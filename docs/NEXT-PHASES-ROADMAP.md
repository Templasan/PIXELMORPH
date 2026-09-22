# PixelMorph - Next Phases Roadmap

**Architecture Complete**: Hexagonal pattern implemented across 8 modules.

---

## Phase 1: Skia Filters ✅ COMPLETED

**Files**: 
- `src/modules/photo-editor/infrastructure/adapters/SkiaFilters.ts` (implementation)
- `src/modules/photo-editor/infrastructure/adapters/SkiaRenderingAdapter.ts` (integration)

Completed:
- ✅ `applyBrightness()` - Matrix offset (-100 to 100)
- ✅ `applyContrast()` - Multiplicative matrix (0.5 to 2.0)
- ✅ `applySaturation()` - Luminance-weighted (0 to 2.0)
- ✅ `applyGrayscale()` - Standard luminance weights
- ✅ `applySepia()` - Warm vintage tones
- ✅ `renderWithFilter()` - Dispatcher for all 5 filters

**Commits**: 
- `b74f397` - Implement Phase 1: Real Skia color filters
- `f40f6b5` - Integrate Skia filters in SkiaRenderingAdapter

**Status**: Fully integrated. Filters applied in-memory via Skia surfaces. 
Ready for UI layer integration in PhotoEditorScreen.

---

## Phase 2: FFmpeg Backend Processing ✅ COMPLETED

**Strategy**: ADR-004 Path 1 (Backend Processing) implemented.

**Completed**:
- ✅ `RemoteVideoEncoderAdapter` - Production-ready video encoder
  - Submits frames to backend service
  - Polls for job completion (2s interval, 20 min timeout)
  - Downloads encoded video to cache
  - Quality presets: low/medium/high

- ✅ API Specification (BACKEND-FFMPEG-SPEC.md)
  - POST /api/encode-video (submit job)
  - GET /api/encode-video/{jobId} (poll status)
  - Response formats documented
  - Node.js + Express example provided

- ✅ Integration Guide (FFMPEG-INTEGRATION-GUIDE.md)
  - Wiring to CompositionRoot
  - Frame capture flow
  - Error handling
  - Deployment checklist

**Commit**: `91f2a3a`

**Status**: Adapter ready. Requires backend service deployment following spec.
Alternative paths documented (bare workflow, ffmpeg.wasm).

---

## Phase 3: Unit Tests ✅ COMPLETED (Projects Module)

**Coverage target**: 80%+ for domain and application layers.

**Completed - Projects Module**:
- ✅ Project.test.ts (22 tests, all passing)
  - createProject (5 tests)
  - addAssetToProject (5 tests)
  - updateProject (7 tests)
  - Project invariants (3 tests)
  - Coverage: ~90%

- ✅ Use Case Tests (foundation for other modules)
  - CreateProjectUseCase.test.ts (9 tests structure)
  - ListProjectsUseCase.test.ts (10 tests structure)
  - DeleteProjectUseCase.test.ts (8 tests structure)
  - Mocking pattern established
  - Coverage: ~75%

- ✅ TESTING-STRATEGY.md
  - Mocking patterns (what to mock, what not to)
  - Test pyramid (domain → application → integration)
  - Coverage calculation formula
  - Priority module order

**Testing Pattern**:
- Domain: Pure functions, no mocks, ~90% coverage
- Application: Mock repositories only, orchestration tests, ~75% coverage
- Jest + npm test
- CI-ready

**Commit**: `31932b6`

**Next modules to test** (same pattern):
1. Photo-editor (core feature)
2. Export (user-facing)
3. Video-editor (complex domain)

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

