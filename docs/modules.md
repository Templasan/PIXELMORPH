# Modules

What each part of `src/` owns, as it is in the code today. Layering rules are in
[`architecture.md`](architecture.md); decisions in [`decisions/`](decisions/). The refactor that
produced this shape, and what is still pending, is tracked in [`foundation-plan.md`](foundation-plan.md).

## `src/app` — composition and screens

| Path | Owns |
|---|---|
| `App.tsx`, `CompositionRoot.ts` | App bootstrap; wires the `projects` module (the only module with app-wide state) |
| `navigation/` | Stack navigator (heavy screens are lazy), `SideDrawer` (main menu), `ScreenErrorBoundary` (every route renders inside one) |
| `screens/` | One file per screen + a folder of its parts (`photo-editor/`, `video-editor/`, `projects/`) |

Screens are presentation. Both editors keep their state and edits in a store
(`video-editor/application/videoEditorStore`, `photo-editor/application/photoEditorStore`); the
canvas, panels and drawers subscribe to the slice they draw, so a slider tick or a brush point
re-renders only them, not the screen.

## `src/core` — shared kernel

Never imports `src/modules` or `src/app` (enforced by lint).

| Path | Owns |
|---|---|
| `state/` | `createStore` + `useStore(store, selector, isEqual)` — editor state outside React |
| `history/` | Unlimited undo/redo (`HistoryStore`, RF-027), persisted autosave (`LocalHistoryRepository`, `DebouncedSaver`, RNF-005). Large logs are stored in parts |
| `reliability/` | Error log (RNF-017: 5 MB in 256 KB segments) and storage usage |
| `i18n/` | PT/EN/ES strings (`t()`, `useI18n`) |
| `theme/`, `ui/` | Tokens and base components (Button, Slider, Switch, Tabs, TopBar, Icon) |
| `infrastructure/config.ts` | App config (error report URL) |

## `src/modules`

### `projects` — projects and their media (US-01, US-03)
- `domain/`: `Project`, `MediaAsset`, `MediaMetadata`, types.
- `application/usecases/`: create, list, get, update, archive/unarchive, delete, add/update/remove media asset, batch adjustments.
- `ports/`: `ProjectRepository`, `MediaFileStore`.
- `infrastructure/`: `LocalProjectRepository` (AsyncStorage + backup file, RNF-006), `FileSystemMediaFileStore` (every project owns a copy of its media under `documents/media/<projectId>/`; cache URIs are never stored), `repairCacheMedia` (one-time repair of data saved before that rule).
- Public entry: `createProjectsModule()`.

### `video-editor` — timeline editing (US-14..17, US-30, US-33)
- `domain/`: tracks and clips, timeline ops (move/trim/split/ripple), transitions, speed ramp, freeze frame, audio fades, export and GIF plans, frame math, orientation, loop range, 360° detection.
- `application/videoEditorStore.ts`: the editor's state and every edit (one undo entry per action or gesture).
- Export goes straight to the native module `modules/pixelmorph-video-export` (Android, Media3).

### `photo-editor` — photo editing (US-04..13)
- `domain/`: adjustments math, effects, geometry (homography, EXIF, snap guides), layer model, collage and panorama math, RAW naming, stereo detection, presets/masks/watermark models.
- `domain/adjustments/`: the adjustments model and pure derivations (shader uniforms, perspective matrix, rotation) shared by the live canvas and the bake actions.
- `application/photoEditorStore.ts`: adjustments, open tool, compare/zoom, layers, brush and the live stroke, with the undo rules.
- `application/`: use cases (presets, masks, strokes, watermark, QR) and hooks (histogram from a 192 px sample, gyro parallax).
- `ports/` + `infrastructure/`: preset/watermark repositories (AsyncStorage), layer storage, Skia collage and panorama composition.
- Public entry: `createPhotoEditorModule()` (used by presets, batch edit and mask painter).

### `export` — image encoding and sizing (US-30)
Pure export math and `encodeImage`/`resizeImageCover` used by the photo export sheet and GIF export.

### `device-media` — gallery, files, metadata
Pickers (gallery, audio), save to gallery, `copyToAppStorage` (permanent copy of a picked file), `writeImageToCache`, file/video probes, upright dimensions.

### `camera` — AR overlay
AR tracking (WebView-based) used by the camera screen; capture itself uses `expo-camera` directly in the screen.

## `modules/pixelmorph-video-export` (native)
Expo module in Kotlin: video export with transitions, speed, per-clip gain and the A1 audio mix (Media3 Transformer), plus video probes.
