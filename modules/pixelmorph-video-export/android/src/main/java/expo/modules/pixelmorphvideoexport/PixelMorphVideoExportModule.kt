package expo.modules.pixelmorphvideoexport

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.effect.Presentation
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.effect.SpeedChangeEffect
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Joins, trims, speeds up/slows down and rotates the editor clips into one H.264/AAC mp4 with
 * Google Media3 Transformer (hardware encoder, no FFmpeg). Transformer has to be driven from a
 * thread with a Looper, so everything is started on the main looper; the encoding itself runs
 * on Media3 own threads.
 */
class PixelMorphVideoExportModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val main = Handler(Looper.getMainLooper())
  private var current: Transformer? = null

  override fun definition() = ModuleDefinition {
    Name("PixelMorphVideoExport")

    Events("onProgress")

    AsyncFunction("exportVideo") { options: ExportOptions, promise: Promise ->
      main.post {
        try {
          start(options, promise)
        } catch (error: Throwable) {
          promise.reject("ERR_VIDEO_EXPORT", error.message ?: "Video export failed", error)
        }
      }
    }

    Function("cancel") {
      main.post {
        current?.cancel()
        current = null
      }
    }
  }

  private fun start(options: ExportOptions, promise: Promise) {
    if (options.clips.isEmpty()) {
      promise.reject("ERR_VIDEO_EXPORT", "Nothing to export", null)
      return
    }

    val items = options.clips.map { buildItem(it) }
    val sequence = EditedMediaItemSequence.Builder(*items.toTypedArray()).build()
    val frameEffects = listOf<Effect>(
      Presentation.createForWidthAndHeight(
        options.width,
        options.height,
        Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP
      )
    )
    val composition = Composition.Builder(sequence)
      .setEffects(Effects(emptyList(), frameEffects))
      .build()

    val encoderFactory = DefaultEncoderFactory.Builder(context)
      .apply {
        if (options.bitrate > 0) {
          setRequestedVideoEncoderSettings(
            VideoEncoderSettings.Builder().setBitrate(options.bitrate).build()
          )
        }
      }
      .build()

    val outputFile = File(options.outputPath)
    outputFile.parentFile?.mkdirs()
    if (outputFile.exists()) outputFile.delete()

    var finished = false
    val transformer = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .setEncoderFactory(encoderFactory)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          finished = true
          current = null
          promise.resolve(
            ExportResultRecord(
              uri = Uri.fromFile(outputFile).toString(),
              sizeBytes = outputFile.length(),
              durationMs = exportResult.approximateDurationMs
            )
          )
        }

        override fun onError(
          composition: Composition,
          exportResult: ExportResult,
          exportException: ExportException
        ) {
          finished = true
          current = null
          promise.reject(
            "ERR_VIDEO_EXPORT",
            exportException.message ?: "Video export failed",
            exportException
          )
        }
      })
      .build()

    current = transformer
    transformer.start(composition, options.outputPath)

    val holder = ProgressHolder()
    val poll = object : Runnable {
      override fun run() {
        if (finished) return
        if (transformer.getProgress(holder) != Transformer.PROGRESS_STATE_NOT_STARTED) {
          sendEvent("onProgress", mapOf("progress" to holder.progress))
        }
        main.postDelayed(this, 250)
      }
    }
    main.postDelayed(poll, 250)
  }

  private fun buildItem(clip: ExportClip): EditedMediaItem {
    val isImage = clip.kind == "image"
    val mediaItem = MediaItem.Builder()
      .setUri(Uri.parse(clip.uri))
      .apply {
        if (isImage) {
          setImageDurationMs(clip.holdMs)
        } else {
          setClippingConfiguration(
            MediaItem.ClippingConfiguration.Builder()
              .setStartPositionMs(clip.inMs)
              .setEndPositionMs(clip.outMs)
              .build()
          )
        }
      }
      .build()

    val videoEffects = mutableListOf<Effect>()
    val audioProcessors = mutableListOf<AudioProcessor>()

    if (clip.rotation != 0) {
      // Media3 rotates counter-clockwise; the editor rotation is clockwise.
      videoEffects.add(
        ScaleAndRotateTransformation.Builder().setRotationDegrees(-clip.rotation.toFloat()).build()
      )
    }
    if (!isImage && clip.speed != 1.0) {
      videoEffects.add(SpeedChangeEffect(clip.speed.toFloat()))
      audioProcessors.add(SonicAudioProcessor().apply { setSpeed(clip.speed.toFloat()) })
    }

    return EditedMediaItem.Builder(mediaItem)
      .setEffects(Effects(audioProcessors, videoEffects))
      .apply { if (isImage) setFrameRate(30) }
      .build()
  }
}
