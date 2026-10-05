package expo.modules.pixelmorphvideoexport

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.AudioProcessor.UnhandledAudioFormatException
import androidx.media3.common.audio.BaseAudioProcessor
import java.nio.ByteBuffer

/** Constant volume plus linear fade in/out over a clip of [durationMs]; 16-bit PCM only (what Transformer feeds). */
class GainAudioProcessor(
  private val volume: Float,
  private val fadeInMs: Long,
  private val fadeOutMs: Long,
  private val durationMs: Long
) : BaseAudioProcessor() {
  private var frame = 0L

  override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
      throw UnhandledAudioFormatException(inputAudioFormat)
    }
    return inputAudioFormat
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    val out = replaceOutputBuffer(inputBuffer.remaining())
    val channels = inputAudioFormat.channelCount
    val rate = inputAudioFormat.sampleRate
    while (inputBuffer.remaining() >= 2 * channels) {
      val ms = frame * 1000.0 / rate
      var factor = 1.0
      if (fadeInMs > 0 && ms < fadeInMs) factor = minOf(factor, ms / fadeInMs)
      if (fadeOutMs > 0 && ms > durationMs - fadeOutMs) factor = minOf(factor, (durationMs - ms) / fadeOutMs)
      val g = volume * factor.coerceIn(0.0, 1.0)
      repeat(channels) {
        out.putShort((inputBuffer.getShort() * g).toInt().coerceIn(-32768, 32767).toShort())
      }
      frame++
    }
    out.flip()
  }

  override fun onFlush() {
    frame = 0
  }
}
