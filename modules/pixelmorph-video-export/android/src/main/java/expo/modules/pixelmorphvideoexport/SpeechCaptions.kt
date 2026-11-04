package expo.modules.pixelmorphvideoexport

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import expo.modules.kotlin.Promise
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteOrder
import java.security.MessageDigest

/**
 * RF-069: what is said in a clip, with times. The model is fetched once, on request; the audio is
 * read and heard on the device and never leaves it. Errors carry a code the editor translates.
 */
object SpeechCaptions {
  // whisper.cpp's multilingual tiny model and the hash its models/README.md publishes.
  private const val MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
  private const val MODEL_SHA1 = "bd577a113a864445d4c299885e0cb97d4ba92b5f"
  private const val SAMPLE_RATE = 16000
  private const val MAX_MS = 30L * 60 * 1000
  private const val MAX_THREADS = 4

  @Volatile private var cancelled = false
  @Volatile private var nativeLoaded = false

  private class Stop(val code: String) : Exception(code)

  private fun modelFile(context: Context) = File(context.filesDir, "models/ggml-tiny.bin")

  fun modelReady(context: Context) = modelFile(context).exists()

  fun cancel() {
    cancelled = true
    if (nativeLoaded) WhisperNative.cancel()
  }

  fun run(
    context: Context,
    uri: String,
    inMs: Long,
    outMs: Long,
    progress: (stage: String, percent: Int) -> Unit,
    promise: Promise
  ) {
    cancelled = false
    Thread {
      try {
        if (outMs - inMs > MAX_MS) throw Stop("TOO_LONG")
        val model = modelFile(context)
        if (!model.exists()) download(model) { progress("model", it) }
        progress("audio", 0)
        val samples = readSpeech(context, uri, inMs, outMs)
        promise.resolve(transcribe(model, samples) { progress("speech", it) })
      } catch (e: Stop) {
        promise.reject(e.code, e.code, e)
      } catch (e: java.io.IOException) {
        promise.reject("NETWORK", "NETWORK", e)
      } catch (e: UnsatisfiedLinkError) {
        promise.reject("NO_ENGINE", "NO_ENGINE", e)
      } catch (e: Exception) {
        promise.reject("FAILED", e.message ?: "FAILED", e)
      }
    }.start()
  }

  private fun download(target: File, progress: (Int) -> Unit) {
    target.parentFile?.mkdirs()
    val part = File(target.path + ".part")
    val connection = URL(MODEL_URL).openConnection() as HttpURLConnection
    try {
      val total = connection.contentLengthLong
      val digest = MessageDigest.getInstance("SHA-1")
      connection.inputStream.use { input ->
        part.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          var read = 0L
          var shown = -1
          while (true) {
            if (cancelled) throw Stop("CANCELLED")
            val n = input.read(buffer)
            if (n < 0) break
            output.write(buffer, 0, n)
            digest.update(buffer, 0, n)
            read += n
            val percent = if (total > 0) (read * 100 / total).toInt() else 0
            if (percent != shown) {
              shown = percent
              progress(percent)
            }
          }
        }
      }
      val hash = digest.digest().joinToString("") { "%02x".format(it) }
      if (hash != MODEL_SHA1) throw Stop("BAD_MODEL")
      if (!part.renameTo(target)) throw java.io.IOException("Could not keep the model.")
    } finally {
      part.delete()
      connection.disconnect()
    }
  }

  private fun transcribe(model: File, samples: FloatArray, progress: (Int) -> Unit): List<Map<String, Any>> {
    nativeLoaded = true
    WhisperNative.reset()
    if (cancelled) throw Stop("CANCELLED")
    val segments = ArrayList<Map<String, Any>>()
    val listener = object : WhisperNative.Listener {
      override fun onSegment(startMs: Long, endMs: Long, text: ByteArray) {
        segments.add(mapOf("startMs" to startMs.toDouble(), "endMs" to endMs.toDouble(), "text" to String(text, Charsets.UTF_8)))
      }

      override fun onProgress(percent: Int) = progress(percent)
    }
    val threads = Runtime.getRuntime().availableProcessors().coerceIn(1, MAX_THREADS)
    when (WhisperNative.transcribe(model.path, samples, threads, listener)) {
      0 -> return segments
      1 -> throw Stop("CANCELLED")
      2 -> {
        // A model that does not load will not load next time either: fetch it again.
        model.delete()
        throw Stop("BAD_MODEL")
      }
      else -> throw Stop("FAILED")
    }
  }

  /** The clip's sound as whisper wants it: 16 kHz mono, from inMs to outMs of the file. */
  private fun readSpeech(context: Context, uri: String, inMs: Long, outMs: Long): FloatArray {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(context, Uri.parse(uri), null)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: throw Stop("NO_AUDIO")
      extractor.selectTrack(track)
      extractor.seekTo(inMs * 1000, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      val input = extractor.getTrackFormat(track)
      codec = MediaCodec.createDecoderByType(input.getString(MediaFormat.KEY_MIME)!!)
      codec.configure(input, null, null, 0)
      codec.start()

      val out = FloatArray(((outMs - inMs) * SAMPLE_RATE / 1000).toInt())
      var written = 0
      var channels = input.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      var rate = input.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var isFloat = false
      // Averaging into each output sample also keeps what is above speech from folding back in.
      var sum = 0f
      var summed = 0
      var phase = 0
      val info = MediaCodec.BufferInfo()
      var inputDone = false
      while (written < out.size) {
        if (cancelled) throw Stop("CANCELLED")
        if (!inputDone) {
          val slot = codec.dequeueInputBuffer(10_000)
          if (slot >= 0) {
            val size = extractor.readSampleData(codec.getInputBuffer(slot)!!, 0)
            if (size < 0) {
              codec.queueInputBuffer(slot, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              codec.queueInputBuffer(slot, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }
        val slot = codec.dequeueOutputBuffer(info, 10_000)
        if (slot == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          val format = codec.outputFormat
          channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          isFloat = format.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
            format.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
        } else if (slot >= 0) {
          val bytes = codec.getOutputBuffer(slot)!!.order(ByteOrder.nativeOrder())
          val floats = if (isFloat) bytes.asFloatBuffer() else null
          val shorts = if (isFloat) null else bytes.asShortBuffer()
          val frames = (floats?.remaining() ?: shorts!!.remaining()) / channels
          // The sound may start after the clip's in-point: the gap stays silent, and times stay true.
          val firstFrame = ((inMs * 1000 - info.presentationTimeUs) * rate / 1_000_000).coerceAtLeast(0)
          if (written == 0 && info.presentationTimeUs > inMs * 1000) {
            written = (((info.presentationTimeUs - inMs * 1000) * SAMPLE_RATE / 1_000_000).toInt()).coerceAtMost(out.size)
          }
          var frame = firstFrame.toInt()
          while (frame < frames && written < out.size) {
            var mono = 0f
            for (c in 0 until channels) {
              val at = frame * channels + c
              mono += floats?.get(at) ?: (shorts!!.get(at) / 32768f)
            }
            sum += mono / channels
            summed += 1
            phase += SAMPLE_RATE
            if (phase >= rate) {
              phase -= rate
              out[written++] = sum / summed
              sum = 0f
              summed = 0
            }
            frame += 1
          }
          val ended = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
          codec.releaseOutputBuffer(slot, false)
          if (ended) break
        }
      }
      return if (written == out.size) out else out.copyOf(written)
    } finally {
      codec?.stop()
      codec?.release()
      extractor.release()
    }
  }
}
