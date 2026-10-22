# Agent Briefing — rules and continuity

Handoff for the next agent on branch `sprint-2` (state as of 2026-10-19, HEAD after `971eea2`).
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

Found by the repo audit of 2026-10-22 (not fixed yet):
6. **One corrupted project hides every project.** `LocalProjectRepository.findAll` throws when a
   project and its backups are all unreadable, and `ProjectsScreen.loadProjects` does not catch
   it: the list stays on "loading" forever. Fix: skip (and log) the failing project in `findAll`;
   add a test with one corrupted project in the list.
7. **Clips added with "+" are never deleted.** `copyToAppStorage` puts them in `imports/`, which
   no project owns: deleting the project leaves them (and their proxies) on disk, and nothing
   cleans that folder. Fix: copy them into `media/<projectId>/` with `MediaFileStore.persist`.
8. **Video export cancel may hang (to confirm).** `cancel` calls `Transformer.cancel()` and drops
   `current`; if Media3 calls no listener on cancel, the JS promise never settles and the 250 ms
   progress poll runs forever. Fix: reject the pending promise with `CANCELLED` and set
   `finished = true` in `cancel`.
9. Every video export stays in the cache (~78 MB for 1:30 1080p) until Android or "limpar cache"
   removes it.
10. A proxy that failed is not retried in the same session (`requestProxy` returns early).
11. Project info sheet: "Apagar projeto" sits behind the 3-button navigation bar on the Poco
    (only ~20 px tappable); the sheet ignores the bottom inset.

Owner decisions still pending (documented in foundation-plan.md): video history as diffs,
lightweight project-list index, small per-project thumbnails, true AR via ARCore (US-23), real
batch apply (US-02, its fake button was removed).

## 7. Next step: continue Sprint 2

Sprint 2 stories: US-01, US-10, US-12, US-16, US-17, US-30, US-33
(`backlog/backlog sprint 2/`). Suggested first move: one read-only subagent maps every acceptance
criterion of these stories to the code (done / partial / missing, with file refs), the lead agent
verifies the gaps, then plan with the owner one story per commit. Measure on the phone again
only when the owner allows it.
