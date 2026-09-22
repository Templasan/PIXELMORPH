# PixelMorph - Next Phases Roadmap

**Architecture Complete**: Hexagonal pattern implemented across 8 modules.

---

## Phase 1: Skia Filters (In Progress)

**File**: `src/modules/photo-editor/infrastructure/adapters/SkiaFilters.ts`

Implementations needed:
- ✅ Structure created
- [ ] `applyBrightness()` - use Skia.ColorFilter or canvas transforms
- [ ] `applyContrast()` - matrix operations or shader
- [ ] `applySaturation()` - color matrix
- [ ] `applyGrayscale()` - desaturation
- [ ] `applySepia()` - color tone transform

**Integration**: Update `SkiaRenderingAdapter.renderWithFilter()` to call these functions.

---

## Phase 2: FFmpeg Backend Processing

**Strategy**: ADR-004 recommends backend approach.

**Steps**:
1. Create backend service (separate project)
   - Endpoint: POST /api/encode-video
   - Accept: base64 frames, fps, dimensions, quality
   - Return: encoded video URL or blob

2. Implement `RemoteVideoEncoderAdapter`
   - `src/modules/export/infrastructure/adapters/RemoteVideoEncoderAdapter.ts`
   - Upload frames
   - Trigger encoding
   - Poll for completion
   - Download result

3. Wire via configuration
   - Choose between FFmpegEncoderAdapter (stub) and RemoteVideoEncoderAdapter

---

## Phase 3: Unit Tests - Domain + Application

**Coverage target**: 80%+ for domain and application layers.

**File structure**:
```
src/modules/{module}/tests/
├── domain/
│   ├── Project.test.ts
│   ├── MediaAsset.test.ts
│   └── ...
└── application/
    ├── CreateProjectUseCase.test.ts
    ├── ListProjectsUseCase.test.ts
    └── ...
```

**Tools**: Jest (already installed)

**Priority modules** (in order):
1. Projects (most critical)
2. Photo-editor (core feature)
3. Export (user-facing)
4. Video-editor (complex domain)

---

## Phase 4: Screen Refactoring - Use CompositionRoot

**Objective**: All screens use `AppCompositionRoot` for dependencies.

**Pattern**:
```typescript
// Before
import { createProjectsModule } from '@modules/projects';
const module = createProjectsModule();

// After
import { AppCompositionRoot } from '@app/CompositionRoot';
const { projects } = AppCompositionRoot;
```

**Scope**:
- Update all screens in `src/app/screens/`
- Remove direct module instantiation
- Use Context if needed for reactive state

**Files to update**: ~20 screen files

---

## Phase 5: Performance Tuning

**Profiling checklist**:
- [ ] Canvas rendering (Skia) performance
- [ ] Image loading and caching
- [ ] Memory usage during editing
- [ ] Bundle size analysis
- [ ] Video encoding performance (when backend ready)

**Tools**:
- React Native Debugger
- Expo Performance Monitor
- Hermes debugger

---

## Timeline Estimate

| Phase | Effort | Timeline |
|-------|--------|----------|
| Skia Filters | Medium | 3-5 days |
| FFmpeg Backend | High | 1-2 weeks |
| Unit Tests | High | 2-3 weeks |
| Screen Refactor | Medium | 1 week |
| Performance | Medium | 1 week |

**Total**: ~6-8 weeks for full implementation.

---

## Current Status

✅ Foundation complete:
- Hexagonal architecture
- 8 modules structured
- Adapters prepared
- Composition root created
- ADRs documented

🔄 Ready for:
- Parallel development
- Library integration
- Testing
- Performance optimization

---

## Notes

- All adapters are structured with clear TODO comments
- Each module is independent and can be developed in parallel
- Backend service needed for video export
- Migration to bare workflow optional (for full FFmpeg support)

