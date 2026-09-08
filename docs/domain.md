# Domain Model

This document describes the core domain entities and their relationships.

## Core Entities

### 1. Project
**Purpose**: Container for all editing work  
**Immutability**: Mutable (editing happens here)  
**Persistence**: Yes (SQLite)

```typescript
interface Project {
  id: string;                    // UUID
  name: string;                  // "My Photo Edit", "Summer Vlog"
  type: "photo" | "video";       // Project type
  createdDate: Date;
  lastModifiedDate: Date;
  originalMedia: Asset;          // Reference to original file
  layers: Layer[];               // Ordered layers
  operations: Operation[];       // Global operations
  metadata: ProjectMetadata;
}

interface ProjectMetadata {
  authorName?: string;
  description?: string;
  tags?: string[];
  aspectRatio?: string;          // "16:9", "1:1", "4:3"
}
```

**Constraints**:
- Project.type determines which modules can edit it
- At least one layer must exist
- Cannot be empty

---

### 2. Layer
**Purpose**: Represents one editable component (photo, shape, text, video segment)  
**Immutability**: Semi-immutable (contents mutable, structure mutable)  
**Persistence**: Yes (SQLite)

```typescript
interface Layer {
  id: string;                    // UUID within project
  name: string;                  // "Background", "Text", "Effect"
  type: "photo" | "video" | "shape" | "text" | "adjustment";
  
  // Visual properties
  blendMode: BlendMode;          // "normal", "multiply", "screen", etc.
  opacity: number;               // 0-1
  visible: boolean;
  
  // Bounds (for transform)
  x: number;                     // Position in project
  y: number;
  width: number;
  height: number;
  rotation: number;              // Degrees, 0-360
  
  // Content reference
  asset?: Asset;                 // Original content (for photo/video layers)
  mask?: Mask;                   // Optional mask
  
  // Operations applied to this layer
  operations: Operation[];
  
  // Hierarchy
  order: number;                 // Z-order (higher = on top)
  parentId?: string;             // For layer groups (future)
}

type BlendMode = 
  | "normal" | "multiply" | "screen" | "overlay" | "soft-light"
  | "hard-light" | "color-dodge" | "color-burn" | "lighten"
  | "darken" | "difference" | "exclusion" | "saturation"
  | "color" | "hue" | "luminosity"
```

**Constraints**:
- Opacity must be 0-1
- Blend mode must be valid
- Width and height must be positive
- Order must be unique within project

---

