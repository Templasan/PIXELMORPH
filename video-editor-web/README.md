# PixelMorph video editor (web)

The app's video editor, taken out of the React Native app to be fixed in a desktop browser and
embedded back into the app's WebView afterwards. Same domain, same rules (docs/agent-rules.md),
its own build: Vite + React + TypeScript, tests with vitest.

```bash
cd video-editor-web
npm install
npm run dev        # http://localhost:5174 — the editor, with media/ as the gallery
npm test           # vitest: domain, composition and randomized edit invariants
npm run typecheck
```

Test media goes in `media/` (not committed; any .mp4/.jpg/.png/.m4a). Exports from the dev
server land in `exports/`. In the dev console `pm` is the editing session (`pm.addMedia`,
`pm.seek`, `pm.startTrace()`/`pm.stopTrace()` for per-frame diagnostics).

## Smart compression (RNF-013): off by default

The export sheet's "Compressão inteligente" (MP4 only) lowers the bitrate of still clips and keeps
the preset for busy ones. It is **off by default**: quality and size pass on the clips below, but
the analysis costs 23-32% of the export time on the desktop browser, against the 10% target. The
checkbox stays so it can be tried.

`src/domain/sceneComplexity.ts` reads up to 24 frames, evenly spread across the export and drawn
through the composition path the encoder uses at a 480 px long edge. Each sample is compared with
the frame a tick before (motion counts). The score is the 90th percentile of per-frame detail plus
motion, mapped to 0-1 between a quiet level (0.006) and a busy level (0.015). The bitrate runs from
55% of the preset (still) to the preset (busy), never above it. Variable bitrate is used only when
that target is in use and `VideoEncoder.isConfigSupported` accepts it. Any failure in the read
keeps the preset's bitrate, so the export never fails because of it.

Measured on headless Edge 156 (Windows, desktop hardware encoder). Preset 1920x1080 at 8 Mbps;
four 20 s clips at 1920x1080, 30 fps, made with ffmpeg (no clip in `media/` is a talking head).
Quality is luma PSNR at 30 evenly spaced frames, each export against its source, decoded in
software. Variable bitrate was accepted for every ON export.

| Clip | Smart | Complexity | Target Mbps (% preset) | File | Avg Mbps | Export | Analysis (% export) | PSNR mean / min dB | Δ mean dB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a simple gradient | off | - | 8.00 (100%) | 12.30 MB | 4.92 | 2.42 s | - | 58.61 / 53.47 | - |
| a simple gradient | on | 0.00 | 4.40 (55%) | 8.01 MB (-35%) | 3.20 | 3.09 s | 0.71 s (23%) | 57.67 / 52.84 | -0.94 |
| b talking head, grain | off | - | 8.00 (100%) | 17.38 MB | 6.95 | 2.46 s | - | 45.01 / 40.02 | - |
| b talking head, grain | on | 1.00 | 8.00 (100%) | 17.38 MB (0%) | 6.95 | 3.24 s | 0.73 s (23%) | 45.01 / 40.02 | 0.00 |
| c full-frame noise | off | - | 8.00 (100%) | 23.40 MB | 9.36 | 2.52 s | - | 34.54 / 27.17 | - |
| c full-frame noise | on | 1.00 | 8.00 (100%) | 23.40 MB (0%) | 9.36 | 3.85 s | 1.23 s (32%) | 34.54 / 27.17 | 0.00 |
| d 80% static, 20% noise | off | - | 8.00 (100%) | 17.99 MB | 7.19 | 2.63 s | - | 53.46 / 23.08 | - |
| d 80% static, 20% noise | on | 1.00 | 8.00 (100%) | 17.99 MB (0%) | 7.19 | 3.53 s | 0.92 s (26%) | 53.46 / 23.08 | 0.00 |

Acceptance, as set for RNF-013: mean PSNR loss at most 1.0 dB and minimum at least 32 dB (unless off
is below it): passed on all four clips (simple: -0.94 dB mean, -0.63 dB min). Simple clip saving of
30% or more: passed (-35%). Analysis under 10% of export time: failed (23-32%). Analysis is about one
extra decode pass of the clip, and fewer samples (12 instead of 24) barely changed it (0.67 s
against 0.72 s), so it is not a tuning problem. Clips at the busy level came out identical to off.

