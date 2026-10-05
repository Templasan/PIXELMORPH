package expo.modules.pixelmorphvideoexport

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
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
import androidx.media3.common.OverlaySettings
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.effect.StaticOverlaySettings
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
 * Joins, trims, speeds up/slows down, rotates and cross-blends clips with transitions to the editor
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

    // Rotation tag of a video file (0, 90, 180 or 270): how it was recorded, which the player and
    // the exporter already apply. Null when the file cannot be read.
    AsyncFunction("probeRotation") { uri: String, promise: Promise ->
      Thread {
        val retriever = MediaMetadataRetriever()
        try {
          retriever.setDataSource(context, Uri.parse(uri))
          val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
          promise.resolve(rotation?.toIntOrNull())
        } catch (error: Throwable) {
          promise.resolve(null)
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
    val items = options.clips.map { buildItem(it, fit, options.width, options.height) }
    // Clips may or may not carry audio (a screen recording has none, a camera clip does);
    // forcing the track makes the silent ones export as silence instead of failing.
    val sequence = EditedMediaItemSequence.Builder(*items.toTypedArray())
      .experimentalSetForceAudioTrack(true)
      .build()
    val sequences = mutableListOf(sequence)
    if (options.audio.isNotEmpty()) {
      val audioBuilder = EditedMediaItemSequence.Builder().setIsLooping(false)
      var cursorMs = 0L
      for (a in options.audio) {
        if (a.startMs > cursorMs) audioBuilder.addGap((a.startMs - cursorMs) * 1000)
        audioBuilder.addItem(buildAudioItem(a))
        cursorMs = a.startMs + (a.outMs - a.inMs)
      }
      sequences.add(audioBuilder.build())
    }
    val composition = Composition.Builder(sequences).build()

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
   * A transition is the last frame of the clip that leaves, laid over the first moments of the
   * clip that arrives (a Media3 bitmap overlay on the incoming clip, so it is a true cross: the
   * incoming video plays underneath while the old frame fades, slides or grows away). The old
   * clip is frozen on its last frame for the duration, as in the editor preview.
   * Frame times passed to the overlay are on the whole timeline, so each clip subtracts its start.
   */
  private fun transitionEffects(clip: ExportClip, width: Int, height: Int): List<Effect> {
    val inUs = clip.transitionInMs * 1000
    if (clip.transitionIn.isEmpty() || inUs <= 0 || clip.transitionFrameUri.isEmpty()) {
      return emptyList()
    }
    val frame = outgoingFrame(clip, width, height) ?: return emptyList()
    val startUs = clip.startMs * 1000
    val type = clip.transitionIn

    val overlay = object : BitmapOverlay() {
      override fun getBitmap(presentationTimeUs: Long): Bitmap = frame

      override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings {
        val p = ((presentationTimeUs - startUs).toFloat() / inUs).coerceIn(0f, 1f)
        val builder = StaticOverlaySettings.Builder()
        when (type) {
          // The old frame is pushed out to the left (slide) or the right (wipe). Anchors only
          // accept -1..1, so the frame's trailing edge travels across the whole output instead.
          "slide" -> builder.setOverlayFrameAnchor(1f, 0f).setBackgroundFrameAnchor(1f - 2f * p, 0f)
          "wipe" -> builder.setOverlayFrameAnchor(-1f, 0f).setBackgroundFrameAnchor(2f * p - 1f, 0f)
          "zoom" -> builder.setAlphaScale(1f - p).setScale(1f + 0.3f * p, 1f + 0.3f * p)
          else -> builder.setAlphaScale(1f - p)
        }
        return builder.build()
      }
    }
    return listOf(OverlayEffect(listOf(overlay)))
  }

  /** The leaving clip's frame, turned by its editor rotation and cropped to the output size. */
  private fun outgoingFrame(clip: ExportClip, width: Int, height: Int): Bitmap? {
    val path = Uri.parse(clip.transitionFrameUri).path ?: return null
    val raw = BitmapFactory.decodeFile(path) ?: return null
    val turned = if (clip.transitionFrameRotation != 0) {
      Bitmap.createBitmap(
        raw, 0, 0, raw.width, raw.height,
        Matrix().apply { postRotate(clip.transitionFrameRotation.toFloat()) }, true
      )
    } else {
      raw
    }
    val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val scale = maxOf(width.toFloat() / turned.width, height.toFloat() / turned.height)
    val dx = (width - turned.width * scale) / 2f
    val dy = (height - turned.height * scale) / 2f
    Canvas(out).drawBitmap(
      turned,
      Matrix().apply { postScale(scale, scale); postTranslate(dx, dy) },
      Paint(Paint.FILTER_BITMAP_FLAG)
    )
    return out
  }

  /** An audio-only item: trimmed, with the clip's volume and fades applied by [GainAudioProcessor]. */
  private fun buildAudioItem(a: ExportAudioClip): EditedMediaItem {
    val mediaItem = MediaItem.Builder()
      .setUri(Uri.parse(a.uri))
      .setClippingConfiguration(
        MediaItem.ClippingConfiguration.Builder()
          .setStartPositionMs(a.inMs)
          .setEndPositionMs(a.outMs)
          .build()
      )
      .build()
    val gain = GainAudioProcessor(a.volume.toFloat(), a.fadeInMs, a.fadeOutMs, a.outMs - a.inMs)
    return EditedMediaItem.Builder(mediaItem)
      .setRemoveVideo(true)
      .setEffects(Effects(listOf<AudioProcessor>(gain), emptyList()))
      .build()
  }

  private fun buildItem(
    clip: ExportClip,
    fit: Presentation? = null,
    width: Int = 0,
    height: Int = 0
  ): EditedMediaItem {
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
    if (!isImage && clip.volume != 1.0) {
      audioProcessors.add(GainAudioProcessor(clip.volume.toFloat(), 0, 0, clip.outMs - clip.inMs))
    }
    // Fit to the output size first, so the slide/zoom moves the frame the viewer sees.
    if (fit != null) videoEffects.add(fit)
    if (fit != null) videoEffects.addAll(transitionEffects(clip, width, height))

    return EditedMediaItem.Builder(mediaItem)
      .setEffects(Effects(audioProcessors, videoEffects))
      .apply { if (isImage) setFrameRate(30) }
      .build()
  }
}
