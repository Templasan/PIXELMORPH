# Architecture

PixelMorph is a local-first React Native (Expo, Android) app: a modular monolith with hexagonal
modules **where there is a real boundary** (ADR-001, ADR-003, refined by ADR-005).

> Transition in progress: screens are being extracted into this shape one at a time. What is
> done and what is pending is tracked in [`foundation-plan.md`](foundation-plan.md) §8.

## Layout

```
src/
  app/                      composition + presentation
    App.tsx, CompositionRoot.ts, navigation/
    screens/<feature>/      screen = layout + wiring; small components read the store by selector
  core/                     shared kernel — no feature code, never imports src/modules
    state/                  createStore + useStore (editor state outside React)
    history/                undo/redo + debounced autosave (RF-027, RNF-005)
    reliability/            error log (RNF-017), storage usage
    i18n/ theme/ ui/        translations, tokens, base components
  modules/<module>/
    domain/                 pure functions and types — no React, Expo, Skia
    application/            the module's store + use cases (the rules)
    ports/                  interfaces for real external dependencies only
    infrastructure/         adapters: native export, Skia, FileSystem, AsyncStorage, expo-camera
    index.ts                public API — the only import path for other code
modules/pixelmorph-video-export/   Expo native module (Android, Media3) used for video export
```

## Dependency rules

| From | May import | Must not import |
|---|---|---|
| `app/**` | `@core/*`, `@modules/<m>` (index only) | `@modules/<m>/infrastructure/**`, other internals |
| `modules/<m>/domain/**` | its own domain, `@core/*` pure parts | `react`, `react-native`, `expo-*`, Skia, `infrastructure/` |
| `modules/<m>/application/**` | its `domain/`, its `ports/`, `@core/*` | its `infrastructure/` (injected instead) |
| `modules/<m>/infrastructure/**` | its `ports/`, `domain/`, platform libs | other modules' internals |
| `modules/<a>/**` | `@modules/<b>` index only | `@modules/<b>/**` internals |
| `core/**` | `core/**`, platform libs | `@modules/**`, `app/**` |

Enforced by ESLint `no-restricted-imports` (see `.eslintrc.cjs`).

## Ports

A port exists only when a real adapter implements it and something calls it (ADR-005). Typical
real boundaries: native video export, Skia rendering/encoding, file system, AsyncStorage
repositories, camera. Pure computation is never behind a port — it lives in `domain/`.

Adapters are created in the module's `bootstrap.ts` and wired in `app/CompositionRoot.ts`.

## State

- Editor state lives in a module store (`core/state` `createStore`), not in screen `useState`.
- Components read with `useStore(store, selector, isEqual)`; only components whose slice changed
  re-render. Use `shallowEqual` when the selector builds an object or array.
- Gesture-driven values (sliders, playhead) stay on the UI thread (Reanimated) and commit to the
  store at a throttled rate / on gesture end.
- Undo/redo goes through `core/history` (`usePersistedHistory`), which also autosaves.

## Persistence

- AsyncStorage keys are owned by one repository each (`project:*`, `layers:*`, `history:*`, ...).
- Keep each stored value well under ~2 MB (Android SQLite row limit); split large data
  (see the segmented error log).
- Persisted DTOs carry `version`; changing a format bumps it and adds a migration + a test that
  loads real JSON from the previous version.

## Testing

- Pure logic (`domain/`, `application/`, `core/`) is unit-tested with Jest.
- Files importing `@shopify/react-native-skia` cannot load under Jest: keep math in a plain `.ts`
  file and the Skia call in a thin wrapper; tests import the pure file directly.
- Before moving behavior, pin it with characterization tests derived from the story's
  acceptance criteria. Screens and native flows are verified on the `Pixel_7` emulator.
- Performance is measured on a **release** build with `scripts/perf/measure.mjs`.
