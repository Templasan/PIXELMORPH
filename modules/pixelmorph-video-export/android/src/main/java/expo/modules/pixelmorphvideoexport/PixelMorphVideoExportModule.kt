package expo.modules.pixelmorphvideoexport

import android.graphics.Bitmap
import android.graphics.Matrix
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.effect.MatrixTransformation
import androidx.media3.effect.Presentation
import androidx.media3.effect.RgbMatrix
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
 * Joins, trims, speeds up/slows down, rotates and applies simple transitions to the editor
 * clips, into one H.264/AAC mp4 with Google Media3 Transformer (hardware encoder, no FFmpeg).
 * Transformer has to be driven from a thread with a Looper, so everything is started on the
 * main looper; the encoding itself runs on Media3 own threads.
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

    // Exact frame at `timeMs` as a JPEG in the cache dir. expo-video-thumbnails seeks with
    // OPTION_CLOSEST_SYNC (keyframes only), so frames of a clip with sparse keyframes all came
    // out identical; OPTION_CLOSEST decodes up to the requested instant.
    AsyncFunction("extractFrame") { uri: String, timeMs: Long, maxWidth: Int, promise: Promise ->
      Thread {
        val retriever = MediaMetadataRetriever()
        try {
          retriever.setDataSource(context, Uri.parse(uri))
          val timeUs = timeMs * 1000
          val raw = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
            ?: throw IllegalStateException("No frame at $timeMs ms")
          val frame = if (maxWidth > 0 && raw.width > maxWidth) {
            val height = (raw.height.toLong() * maxWidth / raw.width).toInt().coerceAtLeast(1)
            Bitmap.createScaledBitmap(raw, maxWidth, height, true).also { raw.recycle() }
          } else {
            raw
          }
          val file = File.createTempFile("pm_frame_", ".jpg", context.cacheDir)
          file.outputStream().use { frame.compress(Bitmap.CompressFormat.JPEG, 85, it) }
          promise.resolve(
            mapOf("uri" to Uri.fromFile(file).toString(), "width" to frame.width, "height" to frame.height)
          )
        } catch (error: Throwable) {
          promise.reject("ERR_EXTRACT_FRAME", error.message ?: "Could not extract frame", error)
        } finally {
          retriever.release()
        }
      }.start()
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

    val fit = Presentation.createForWidthAndHeight(
      options.width,
      options.height,
      Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP
    )
    val items = options.clips.map { buildItem(it, fit) }
    // Clips may or may not carry audio (a screen recording has none, a camera clip does);
    // forcing the track makes the silent ones export as silence instead of failing.
    val sequence = EditedMediaItemSequence.Builder(*items.toTypedArray())
      .experimentalSetForceAudioTrack(true)
      .build()
    val composition = Composition.Builder(sequence).build()

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
          Log.e("PixelMorphExport", "export failed", exportException)
          // The top-level message ("Video frame processing error") hides the real reason.
          val root = generateSequence<Throwable>(exportException) { it.cause }.last()
          promise.reject(
            "ERR_VIDEO_EXPORT",
            "${exportException.message}: ${root.javaClass.simpleName} ${root.message ?: ""}".trim(),
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

  /**
   * Transitions are applied inside each clip with per-frame effects (no second video layer):
   * the clip leaving darkens, the clip arriving comes up from black and, depending on the type,
   * slides in or grows. Frame times passed to the effects are on the whole timeline, so each clip subtracts its own start. These are
   * simplified transitions: the two clips are not shown crossing over each other.
   */
  private fun transitionEffects(clip: ExportClip): List<Effect> {
    val effects = mutableListOf<Effect>()
    val inUs = clip.transitionInMs * 1000
    val outUs = clip.fadeOutMs * 1000
    val totalUs = clip.outputMs * 1000
    // Effects receive time on the whole timeline (not restarting at 0 for each clip).
    val startUs = clip.startMs * 1000
    val hasIn = clip.transitionIn.isNotEmpty() && inUs > 0
    val hasOut = outUs > 0 && totalUs > 0

    if (hasIn && (clip.transitionIn == "slide" || clip.transitionIn == "wipe")) {
      val fromRight = clip.transitionIn == "slide"
      effects.add(MatrixTransformation { t ->
        val p = ((t - startUs).toFloat() / inUs).coerceIn(0f, 1f)
        val eased = 1f - (1f - p) * (1f - p)
        Matrix().apply { postTranslate((if (fromRight) 2f else -2f) * (1f - eased), 0f) }
      })
    } else if (hasIn && clip.transitionIn == "zoom") {
      effects.add(MatrixTransformation { t ->
        val p = ((t - startUs).toFloat() / inUs).coerceIn(0f, 1f)
        val scale = 0.7f + 0.3f * p
        Matrix().apply { postScale(scale, scale) }
      })
    }

    // Brightness ramp: 0 -> 1 while a "fade"/"zoom" arrives, and 1 -> 0 while the clip leaves.
    val rampsIn = hasIn && (clip.transitionIn == "fade" || clip.transitionIn == "zoom")
    if (rampsIn || hasOut) {
      effects.add(object : RgbMatrix {
        override fun getMatrix(presentationTimeUs: Long, useHdr: Boolean): FloatArray {
          val local = presentationTimeUs - startUs
          var k = 1f
          if (rampsIn) k *= (local.toFloat() / inUs).coerceIn(0f, 1f)
          if (hasOut) k *= ((totalUs - local).toFloat() / outUs).coerceIn(0f, 1f)
          // 4x4 column-major: scale R, G and B, keep alpha.
          return floatArrayOf(k, 0f, 0f, 0f, 0f, k, 0f, 0f, 0f, 0f, k, 0f, 0f, 0f, 0f, 1f)
        }
      })
    }
    return effects
  }

  private fun buildItem(clip: ExportClip, fit: Presentation? = null): EditedMediaItem {
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
    // Fit to the output size first, so the slide/zoom moves the frame the viewer sees.
    if (fit != null) videoEffects.add(fit)
    videoEffects.addAll(transitionEffects(clip))

    return EditedMediaItem.Builder(mediaItem)
      .setEffects(Effects(audioProcessors, videoEffects))
      .apply { if (isImage) setFrameRate(30) }
      .build()
  }
}
