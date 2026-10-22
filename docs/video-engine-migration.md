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
