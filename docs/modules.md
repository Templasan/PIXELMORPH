# Module Descriptions

## Module Ownership & Responsibilities

Each module is independently deployable but runs in a single React Native app.

## 1. App (Core Shell)

**Location**: `src/app/`  
**Risk**: 🟢 **LOW**  
**Responsibility**: Application bootstrap, navigation, routing

### What It Does
- Initializes providers (Redux, Firebase, context)
- Manages root navigation and routing
- Handles app lifecycle (onAppStart, onAppPause, onAppResume)
- Global error boundaries

### What It Doesn't Do
- ❌ Business logic (moves to modules)
- ❌ UI rendering of features (moves to module screens)
- ❌ Feature-specific navigation (each module handles its own)

### Key Files
```
app/
├── navigation/
│   ├── RootNavigator.tsx      # Main navigation setup
│   ├── AppStack.tsx           # Stack navigators
│   └── types.ts               # Navigation types
├── providers/
│   ├── AppProviders.tsx       # Redux, Firebase providers
│   └── NavigationContainer.tsx
├── screens/
│   ├── SplashScreen.tsx       # App start
│   ├── LoginScreen.tsx        # Authentication
│   └── ProjectListScreen.tsx  # Main entry point
└── configuration/
    ├── environment.ts         # Environment config
    └── constants.ts           # App constants
```

### Dependencies
- None (depends on nothing, everything depends on this)

## 2. Core (Shared Foundations)

**Location**: `src/core/`  
**Risk**: 🟢 **LOW**  
**Responsibility**: Shared domain entities, ports, and utilities

