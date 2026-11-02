# Web design preview

The app's real screens in a browser, with sample data, to change the design without recompiling.

```bash
npm run web
```

Opens http://localhost:8082. Saving a file updates the page. The side panel (on a window at least
720 px wide) picks the phone width, the account state and the sync result. The editors run from
their own dev servers on ports 5175 (photo) and 5174 (video), in an iframe, with their own hot
reload.

## How it stays out of the app

Everything mocked lives in `.web.ts(x)` files and `src/web-preview/`. Metro picks `.web` files only
for the web platform, so none of this reaches the Android bundle, and nothing leaves the browser:
no Supabase, Google or media server calls.

| Web file | Replaces |
| --- | --- |
| `src/app/Root.web.tsx` | `Root.tsx`: phone column, side panel, drawn alerts (React Native Web's `Alert` does nothing) |
| `src/modules/account/infrastructure/SupabaseAuthGateway.web.ts` | Login: forms only change the state |
| `src/modules/projects/sync.web.ts` | Sync: canned results |
| `src/modules/projects/infrastructure/FileSystemMediaFileStore.web.ts` | Media files |
| `src/app/screens/projects/cardThumb*.web.ts` | Thumbnails: the sample photo itself |
| `src/app/screens/{Photo,Video}EditorWebScreen.web.tsx` | The WebView: an iframe to the dev server |
| `modules/pixelmorph-video-export/src/index.web.ts` | The native exporter |

Sample projects go through the real repository into the browser's storage. "Restaurar projetos de
exemplo" resets them. Screens themselves are not copied: editing one changes the app too.

## What the browser cannot tell you

Check on a device before calling a design done:

- Fonts, shadows, safe areas, keyboard and gestures differ from Android.
- The camera screen only reaches its permission message, and it asks the browser for the camera.
- `video-editor-web/media/` is not committed, so the video editor opens empty until a clip is there.
- Native pickers, notifications, HEIC and video export through the app do not exist here.
