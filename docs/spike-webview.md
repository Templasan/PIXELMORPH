# Spike: WebCodecs video engine inside a WebView

Branch `spike-webview` (based on `transitions-in-out`). Time-boxed proof of concept: ONE drawing
function (`drawListAt`) drives both the live preview and the frame-by-frame mp4 export, decoded
and encoded with WebCodecs (Mediabunny) in an Expo DOM component. The old editor is untouched
except for one top-bar entry ("Motor web (teste)").

## What was built

| Piece | File |
| --- | --- |
| Pure scene model + `drawListAt` (no DOM/RN/Skia) | `src/modules/video-editor/domain/webScene.ts` |
| Jest tests (gap = black, PiP opacity, text and sticker keyframes, transition at a junction, determinism) | `tests/modules/video-web-scene.test.ts` |
| Engine (canvas, one draw path, playback loop, seek, export, metrics) | `src/app/screens/video-editor/web-engine/engine.ts` |
| Decoder slot (current + 2 decoded ahead, restart on jumps) | `.../web-engine/feed.ts` |
| DOM component (`'use dom'`), props in / function props out | `.../web-engine/WebEngine.tsx` |
| RN host screen (file reads, export file writing, AppState, metrics file) | `src/app/screens/VideoEngineSpikeScreen.tsx` |
| Route + entry button | `RootNavigator.tsx`, `VideoEditorScreen.tsx` (one `Pressable`) |
| Sticker (assets/icon.png inlined as a data URI; bundled assets have no file in release) | `.../web-engine/stickerData.ts` |

Test scenario in `buildSpikeScene`: the project's main sequence from `planSequence` (gaps black, the
4 transitions with their out/in modes through `transitionTransforms`), two PiP video layers (first
project sources, 30 % boxes, one at 70 % opacity, the second offset +5 s), the text "PixelMorph"
(slides in from the left over 0.6 s, then scales 1.0 to 1.2 over its life) and the PNG sticker
(keyframed position and rotation). Audio is NOT handled (gap). Image-track pieces are not drawn
(video and frozen stills only).

## Dependencies the spike needed (beyond the two approved) - lead must decide

Expo DOM components cannot be bundled without these:
- `react-dom` 19.2.3, `react-native-web` ~0.21, `@expo/metro-runtime` ~56.0.21 (all MIT): required
  by the web bundle (`expo export` fails without them).
- `@expo/dom-webview` 56.0.6 (MIT): **react-native-webview does not work for DOM components here.**
  The generated page calls `window.ReactNativeWebView.injectedObjectJson()` synchronously at parse
  time, but react-native-webview 13.16.1 injects it with `evaluateJavascript` after the page has
  started, so the runtime throws ("injectedObjectJson is not a function"). Expo's default WebView
  (`@expo/dom-webview`) works and already enables `allowFileAccess` and `allowFileAccessFromFileURLs`.
  `react-native-webview` stays installed (approved) but is unused by the engine.
All are listed in `THIRD_PARTY_NOTICES.md`.

## File access: what worked

**XHR GET of the `file://` URI with `responseType = 'blob'` into `BlobSource` works** in a release
build (the page is served from `file:///android_asset/www.bundle/...`). It read the app-private
`file:///data/user/0/<pkg>/files/media/...mp4` directly. Cost: 110 ms to open a 40 MB file on the
emulator (blob creation; no copy through JS). The chunk bridge (`readChunk(uri, offset, length)`,
base64 over the WebView bridge into Mediabunny's `StreamSource`, backed by the expo-file-system
`FileHandle`) is implemented as the fallback (button "arquivo: auto/xhr/bridge") but was NOT needed
and was NOT measured; expect it to be much slower. In dev builds (Metro, http origin) XHR to
`file://` is blocked, so `auto` falls back to the bridge there.

## Verified on the emulator (Pixel_7, API 34, WebView 153, software codecs)

CORRECTNESS ONLY. The emulator decodes and encodes in software on the host CPU; none of its numbers
say anything about the phone.

- Env: WebCodecs present; `VideoDecoder.isConfigSupported(avc1.640028, 1080p, prefer-hardware)` true;
  WebGL2 true; WebGPU true.
