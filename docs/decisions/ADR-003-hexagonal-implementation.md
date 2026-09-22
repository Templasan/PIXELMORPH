# ADR-003: Hexagonal Architecture Implementation

**Date**: 2026-09-22  
**Status**: IMPLEMENTED  
**Context**: Following ADR-001, the codebase was refactored to implement the Hexagonal Architecture across all core modules.

## Decision

Implement Hexagonal Architecture (Ports & Adapters) pattern across:
1. Core layer (`src/core/`)
2. Projects module (`src/modules/projects/`)
3. Photo Editor module (`src/modules/photo-editor/`)
4. Video Editor module (`src/modules/video-editor/`)

## Implementation Summary

### Core Layer (`src/core/`)

**Domain** (`src/core/domain/`):
- `BaseEntity` — base class for all entities with id and timestamps
- `DomainError`, `ValidationError`, `NotFoundError` — domain-specific exceptions
- `UUID` type — branded type for type safety

**Application** (`src/core/application/`):
- `UseCase` — base class for use cases (optional, for structure)
- `UseCaseResult<T>` — standard result type with success/error
- `DTO` — base interface for data transfer objects

**Ports** (`src/core/ports/`):
- `LoggerPort` — abstraction for logging
- `StoragePort` — abstraction for key-value storage
- `RepositoryPort<T>` — generic repository interface
- Module-specific ports (PresetsRepository, RecentAdjustmentsRepository, WatermarkPresetsRepository)

**Infrastructure** (`src/core/infrastructure/`):
- `CONFIG` — centralized configuration by environment
- `errorLogger` — concrete logging implementation

**Theme & UI** (`src/core/theme/`, `src/core/ui/`):
- Consolidated theme system (colors, typography, spacing)
- Generic UI components with zero module dependencies

### Projects Module (`src/modules/projects/`)

**Domain** (`domain/`):
- `Project` — entity with validation functions
- `MediaAsset`, `MediaMetadata` — supporting entities
- Pure functions: `createProject()`, `addAssetToProject()`, `updateProject()`

**Ports** (`ports/`):
- `ProjectRepository` — contract for project persistence
- Exception types: `ProjectNotFoundError`, `DataCorruptionError`, `StorageError`

**Application** (`application/usecases/`):
- 12 use cases with dependency injection
- Each accepts repository via constructor
- Examples: `CreateProjectUseCase`, `ListProjectsUseCase`, `ArchiveProjectUseCase`

**Infrastructure** (`infrastructure/`):
- `LocalProjectRepository` — AsyncStorage implementation with backup + integrity checking
- `ProjectMapper` — Entity ↔ DTO conversion
- `ProjectPersistenceDTO` — serialization format

**Bootstrap** (`bootstrap.ts`):
- `ProjectsModuleFactory` — composes all projects dependencies

### Photo Editor Module (`src/modules/photo-editor/`)

**Domain** (`domain/`):
- Entities: `Preset`, `Mask`, `Watermark`, `QRCode`, `Layer`, etc.
- Pure functions for domain logic
- No library dependencies

**Ports** (`ports/`):
- `ImageRenderingPort` — abstraction for rendering (Skia, Canvas)
- `ImageProcessingPort` — abstraction for image transformations
- `ImageExportPort` — abstraction for export (JPEG, PNG)
- Error types: `PhotoEditorError`, `RenderingError`

**Application** (`application/usecases/`):
- 15+ use cases with factory functions
- Examples: `SavePresetUseCase`, `ApplyBrushStrokeUseCase`, `CreateColorMaskUseCase`

**Infrastructure** (`infrastructure/adapters/`):
- `SkiaRenderingAdapter` — Skia rendering implementation (stub)
- `SkiaImageProcessingAdapter` — image processing implementation (stub)
- `ImageExportAdapter` — export implementation (stub)
- All marked with `ponytail:` comments for future integration

**Bootstrap** (`bootstrap.ts`):
- `PhotoEditorModuleFactory` — composes rendering, processing, export adapters

**Utilities** (`color/`, `effects/`, `geometry/`, etc.):
- Domain services and pure functions
- No infrastructure dependencies
- Reusable across use cases

### Video Editor Module (`src/modules/video-editor/`)

