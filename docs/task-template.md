# Task Template

Every task in PixelMorph must follow this structure. Use this as a template when creating new tasks.

## Complete Task Example

```
TASK-042

Title:
Implement Layer Composition Engine

Objective:
Enable multiple layers with blend modes and opacity in photo editor.

Epic:
Photo Editing Foundations

Module:
photo-editor

Type:
FEATURE (or FIX, REFACTOR, RESEARCH, INFRASTRUCTURE)

Risk Level:
MEDIUM

Priority:
HIGH

Dependencies:
- TASK-021: Layer Domain Model
- TASK-032: Skia Rendering Adapter

Subtasks:
- [ ] Implement LayerCompositor use case
- [ ] Add blend mode enum to domain
- [ ] Create SkiaCompositorAdapter
- [ ] Write composition tests
- [ ] Benchmark rendering performance

Input:
Multiple Layer entities with blend modes and opacity values

Output:
Composite image (Bitmap) with correct blending applied

Acceptance Criteria:
- [ ] Supports all standard blend modes (normal, multiply, screen, overlay, etc.)
- [ ] Opacity on each layer is correctly applied
- [ ] Layer order is respected
- [ ] Performance: Compositing 10 layers < 100ms on mid-range device
- [ ] Blend modes match Photoshop behavior (document which reference)
- [ ] Undo/redo preserves layer state correctly
- [ ] Handles edge cases (no layers, transparent layers, etc.)

Allowed Files:
- modules/photo-editor/domain/** (new entities only)
- modules/photo-editor/application/** (new use cases)
- modules/photo-editor/infrastructure/adapters/SkiaCompositorAdapter.ts
- tests/modules/photo-editor/**

Forbidden:
- ❌ modules/photo-editor/presentation/** (UI not in this task)
- ❌ modules/video-editor/** (wrong module)
- ❌ core/** (modifications need separate approval)
- ❌ src/app/** (app-level code)

Runtime:
Mobile (on-device processing)

Network Requirement:
Not required

Offline Support:
Not applicable (doesn't need network)

Performance Requirements:
- Compositing must complete in < 100ms for typical 10-layer project
- Memory usage must not exceed 50MB for composition
- No significant battery drain during editing

Related Work:
- Related to TASK-041 (Filter Application)
- Related to TASK-043 (Undo/Redo)
- Blocks TASK-052 (Merge Layers)

Testing Requirements:
- Unit tests for LayerCompositor use case
- Integration tests with SkiaAdapter
- Performance benchmarks (10, 20, 50 layer compositions)
- Edge case tests (empty layers, all transparent, etc.)

Implementation Notes:
- Use Skia for rendering (not custom implementation)
- Research blend mode math if not available in Skia
- Consider caching composite results for performance
- Benchmark on physical devices, not emulator

Definition of Done:
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Lint passes
- [ ] No console errors
- [ ] Code reviewed and approved
- [ ] Performance benchmarks meet targets
- [ ] Architecture respected (ports used correctly)
- [ ] Documentation updated if needed
- [ ] No known bugs

Estimated Effort:
2-3 days for implementation + testing

Author:
Architect Agent

Status:
READY

Created:
2026-09-07
```

## Template (Copy & Paste)