Why the constants changed: the first values (96 px read, busy at 0.25, floor 45%) lost 3.9 dB on the
talking head at half the bitrate and 1.1 dB on the simple clip. At 96 px the read could not tell a
gradient from grain, and both came out as nearly still. The 480 px read and the quiet/busy band fixed
that. The 90th percentile caught the 20% busy part of the mixed clip; a shorter burst was not tested.

Honest limits:
- Desktop only. A phone's hardware encoder and decoder behave differently and were not measured.
- This desktop H.264 decoder rejected frames 480-485 of the mixed export, which are valid (ffmpeg
  decodes them), so the measurement decodes in software.
- Per export, not per scene: one bitrate covers the whole file, and a short busy section below the
  sampling resolution is not seen.
- Four 20 s clips with x264 default GOPs (250). Analysis cost depends on the decode, so phone
  footage with short GOPs may differ.

## Why it was moved out

The app version split the editor in two runtimes: the timeline, playhead and edit state in React
Native, the picture and sound in a WebView, talking through serialised props and ~10 Hz time
reports. Most reported bugs came from that border (two clocks, a playhead that disagreed with the
picture) and from a composition model that flattened every track into one sequence where the top
track replaced the whole frame. Here everything that moves with time lives in one page.

## Layout (hexagonal, like the app)

| Folder | What | May import |
| --- | --- | --- |
| `src/domain` | Track/Clip model, timeline edits, `composition.ts` (what is on screen at t), transitions, text, GIF encoder. Pure. | domain only |
| `src/application` | `session.ts` (one editing session), the edit store with undo, history | domain, engine, ports, state |
| `src/engine` | `player.ts` (preview, the only owner of the playhead), `exporter.ts`, `draw.ts` (the only drawing code), decoders (`feed.ts`, `media.ts`), sound (`audio.ts`) | domain, ports |
| `src/ports` | `host.ts`: what the editor needs from outside (media picker, project store, export sink, file reader) | domain |
| `src/adapters/dev` | the browser dev host (media/, localStorage, exports/). Dev server only, never in the app build. | ports |
| `src/ui` | React DOM UI | application, domain, state |

## Rules that fix the old bugs

- **One clock.** Only `Player` changes the playhead. The UI calls `play/pause/seek` and shows the
  time the player reports; while playing the sound's clock leads and the picture follows it.
- **Real layers.** `composition.ts`: every visible video/image track is a layer (later tracks on
  top, texts above all, PiP boxes honoured); transitions are per track and the outgoing clip keeps
  playing; every clip's sound is mixed; the video ends with its last picture.
- **One drawing path.** Preview, seeks and export all draw `opsAt(composition, t)` with
  `drawFrame`, so the file is what the preview showed.
- **Clips never pop in late.** Decoders of clips starting within 1.5 s are opened and positioned
  ahead; one decoder slot per clip; a late layer keeps the last complete frame (max 400 ms)
  instead of vanishing; a decoder restart keeps its frame until the new one is decoded.
- **Edits keep their units straight.** In/out points are source ms, positions timeline ms, speed
  converts between them; `tests/timeline-invariants.test.ts` runs thousands of random edits and
  checks no overlap, no frame outside the source, nothing shorter than the minimum, and that a
  split changes nothing on screen.

## In the app

`npm run build:app` builds one self-contained `index.html` (classic inline script and styles,
because file:// pages cannot load module scripts) and copies it to
`android/app/src/main/assets/video-editor/` (git-ignored). The app's `VideoEditor` route is
`src/app/screens/VideoEditorWebScreen.tsx`: a WebView on that file whose bridge answers the
editor's `EditorHost` calls (src/adapters/android): the system gallery/audio pickers (files copied
into the project's media folder), the timeline saved as `media/<project>/timeline.json` (the first
open replays the old editor's undo log), block reads of large files, and the export saved to the
photo library. Builds must run in the short worktree (C:/ve), Windows path limits break CMake in
the main checkout.

Checked on the emulator (Pixel_7, 2026-10-24): the editor opens inside the app, the video plays in
the preview (the old editor showed black there), photos added from the system picker land at the
playhead with their thumbnails, the project comes back after leaving and reopening, a 720p export
lands in the gallery (H.264 + AAC, exact length). Not yet: the phone, preview proxies (the
preview decodes the originals), and removing the old RN editor.
