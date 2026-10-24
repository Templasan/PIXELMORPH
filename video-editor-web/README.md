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
photo library. Builds must run in the short worktree (C:e), Windows path limits break CMake in
the main checkout.

Checked on the emulator (Pixel_7, 2026-10-24): the editor opens inside the app, the video plays in
the preview (the old editor showed black there), photos added from the system picker land at the
playhead with their thumbnails, the project comes back after leaving and reopening, a 720p export
lands in the gallery (H.264 + AAC, exact length). Not yet: the phone, preview proxies (the
preview decodes the originals), and removing the old RN editor.
