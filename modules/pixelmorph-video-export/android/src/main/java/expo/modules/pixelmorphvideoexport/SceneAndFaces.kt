package expo.modules.pixelmorphvideoexport

import android.content.Context
import android.graphics.PointF
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import expo.modules.kotlin.Promise

/** RF-034 and RF-016: what a photo shows and where its faces are, read on the device. */
object SceneAndFaces {
  /** Below this a label is mostly noise, and the scene is worked out from what is left. */
  private const val MIN_LABEL_CONFIDENCE = 0.5f
  private const val MIN_FACE_SIZE = 0.08f

  fun labels(context: Context, uri: String, promise: Promise) {
    if (!MlKitModels.hasPlayServices(context)) {
      promise.reject("NO_PLAY_SERVICES", "Google Play services is not available.", null)
      return
    }
    val options = ImageLabelerOptions.Builder().setConfidenceThreshold(MIN_LABEL_CONFIDENCE).build()
    val labeler = ImageLabeling.getClient(options)
    val fail = { code: String, e: Exception? ->
      labeler.close()
      promise.reject(code, e?.message ?: code, e)
    }
    MlKitModels.whenReady(context, labeler, {
      try {
        labeler.process(InputImage.fromFilePath(context, Uri.parse(uri)))
          .addOnSuccessListener { found ->
            labeler.close()
            promise.resolve(found.map { mapOf("text" to it.text, "confidence" to it.confidence.toDouble()) })
          }
          .addOnFailureListener { fail("LABEL_FAILED", it) }
      } catch (e: Exception) {
        fail("READ_FAILED", e)
      }
    }, { fail("MODEL_DOWNLOAD_FAILED", it) })
  }

  fun faces(context: Context, uri: String, promise: Promise) {
    if (!MlKitModels.hasPlayServices(context)) {
      promise.reject("NO_PLAY_SERVICES", "Google Play services is not available.", null)
      return
    }
    // Landmarks, not contours: ML Kit gives contours for only the most prominent face.
    val options = FaceDetectorOptions.Builder()
      .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
      .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
      .setMinFaceSize(MIN_FACE_SIZE)
      .build()
    val detector = FaceDetection.getClient(options)
    val fail = { code: String, e: Exception? ->
      detector.close()
      promise.reject(code, e?.message ?: code, e)
    }
    MlKitModels.whenReady(context, detector, {
      try {
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        val w = image.width.toFloat()
        val h = image.height.toFloat()
        val point = { p: PointF? -> p?.let { mapOf("x" to (it.x / w).toDouble(), "y" to (it.y / h).toDouble()) } }
        detector.process(image)
          .addOnSuccessListener { found ->
            detector.close()
            promise.resolve(
              found.map { f ->
                val at = { type: Int -> point(f.getLandmark(type)?.position) }
                mapOf(
                  "x" to (f.boundingBox.left / w).toDouble(),
                  "y" to (f.boundingBox.top / h).toDouble(),
                  "w" to (f.boundingBox.width() / w).toDouble(),
                  "h" to (f.boundingBox.height() / h).toDouble(),
                  "leftEye" to at(FaceLandmark.LEFT_EYE),
                  "rightEye" to at(FaceLandmark.RIGHT_EYE),
                  "mouthLeft" to at(FaceLandmark.MOUTH_LEFT),
                  "mouthRight" to at(FaceLandmark.MOUTH_RIGHT),
                  "mouthBottom" to at(FaceLandmark.MOUTH_BOTTOM)
                )
              }
            )
          }
          .addOnFailureListener { fail("FACES_FAILED", it) }
      } catch (e: Exception) {
        fail("READ_FAILED", e)
      }
    }, { fail("MODEL_DOWNLOAD_FAILED", it) })
  }
}
