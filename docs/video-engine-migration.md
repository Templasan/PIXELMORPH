# Video engine migration plan (web engine) — draft for the owner's approval

Based on `docs/spike-webview.md` (Poco results, 2026-10-22). Nothing here is started; each stage is
proposed, then confirmed with the owner before it begins (owner's rule: one part at a time).

## Why

The current editor previews with expo-video players + frozen frames and exports with a separate
Media3 pipeline. It shows one video layer, and every effect is written twice (preview and export)
and drifts. Sprint 3 stacks five composition stories on top (US-20 PiP, US-19 360°, US-18
stabilization, US-29 subtitles, US-32 watermark) plus Sprint 2's text over video. The spike drew
and exported 3 layers + animated text + keyframed sticker from ONE function on the Poco: 103 fps
preview, seek 0.37 s, export 1.22x realtime, export survives 30 s in the background.

Scope: the VIDEO editor only. Camera (US-21/22/23) stays native; the photo editor stays on Skia.

## Stages

Each stage ends with: tsc/eslint/jest clean, emulator correctness check, Poco measurement with the
same metrics JSON as the spike, one commit per item, the owner sees it before it merges.

### 1. Foundation in the real editor (risk first)
1. The engine replaces the preview inside `VideoEditorScreen` (not a separate screen). Timeline,
   clip panel and stores stay as they are; the engine reads the same tracks.
2. Fallback when the System WebView cannot run it: the message + "update WebView" button (done in
   the spike). Decision A below on whether the old preview stays as a second fallback.
3. Streaming file reads instead of loading whole files into memory (the spike's XHR read holds each
   source fully in RAM). Measure the chunk path; pick the cheaper.
4. Preview quality tiers (export always uses the originals):
   - automatic tier from device RAM + decoder capability: High (1080p sources), Medium (720p
     proxy), Low (540p proxy, 720p canvas, max 2 live video layers);
   - automatic step down when the preview drops frames, with a short notice;
   - manual setting "Qualidade da prévia: Automática / Alta / Média / Baixa".
   Reuses `previewProxy.ts`; adds a 540p tier and 1 s keyframe interval to proxies (faster seek).
5. Memory measured on the Poco without the old editor mounted (spike peak was 1.45 GB with it).

### 2. Parity with today's editor
Audio (clip audio, A1 music, volume/fades, mix into the export), image track and time-lapse,
speed and speed ramp, freeze frames, rotation, colour correction, gaps (black), transitions
(done in the spike), export presets (resolution/bitrate), GIF export, progress UI and cancel.
After this stage the old preview (expo-video players, frozen-frame transition layers) and the
transition preview fixes planned for it are dropped.

### 3. New capabilities (the reason for the change)
Text over video with in/out animations (Sprint 2 RF-008), real picture-in-picture (US-20),
watermark (US-32), then 360° and stabilization (US-19/18) as shaders.

### 4. Clean-up
Remove unused code (old preview, `react-native-webview` if unused), decide the fate of the Kotlin
Media3 exporter (keep as fast path for simple 1-layer exports, or remove), update docs.

## Impact on Sprint 2

- Becomes unnecessary: the transition preview glitch fixes on the old preview.
- Moves into the engine: text over video (RF-008), audio items of US-33 that touch playback/mix.
- Unaffected: photo editor, projects/help/i18n, photo export/HEIC, login/sync, camera.
- Part 1 + transitions (branches `worktree-agent-a34516139c6cd9d3a`, `transitions-in-out`) still
  merge first: their shared frame plan and ripple logic are what the engine reads.

## Decisions needed from the owner

A. Fallback for phones whose WebView cannot run the engine: only the "update WebView" message, or
   also keep the old 1-layer preview as a second mode (more code to maintain).
B. Approve the 4 dependencies the spike needed: `react-dom`, `react-native-web`,
   `@expo/metro-runtime`, `@expo/dom-webview` (all MIT).
C. A weaker test phone (3-4 GB RAM) for tier calibration: is one available? Otherwise tiers are
   calibrated on the Poco by forcing Medium/Low.
D. Order: start stage 1 now, after merging part 1 + transitions into `sprint-2`.

## Stage 1 status (branch `video-engine`, emulator-verified; Poco numbers pending)

Done:
- `VideoEditorScreen` renders the web engine (`EnginePreview.tsx` + DOM component `web-engine/EditorPreview.tsx`,
  same `Engine` as the spike) instead of the expo-video layers when the persisted setting `videoEngine` is
  `web` (default `native`, because preview audio and the web export are stage 2). Switch and quality live in the
  menu opened by the quality badge on the preview; it says "sem áudio na prévia (em breve)".
- The engine owns the clock and reports time ~10 Hz into `timeStore`; a `timeStore` value the engine did not
  report is a user seek (coalesced: only the latest pending seek runs, `Feed.seek` decodes the frame directly;
  seeking while playing just moves the clock origin). Timeline edits rebuild the scene (`buildEditorScene`) and
  the engine redraws the current frame (`Engine.setScene`) keeping the playhead; verified split, transition
  (Saída and Entrada), speed 2x, tier change, scrub and play across a junction.
- Fallback: no WebCodecs, an error before the first frame, or no sign of life in 10 s falls back to the native
  preview for the session and shows a one-time non-blocking banner (with the "Atualizar o WebView na Play
  Store" button for the WebView case). Verified on the Pixel_API28 AVD (WebView 69). No dev flag was added.
- Tiers (`previewTier.ts`, pure, Jest): Alta = sources as they are, 1080p canvas; Média = 720p proxy, 1080p
  canvas; Baixa = 540p proxy (`.proxy540.mp4`, made only when Baixa is in use; 720p proxy until it exists),
  720p canvas, at most 2 live video layers. Automatic: `navigator.deviceMemory` (<=3 GB Baixa, <=6 Média, else
  Alta; no 1080p hardware decode caps at Média) and one automatic step down per session (Automática only) when
  more than 10 % of layer draws in a 5 s window are late (>100 ms behind) or dropped; notice "Prévia reduzida
  para manter a fluidez". Manual choice persisted. Export never uses the tiers.
- Proxies keyframe every second (`keyFrameIntervalSeconds` in the native `ExportOptions`, passed only by proxy
  jobs). Probed on device: 720p proxy 1280x720 and 540p proxy 960x540, keyframes at 0,1,2,3,4,5 s; the 4K
  original has them every 8.3 s. Proxies made by older builds keep their long GOP.
- File reads: XHR Blob by default, chunk bridge (1 MiB blocks, 24-block LRU, read-ahead, `BlockReader`) when XHR
  fails or the file is above 1 GiB (`STREAM_ABOVE_BYTES`). Emulator numbers, 40 MB 1080p file: XHR open 104-153 ms,
  seek x20 mean 701 ms / p90 1152 ms, renderer PSS 100 MB (app 394 MB); bridge open 23 ms, seek mean 881 ms /
  p90 1583 ms, renderer 140 MB at open, 247 MB after the seek run (app 409 MB). 300 MB 4K file: XHR open 994 ms,
  renderer 125 MB at open and 189 MB after a seek run; bridge renderer 323 MB at open and 1.2 GB (181 MB swapped)
  after the same run. XHR keeps the file out of the JS heap (Blob), so it is cheaper in RAM and speed here.
  Emulator numbers are for correctness and relative cost only.

Not done / known gaps: no audio in web mode; image-track pieces draw black; colour-correction overlay and
the fullscreen preview are not wired in web mode (the fullscreen button is hidden there); the automatic step
down was not triggered live (software decode on the emulator makes drops, but Automática resolves to Baixa
there already); rotated sources (rotation tag) not checked in the engine; Poco measurement (memory without the
old editor, tier calibration by forcing tiers) is the lead's.
