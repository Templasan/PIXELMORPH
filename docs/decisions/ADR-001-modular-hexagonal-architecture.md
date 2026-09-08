# ADR-001: Modular Monolith + Hexagonal Architecture

**Date**: 2026-09-07  
**Status**: ACCEPTED  
**Context**: PixelMorph needs architecture that enables parallel agent work, library swapping, and offline support.

## Problem

PixelMorph is a complex media editing application with:
- Multiple features (photo, video, camera, AI, export)
- Multiple teams/agents working in parallel
- Frequent library changes (FFmpeg alternatives, rendering engines)
- Local + optional backend processing
- Offline-first requirements

Traditional approaches:
- **Flat monolith**: Hard to modularize, agents interfere with each other
- **Microservices**: Overkill for a mobile app, adds network complexity
- **Tightly coupled**: Difficult to swap libraries, changes break everything

## Decision

Adopt **Modular Monolith** with **Hexagonal Architecture** (Ports & Adapters):

```
Modular Monolith
├── Single React Native app (no internal microservices)
└── Multiple independent modules (photo, video, camera, ai, etc.)
    ├── Each module follows Hexagonal Architecture
    ├── Core domain logic (no library dependencies)
    ├── Ports (abstract interfaces)
    └── Adapters (concrete implementations)
```

Key principles:
1. **Single deployable unit** - One mobile app
2. **Independent modules** - Each can be worked on separately
3. **Hexagonal boundaries** - Domain logic isolated from infrastructure
4. **Ports & Adapters** - Libraries pluggable, not embedded in logic

## Rationale

### Why Not Flat Monolith?
- ❌ All agents working in `src/app` would conflict
- ❌ No clear boundaries between features
- ❌ Hard to prevent inappropriate cross-module dependencies
- ❌ Hard to isolate complex features like video editing

### Why Not Microservices?
- ❌ Mobile app can't efficiently call multiple services
- ❌ Network latency kills UX for editing operations
- ❌ Complex deployment and communication
- ❌ Overkill for "edit on my phone" use case

### Why Modular Monolith?
- ✅ Single app, clear module boundaries
- ✅ Each module can be developed independently
- ✅ Clear contracts between modules
- ✅ No internal network calls
- ✅ Agents work on different modules in parallel

### Why Hexagonal Architecture?
- ✅ Domain logic never depends on libraries
- ✅ Easy to swap FFmpeg ↔ alternative encoder
- ✅ Easy to swap Firebase ↔ custom backend
- ✅ Easy to swap local ↔ remote AI
- ✅ Testable domain logic (no infrastructure dependencies)

## Structure

```
src/
├── app/
│   ├── screens/           # UI components
│   ├── navigation/        # App routing
│   └── providers/         # Global providers
│
├── core/
│   ├── domain/            # Shared entities
│   ├── application/       # Base services
│   ├── ports/             # Abstract interfaces
│   ├── infrastructure/    # Generic adapters
│   └── shared/            # Utilities
│
└── modules/               # Feature modules
    ├── photo-editor/
    │   ├── domain/        # Photo entities
    │   ├── application/   # Photo use cases
    │   ├── ports/         # Photo ports
    │   ├── infrastructure/# Photo adapters
    │   ├── presentation/  # Photo UI
    │   └── tests/
    ├── video-editor/
    │   └── (same structure)
    ├── camera/
    ├── ai/
    └── export/
```

Each module:
- 👍 Can be worked on independently
- 👍 Has clear responsibilities
- 👍 Depends only on Core layer
- 👍 Is replaceable without affecting others

## Consequences

### Positive
✅ Agents can work in parallel without conflict  
✅ Library replacements only affect one adapter  
✅ Domain logic testable without infrastructure  
✅ Clear module boundaries prevent contamination  
✅ Offline support achievable at module level  

### Negative
⚠️ More files/structure than flat approach  
⚠️ Requires discipline in dependency management  
⚠️ Agents must follow port/adapter pattern  

## Mitigation for Negatives

**Extra files**: Documentation and code generation tools minimize this.  
**Requires discipline**: Agent rules enforce this; reviews catch violations.

## Examples

### Example 1: Switching Video Encoder
Without Hexagonal Architecture:
```
Video module directly imports FFmpeg
If we want to switch → refactor entire module
Risk: High
```

With Hexagonal Architecture:
```
Video module uses MediaEncoderPort
FFmpegAdapter implements MediaEncoderPort
To switch → create AlternativeEncoderAdapter, update configuration
Risk: Low
```

### Example 2: Offline Support
Without Hexagonal Architecture:
```
Camera module calls Firebase directly
Offline → feature broken
```

With Hexagonal Architecture:
```
Camera module uses SyncPort abstraction
Local implementation works offline
Remote implementation syncs when available
Offline → works with local adapter
```

## Related Documents

- [architecture.md](../architecture.md) - Implementation details
- [modules.md](../modules.md) - Module descriptions
- [agent-rules.md](../agent-rules.md) - Agents must follow this

## Reviewed By

- Architect Agent (Templasan)

## Decision Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-09-07 | PROPOSED | Initial decision |
| 2026-09-07 | ACCEPTED | Foundation for project |
