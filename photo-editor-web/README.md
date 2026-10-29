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
the editing session (`pm.editor`, `pm.exportImage({ ...pm.exportOptions.get(), format: 'jpeg', quality: 90 })`).

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

Done: Ajustes (básico, curvas, detalhe, cor seletiva, histograma, "✓ Aplicar" that bakes them
into the photo), Geometria (quarter turns, mirror, straighten, 4-point perspective + bake),
Camadas, Efeitos, Elementos (text, shapes, stickers, meme, collage -> new project), Presets
(one undo step each) and batch edit (a look added to other projects' history), Panorama (new
project), compare, undo/redo, pinch zoom/pan and the 2/3-finger shortcuts, export JPEG/PNG/WebP
and HEIC (Android 9+, platform encoder) with size presets, social crops, target size, DPI and
watermark.

Not carried over: gyro parallax for stereoscopic photos; Máscaras, Retoque and IA, which were
placeholders in the app (sprint 3).

## Performance (Poco, 50 MP photo, 2026-10-28)

The screen works on a 2048 px light copy made once per photo by the app; the GPU passes draw at
the size the photo is shown (the canvas never grows past the light copy's detail). Slider: 120 fps
(8 ms frames). Open: ~0.5-1 s from the tap (the old editor ~0.2 s; the difference is starting
the WebView). Export at full size ~5.5 s. Outputs larger than 4096 px are copied out of the GPU in
4096 px pieces: browsers silently shrink a larger WebGL canvas.
