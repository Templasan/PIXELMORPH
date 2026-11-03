package expo.modules.pixelmorphvideoexport

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import java.io.File
import java.io.FileOutputStream

/**
 * RF-004: writes a PNG of a photo's main subject, transparent everywhere else. The picture is read
 * on the device and never sent anywhere; only the model comes from Google Play services, the first
 * time, which is why this can ask for a download and can fail on phones without them.
 */
object SubjectCutout {
  fun run(context: Context, inputUri: String, outputPath: String, promise: Promise) {
    val availability = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)
    if (availability != ConnectionResult.SUCCESS) {
      promise.reject("NO_PLAY_SERVICES", "Google Play services is not available.", null)
      return
    }
    val options = SubjectSegmenterOptions.Builder().enableForegroundBitmap().build()
    val segmenter = SubjectSegmentation.getClient(options)
    val fail = { code: String, error: Exception? ->
      segmenter.close()
      promise.reject(code, error?.message ?: code, error)
    }
    val segment = {
      try {
        val image = InputImage.fromFilePath(context, Uri.parse(inputUri))
        segmenter.process(image)
          .addOnSuccessListener { result ->
            val foreground = result.foregroundBitmap
            segmenter.close()
            if (foreground == null || !hasPixels(foreground)) {
              promise.reject("NO_SUBJECT", "No subject found.", null)
              return@addOnSuccessListener
            }
            // A PNG of a large photo takes a moment: not on the thread that draws the app.
            Thread {
              try {
                File(outputPath).parentFile?.mkdirs()
                FileOutputStream(outputPath).use { foreground.compress(Bitmap.CompressFormat.PNG, 100, it) }
                promise.resolve(
                  mapOf("uri" to Uri.fromFile(File(outputPath)).toString(), "width" to foreground.width, "height" to foreground.height)
                )
              } catch (e: Exception) {
                promise.reject("WRITE_FAILED", e.message, e)
              }
            }.start()
          }
          .addOnFailureListener { fail("SEGMENT_FAILED", it) }
      } catch (e: Exception) {
        fail("READ_FAILED", e)
      }
    }

    val modules = ModuleInstall.getClient(context)
    modules.areModulesAvailable(segmenter)
      .addOnSuccessListener { state ->
        if (state.areModulesAvailable()) {
          segment()
          return@addOnSuccessListener
        }
        lateinit var listener: InstallStatusListener
        listener = InstallStatusListener { update ->
          when (update.installState) {
            ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED -> {
              modules.unregisterListener(listener)
              segment()
            }
            ModuleInstallStatusUpdate.InstallState.STATE_FAILED,
            ModuleInstallStatusUpdate.InstallState.STATE_CANCELED -> {
              modules.unregisterListener(listener)
              fail("MODEL_DOWNLOAD_FAILED", null)
            }
            else -> Unit
          }
        }
        val request = ModuleInstallRequest.newBuilder().addApi(segmenter).setListener(listener).build()
        modules.installModules(request)
          .addOnSuccessListener { if (it.areModulesAlreadyInstalled()) segment() }
          .addOnFailureListener { fail("MODEL_DOWNLOAD_FAILED", it) }
      }
      .addOnFailureListener { fail("MODEL_DOWNLOAD_FAILED", it) }
  }

  /** The segmenter answers with an empty picture when it finds nothing to cut out. */
  private fun hasPixels(bitmap: Bitmap): Boolean {
    val row = IntArray(bitmap.width)
    val step = maxOf(1, bitmap.height / 64)
    for (y in 0 until bitmap.height step step) {
      bitmap.getPixels(row, 0, bitmap.width, 0, y, bitmap.width, 1)
      if (row.any { (it ushr 24) != 0 }) return true
    }
    return false
  }
}
