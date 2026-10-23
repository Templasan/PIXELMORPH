# Agent Briefing — rules and continuity

Handoff for the next agent on branch `sprint-2` (updated 2026-10-22; see §7 for the newest
work, which lives on branch `video-engine` in worktree `C:\ve`).
Read [AGENTS.md](../AGENTS.md) first; this file adds what was learned while restoring the
foundation and is the starting point for continuing Sprint 2. Detailed history and every
measurement: [foundation-plan.md](foundation-plan.md) §7–§9 (Portuguese).
`docs/next-steps.md` is from 2026-09-07 and is stale — do not plan from it.

## 1. How the owner works

- **Language**: talk to the owner in Portuguese (pt-BR). Code, commits and these docs stay English
  (foundation-plan.md is the exception: it is the owner-facing log, in Portuguese).
- **Delegation (owner's choice)**: two levels. The lead agent writes self-contained specs,
  reviews diffs, edits critical code itself, measures and commits. Cheap subagents (Haiku)
  implement, run tsc/eslint/jest and drive the emulator. No middle "manager" layer.
  Subagents doing code must be told which files they may NOT touch when others run in parallel.
- **Scope**: the backlog (`backlog/backlog sprint N/US-NN/`) is the scope. Ambiguous or
  conflicting criteria → ask. Product rules the owner gave verbally are recorded below (§4).
- **Honesty about numbers**: measure before and after with the same method; if a change shows
  no real gain, revert it. Correct earlier claims when a measurement turns out wrong
  (it happened: see §3, uiautomator idle wait).
- **Commits**: one story / one scoped fix per commit; message says what and why; ends with the
  session's `Co-Authored-By` line. Never `--force`, never skip hooks.
- **Push**: authorized to `origin sprint-2` only. Release APKs go to `C:\apks`.

## 2. Device safety

- Always pass the device: `adb -s emulator-5554` (AVD `Pixel_7`) or `adb -s T4PVUC79WGS4FE8T`
  (owner's real phone, 24095PCADG, 1220×2712, 3-button nav = 153 px bar at the bottom).
- **Owner's phone**: never uninstall, never clear data, never edit/delete/export projects, never
  move sliders inside real projects, never take photos or record; stop if the phone is locked.
  `install -r` only. The owner asked to keep testing on the **emulator only** for now.
- **Emulator**: projects there are test data (editing/exporting/importing allowed). Deleting
  files on it still needs the owner's OK (granted once for test files). Watch the disk: 10 GB
  fills up fast with 300 MB test videos — a full disk makes imports fail ("Não foi possível
  importar") and silently stops light copies from being written.
- In Git Bash, `export MSYS_NO_PATHCONV=1` before adb commands with device paths.

## 3. Build, test and measure

- Verify loop: `npx tsc --noEmit`, `npx eslint <touched files>` (never `--fix .` on the repo),
  `npx jest` (449 tests). Prettier only on touched files.
- **Release builds for measurement** in the worktree `C:\pw` (keeps the main checkout free):
  `git -C C:/pw clean -fdq src assets tests && git -C C:/pw checkout -q -- .`, fetch this repo's
  `sprint-2` into it and `checkout --detach FETCH_HEAD`, copy uncommitted files over, then
  `cd C:/pw/android && ./gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64`
  (emulator) or `arm64-v8a` (phone). `npm ci` in `C:\pw` if dependencies changed.
  Native (Kotlin) changes are picked up by the same Gradle build.
- **Test media must be heavy** (owner's explicit point): `C:\testmedia` — `foto-48mp.jpg`
  (8000×6000, 40 MB), `foto-12mp.jpg`, `v4k-h264-80mbps.mp4` (3840×2160, 80 Mbps, 30 s, 300 MB),
  `v4k-rot90.mp4` (4K with a 90° rotation tag, displays portrait). Generated with ffmpeg
  (winget `Gyan.FFmpeg`, binary under `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*`),
  with noise so they don't compress or decode easily. Push to `/sdcard/DCIM/Camera/`, media-scan,
  import through the app's gallery FAB. Real phone footage is the next step when allowed.
- **Perf script**: `node scripts/perf/measure.mjs --label X --serial <id> --runs 3 --only a,b`
  (scenarios: cold-start, open-photo-editor, photo-drawer, photo-slider, open-video-editor,
  video-timeline, side-menu). It opens the FIRST card of the FOTOS/VÍDEOS filter. Its
  `uiautomator dump` sometimes fails — rerun once.
- **Measurement traps found the hard way**:
  - On the emulator the GPU is host-translated: every frame sits at ~17 ms, so gfxinfo "janky %"
    calls almost everything janky. Use `dumpsys gfxinfo <pkg> framestats` and compare phases
    (anim = React/Fabric mount, record = draw recording, gpu = SwapBuffers→FrameCompleted).
  - `uiautomator dump` waits for the UI to go idle (~2 s): polling it is NOT a valid open-time
    clock. Use timed `screencap` instead.
  - gfxinfo does not count the Skia canvas' own frames.
  - The emulator decodes video in software (host CPU); the phone has hardware decoders, so video
    numbers on the emulator overstate the problem. Java heap limit (192 MB) is the same on both.
- **Release CPU profile** (Hermes sampling profiler is not exposed in release): in the `C:\pw`
  worktree only, add `debuggable true` to the release buildType, `npm install
  react-native-release-profiler@0.4.5 @react-native-community/cli-tools`, call
  `startProfiling()` on editor mount / `stopProfiling(true)` on unmount; the trace lands in
  `/sdcard/Download/`; convert with `npx react-native-release-profiler --local <file>
  --sourcemap-path android/app/build/generated/sourcemaps/react/release/index.android.bundle.map`.
  Compare builds only within the same emulator session (it drifts 20-40 % across days).
- Live UI checks: drive with `adb shell input`, read with `adb exec-out uiautomator dump /dev/tty`,
  look at `adb exec-out screencap -p`. Release build: no `run-as`; native export errors are logged
  under tag `PixelMorphExport`.

## 4. Codebase rules learned in this phase (beyond AGENTS.md)

- **Edit a light copy, export the original** (owner's product rule):
  - Photo: `photo-editor/photoProxy.ts` (+ `photoProxySkia.ts`) keeps `<name>.proxy2048.jpg` next
    to the photo; the editor opens on it; export (`drawAsImage` of `EditorScene` scaled to native
    pixels, cap 8192) and the bakes decode the full photo on demand and dispose it.
  - Video: `video-editor/previewProxy.ts` transcodes a 720p `<name>.proxy720.mp4` next to sources
    above 1280 px through the native exporter (single-slot: export pauses the queue).
  - **Editors are locked** behind `shared/PreparingMediaOverlay` until the light copy exists AND
    the project and its undo log have loaded. Back is allowed; the job keeps running. The owner
    does not want any editing (or rollback risk) on unprocessed media. Projects screen unchanged.
- **Sliders** (`core/ui/Slider.tsx` + `sliderEcho.ts`): echoes arrive in emission order; an echo
  drops older emitted values; in-flight values stay recognised for 1 s after release. Do not
  "simplify" this back — that was the app-wide rollback bug. Slider values must come from the
  store (no local copies that drift, like the old PiP sliders).
- **expo-video**: keep `bufferOptions` capped in `ClipVideo` (32 MB / 5 s). ExoPlayer's default
  byte buffer (~130 MB) with a high-bitrate 4K file filled the Java heap and any second decoder
  (export, transcode) crashed the app with OutOfMemory.
- **Native module records** (`modules/pixelmorph-video-export`): fields omitted from JS arrive in
  Kotlin as 0/null, NOT as the Kotlin default. Pass every field explicitly (speed 1, volume 1,
  transitionIn '', audio [] …). `probeVideo` reads size/rotation/duration from metadata cheaply.
- **Edge to edge**: absolute-positioned UI must add `useSafeAreaInsets()`; SafeAreaView padding
  does not move absolute children.
- **React 19.2 `<Activity>`** works on this RN 0.85 setup: the Ajustes drawer stays mounted
  (hidden) after first open. Use it only where keeping state is acceptable.
- Skia/Jest split, module boundaries via `core/ports`, Project → editor intake: see AGENTS.md §4.

## 5. State at handoff

Done and pushed this phase (newest first): Ajustes drawer kept mounted (`ce15fbf`); editors locked
until media/history ready + persisted photo light copy (`7259542`); slider rollback fix + PiP
sliders (`14ca224`); video 720p proxy + capped player buffer (`8d7cbc8`); photo proxy + full-res
export (`b0cc1be`); recent-adjustments dead code removed (`ab26e51`); system-bar insets for Camera
and Projects (`bb72aa6`); earlier foundation work in the plan log.

Heavy-media results (emulator): 4K timeline drag 31 % → 10 % janky, p99 500 → 38 ms; video editor
memory 804 → ~354 MB; photo slider 9.2 % → 3.6 %; photo export now 8000×5341 (was screen size).

Research + optimization round (2026-10-21/22, see foundation-plan.md): GPU histogram
(`c1ff43a`), 384 px card thumbnails (`833ac77`), expo-video-thumbnails removed (`780dfae`),
failed import leaves no project (`3f0e050`), camera recorder crash (`1453b78`).
Tried and reverted for no measured gain: expo-video scrubbing mode, shader uniforms via
shared values (the JS thread is no longer the slider bottleneck after the GPU histogram).

## 6. Open items

Known bugs found, not fixed (verify, then fix or ask):
1. Video export "Original" preset is capped at 1920×1080 even for 4K sources — ask the owner
   whether 4K export is wanted.
2. Text layers did not show in the photo editor during a test (neither preview nor export) —
   looks pre-existing; reproduce first.
3. `bakePerspective` applies a matrix computed in 340×227 canvas units to image pixels.
4. AR scale slider (`camera/ARControlPanel.tsx`) can show one fallback frame between the draft
   clearing and the committed value.
5. Not verified: leaving and re-entering a video editor while its proxy is still being made
   (progress should continue). One isolated Hermes GC SIGSEGV at startup, not reproduced.

Found by the repo audit of 2026-10-22. 6, 7, 8 and 11 are FIXED on branch `audit-fixes`
(`6947748`, `2a6ca86`, `f5ee523`, `3cd6e86`), already merged into `video-engine`, not yet in
`sprint-2` (owner review pending):
6. ~~One corrupted project hides every project~~ (findAll skips and logs it; the screen stops
   loading if the list itself is unreadable).
7. ~~Clips added with "+" are never deleted~~ (copyToAppStorage takes the project id and copies
   into `media/<projectId>/`; files already in `imports/` stay).
8. ~~Video export cancel hangs~~ (Media3 1.9 `Transformer.cancel()` calls no listener: `cancel`
   now rejects the pending promise with `CANCELLED`; a cancel tapped before the native export
   starts is honoured too).
9. Every video export stays in the cache (~78 MB for 1:30 1080p) until Android or "limpar cache"
   removes it.
10. A proxy that failed is not retried in the same session (`requestProxy` returns early).
11. ~~Project info sheet: "Apagar projeto" behind the navigation bar~~ (bottom inset added).

Found on the owner's Poco on 2026-10-22 (not fixed yet):
12. **Video export sheet: the EXPORTAR button sits mostly behind the 3-button navigation bar**
    (only its top edge, y≈2492 of 2712, is tappable). Same cause as 11: add the bottom inset
    (`useSafeAreaInsets`) to the sheet's scroll content. Gesture-nav emulators do not show it.
13. Preview quality menu copy is stale: it says only the default engine has audio; the web
    engine has audio since `aedfdbd`.
14. Full-screen preview: its top bar (badge + close) overlaps the Android status bar.
15. Automatic preview tier picks **Alta** on an 8 GB phone even for 4K sources: decoding the 4K
    original (80 Mbps, 8 s GOP) gives 29 fps with 41 late frames per 10 s and seeks up to 1.8 s.
    Fix idea: in Automática, sources above 1080p use Média (720p proxy). The automatic
    step-down already rescues it after a few seconds.
16. Not verified: an export with the app in the background on the phone (the phone locked
    during the test). On the emulator / in the browser test it kept going at ~1/3 speed.
    TODO (owner, 2026-10-22): Android throttles the WebView in the background, so a foreground
    service would not help. Planned: keep the screen on while exporting (`expo-keep-awake`, new
    dependency, needs the owner's OK) and tell the user to keep the app open.

Owner decisions still pending (documented in foundation-plan.md): video history as diffs,
lightweight project-list index, small per-project thumbnails, true AR via ARCore (US-23), real
batch apply (US-02, its fake button was removed).

## 7. Where things stand (2026-10-22, evening) and next steps

**Update 2026-10-23:** `video-engine` was merged into `sprint-2` (fast-forward) after an
emulator-only check (the owner's Poco was disconnected). Not yet measured on the Poco: the
1080p Alta proxy (`72344fb`), the streaming GIF encoder (`2fc4845`), HEIC export on a real
device, the 3-button-bar EXPORTAR position (bug 12). Open work and owner decisions:
`docs/sprint-2-plan.md` (decisions of 2026-10-23, feasibility TODO). The paragraphs below
describe the state before this merge.

Branches (all local unless noted; nothing goes into `sprint-2` before the owner sees it):
- `sprint-2` (pushed): part 1 (speed ripple, shared frame plan, gesture rollback fix) and the
  Saída/Entrada transitions are merged (`7fc43ff`). Sprint 2 audit and decisions:
  `docs/sprint-2-plan.md`.
- `audit-fixes` (worktree `C:\pw`): bugs 6, 7, 8, 11 above.
- `video-engine` (worktree **`C:\ve`**, the newest work): the video editor's new engine — a
  WebCodecs engine in an Expo DOM component (WebView). Preview AND export (mp4 and GIF) come
  from ONE function `drawListAt` (`src/modules/video-editor/domain/webScene.ts`), so they cannot
  drift. Has: 3+ video layers, sound (Web Audio clock drives the picture), photos/time-lapse/
  stop-motion, colour correction, transitions, text over video (RF-008: 5 fonts, colours, shadow,
  outline, 8 in/out animations, drag/pinch), preview quality tiers (Alta/Média/Baixa, automatic
  + manual). Since `33c988a` it is the ONLY preview and exporter (the old expo-video preview and
  the Media3 export path are gone); when the System WebView is too old the editor says preview
  and export are unavailable and the export sheet refuses.
  Full story, numbers and decisions: `docs/video-engine-migration.md` and `docs/spike-webview.md`
  on that branch.
- Poco numbers (`be5e79a`): Média/Baixa 30.7 fps, seek 0.11–0.29 s, ~700–750 MB; export of a
  1 min 4K+1080p project with sound and text in 44 s (peak ~810 MB).

Next steps, in order:
1. Done: bugs 13–15 (`6932443`, tier threshold fixed in `feb9807`), engine-only editor
   (`33c988a`, cleanup `e32e997`/`aae0ef3`). Bug 12 (EXPORTAR behind the 3-button bar) still needs
   checking on a 3-button-navigation device: the sheet already had the bottom inset.
   Open, needs the phone: GIF export keeps every frame in memory before encoding (`engine.ts`).
2. Owner reviews `video-engine` (includes `audit-fixes`) → merge into `sprint-2`, push.
4. Rest of Sprint 2, one part at a time, asking decisions first (`docs/sprint-2-plan.md`):
   photo editor US-10/US-12 + P0 #6/#7, projects/help/i18n, photo export US-30 + HEIC,
   login/2FA/sync (owner creates the Supabase account), gap media-drop, zoom Entrada.
   (Steps renumbered: 2 = owner review + merge, 3 = rest of Sprint 2.)

## 8. Rules for any agent, especially low-budget models (Haiku etc.)

Read §1–§4 first. Then, without exception:
- **Phone (`T4PVUC79WGS4FE8T`)**: only when the owner says so in this session. `install -r` only,
  never uninstall/clear data, never touch the owner's projects (only a test project you created,
  deleted at the end with the owner's OK), never grant permissions or tap system dialogs, never
  save to the owner's gallery. Stop if the phone is locked or the screen is off.
- **Always** `adb -s <serial>`; emulator is `emulator-5554` (AVD `Pixel_7`). In Git Bash run
  `export MSYS_NO_PATHCONV=1` before adb commands with device paths.
- **Builds**: Windows paths over ~250 chars break CMake. Build only in short worktrees
  (`C:\ve`, `C:\pw`), never inside `.claude/worktrees/...`:
  `cd C:/ve/android && ./gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64` (emulator)
  or `arm64-v8a` (phone). Copy APKs to `C:\apks\`.
- **Verify loop**: `npx tsc --noEmit`, `npx eslint <touched files>` (never `--fix .`),
  `npx jest --testPathIgnorePatterns worktrees` (the main checkout otherwise also runs the
  worktrees' copies of the tests and they fail).
- **Do not change** without the lead's review: `web-engine/engine.ts`, `web-engine/audio.ts`,
  `web-engine/feed.ts`, `domain/webScene.ts`, `domain/framePlan.ts`, `domain/textCaption.ts`,
  the Kotlin export module, `LocalProjectRepository.ts`. These are the critical areas the lead
  (Opus) codes itself. UI around them is fine.
- **Gestures**: use `.onStart`/`.onUpdate`/`.onFinalize` with `scheduleOnRN`, never
  `onBegin`/`onEnd` (see the rollback bug in VideoEditorScreen). Edits go through the store's
  `commit*` (one undo entry) or `live*` + `endGesture` (sliders, drags, typing).
- **Native module records**: pass every field from JS (omitted ones arrive as 0/null).
- **Emulator numbers are for correctness only**; performance is measured on the phone.
  Phone measurement scripts: `scripts/perf/poco-tier.sh` and `scripts/perf/poco-set-tier.sh`
  (screen-record frame counting, seek, memory; read them before running).
- **No new dependencies** without the owner. Licences must allow closed commercial use and go in
  `THIRD_PARTY_NOTICES.md`.
- Talk to the owner in Portuguese; code, commits and docs in English; one scoped change per
  commit, ending with the session's `Co-Authored-By` line. Push only `sprint-2`, only when asked.
- When stuck: write the exact error and what you tried, and stop; do not guess or widen scope.
