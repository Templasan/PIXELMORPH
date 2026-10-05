# ADR-005: Hexagonal only at real boundaries; editor state outside React

**Date**: 2026-10-05
**Status**: ACCEPTED
**Refines**: ADR-001, ADR-003 · **Supersedes**: ADR-004

## Context

ADR-001/003 set a modular hexagonal architecture. In practice (Sprint 1–2, built in a few days):

- `CompositionRoot` instantiated 7 modules, but screens only used `projects`. The ports/adapters of `ai`, `audio`, `camera`, `export` and `video-editor` were stubs (`// TODO: FFmpeg`) that nothing called. FFmpeg (ADR-004) was never added; video export is the native module `modules/pixelmorph-video-export`.
- The real application layer lived inside 1000–2000 line screens (`VideoEditorScreen`, `PhotoEditorScreen`), which caused lag (any state change re-rendered the whole editor, including the Skia canvas) and regressions (unrelated features coupled in one component).
- The one pattern that measurably fixed lag was the time store: state outside React, read by `useSyncExternalStore` only where it is drawn.

## Decision

1. **A port exists only when there is a real adapter behind it.** No ports "for later". Speculative ports and stubs are deleted.
2. **Each editor module has `domain/` (pure), `application/` (store + use cases), `ports/`, `infrastructure/`.** The screen is presentation only.
3. **Editor state lives in `core/state` stores** (`createStore` + `useStore(store, selector, isEqual)`); components subscribe to the slice they draw. No new state library unless this proves insufficient.
4. **Boundaries are enforced by ESLint** (`no-restricted-imports`), not by convention.
5. **Video export goes through the native module** behind a `VideoExportPort`. ADR-004 (FFmpeg / backend encoding) is superseded.
6. **Persisted formats are versioned**; any change bumps `version` and ships a migration with a test against real data from the previous version.

## Consequences

- Smaller, truthful module surface; `CompositionRoot` only wires what is used.
- Refactor proceeds screen by screen (video → photo → projects/camera), each step verified against the Sprint 2 acceptance criteria and on device. Plan and log: `docs/foundation-plan.md`.
- Until a screen is extracted, it still holds application logic; that is tracked debt, not the target.
