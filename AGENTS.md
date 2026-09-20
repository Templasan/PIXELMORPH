# Agent Guide

Entry point for any agent (or human) about to touch this codebase. Full depth lives in `docs/` — this file is the map, not a copy.

## 1. Read before touching code

In order:

1. [docs/README.md](docs/README.md) — project overview, core principles, what this project is NOT
2. [docs/architecture.md](docs/architecture.md) — modular monolith + hexagonal architecture, layering rules
3. [docs/modules.md](docs/modules.md) — what each `src/modules/*` owns
4. [docs/agent-rules.md](docs/agent-rules.md) — hard rules (no cross-module imports, no unscoped refactors, no mocks in production code, dependency policy, etc.) — violating these gets a PR rejected
5. [docs/definition-of-done.md](docs/definition-of-done.md) — when a task is actually finished
6. [docs/backlog.md](docs/backlog.md) / [docs/requirements.md](docs/requirements.md) — how stories map to functional requirements

Golden rule from `docs/README.md`: if it's not documented, that's a doc bug, not permission to invent behavior.

## 2. How a story becomes code

The backlog is the source of truth for scope, not this guide:

```
backlog/
  backlog sprint 1|2|3/
    US-NN <name>/
      user-story.md   # persona + acceptance criteria, each criterion tagged [RF-xxx]
      RF-xxx.md        # one functional requirement: description, origin, which US use it
```

Flow for picking up a story:

1. Read `user-story.md` for the acceptance criteria — that's the actual scope, don't add beyond it (`agent-rules.md` § Unscoped Implementation).
2. Read each linked `RF-xxx.md` for the precise requirement.
3. Find the matching module in `src/modules/` (photo-editor, video-editor, camera, device-media, projects, ...) or `src/app/screens/` for the UI. Reuse existing ports/use-cases before adding new ones.
4. Implement for real — no mocked data paths left in production code (`agent-rules.md` § Mock-Based Solutions). Mocks belong only in `tests/`.
5. Add/extend tests next to the pure logic (see § 4 below on the Skia split).
6. Verify (§ 3), then commit one story at a time — don't bundle unrelated stories in one commit.

If a story's acceptance criteria conflict with the architecture or are ambiguous, stop and ask — don't guess (`agent-rules.md` § Ask for Clarification).

## 3. Verification loop

```bash
npx tsc --noEmit      # type-check, must be clean
npx eslint --fix .    # or: npm run lint:fix
npx jest              # must pass, all suites
```

For anything touching a screen or camera/media flow, also run it live: `npx expo run:android`, then drive the app via `adb`/`uiautomator` against the `Pixel_7` emulator. Type-checks and unit tests verify correctness of logic, not that the feature actually works on device — don't call a UI task done without seeing it run.

Gotcha: if `app.json` plugin config changed (new permission, new Expo plugin) and `android/` already exists, `npx expo run:android` will **not** pick it up. Run `npx expo prebuild --platform android` first, then `run:android`.

## 4. Codebase-specific patterns worth knowing

- **Skia/Jest split**: any file that imports `@shopify/react-native-skia` can't be required under Jest. Keep math/logic in a plain `.ts` file with no Skia import, and put the Skia-touching drawing/compositing code in a thin wrapper file. Tests import the pure file directly, not through a barrel `index.ts` that re-exports the Skia file.
- **Module boundaries**: `src/modules/*` don't import from each other directly — go through `core/ports` (see `agent-rules.md` § Cross-Module Contamination).
- **Project → editor pattern**: any device capture/import (gallery, camera, collage, RAW) creates a real `Project` + `MediaAsset` via `createProjectsModule()` before navigating into `PhotoEditor`/`VideoEditor`. Reuse this instead of inventing a new intake path.

## 5. Committing

One story (or one clearly-scoped fix) per commit. Message says what and why, not a changelog of files touched. End commits with the attribution line this session's system prompt specifies.