- Preview: right burnt-in timecode; PiP 1 and 2 in sync with the main layer (PiP 2 = main time +5 s),
  PiP 2 at 70 % opacity, text slides in then grows, sticker moves and rotates.
- Seeks: 20 seeks to fixed pseudo-random times (seed 1234). The last frame was 26.033 s for a 26.048 s
  target (frame at or before), PiP 2 showed 1.033 s ((26.048 + 5) mod 30), as expected. Emulator
  latency mean 2.65 s / p90 7.4 s / max 8.7 s, dominated by software decoding from far keyframes
  (the test files have ~8 s GOPs) times 3 layers.
- Playback (emulator): 27-29 screen fps, 12-23 frames/s per layer, late/dropped counted per layer.
  Meaningless for the phone.
- Export: 20 s, 600 frames, 1920x1080, 24.3 MB, 32-34 s (0.6x realtime; the emulator has no hardware
  encoder, so the engine falls back from prefer-hardware and reports `hardwareEncoder:false`).
  ffprobe: h264 High, 1920x1080, 30 fps, duration 20.000, 600 frames, 9.7 Mbps. Frames 0, 200, 450
  show timecodes 0.000, 6.667, 15.000 with PiPs, text and sticker in the right state. Bytes
  go through `StreamTarget` (4 MB chunks) and are written with `FileHandle.offset` + `writeBytes`
  into the cache dir.
- NOT exercised live: a project with several clips and a transition (transition math is covered by
  Jest only; the draw path is the same), backgrounding during export (`framesWhileBackground` is 0
  until tested on the phone).

## Android 9 (Pixel_API28 AVD, google_apis x86_64)

- The app installs and starts; the video editor works.
- System WebView is **69.0.3497.100**; `typeof VideoDecoder === 'undefined'`.
- The engine cannot start: the DOM bundle dies at load with
  `TypeError: Object.fromEntries is not a function` (before our component runs), so the web side
  cannot show its own message. The RN screen therefore shows, after 10 s without any status, "O
  motor de vídeo precisa do Android System WebView atualizado (o motor não iniciou em 10 s)". No
  crash. (Chrome 69 has no WebCodecs anyway; it arrived in Chrome 94.)
- Below the message, "Atualizar o WebView na Play Store" opens `market://details?id=com.google.android.webview`;
  without a Play Store app (this AVD) it falls back to the same page on play.google.com in the
  browser. Verified on Pixel_API28. Real Android 9 phones update the System WebView through the Play
  Store, so this button is the planned path for them; the old editor stays usable meanwhile.

## Easy / hard

- Easy: the scene model. Keyframes are one small function; animated text and the keyframed sticker
  are just values from `drawListAt` plus `ctx.translate/scale/rotate` (text scales around its centre,
  sticker rotates around its centre). Preview and export call the same `drawOps`, so they matched on
  the first try. Transition transforms were reused as is.
- Hard / time sinks: (1) DOM component prerequisites (4 undeclared packages, WebView choice);
  (2) release builds of this repo from the worktree hit the Windows CMake 250-character path limit,
  so builds were done in a short-path mirror (`C:\sws`, a robocopy of the worktree without `.git`);
  (3) the decoder slot (restart on jumps, prefetch, late/dropped accounting) is the only non-trivial
  code; (4) re-entrancy: tapping Seek twice ran two benches at once (now guarded).

## Risks

- Extra dependencies (above) and a hard requirement on a recent System WebView (WebCodecs = Chrome
  94+, plus a modern JS engine for the Expo web bundle). The stock WebView of Android 9 is not enough.
- The page is a separate JS context: file chunks (fallback), export chunks and metrics cross a JSON
  bridge. XHR avoids it for reads; export bytes still cross it as base64.
- Hardware decoder limits with 3 simultaneous 1080p decoders inside a WebView: exactly what the
  owner's table below must confirm.
- No audio (decode, mix, mux) yet; no image-track pieces; the frozen outgoing transition frame is
  decoded lazily in playback (it may appear a frame or two late).
- The spike screen enables WebView debugging and copies the exported mp4 into the media store.

## Size and effort

Engine (`web-engine/*.ts*` without the inlined sticker): 778 lines (engine 478, WebEngine 165,
feed 135, `wc -l`). Scene model 298, RN screen 225. About 5 hours of agent work (build and
environment problems were a large share).

