# PixelMorph

A React Native photo and video editing application with AI capabilities.

**Status**: Foundation complete, ready for implementation  
**Timeline**: ~2 months to MVP  
**Platform**: iOS & Android via React Native

---

## Quick Start (For New Team Members)

New to this project? Start here:

1. **[Read the Architecture Summary](ARCHITECTURE.md)** (5 min read, high-level overview)
2. **[Read the Project README](docs/README.md)** (10 min, understand what we're building)
3. **[Read the Architecture Guide](docs/architecture.md)** (15 min, system design)
4. **[Read the Modules Guide](docs/modules.md)** (15 min, what each module does)
5. **[Read the Agent Rules](docs/agent-rules.md)** (10 min, rules you must follow)

After that:
- **Picking a task?** → [Task Template](docs/task-template.md) + [Backlog](docs/backlog.md)
- **Want to know what's next?** → [Next Steps](docs/next-steps.md)
- **Curious about architecture decisions?** → [ADRs](docs/decisions/)

**Total reading time**: ~1 hour to understand the project completely.

---

## Project Overview

### What is PixelMorph?

PixelMorph is a mobile photo and video editing application that:
- Allows users to edit photos and videos on their mobile device
- Supports non-destructive editing (unlimited undo/redo)
- Works offline (core editing doesn't require internet)
- Has AI-powered features (background removal, upscaling, etc.)
- Supports collaboration (sync projects across devices)
- Has a community (share and discover edited media)

### Why This Architecture?

The project uses **Modular Monolith** + **Hexagonal Architecture** (Ports & Adapters):
- ✅ Multiple agents can work in parallel
- ✅ Easy to swap libraries (FFmpeg alternatives, rendering engines)
- ✅ Core domain logic independent of infrastructure
- ✅ Clear module boundaries prevent contamination
- ✅ Offline-first design built in

---

## Project Structure

```
PixelMorph/
├── docs/                    # Complete documentation (start here!)
│   ├── README.md           # Project overview
│   ├── architecture.md      # System design (detailed)
│   ├── modules.md          # Module descriptions
│   ├── requirements.md      # User stories → technical
│   ├── agent-rules.md      # Rules for all agents
│   ├── task-template.md    # How to create tasks
│   ├── definition-of-done.md # When work is complete
│   ├── backlog.md          # Initial backlog with dependencies
│   ├── risks.md            # Risk register
│   ├── dependencies.md     # Library evaluation policy
│   ├── domain.md           # Core domain entities
│   ├── environments.md     # Dev/staging/prod config
│   ├── next-steps.md       # What to work on next
│   └── decisions/          # Architecture Decision Records (ADRs)
│       ├── ADR-001-modular-hexagonal-architecture.md
│       └── ADR-002-non-destructive-editing.md
│
├── src/                     # Application code (empty, ready for implementation)
│   ├── app/                # Application shell and navigation
│   ├── core/               # Shared domain, ports, infrastructure
│   ├── modules/            # Feature modules (photo, video, etc.)
│   └── infrastructure/     # Adapters and external services
│
├── tests/                   # Test infrastructure (empty, ready)
│
├── ARCHITECTURE.md         # Quick architecture reference (start here!)
└── README.md              # This file
```

---

## Key Concepts

### Architecture: Modular Monolith

```
Single React Native App (one deployable unit)
├── Photo Editor Module (independent)
├── Video Editor Module (independent)
├── Camera Module (independent)
├── AI Module (independent)
└── ... other modules ...
```

Each module is worked on independently but runs in a single app.

### Architecture: Hexagonal (Ports & Adapters)

Domain logic never depends on libraries:

```
Photo Editor Domain
  ↓
(uses PhotoEditPort)
  ↓
Adapters (SkiaAdapter, SQLiteAdapter, etc.)
  ↓
External Libraries (Skia, SQLite, FFmpeg, etc.)
```

This lets us swap libraries without changing domain logic.

### Editing Model: Non-Destructive

```
Original Photo + Operations List = Current State

User adjusts brightness → Add operation to list
User presses undo → Remove operation from list
User exports → Apply all operations + render

Result: Unlimited undo/redo, works offline!
```

---

## Documentation Roadmap

### For Everyone
- [ARCHITECTURE.md](ARCHITECTURE.md) - High-level overview
- [docs/README.md](docs/README.md) - Project introduction

### For Implementers
- [docs/architecture.md](docs/architecture.md) - Detailed architecture
- [docs/modules.md](docs/modules.md) - Module descriptions
- [docs/domain.md](docs/domain.md) - Core entities
- [docs/agent-rules.md](docs/agent-rules.md) - Rules you must follow
- [docs/task-template.md](docs/task-template.md) - How to write tasks
- [docs/definition-of-done.md](docs/definition-of-done.md) - When you're done

### For Decision Makers
- [docs/requirements.md](docs/requirements.md) - User stories → features
- [docs/backlog.md](docs/backlog.md) - Task list and prioritization
- [docs/risks.md](docs/risks.md) - Risks and mitigations
- [docs/decisions/](docs/decisions/) - Architecture decisions (ADRs)

### For DevOps/Setup
- [docs/environments.md](docs/environments.md) - Development/staging/production
- [docs/dependencies.md](docs/dependencies.md) - Library policy

### Getting Unstuck
- [docs/next-steps.md](docs/next-steps.md) - What to work on next
- [docs/agent-rules.md](docs/agent-rules.md) - Rules and escalation
- [docs/risks.md](docs/risks.md) - What might go wrong

---

## Status Summary

### ✅ Completed (Foundation Phase)

- [x] Architecture defined (Modular Monolith + Hexagonal)
- [x] 13 modules designed with clear responsibilities
- [x] 24+ tasks in initial backlog with dependencies
- [x] Core domain model defined
- [x] Ports/adapters pattern established
- [x] Agent rules and conduct guidelines
- [x] Definition of Done criteria
- [x] Risk register with mitigations
- [x] 7-sprint plan for 2-month timeline
- [x] All documentation written

### 📋 Next (Research Phase - Week 1-2)

- [ ] Evaluate state management (Redux vs Zustand vs MobX)
- [ ] Prototype FFmpeg integration
- [ ] Benchmark React Native Skia rendering
- [ ] Evaluate camera library options
- [ ] Evaluate AI inference approaches
- [ ] Create ADRs for technology choices

### 🚀 Then (Implementation Phase - Week 2-8)

- [ ] React Native project setup
- [ ] Core domain model implementation
- [ ] Photo editing features
- [ ] Video editing features
- [ ] Camera integration
- [ ] Export functionality
- [ ] AI features (if research successful)
- [ ] Integration and optimization
- [ ] QA and launch prep

---

## Key Statistics

| Metric | Value |
|--------|-------|
| User Stories | 36 |
| Functional Requirements | ~80 |
| Non-Functional Requirements | ~17 |
| Modules Designed | 13 |
| Initial Tasks | 24+ |
| Documentation Pages | 15+ |
| Architecture Decision Records | 2 (more to come) |
| Identified Risks | 15 |
| Timeline (weeks) | 8 |
| Target Platform | iOS & Android |

---

## Important Files

**Must Read First**:
1. [ARCHITECTURE.md](ARCHITECTURE.md) - 5 minute overview
2. [docs/README.md](docs/README.md) - Project introduction
3. [docs/architecture.md](docs/architecture.md) - Detailed design

**Before You Code**:
4. [docs/agent-rules.md](docs/agent-rules.md) - Rules you must follow
5. [docs/task-template.md](docs/task-template.md) - How to write tasks
6. [docs/definition-of-done.md](docs/definition-of-done.md) - When you're done

**When Picking Work**:
7. [docs/backlog.md](docs/backlog.md) - What to work on
8. [docs/next-steps.md](docs/next-steps.md) - Guidance on starting

---

## How to Contribute

1. **Read the foundations**: Start with [ARCHITECTURE.md](ARCHITECTURE.md)
2. **Understand the rules**: Read [docs/agent-rules.md](docs/agent-rules.md)
3. **Pick a task**: Find one in [docs/backlog.md](docs/backlog.md)
4. **Follow the template**: Use [docs/task-template.md](docs/task-template.md)
5. **Write tests**: Required for all tasks
6. **Create PR**: Reference task and acceptance criteria
7. **Pass review**: Architect + Review Agent approval
8. **Merge**: When all checks pass

See [docs/next-steps.md](docs/next-steps.md) for detailed guidance.

---

## Architecture Decisions

We use **Architecture Decision Records (ADRs)** for major decisions.

See [docs/decisions/](docs/decisions/):
- [ADR-001: Modular Monolith + Hexagonal Architecture](docs/decisions/ADR-001-modular-hexagonal-architecture.md)
- [ADR-002: Non-Destructive Editing with Operation Store](docs/decisions/ADR-002-non-destructive-editing.md)

More ADRs coming for technology choices (state management, rendering, media processing, etc.).

---

## Risk Management

15 risks identified and categorized. See [docs/risks.md](docs/risks.md).

**Critical Risks**:
- Video processing performance (uncertain)
- AI feature viability (uncertain)
- Timeline feasibility (2 months might be tight)

**Action**: Research phase (Week 1-2) addresses critical risks.

---

## Timeline

```
Week 1-2: Foundation (✅ DONE) + Research
Week 2-3: Photo Editing
Week 3-4: Video Editing
Week 4-5: Camera & Export
Week 5-6: AI & Integration
Week 6-7: Performance & Polish
Week 7-8: QA & Launch
```

See [docs/backlog.md](docs/backlog.md) for detailed sprint breakdown.

---

## Code Quality Standards

Every task must meet these criteria:

- ✅ Follows architecture patterns (ports/adapters)
- ✅ Has tests (unit + integration)
- ✅ Passes lint
- ✅ Meets all acceptance criteria
- ✅ Zero scope creep
- ✅ Documentation updated
- ✅ Code review approved

See [docs/definition-of-done.md](docs/definition-of-done.md) for complete checklist.

---

## Getting Help

**Questions about**:
- **Architecture** → Read [docs/architecture.md](docs/architecture.md), then ask Architect
- **What to work on** → See [docs/backlog.md](docs/backlog.md) and [docs/next-steps.md](docs/next-steps.md)
- **Task specification** → Read task in backlog or create one following [docs/task-template.md](docs/task-template.md)
- **Code review** → See [docs/agent-rules.md](docs/agent-rules.md)
- **Stuck?** → Check [docs/next-steps.md](docs/next-steps.md) and escalation process

---

## Project Philosophy

1. **Architecture First**: Good architecture enables good work
2. **Documentation as Code**: Docs are as important as code
3. **Pragmatism**: Use proven libraries, avoid reinventing wheels
4. **Parallelism**: Multiple agents can work safely in parallel
5. **Quality**: No shortcuts on core architecture
6. **Clarity**: When in doubt, document

---

## Next Steps

👉 **START HERE**: Read [ARCHITECTURE.md](ARCHITECTURE.md) (5 minutes)

Then:
- If you're **implementing code** → [docs/architecture.md](docs/architecture.md) + [docs/agent-rules.md](docs/agent-rules.md)
- If you're **researching tech** → [docs/dependencies.md](docs/dependencies.md) + [docs/backlog.md](docs/backlog.md)
- If you're **reviewing architecture** → [docs/decisions/](docs/decisions/) + [docs/architecture.md](docs/architecture.md)
- If you're **planning work** → [docs/backlog.md](docs/backlog.md) + [docs/task-template.md](docs/task-template.md)

---

**Foundation Completed**: 2026-09-07  
**By**: Architect Agent (Templasan)  
**Status**: ✅ Ready for implementation

**Let's build PixelMorph!** 🚀
