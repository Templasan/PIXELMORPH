# Architecture Guide

## Overview

PixelMorph uses a **Modular Monolith** architecture with **Hexagonal Architecture** (Ports & Adapters) principles. This document explains the overall system design.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                             │
│        (React Native Screens & Components)              │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│            Application / Use Cases Layer                │
│         (Features, Workflows, State Management)         │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│              Domain Layer                               │
│    (Business Rules, Entities, Use Cases)                │
│     NO DEPENDENCIES on libraries or APIs                │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                Ports Layer                              │
│        (Abstract Interfaces / Contracts)                │
│    - MediaEncoderPort  - StoragePort                    │
│    - ApiPort           - CameraPort                     │
│    - AIServicePort     - AuthPort                       │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│          Adapters / Infrastructure Layer                │
│    (Concrete Implementations via Ports)                 │
│    - FFmpegAdapter      - SQLiteAdapter                 │
│    - FirebaseAdapter    - VisionCameraAdapter           │
│    - NgrokAdapter       - LocalAIAdapter                │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│          External Services & Libraries                  │
│    FFmpeg, Firebase, APIs, ML Kit, MediaPipe, etc.      │
└─────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Domain Isolation
The domain layer contains **pure business logic** and never imports:
- ❌ FFmpeg, Skia, OpenCV
- ❌ Firebase, HTTP clients
- ❌ SQLite, file system directly
- ❌ Camera libraries
- ❌ AI model inference engines
- ❌ Platform-specific code

**Why?** This allows swapping implementations without changing business logic.

### 2. Ports & Adapters
Every external dependency goes through an interface:

```typescript
// Domain (port)
export interface MediaEncoderPort {
  encodeVideo(input: VideoFile, settings: EncodingSettings): Promise<VideoFile>;
  encodePhoto(input: PhotoFile, settings: EncodingSettings): Promise<PhotoFile>;
}

// Infrastructure (adapter)
export class FFmpegAdapter implements MediaEncoderPort {
  async encodeVideo(input: VideoFile, settings: EncodingSettings): Promise<VideoFile> {
    // FFmpeg implementation
  }
}

// Application uses the port, not the adapter
export class VideoExportUseCase {
  constructor(private encoder: MediaEncoderPort) {} // Depends on interface, not FFmpeg
}
```

This enables:
- Switching `FFmpeg` → different library
- Switching `ngrok` → production API
- Switching `Firebase` → custom backend
- Testing with mocks

### 3. No Microservices Inside Mobile App
The mobile app is a **single unit**. It can communicate with backend/Firebase, but doesn't contain embedded microservices.

```
React Native App (Monolith)
      ↓
   Ports
      ↓
Adapters (can call external services)
      ↓
Backend / Firebase / APIs (separate deployments)
```

### 4. Local-First, Backend-Optional
Default behavior:
- **Photo editing**: 100% local
- **Video editing**: 100% local (unless hardware-limited)
- **Camera capture**: 100% local
- **Export**: 100% local
- **Collaboration**: Backend-enabled
- **Community**: Backend-enabled
- **Cloud sync**: Backend-optional

For each feature, determine:
```
Runtime: Mobile | Backend | Firebase | Hybrid
Network: Required | Optional | Not required
Fallback: Behavior when offline
```

## Module Structure

Every module (when applicable) follows this structure:

```
modules/photo-editor/
├── domain/
│   ├── entities/          # Core data structures
│   ├── use-cases/         # Business logic workflows
│   └── ports/             # Abstract interfaces
├── application/
│   ├── services/          # Application workflows
│   ├── state/             # State management
│   └── dto/               # Data transfer objects
├── infrastructure/
│   ├── adapters/          # Port implementations
│   └── repositories/      # Data access
├── presentation/
│   ├── screens/           # React Native components
│   ├── hooks/             # React hooks
│   └── navigation/        # Module routing
└── tests/
    ├── domain/            # Domain logic tests
    ├── application/       # Use case tests
    └── integration/       # E2E tests
```

## Module Dependency Flow

Modules should follow this dependency pattern:

```
Presentation
   ↓
Application
   ↓
Domain (Entities & Use Cases)
   ↓
Ports
   ↓
Infrastructure (Adapters)
   ↓
External Libraries
```

**Critical Rule**: Lower layers never depend on upper layers.

## Specific Patterns

### Pattern 1: Photo Editing
```
PhotoEditorModule
├── Domain: Layer, Operation, Project entities
├── Application: EditUseCase, UndoRedoManager
├── Infrastructure: LayerRepository, ProjectRepository, SkiaAdapter
└── Presentation: EditorScreen, LayerPanel
```

### Pattern 2: Video Processing
```
VideoEditorModule
├── Domain: VideoSegment, Clip, Timeline entities
├── Application: VideoEditUseCase, TimelineManager
├── Infrastructure: MediaEncoderAdapter, VideoRepository
└── Presentation: TimelineScreen, VideoPreview
```

### Pattern 3: Camera Capture
```
CameraModule
├── Domain: CaptureSettings, Photo/Video entities
├── Application: CaptureUseCase
├── Ports: CameraPort
├── Infrastructure: VisionCameraAdapter, CameraRepository
└── Presentation: CameraScreen, CapturePreview
```

### Pattern 4: AI Features
```
AIModule
├── Domain: AITask, Model entities
├── Application: AIInferenceUseCase
├── Ports: AIServicePort
├── Infrastructure: 
│   ├── LocalAIAdapter (on-device models)
│   ├── RemoteAIAdapter (backend API)
│   ├── MLKitAdapter (Google ML Kit)
│   └── AIRepository
└── Presentation: AIFeatureScreen
```

