package expo.modules.pixelmorphvideoexport

/** The compiled whisper.cpp. Its callbacks arrive on the thread that called transcribe. */
object WhisperNative {
  init {
    System.loadLibrary("pmwhisper")
  }

  interface Listener {
    fun onSegment(startMs: Long, endMs: Long, text: ByteArray)
    fun onProgress(percent: Int)
  }

  external fun reset()
  external fun cancel()
  external fun transcribe(modelPath: String, samples: FloatArray, threads: Int, listener: Listener): Int
}