```
TASK-XXX

Title:
[Clear, specific title of what's being built]

Objective:
[One paragraph: what problem does this solve?]

Epic:
[Which epic does this belong to? e.g., Photo Editing Foundations]

Module:
[Which module? photo-editor, video-editor, camera, etc.]

Type:
FEATURE | FIX | REFACTOR | RESEARCH | INFRASTRUCTURE

Risk Level:
LOW | MEDIUM | HIGH | EXPERIMENTAL

Priority:
LOW | MEDIUM | HIGH | CRITICAL

Dependencies:
- TASK-XXX: [Description]
- TASK-YYY: [Description]
(or "None" if independent)

Subtasks:
- [ ] [Specific implementation task]
- [ ] [Another task]
- [ ] [Another task]

Input:
[What data does this accept?]

Output:
[What does this produce?]

Acceptance Criteria:
- [ ] [Specific, testable criteria]
- [ ] [Another criterion]
- [ ] [Another criterion]
(Should be 3-10 clear criteria)

Allowed Files:
- modules/[module]/** (be specific)
- tests/** (be specific)

Forbidden:
- ❌ [Module/layer you must NOT touch]
- ❌ [Another forbidden area]

Runtime:
Mobile | Backend | Firebase | Hybrid

Network Requirement:
Required | Optional | Not required

Offline Support:
[If applicable: how does this work offline?]

Performance Requirements:
[e.g., "Operation must complete in < 500ms"]

Related Work:
- Related to TASK-XXX ([Brief description])
- Blocks TASK-YYY ([Brief description])

Testing Requirements:
- [Unit test strategy]
- [Integration test strategy]
- [Performance tests if applicable]
- [Edge case tests]

Implementation Notes:
- [Technical guidance]
- [Libraries to use/avoid]
- [Architectural patterns to follow]

Definition of Done:
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Lint passes
- [ ] Code reviewed
- [ ] [Task-specific item]
- [ ] [Task-specific item]

Estimated Effort:
[e.g., "1-2 days"]

Author:
[Who created this task]

Status:
BACKLOG | READY | IN_PROGRESS | IMPLEMENTED | TESTING | REVIEW | DONE | BLOCKED

Created:
[Date]

Updated:
[Date if updated]
```

## Field Guidance

### Title
- ✅ "Implement Layer Composition Engine"
- ❌ "Photo Editor Stuff"
- ❌ "Make filters work"

Be specific and descriptive.

### Objective
One paragraph explaining the business goal. Why does this matter?

### Epic
Which larger initiative does this belong to? Examples:
- Photo Editing Foundations
- Video Timeline Implementation
- Camera Integration
- AI Features Phase 1

### Module
Single module this task belongs to. Cross-module tasks should be split.

### Type
- **FEATURE**: New functionality
- **FIX**: Bug fix
- **REFACTOR**: Code improvement (must be explicitly requested)
- **RESEARCH**: Investigation (no implementation)
- **INFRASTRUCTURE**: Dev tools, setup, build system

### Risk Level
- 🟢 **LOW**: Straightforward, well-understood work
- 🟡 **MEDIUM**: Some technical uncertainty
- 🟠 **HIGH**: Significant uncertainty or complexity
- 💀 **EXPERIMENTAL**: Completely unproven

### Priority
- **LOW**: Can be deferred
- **MEDIUM**: Should complete in this sprint
- **HIGH**: Should complete soon
- **CRITICAL**: Blocker for other work

### Dependencies
List all tasks that must be done before this one. Be explicit.

### Input/Output
What does the agent receive? What do they produce?

Examples:
```
Input: Photo and a set of filter parameters
Output: Filtered photo

Input: Project with layers
Output: Composite bitmap
```

### Acceptance Criteria
These are the definition of "done" for this task. Should be:
- Specific (not vague)
- Testable (can verify with tests)
- Complete (covers main scenario + edge cases)
- Realistic (achievable in estimated time)

Bad criteria:
- "Make it fast" (vague)
- "It should work" (untestable)
- "Support everything" (not specific)

Good criteria:
- "Response time < 100ms for typical case"
- "All existing tests pass"
- "Handles edge case of empty input gracefully"

### Allowed/Forbidden Files
Explicitly list what the agent can and cannot touch. This prevents accidental contamination.

### Runtime
Where does this code execute?
- **Mobile**: On-device processing
- **Backend**: Server processing
- **Firebase**: Cloud functions
- **Hybrid**: Split between multiple locations

### Network Requirement
- **Required**: Cannot work without network
- **Optional**: Prefers network but can work offline
- **Not required**: Purely local operation

### Performance Requirements
Any specific performance targets? Examples:
- "Must complete in < 500ms"
- "Memory usage < 50MB"
- "Support 4K video real-time playback"