## Running it and reading the metrics on the phone

1. Release build from a short path (e.g. `C:\pw`):
   `cd android && ./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a`;
   `adb -s <phone> install -r`.
2. Open a video project with 1080p clips, tap "Motor web (teste)" in the editor top bar.
3. Wait for "pronto". Buttons: Play (up to 30 s from the playhead; reports on end/pause), Pause,
   "Seek x20", "Exportar" (first 20 s, 30 fps, ~10 Mbps). "arquivo: auto/xhr/bridge" picks the file
   access method (reloads the engine).
4. Metrics: `adb logcat -s ReactNativeJS | grep webengine-metrics`; also on screen and in
   `<documentDirectory>/webengine-metrics-<timestamp>.json` (sections `env`, `fileAccess`, `playback`,
   `seek`, `export`). The exported mp4 is in the app cache and, in this spike only, copied to the
   media store (DCIM): delete it afterwards. For background survival press Home during the export and
   read `framesWhileBackground` and `longestPauseMs`.
5. Memory: `adb shell dumpsys meminfo com.anonymous.pixelmorph` every few seconds during playback and
   export (the WebView renderer is a separate `sandboxed_process0` process).

## Owner's phone numbers (Poco, 2026-10-22, WebView 154)

| Metric | Browser test (Poco) | Current app (Poco) | WebView spike (Poco) |
| --- | --- | --- | --- |
| Screen fps, 3 layers 1080p | 61 | 1 layer only | 101 avg (120 Hz panel), worst 1 s window 63; 29.9-30 frames/s per layer |
| Screen fps, 3 layers proxy | - | - | not run (originals were read) |
| Dropped/late frames per layer | - | - | 3/0, 3/0, 2/19 in 30 s; longest frame gap 66 ms |
| Seek mean / p90 | 0.39-0.45 s | ~0.30-0.36 s | 1.14 s / 3.12 s (max 3.26 s); files have 1 s GOPs, so this is the engine's seek path, not the media: the browser test seeked the same files in 0.4 s |
| Export time / x-realtime | 20 s, 3 layers: 14.7 s | 1:30 1080p, 1 layer: 15.8 s | 20 s, 3 layers: ~27 s (0.74x), hardware encoder; output checked (h264 1080p, 600 frames, overlays right) |
| Export with app in background | ~1/3 speed, kept going | 19.1 s | app home-screened 30 s: kept going, ~35 s total |
| Frames encoded in background / longest pause | - | - | 424 of 600 / 2.0 s |
| Memory peak / average | - | - | RSS app + WebView renderer: ~0.9-1.0 GB playing, peak 1.45 GB exporting (old editor still mounted underneath; RSS overcounts shared pages) |
| File access method / open cost | - | - | xhr-blob, 102-118 ms per 40 MB file |

Notes from the phone run: the media-store copy of each export asks for photo access on Android 14+
(spike-only; must go before any real use). Seek and export speed lag the browser test on the same
files, so the decoder feed (restart on jump, per-frame pulls) is the first thing to optimise.

### Second phone run, after two fixes (same files, same day)

- Seek now decodes the target frame directly (`Feed.seek` → `VideoSampleSink.getSample`) instead of
  restarting the sample iterator, which left the old decoder closing while a new one opened for each
  of the 3 layers: **1.14 s / p90 3.12 s → 0.37 s / p90 0.48 s (max 0.48 s)**, the browser test's figure.
- Export no longer awaits each 4 MB chunk crossing the bridge (writes are chained in the background):
  **20 s, 3 layers: ~27 s → 16.4 s (1.22x realtime)**. Split: encoder add 10.1 s, canvas draw 3.9 s,
  decode 1.3 s, bridge writes 4.4 s (overlapped). Next levers: draw with WebGL instead of Canvas 2D;
  the encoder share is mostly hardware.
- Playback unchanged: 103 fps average, 30 frames/s per layer, worst 1 s window 93 fps.
- Export with the app home-screened for 30 s: finished, 429 of 600 frames encoded in the background,
  33.7 s in total, longest pause 1.4 s.
- The media-store copy was removed (it asked for photo access); exports stay in the app cache.
