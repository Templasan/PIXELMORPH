# PixelMorph photo editor (web)

The app's photo editor, taken out of React Native the same way as the video editor
(`video-editor-web/`): developed in a desktop browser, embedded in the app's WebView. Same domain
(copied from `src/modules/photo-editor/domain` with its tests), same rules (docs/agent-rules.md).

```bash
cd photo-editor-web
npm install
npm run dev        # http://localhost:5175/?photo=<file in media/>  (media/ is the gallery)
npm test           # vitest: the domain's tests + history
npm run typecheck
npm run build:app  # one self-contained index.html -> android/app/src/main/assets/photo-editor/
```

Test pictures go in `media/` (not committed). Exports land in `exports/`. In the console `pm` is
the editing session (`pm.editor`, `pm.exportImage('jpeg', 0.9)`).

## Why it was moved out

The app drew the photo with Skia inside React Native and forced every photo into a fixed
340×227 canvas ("cover", so portrait photos were cropped), ignored EXIF orientation (hence the
"Auto EXIF" button) and had slow drawers. Here the picture keeps the photo's own shape, photos open
upright, and preview and export share one drawing path.

## Layout (hexagonal, like the app)

| Folder | What |
| --- | --- |
| `src/domain` | The app's photo domain (adjustments, colour/retro shaders in SkSL, geometry, layers, effects...) + `sceneSize.ts`. Pure. |
| `src/application` | `session.ts` (load, draw on screen, save, export), `photoEditorStore.ts` (the app's edit store), `history.ts` (undo log in the app's format) |
| `src/engine` | `photoGl.ts` (WebGL2 passes: adjustments -> retro/overlay textures -> blended pictures -> perspective), `sksl.ts` (SkSL -> GLSL, so the shaders keep one source), `scene.ts` (the only drawing of the finished picture: turn, mirror, light, layers, frame), `picture.ts` |
| `src/ports` | `host.ts`: project load/save, picture picker, export sink |
| `src/adapters` | `dev/` (media/, localStorage, exports/) and `android/` (the WebView bridge) |
| `src/ui` | React DOM: `PhotoView` (canvas, painting, drag handles, compare), panels, export sheet |

Checks that hold it together: with neutral settings the screen equals the original photo (mean
difference 0.56/255), and the GPU output equals the domain's CPU mirror of the shader
(`applyFullAdjustmentsRGB`) within 1/255.

## In the app

`src/app/screens/PhotoEditorWebScreen.tsx` hosts the build. It keeps the app's stores as the
source of truth: the undo log in `LocalHistoryRepository` (the projects screen's "histórico de
edições" reads it), layers in `layerStorage`, double exposure/overlay pictures in
`editorImages`. Adjustments are replayed from the log on open, as before. HEIC photos get a
full-size JPEG copy (`<name>.full.jpg`, made once with Skia): the WebView cannot decode HEIC.

## Done / not yet

Done: Ajustes (básico, curvas, detalhe, cor seletiva, histograma), Geometria (quarter turns,
mirror, straighten, 4-point perspective), Camadas (paint, visibility, opacity, merge),
Efeitos (retrô, overlays, molduras, iluminação, dupla exposição), Elementos (text, shapes,
stickers, meme), compare, undo/redo, export JPEG/PNG/WebP at full or reduced size.

Not yet (from the old screen): bake ("✓" apply-and-start-over for Ajustes and perspective),
Presets, batch edit, Panorama and collage (both create a new project: need a host method),
export extras (target size, watermark, DPI, social presets, HEIC), pinch zoom, touch shortcuts
(2/3-finger taps), gyro parallax for stereoscopic photos. Máscaras, Retoque and IA were
placeholders in the app (sprint 3) and were not carried over.
