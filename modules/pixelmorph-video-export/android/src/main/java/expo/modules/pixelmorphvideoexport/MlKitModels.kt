package expo.modules.pixelmorphvideoexport

import android.content.Context
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.OptionalModuleApi
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate

/**
 * ML Kit's models come through Google Play services the first time they are used. This gets one
 * ready, or says why it cannot be; after that the work happens on the device, with no connection.
 */
object MlKitModels {
  fun hasPlayServices(context: Context): Boolean =
    GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

  fun whenReady(context: Context, api: OptionalModuleApi, onReady: () -> Unit, onFail: (Exception?) -> Unit) {
    val modules = ModuleInstall.getClient(context)
    modules.areModulesAvailable(api)
      .addOnSuccessListener { state ->
        if (state.areModulesAvailable()) {
          onReady()
          return@addOnSuccessListener
        }
        lateinit var listener: InstallStatusListener
        listener = InstallStatusListener { update ->
          when (update.installState) {
            ModuleInstallStatusUpdate.InstallState.STATE_COMPLETED -> {
              modules.unregisterListener(listener)
              onReady()
            }
            ModuleInstallStatusUpdate.InstallState.STATE_FAILED,
            ModuleInstallStatusUpdate.InstallState.STATE_CANCELED -> {
              modules.unregisterListener(listener)
              onFail(null)
            }
            else -> Unit
          }
        }
        val request = ModuleInstallRequest.newBuilder().addApi(api).setListener(listener).build()
        modules.installModules(request)
          .addOnSuccessListener { if (it.areModulesAlreadyInstalled()) onReady() }
          .addOnFailureListener { onFail(it) }
      }
      .addOnFailureListener { onFail(it) }
  }
}