### 3. Operation
**Purpose**: Represents a single edit (filter, transform, text, etc.)  
**Immutability**: Immutable (create new, don't modify)  
**Persistence**: Yes (SQLite)

```typescript
interface Operation {
  id: string;                    // UUID
  type: OperationType;
  params: Record<string, any>;   // Operation-specific parameters
  targetId: string;              // Layer ID this applies to
  timestamp: Date;               // When operation was created
  order: number;                 // Within layer's operation sequence
}

type OperationType =
  // Image adjustments
  | "brightness" | "contrast" | "saturation" | "hue"
  | "exposure" | "highlights" | "shadows"
  // Filters
  | "blur" | "sharpen" | "emboss" | "edge-detect"
  // Transforms
  | "crop" | "scale" | "rotate" | "skew" | "perspective"
  // Content
  | "text" | "shape" | "brushstroke" | "clone"
  // Effects
  | "shadow" | "glow" | "bloom" | "vignette"
```

**Operation Parameter Examples**:

```typescript
// Brightness: { value: -50 to 50 }
{ type: "brightness", params: { value: 25 } }

// Blur: { radius: 0-100 }
{ type: "blur", params: { radius: 5 } }

// Crop: { x, y, width, height }
{ type: "crop", params: { x: 0, y: 0, width: 100, height: 100 } }

// Text: { text, font, size, color, x, y }
{ type: "text", params: { 
    text: "Hello", 
    font: "Arial", 
    size: 24, 
    color: "#000000",
    x: 50, y: 50 
  } 
}
```

**Constraints**:
- Operation must have valid type
- Parameters must match type requirements
- Cannot modify operation (create new instead)

---

### 4. Asset
**Purpose**: Reference to media file (photo, video, etc.)  
**Immutability**: Immutable (references don't change)  
**Persistence**: Yes (metadata in SQLite, file on disk)

```typescript
interface Asset {
  id: string;                    // UUID
  type: "photo" | "video" | "audio" | "raw";
  filename: string;              // "IMG_001.jpg"
  mimeType: string;              // "image/jpeg"
  fileSize: number;              // In bytes
  
  // Dimensions
  width: number;                 // Pixels
  height: number;
  
  // Media-specific metadata
  duration?: number;             // Video/audio duration in seconds
  frameRate?: number;            // Video frame rate
  colorSpace?: string;           // "sRGB", "DCI-P3", etc.
  
  // File storage
  path: string;                  // Local file path
  hash: string;                  // SHA-256 for integrity check
  
  // Timestamps
  createdDate: Date;
  sourceDate?: Date;             // When photo was taken
}
```

**Constraints**:
- Asset must exist on disk
- Cannot modify asset (reference immutable)
- File hash must match on load

---

### 5. Mask
**Purpose**: Layer mask for non-destructive masking  
**Immutability**: Mutable  
**Persistence**: Yes (SQLite)

```typescript
interface Mask {
  id: string;
  type: "grayscale" | "vector" | "alpha";
  
  // Grayscale mask: one value per pixel
  // Vector mask: paths (future)
  // Alpha mask: uses layer alpha (simple case)
  
  data?: Buffer;                 // Grayscale mask data
  invert: boolean;               // Invert mask
  opacity: number;               // 0-1
}
```

---

### 6. ExportFormat
**Purpose**: Describes how to export the project  
**Immutability**: Immutable  
**Persistence**: No (configuration only)

```typescript
interface ExportFormat {
  format: "jpeg" | "png" | "webp" | "mp4" | "mov" | "webm";
  quality: number;               // 0-100
  width: number;                 // Output width
  height: number;                // Output height
  codec?: string;                // For video: "h264", "h265", "vp9"
  preset?: "fast" | "balanced" | "high-quality";
  metadata?: boolean;            // Include EXIF, etc.
}

// Presets
const PRESETS = {
  "social-instagram": { format: "jpeg", quality: 85, width: 1080, height: 1080 },
  "social-twitter": { format: "jpeg", quality: 85, width: 1200, height: 675 },
  "high-quality": { format: "png", quality: 100, width: 3840, height: 2160 },
  "web": { format: "webp", quality: 80, width: 1920, height: 1440 },
}
```

---

## Entity Relationships

```
Project
  ├── originalMedia: Asset
  ├── layers: Layer[]
  │   ├── asset?: Asset
  │   ├── mask?: Mask
  │   └── operations: Operation[]
  └── operations: Operation[]

Asset (referenced by multiple projects, never modified)

Mask (belongs to one layer)

Operation (immutable, not modified after creation)
```

---

## Value Objects (Immutable Data)

### BlendMode
```typescript
type BlendMode = string  // Validated against allowed modes
```

### Color
```typescript
interface Color {
  r: number;  // 0-255
  g: number;
  b: number;
  a: number;  // 0-1 (alpha)
}
```

### Point
```typescript
interface Point {
  x: number;
  y: number;
}
```

### Bounds
```typescript
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## Domain Invariants

These rules must always be true:

1. **Every project must have at least one layer**
2. **Layer order must be unique within a project** (prevents ambiguity)
3. **Operations are immutable** (never modify, create new)
4. **Assets are immutable** (never modify original file reference)
5. **Blend modes must be valid** (from defined list)
6. **Opacity must be 0-1** (normalized)
7. **Layers cannot reference themselves** (no circular masks)
8. **All timestamps must be reasonable** (not in future)

---

## Domain Behavior

### Creating a Project
```typescript
// From photo
project = Project.createFromPhoto(asset, name)
// Automatically creates one layer with the photo

// From video
project = Project.createFromVideo(asset, name)
// Creates video project, broken into clips

// Blank project
project = Project.create("Blank", "photo")
// Empty, user adds layers
```

### Editing a Layer
```typescript
// Apply operation (never modify, add to sequence)
project.applyOperation(layerId, new BrightnessOperation(value: 20))

// Undo
project.undo()

// Redo
project.redo()

// Remove layer
project.removeLayer(layerId)

// Reorder layers
project.reorderLayers(newOrder)
```

### Exporting
```typescript
// Render all operations
composite = project.render()

// Export to file
project.export(format, destination)
```

---

## Type Definitions for Implementation

```typescript
// core/domain/entities/index.ts
export type ProjectType = "photo" | "video"
export type LayerType = "photo" | "video" | "shape" | "text" | "adjustment"
export type OperationType = "brightness" | "contrast" | "blur" | ... // All types
export type AssetType = "photo" | "video" | "audio" | "raw"
export type BlendMode = "normal" | "multiply" | ... // All modes
export type ExportFormat = "jpeg" | "png" | "webp" | "mp4" | "mov" | "webm"

export interface Project { ... }
export interface Layer { ... }
export interface Operation { ... }
export interface Asset { ... }
export interface Mask { ... }
export interface ExportFormat { ... }

// Value objects
export interface Color { ... }
export interface Point { ... }
export interface Bounds { ... }
```

---

## Entity Identity

### How Entities are Identified

| Entity | ID Type | Generation | Mutability |
|--------|---------|-----------|-----------|
| Project | UUID | Generated | Mutable |
| Layer | UUID (within project) | Generated | Mutable |
| Operation | UUID | Generated | Immutable |
| Asset | UUID | Generated | Immutable |
| Mask | UUID | Generated | Mutable |

All IDs are UUIDs (v4) to ensure global uniqueness.

---

## Database Schema

See [infrastructure/storage.md](infrastructure/storage.md) for SQL schema details.

Quick overview:
```sql
projects (id, name, type, created_date, last_modified_date)
layers (id, project_id, order, name, blend_mode, opacity, asset_id)
operations (id, layer_id, type, params, timestamp, order)
assets (id, filename, type, width, height, file_size, path)
masks (id, layer_id, type, data, invert, opacity)
```

---

## Event Log (Future: Event Sourcing)

Future enhancement: Store events instead of state:
```typescript
interface ProjectEvent {
  id: string;
  projectId: string;
  type: "layerAdded" | "operationApplied" | "layerRemoved" | ...
  data: any;
  timestamp: Date;
}
```

Currently: Store final state only (simpler).

---

## Related Documents

- [architecture.md](architecture.md) - How domain fits in architecture
- [decisions/ADR-002](decisions/ADR-002-non-destructive-editing.md) - Non-destructive editing rationale
- [modules.md](modules.md) - How modules extend domain

---

**Last Updated**: 2026-09-07  
**Owner**: Architect Agent

This domain model is the foundation for all editing functionality. Changes to these entities require Architect approval.
