# PixelMorph - Project Foundation

**PixelMorph** is a React Native photo and video editing application with AI capabilities, designed for mobile platforms (iOS and Android).

## Quick Start for New Agents

If you're entering this project, read these in order:

1. **[README.md](README.md)** (this file) - Overview
2. **[architecture.md](architecture.md)** - System architecture and design principles
3. **[modules.md](modules.md)** - Module descriptions and responsibilities
4. **[requirements.md](requirements.md)** - Mapped requirements and technical components
5. **[agent-rules.md](agent-rules.md)** - Rules you must follow
6. **[task-template.md](task-template.md)** - How to create and describe tasks
7. **[definition-of-done.md](definition-of-done.md)** - When a task is actually complete
8. **[backlog.md](backlog.md)** - Current backlog with dependencies
9. **[risks.md](risks.md)** - Risk assessment and experimental features

## Project Goals

- **Timeline**: ~2 months
- **Scope**: 36 User Stories → ~80 functional requirements → ~17 non-functional requirements
- **Primary Goal**: Deliver a functional photo/video editing app with AI features
- **Secondary Goals**: Maintainability, offline support, collaboration features, experimental 360° video

## Core Principles

1. **Modular Monolith + Hexagonal Architecture** - Single mobile app, multiple independent modules
2. **No Microservices** - All code runs on mobile; backend/Firebase are adapters, not core
3. **Ports & Adapters** - Domain logic never depends on libraries, APIs, or infrastructure
4. **Pragmatism** - Use mature libraries; avoid reinventing the wheel
5. **Parallelism** - Multiple agents can work simultaneously with clear contracts
6. **Safety First** - Changes require justification; architecture is protected

## Key Characteristics

### Non-Destructive Editing
Projects store original media + operations, enabling undo/redo and layer-based editing.

### Local-First with Optional Backend
- Photo/video editing runs entirely on device
- Collaboration, sync, and community features use optional backend/Firebase
- Offline support is mandatory for core editing

### Experimental Features Isolated
- 360° video editing is marked as experimental
- Can be disabled or replaced without affecting core
- Full isolation via ports/adapters

### AI Integration
- Local inference where possible (on-device models)
- Remote inference where necessary (heavy processing)
- Clear API contract between domain and AI layer

## What This Project Is NOT

❌ Not a monolithic codebase without structure  
❌ Not microservices within the mobile app  
❌ Not overengineered with 50 abstraction layers  
❌ Not a place to implement technologies from scratch  
❌ Not a free-for-all for multiple agents  
❌ Not ready for feature implementation yet

## Project Structure

```
src/
├── app/                 # Application shell, navigation, screens
├── core/                # Shared domain, ports, infrastructure abstractions
├── modules/             # Feature modules (photo, video, camera, ai, etc.)
└── infrastructure/      # Adapters for services, APIs, libraries

docs/                    # All documentation
tests/                   # Test infrastructure
```

## Next Steps

This foundation was built by the Architect Agent. Before any feature implementation:

1. ✅ Architecture is defined → Review in [architecture.md](architecture.md)
2. ✅ Modules are designed → Review in [modules.md](modules.md)
3. ✅ Agent rules are set → Review in [agent-rules.md](agent-rules.md)
4. ✅ Backlog is created → Review in [backlog.md](backlog.md)
5. ⏭️ Research phase begins → Technology evaluation phase
6. ⏭️ Implementation phase → Agents start building modules
7. ⏭️ Integration phase → Modules are connected
8. ⏭️ Testing phase → QA and verification
9. ⏭️ Release phase → Production deployment

## Contact

**Project Lead (Architect)**: Templasan  
**Documentation Owner**: Architecture Team  
**Last Updated**: 2026-09-07

---

**Golden Rule**: When in doubt, check the documentation first. If not documented, that's a documentation bug, not an excuse to invent behavior.
