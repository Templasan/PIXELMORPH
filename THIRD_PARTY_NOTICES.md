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

MPL-2.0 note: mediabunny is not modified; if it is ever patched, the patched files must be
published under MPL-2.0.