## Experimental Features: Video 360°

The 360° video module is marked as **EXPERIMENTAL** due to high technical complexity and uncertainty.

**Isolation Strategy**:
```
modules/video-360/
├── domain/
├── application/
├── ports/
│   └── Video360Port (isolated port)
├── infrastructure/
│   └── Experimental360Adapter
├── presentation/
└── tests/
```

**Key Rules**:
1. The 360° module can be completely disabled via configuration
2. No other module imports from `modules/video-360/` directly
3. Only `app/` level can orchestrate 360° features
4. Fallback to regular video if 360° isn't available
5. No 360° logic in shared domain

## Storage & Persistence

```
Storage Architecture
├── Local Storage (on-device)
│   ├── SQLite (metadata, projects, settings)
│   ├── File System (original media, exports)
│   └── Cache (temporary processing)
├── Remote Storage (optional)
│   ├── Firebase Firestore (project sync)
│   ├── Firebase Storage (media backup)
│   └── Custom Backend
└── Ports
    ├── ProjectRepository (what to persist)
    ├── MediaRepository (media files)
    └── SettingsRepository (user settings)
```

Storage implementations must:
- Support offline-first operation
- Sync when network available
- Handle conflicts gracefully
- Preserve media quality
- Clean up temporary files

## API & External Services

```
Network Communication
├── Development
│   └── ngrok (local backend tunneling)
├── Production
│   └── Real backend URL
└── Ports
    ├── ApiPort (REST/GraphQL contract)
    ├── AuthPort (authentication)
    └── SyncPort (data synchronization)
```

**No hardcoded URLs**. Configuration by environment:
```typescript
// Environment-based
const API_BASE_URL = __DEV__ ? 'https://ngrok-xxx.ngrok.io' : 'https://api.pixelmorph.com';
```

## Data Flow Example: Photo Editing

```
User taps "Adjust Brightness"
  ↓
EditorScreen component
  ↓
AdjustBrightnessUseCase (Application)
  ↓
BrightnessOperation entity (Domain)
  ↓
Project.addOperation(BrightnessOperation)
  ↓
ProjectRepository.save() (Ports)
  ↓
SQLiteProjectAdapter.save() (Infrastructure)
  ↓
SQLite
```

The domain knows nothing about SQLite. The screen knows nothing about business logic. Changes at any layer don't affect others.

## Data Flow Example: Remote AI Processing

```
User requests "Remove background"
  ↓
AIFeatureScreen component
  ↓
RemoveBackgroundUseCase (Application)
  ↓
Check network → decide: local or remote
  ↓
AIServicePort.processImage()
  ↓
Adapter routes to:
  ├── LocalAIAdapter (if model exists locally)
  └── RemoteAIAdapter (if network available, fallback to local)
  ↓
Domain gets AIResult
  ↓
Project updated with mask operation
  ↓
UI refreshed
```

## Concurrency & Async Operations

- Use React's Suspense for async boundaries (where applicable)
- Use Redux/Zustand for state management
- Use RxJS observables for continuous operations (timeline playback)
- Use async/await for one-off operations
- Document which operations are blocking vs non-blocking

## Performance Considerations

1. **Keep domain logic pure and fast** - no I/O
2. **Batch operations** when updating multiple layers
3. **Lazy load modules** - don't load video-360 if not needed
4. **Stream large media files** - don't load entire files into memory
5. **Use web workers** for heavy computation (if applicable)
6. **Profile on actual devices** - emulator doesn't represent real performance

## Testing Strategy

See [testing.md](testing.md) for details.

Quick summary:
- **Domain**: Unit tests (pure, fast)
- **Application**: Integration tests (with mocked adapters)
- **Infrastructure**: Adapter tests (with real implementations)
- **Presentation**: Component tests + E2E tests

## Error Handling

- Domain: Throws domain-specific exceptions
- Application: Catches domain exceptions, converts to use-case results
- Infrastructure: Catches library exceptions, converts to domain exceptions
- Presentation: Catches use-case exceptions, shows user-friendly messages

```typescript
// Domain
export class InvalidLayerException extends DomainException {}

// Application
try {
  await addLayerUseCase.execute(layer);
} catch (error) {
  if (error instanceof InvalidLayerException) {
    return { success: false, message: "Layer is invalid" };
  }
}

// Presentation
if (!result.success) {
  Alert.alert("Error", result.message);
}
```

## Configuration & Environments

See [environments.md](environments.md).

Three environments:
1. **Development** (ngrok, mock data)
2. **Staging** (staging API, real Firebase)
3. **Production** (production API, production Firebase)

## Dependency Management

See [dependencies.md](dependencies.md).

Strict policy on external libraries:
- ✅ Use mature, well-maintained libraries
- ❌ Don't add random npm packages
- ✅ Prefer established solutions (FFmpeg, Firebase, ML Kit)
- ❌ Don't implement complex algorithms from scratch
- ✅ Evaluate technical risk before adopting

## What Happens Next?

1. Architect updates this document as decisions are made
2. Implementation agents follow this architecture strictly
3. Review agent validates architecture compliance
4. If architecture needs changes → create ADR + approval required

## Related Documents

- [modules.md](modules.md) - Detailed module descriptions
- [domain.md](domain.md) - Domain model and entities
- [decisions/](decisions/) - Architecture decision records (ADRs)
- [agent-rules.md](agent-rules.md) - Rules for maintaining this architecture

---

**Remember**: Good architecture should make the right thing easy and the wrong thing hard. This architecture is designed to make parallel agent work possible while preventing architectural decay.