**Domain utilities** (`Timeline`, `Track`, `audio`, `frameMath`, etc.):
- Pure functions for timeline logic
- No rendering/encoding logic (moved to infrastructure)

**Ports** (`ports/`):
- `VideoDecoderPort` — abstraction for video frame extraction
- `VideoEncoderPort` — abstraction for video encoding/export
- `AudioProcessingPort` — abstraction for audio operations
- Error types: `VideoEditorError`, `EncodingError`

**Infrastructure** (`infrastructure/adapters/`):
- `FFmpegDecoderAdapter` — FFmpeg decoding (stub)
- `FFmpegEncoderAdapter` — FFmpeg encoding (stub)
- `FFmpegAudioProcessingAdapter` — audio processing (stub)

**Bootstrap** (`bootstrap.ts`):
- `VideoEditorModuleFactory` — composes decoder, encoder, audio adapters

## Dependency Flow

```
UI Screens (React)
  ↓ calls
Use Cases (Application)
  ↓ orchestrates
Domain Entities & Pure Functions
  ↓ via
Ports (Abstractions)
  ↓ implemented by
Adapters (Infrastructure)
  ↓ calls
External Libraries (Skia, FFmpeg, AsyncStorage)
```

**Key Rule**: Layers only depend on layers below them. No upward dependencies.

## Bootstrap Pattern

Each module has a `bootstrap.ts` file with a `ModuleFactory` class:

```typescript
export class ProjectsModuleFactory {
  static createRepository(): ProjectRepository { /* ... */ }
  static createListProjectsUseCase(): ListProjectsUseCase { /* ... */ }
  // ...
}
```

This centralizes dependency instantiation and makes wiring explicit and testable.

## Global Composition Root

`src/app/CompositionRoot.ts` instantiates all modules:

```typescript
export const AppCompositionRoot = {
  projects: createProjectsModule(),
  photoEditor: createPhotoEditorModule(...),
  videoEditor: VideoEditorModuleFactory.createVideoEditorModule(),
};
```

Screens access modules through this root, ensuring single source of truth for dependencies.

## Benefits Realized

✅ **Domain Logic Isolated**: No library imports in `domain/` folders  
✅ **Library Swappable**: Adapters can be replaced without touching domain or use cases  
✅ **Testable**: Domain and use cases can be tested without infrastructure  
✅ **Clear Contracts**: Ports define what each module provides  
✅ **Parallel Development**: Teams can work on modules independently  
✅ **Easy Refactoring**: Strong boundaries prevent accidental dependencies  

## Stubs & TODOs

Several adapters are marked with `ponytail:` comments indicating incomplete implementations:
- `SkiaRenderingAdapter` — Skia integration pending
- `SkiaImageProcessingAdapter` — Skia integration pending
- `FFmpegDecoderAdapter` — FFmpeg module integration pending
- `FFmpegEncoderAdapter` — FFmpeg module integration pending

These should be completed as libraries are integrated.

## Next Steps

1. **Integrate Skia** — implement rendering and processing adapters
2. **Integrate FFmpeg** — implement video encoding/decoding
3. **Wire UI Context** — consider React Context for global composition root
4. **Add Tests** — unit tests for domain, integration tests for adapters
5. **Profile Performance** — measure rendering and encoding times

## Files Modified

- Created: `src/core/domain/index.ts`, `src/core/application/index.ts`, `src/core/infrastructure/`
- Created: `src/modules/projects/bootstrap.ts`
- Created: `src/modules/photo-editor/ports/`, `src/modules/photo-editor/infrastructure/`, `src/modules/photo-editor/bootstrap.ts`
- Created: `src/modules/video-editor/ports/`, `src/modules/video-editor/infrastructure/`, `src/modules/video-editor/bootstrap.ts`
- Created: `src/app/CompositionRoot.ts`
- Modified: Module `index.ts` files to export new structures

## Related Documents

- [ADR-001: Modular Hexagonal Architecture](./ADR-001-modular-hexagonal-architecture.md)
- [ADR-002: Non-Destructive Editing](./ADR-002-non-destructive-editing.md)
- [architecture.md](../architecture.md) — System design overview

## Reviewed By

- Architect (Templasan)
