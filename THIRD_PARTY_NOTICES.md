# Third-party notices

Libraries added for the web-engine spike (see `docs/spike-webview.md`). Everything else keeps the
licences declared in `package.json` / `package-lock.json`.

| Library | Version | Licence | Source | Use |
| --- | --- | --- | --- | --- |
| mediabunny | 1.61.0 | MPL-2.0 (used unmodified, from npm) | https://github.com/Vanilagy/mediabunny | Demux / WebCodecs decode / encode / MP4 mux inside the WebView |
| react-native-webview | 13.16.1 | MIT | https://github.com/react-native-webview/react-native-webview | The WebView that hosts the Expo DOM component |
| react-dom | 19.2.3 | MIT | https://github.com/facebook/react | Required by Expo DOM components (web bundle) |
| react-native-web | 0.21.x | MIT | https://github.com/necolas/react-native-web | Required by Expo DOM components (web bundle) |
| @expo/metro-runtime | 56.0.x | MIT | https://github.com/expo/expo | Required by Expo DOM components (web bundle) |
| @expo/dom-webview | 56.0.6 | MIT | https://github.com/expo/expo | Expo's own WebView for DOM components (react-native-webview does not work for them, see docs/spike-webview.md) |
| expo-sharing | 56.0.x | MIT | https://github.com/expo/expo | Share a project's file through the Android share sheet |
| reanimated-color-picker | 5.1.x | MIT | https://github.com/alabsi91/reanimated-color-picker | Free colour picker for text and shapes |
| androidx.heifwriter | 1.0.0 | Apache-2.0 | https://developer.android.com/jetpack/androidx/releases/heifwriter | HEIC photo export on Android 9+ (native module) |

MPL-2.0 note: mediabunny is not modified; if it is ever patched, the patched files must be
published under MPL-2.0.