### Testing Requirements
Specify what kind of tests are expected:
- Unit tests
- Integration tests
- Performance tests
- E2E tests
- Edge case coverage

### Definition of Done
Checklist of what must be true before marking this task complete. Should include:
- Acceptance criteria met
- Tests passing
- Lint passing
- Code review approved
- Documentation updated
- Performance targets met

### Estimated Effort
How long should this take?
- Small: 0.5-1 day
- Medium: 1-2 days
- Large: 2-4 days
- Epic: 5+ days (should probably be split)

If > 3 days, consider breaking into smaller tasks.

## Task Status Workflow

```
BACKLOG
  ↓ (prioritized in sprint)
READY
  ↓ (agent starts work)
IN_PROGRESS
  ↓ (implementation complete)
IMPLEMENTED
  ↓ (testing begins)
TESTING
  ↓ (testing complete, ready for review)
REVIEW
  ↓ (review approved)
DONE

Possible deviations:
IN_PROGRESS → BLOCKED (if dependency appears)
IN_PROGRESS → BACKLOG (if deprioritized)
REVIEW → IN_PROGRESS (if review requires changes)
```

## Important Notes

1. **One task per module** - Don't mix work across modules without justification
2. **Acceptance criteria are sacred** - If something isn't in acceptance criteria, it's not required
3. **Update status as you work** - Status should reflect reality, not aspirations
4. **Document blockers** - If something is blocking you, add it to the task
5. **Test requirements are non-negotiable** - Every task needs tests
6. **No "I'll do it tomorrow" commits** - Tasks aren't done until done

## Task Anti-Patterns

### ❌ Too Vague
"TASK-100: Improve photo editor"
→ Split into specific features

### ❌ Too Big
"TASK-101: Implement entire video editing system"
→ Break into 5-10 smaller tasks

### ❌ No Tests
Task without testing requirements
→ Add specific test requirements

### ❌ No Acceptance Criteria
"Make it work"
→ Add specific, testable criteria

### ❌ Unbounded
"Implement AI features" (which AI features?)
→ Be specific about what AI features

### ❌ No Dependencies
"TASK-200 depends on TASK-150" (but not documented)
→ Make dependencies explicit

## Example: Good vs Bad Task

### ❌ BAD
```
TASK-001
Title: Photo Filters
Objective: Add filters to photos
Module: photo-editor
Acceptance Criteria:
- [ ] It works
Definition of Done:
- [ ] Done when tests pass
```

### ✅ GOOD
```
TASK-001
Title: Implement Standard Photo Filters (Brightness, Contrast, Saturation)
Objective: Enable users to adjust three fundamental photo properties non-destructively
Module: photo-editor
Type: FEATURE
Risk Level: MEDIUM
Priority: HIGH
Dependencies:
- TASK-010: Layer Domain Model

Acceptance Criteria:
- [ ] Supports brightness adjustment (-100 to +100)
- [ ] Supports contrast adjustment (-100 to +100)
- [ ] Supports saturation adjustment (-100 to +100)
- [ ] Adjustments persist in project (non-destructive)
- [ ] Undo/redo works correctly
- [ ] Adjustments render in < 200ms on mid-range device
- [ ] UI shows real-time preview

Allowed Files:
- modules/photo-editor/domain/entities/BrightnessFilter.ts
- modules/photo-editor/application/ApplyFilterUseCase.ts
- tests/modules/photo-editor/**

Testing Requirements:
- Unit tests for each filter calculation
- Integration tests with rendering
- Performance benchmarks
- Edge cases (min/max values, zero operations)

Definition of Done:
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Performance benchmarks meet targets
- [ ] Lint passes
- [ ] Code reviewed and approved
- [ ] No regressions in existing filter code

Estimated Effort:
2-3 days
```

---

**Golden Rule**: A well-written task saves time. An vague task costs time. Spend time on clarity upfront.
