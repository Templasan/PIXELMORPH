package expo.modules.pixelmorphvideoexport

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.OverlaySettings
import androidx.media3.common.VideoCompositorSettings
import androidx.media3.common.util.Size
import androidx.media3.effect.StaticOverlaySettings
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
    val composition = if (options.overlays.isEmpty()) {
      val items = options.clips.map { buildItem(it) }
      val sequence = EditedMediaItemSequence.Builder(*items.toTypedArray()).build()
      Composition.Builder(sequence)
        .setEffects(Effects(emptyList(), listOf<Effect>(fit)))
        .build()
    } else {
      buildWithTransitions(options, fit)
    }

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

  /**
   * Two layers: sequence 0 is the timeline, sequence 1 holds a still of the outgoing clip at each
   * transition (gaps in between). The compositor draws sequence 1 over sequence 0 and moves,
   * fades or scales it away while the transition runs; elsewhere it is fully transparent.
   * Both layers are scaled to the output size first, so they line up.
   */
  private fun buildWithTransitions(options: ExportOptions, fit: Presentation): Composition {
    val mainItems = options.clips.map { buildItem(it, fit) }
    val main = EditedMediaItemSequence.Builder(*mainItems.toTypedArray())
      .experimentalSetForceVideoTrack(true)
      .build()

    val overlay = EditedMediaItemSequence.Builder(setOf(androidx.media3.common.C.TRACK_TYPE_VIDEO))
    var cursorMs = 0L
    options.overlays.sortedBy { it.startMs }.forEach { o ->
      val gap = o.startMs - cursorMs
      if (gap > 0) overlay.addGap(gap * 1000)
      overlay.addItem(
        buildItem(
          ExportClip(uri = o.uri, kind = "image", holdMs = o.durationMs, rotation = o.rotation),
          fit
        )
      )
      cursorMs = o.startMs + o.durationMs
    }

    return Composition.Builder(main, overlay.build())
      .setVideoCompositorSettings(TransitionCompositor(options))
      .build()
  }

  /** Output size is fixed; layer 1 is animated inside the transition windows and hidden outside. */
  private class TransitionCompositor(private val options: ExportOptions) : VideoCompositorSettings {
    private val windows = options.overlays.map { Triple(it.startMs * 1000, (it.startMs + it.durationMs) * 1000, it) }

    override fun getOutputSize(inputSizes: List<Size>): Size = Size(options.width, options.height)

    override fun getOverlaySettings(inputId: Int, presentationTimeUs: Long): OverlaySettings {
      if (inputId == 0) return StaticOverlaySettings.Builder().build()

      val window = windows.firstOrNull { presentationTimeUs >= it.first && presentationTimeUs < it.second }
        ?: return StaticOverlaySettings.Builder().setAlphaScale(0f).build()
      val p = ((presentationTimeUs - window.first).toFloat() / (window.second - window.first)).coerceIn(0f, 1f)
      val builder = StaticOverlaySettings.Builder()
      when (window.third.type) {
        // The outgoing frame leaves: p goes 0 -> 1 as it fades, slides out or shrinks away.
        "slide" -> builder.setBackgroundFrameAnchor(-2f * p, 0f)
        "wipe" -> builder.setBackgroundFrameAnchor(2f * p, 0f)
        "zoom" -> builder.setAlphaScale(1f - p).setScale(1f + 0.15f * p, 1f + 0.15f * p)
        else -> builder.setAlphaScale(1f - p)
      }
      return builder.build()
    }
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

    if (fit != null) videoEffects.add(fit)

    return EditedMediaItem.Builder(mediaItem)
      .setEffects(Effects(audioProcessors, videoEffects))
      .apply { if (isImage) setFrameRate(30) }
      .build()
  }
}