### What It Does
- **domain/**: Shared entities (Project, Layer, Operation, Asset)
- **application/**: Base services and managers
- **ports/**: All port/interface definitions
- **infrastructure/**: Generic adapters and utilities
- **shared/**: Utilities, helpers, type definitions

### What It Doesn't Do
- ❌ Feature-specific logic (moves to modules)
- ❌ Platform-specific code (goes to infrastructure adapters)

### Key Files
```
core/
├── domain/
│   ├── entities/
│   │   ├── Project.ts         # Core project model
│   │   ├── Layer.ts           # Layer abstraction
│   │   ├── Operation.ts       # Edit operation
│   │   ├── Asset.ts           # Media asset reference
│   │   └── ExportFormat.ts    # Export format spec
│   └── exceptions/
│       └── DomainException.ts
├── application/
│   ├── BaseUseCase.ts
│   ├── EventBus.ts
│   └── QueryHandler.ts
├── ports/
│   ├── ProjectRepository.ts
│   ├── MediaEncoderPort.ts
│   ├── StoragePort.ts
│   ├── ApiPort.ts
│   ├── AuthPort.ts
│   ├── CameraPort.ts
│   └── AIServicePort.ts
├── infrastructure/
│   ├── repositories/
│   │   └── BaseRepository.ts
│   └── logger/
│       └── Logger.ts
└── shared/
    ├── types.ts               # Global type definitions
    ├── utils.ts               # Utility functions
    └── constants.ts           # Global constants
```

### Dependencies
- React (minimal)
- Type system libraries

## 3. Photo Editor Module

**Location**: `src/modules/photo-editor/`  
**Risk**: 🟡 **MEDIUM**  
**Status**: Foundation ready, implementation pending  
**Responsibility**: Photo editing features

### What It Does
- Load and display photos
- Apply filters, effects, and adjustments
- Layer management (add, delete, merge, reorder)
- Non-destructive editing with undo/redo
- Brush tools (paint, eraser, clone, healing)
- Text overlays
- Geometric transformations (crop, rotate, flip, perspective)

### What It Doesn't Do
- ❌ Video processing (video-editor module)
- ❌ Export (export module)
- ❌ AI processing directly (delegates to AI module via port)
- ❌ Camera capture (camera module)

### Key Entities
- `Photo`: Metadata + layers
- `Layer`: Image data + blend mode + opacity
- `Operation`: Edit operation (filters, transforms, brushstrokes)
- `Mask`: Layer mask for non-destructive masking

### Key Use Cases
- OpenPhotoUseCase
- AddLayerUseCase
- ApplyFilterUseCase
- UndoRedoUseCase
- ExportPhotoUseCase

### Key Ports
- `SkiaRenderingPort`: Rendering layer composition
- `MediaEncoderPort`: Export operations
- `PhotoRepositoryPort`: Persistence

### Estimated Complexity
- Core: Medium (layer management, non-destructive editing)
- Filters: Low (use library)
- Effects: Medium (custom implementations)
- Brushes: High (real-time responsiveness)

## 4. Video Editor Module

**Location**: `src/modules/video-editor/`  
**Risk**: 🟠 **HIGH**  
**Status**: Foundation ready, implementation pending  
**Responsibility**: Video editing features

### What It Does
- Timeline-based video editing
- Clip management (add, trim, reorder)
- Transitions between clips
- Text overlays
- Audio track management
- Speed control
- Effect application
- Video preview

### What It Doesn't Do
- ❌ Camera capture (camera module)
- ❌ AI processing (AI module)
- ❌ 360° video (video-360 module)
- ❌ Export (export module)

### Key Entities
- `Video`: Metadata + clips
- `Clip`: Segment of video + effects
- `Timeline`: Temporal arrangement
- `Transition`: Between-clip effect
- `AudioTrack`: Audio configuration

### Key Use Cases
- OpenVideoUseCase
- AddClipUseCase
- TrimClipUseCase
- ApplyTransitionUseCase
- PlaybackUseCase

### Key Ports
- `VideoDecoderPort`: Video file parsing
- `MediaEncoderPort`: Video encoding
- `SkiaRenderingPort`: Timeline preview rendering
- `AudioPort`: Audio mixing
- `VideoRepositoryPort`: Persistence

### Estimated Complexity
- Core timeline: High (frame-accurate timing)
- Clip management: Medium
- Transitions: Medium
- Audio sync: High
- Playback: High (memory efficiency for large files)

### Performance Constraints
- Must handle 4K video without crashing
- Must support real-time playback preview at 24fps minimum
- Must manage memory efficiently (don't load entire video into RAM)

## 5. Video 360° Module

**Location**: `src/modules/video-360/`  
**Risk**: 💀 **EXPERIMENTAL**  
**Status**: Not implemented, research pending  
**Responsibility**: 360° panoramic video editing

### ⚠️ EXPERIMENTAL STATUS
This module is **high-risk** and **unproven**. It may be disabled entirely in production.

### What It Does
- Load 360° video files
- Equirectangular projection handling
- Viewport/camera movement
- Annotations on 360° surface
- Export as 360° video

### What It Doesn't Do
- ❌ Regular video editing (video-editor)
- ❌ Photo editing (photo-editor)
- ❌ Any editing that could be done with regular video tools

### Key Constraints
- **Fully isolated**: No other modules depend on this
- **Switchable**: Can be removed via configuration
- **Fallback**: If 360° unavailable, treat as regular video
- **Research first**: Technology evaluation required before implementation

### Estimated Complexity
- **Very High** (requires specialized mathematics, rendering, libraries)
- **Highly uncertain** - may require custom rendering engine
- **Platform risk** - may require native code (iOS/Android)

### Decision Point
Before implementing 360°, need:
- ✅ Research on available libraries
- ✅ Performance benchmarks
- ✅ Native code requirements
- ✅ User adoption metrics
- ✅ Risk/benefit analysis

## 6. Camera Module

**Location**: `src/modules/camera/`  
**Risk**: 🟢 **LOW** (library dependency) → 🟡 **MEDIUM** (integration)  
**Status**: Foundation ready, implementation pending  
**Responsibility**: Photo and video capture

### What It Does
- Real-time camera preview
- Photo capture (single frame)
- Video capture (with controls)
- Flash control
- Zoom control
- Auto-focus
- Exposure control

### What It Doesn't Do
- ❌ Editing captured media (photo-editor, video-editor)
- ❌ Effect application during capture (preview only)
- ❌ AI-based capture features (AI module)

### Key Entities
- `CaptureSettings`: Photo/video format and quality
- `CaptureResult`: Captured media with metadata

### Key Use Cases
- CapturePhotoUseCase
- CaptureVideoUseCase
- PreviewUseCase

### Key Ports
- `CameraPort`: Camera hardware abstraction
- `MediaStoragePort`: Store captured media

### Recommended Library
- **React Native Vision Camera** (if compatible and performant)

## 7. Audio Module

**Location**: `src/modules/audio/`  
**Risk**: 🟡 **MEDIUM**  
**Status**: Foundation ready, implementation pending  
**Responsibility**: Audio processing and management

### What It Does
- Audio track management
- Volume mixing and control
- Audio effects (fade in/out, normalization)
- Microphone input
- Audio sync with video
- Audio export

### What It Doesn't Do
- ❌ Music generation (AI module)
- ❌ Speech-to-text (AI module)
- ❌ Audio editing UI (resides in video-editor)

### Key Ports
- `AudioEncoderPort`: Audio encoding
- `AudioMixerPort`: Multi-track mixing
- `MicrophonePort`: Microphone access

## 8. AI Module

**Location**: `src/modules/ai/`  
**Risk**: 🔴 **HIGH** (depends on research)  
**Status**: Architecture defined, implementation pending research  
**Responsibility**: AI-powered features

### What It Does
- Background removal
- Object detection
- Image upscaling
- Noise reduction
- Style transfer
- Color correction (smart)
- Text recognition
- Video frame interpolation

### What It Doesn't Do
- ❌ Direct inference (through ports)
- ❌ Model management (infrastructure handles)
- ❌ Video/photo rendering (editor modules do this)

### Key Entities
- `AITask`: What to process
- `AIResult`: Processing result
- `AIModel`: Model metadata

### Key Use Cases
- RemoveBackgroundUseCase
- DetectObjectsUseCase
- UpscaleImageUseCase
- etc.

### Key Ports
- `AIServicePort`: Abstract inference interface

### Implementation Strategy
```
AIServicePort (Domain)
├── LocalAIAdapter (On-device models)
│   ├── ML Kit (Google)
│   ├── Core ML (iOS)
│   └── ONNX Runtime (local models)
├── RemoteAIAdapter (Backend processing)
│   ├── Custom Backend
│   └── Third-party APIs (Clarifai, etc.)
└── HybridAIAdapter (Decides local vs remote)
```

## 9. Export Module

**Location**: `src/modules/export/`  
**Risk**: 🟡 **MEDIUM**  
**Status**: Foundation ready, implementation pending  
**Responsibility**: Export edited media

### What It Does
- Export photo to various formats (JPG, PNG, WEBP, TIFF)
- Export video to various codecs (H.264, H.265, VP9)
- Resolution control
- Quality settings
- Batch export
- Social media format presets

### What It Doesn't Do
- ❌ Editing (editor modules)
- ❌ Rendering preview (modules handle this)
- ❌ Sharing (collaboration module)

### Key Ports
- `MediaEncoderPort`: Encoding implementation
- `ExportStoragePort`: Where to save exports

## 10. Projects Module

**Location**: `src/modules/projects/`  
**Risk**: 🟡 **MEDIUM**  
**Status**: Foundation ready, implementation pending  
**Responsibility**: Project management and lifecycle

### What It Does
- Create new projects
- List projects
- Open project
- Save project state
- Delete project
- Project metadata (name, date, size)
- Thumbnail generation
- Project recovery/undo history

### What It Doesn't Do
- ❌ Editing (delegated to editor modules)
- ❌ Collaboration (collaboration module)

### Key Entities
- `Project`: Container for editing session
- `ProjectMetadata`: Name, date, thumbnail, size

### Key Use Cases
- CreateProjectUseCase
- OpenProjectUseCase
- ListProjectsUseCase
- SaveProjectUseCase

## 11. Collaboration Module

**Location**: `src/modules/collaboration/`  
**Risk**: 🔴 **HIGH**  
**Status**: Architecture defined, implementation pending  
**Responsibility**: Multi-user collaborative editing

### What It Does
- Real-time project sync
- Conflict resolution
- User presence
- Comments and annotations
- Permission management
- Version history

### What It Doesn't Do
- ❌ Editing (editor modules)
- ❌ User authentication (core handles)
- ❌ Community features (community module)

### Key Ports
- `SyncPort`: Synchronization abstraction
- `CollaborationApiPort`: Backend communication

### Implementation Notes
- Likely requires backend
- May use Firebase Realtime Database
- Needs careful conflict resolution

## 12. Community Module

**Location**: `src/modules/community/`  
**Risk**: 🔴 **HIGH**  
**Status**: Architecture defined, not scoped yet  
**Responsibility**: User-generated content and community

### What It Does
- User profiles
- Project sharing (gallery)
- Comments on shared projects
- Follower system
- Featured projects
- Search shared projects

### What It Doesn't Do
- ❌ Editing
- ❌ Backend infrastructure (infrastructure layer)

## 13. Tutorials Module

**Location**: `src/modules/tutorials/`  
**Risk**: 🟢 **LOW**  
**Status**: Architecture defined, not scoped yet  
**Responsibility**: In-app tutorials and learning

### What It Does
- Tutorial content (videos, steps)
- Interactive tutorials
- Tips and tricks
- Documentation links

### What It Doesn't Do
- ❌ Hosting tutorial videos (backend)

## Module Dependency Map

```
                    App (Navigation)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
     Projects      Photo Editor      Video Editor
        │                 │                 │
        └────────┬────────┴────────┬────────┘
                 │                 │
              Core (Domain)      Export
                 │                 │
        ┌────────┼─────────────────┤
        │        │                 │
      Camera   Audio        Media Processing
        │        │                 │
        └────────┴─────────────────┤
                                   │
                            Infrastructure
        ┌─────────────────┬────────┴───────┬───────────┐
        │                 │                │           │
      Firebase         Storage          APIs        Native Libs
```

**Rules**:
1. Lower modules do NOT depend on upper modules
2. Modules can depend on Core
3. Modules can depend on Infrastructure
4. Cross-module dependencies must go through Core ports
5. Video-360 is isolated and optional

## Module Status Matrix

| Module | Risk | Status | Dependencies | Notes |
|--------|------|--------|--------------|-------|
| App | 🟢 LOW | ✅ Foundation | None | Entry point |
| Core | 🟢 LOW | ✅ Foundation | Minimal | Shared layer |
| Photo Editor | 🟡 MEDIUM | 📋 Planned | Skia | Non-destructive editing |
| Video Editor | 🟠 HIGH | 📋 Planned | FFmpeg, Audio | Complex timeline |
| Video 360 | 💀 EXPERIMENTAL | 🔴 Blocked | Research | May be removed |
| Camera | 🟢 LOW | 📋 Planned | Vision Camera | Well-established lib |
| Audio | 🟡 MEDIUM | 📋 Planned | Audio libs | Standard features |
| AI | 🔴 HIGH | 📋 Planned | Research | Local + Remote |
| Export | 🟡 MEDIUM | 📋 Planned | FFmpeg | Standard features |
| Projects | 🟡 MEDIUM | 📋 Planned | SQLite | Straightforward |
| Collaboration | 🔴 HIGH | 📋 Planned | Firebase | Requires backend |
| Community | 🔴 HIGH | 📋 Planned | Backend | Not scoped yet |
| Tutorials | 🟢 LOW | 📋 Planned | Content | Not critical |

---

**Next Step**: Read [requirements.md](requirements.md) to see how user stories map to these modules.
