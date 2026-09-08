# ADR-002: Non-Destructive Editing with Operation Store

**Date**: 2026-09-07  
**Status**: ACCEPTED  
**Context**: PixelMorph needs to support undo/redo, layer editing, and project save/restore.

## Problem

Traditional destructive editing:
- User adjusts brightness → original pixels lost
- User presses undo → have to re-download original (impossible offline)
- Exporting at different quality → requires re-editing

PixelMorph needs:
- ✅ Unlimited undo/redo
- ✅ Offline-first support
- ✅ Export at different quality levels
- ✅ Project save/restore
- ✅ Layer-based editing

## Decision

Store **original media** + **sequence of operations**, not destructive edits.

```typescript
Project {
  originalMedia: Asset,           // Original photo/video
  layers: Layer[],                // Layer structure
  operations: Operation[],        // All edits applied
  metadata: { name, created }
}

Operation {
  type: "brightness" | "filter" | "transform" | "mask" | "text" | "shape",
  params: Record<string, any>,    // Operation-specific params
  target: LayerId,                // Which layer
  timestamp: Date,                // When applied
}

Layer {
  id: string,
  name: string,
  blendMode: "normal" | "multiply" | "screen" | ...,
  opacity: 0-1,
  visible: boolean,
  mask?: Mask,                    // Optional layer mask
  operations: Operation[]         // Ops applied to this layer
}
```

## Rationale

### Why Operations Store?
✅ **Undo/redo trivial**: Remove/add operations from array  
✅ **Offline support**: No need to re-download, operations stored locally  
✅ **Export flexibility**: Apply operations at different quality  
✅ **Collaboration**: Operations can be synced incrementally  
✅ **Memory efficient**: Don't keep all intermediate states  
✅ **History**: Can inspect every operation applied  

### Why Layers?
✅ **Non-destructive**: Merge on export, not on edit  
✅ **Flexibility**: Adjust one layer without touching others  
✅ **Industry standard**: Matches Photoshop/Lightroom model  
✅ **Effects**: Blend modes, opacity, masks work with layers  

## Data Structure Example

```typescript
// User opens photo
const project = {
  originalMedia: { type: "photo", path: "IMG_001.jpg" },
  layers: [
    {
      id: "layer-1",
      name: "Base Photo",
      blendMode: "normal",
      opacity: 1,
      operations: [
        { type: "brightness", params: { value: 20 }, timestamp: now },
        { type: "saturation", params: { value: 15 }, timestamp: now }
      ]
    },
    {
      id: "layer-2",
      name: "Text Overlay",
      blendMode: "normal",
      operations: [
        { type: "text", params: { text: "PixelMorph", font: "Arial", size: 48 }, timestamp: now }
      ]
    }
  ]
}

// User adjusts brightness further
project.layers[0].operations.push({
  type: "brightness",
  params: { value: 30 },
  timestamp: now
})

// User presses undo
project.layers[0].operations.pop() // Back to value: 20

// Export at different quality
render(project, { quality: "high" }) // Highest quality
render(project, { quality: "social" }) // Optimized for social media
```

## Composite Rendering Pipeline

```
Original Media (JPG, etc)
  ↓
Load into GPU/memory
  ↓
For each layer (in order):
  ├─ For each operation (in order):
  │  └─ Apply operation to layer
  ├─ Apply blend mode
  ├─ Apply opacity
  └─ Composite onto canvas
  ↓
Optionally export to file
```

## Storage Implications

### Local Storage (SQLite)
```sql
projects (
  id, name, created_date, last_modified, size_kb
)

layers (
  id, project_id, order, name, blend_mode, opacity, visible
)

operations (
  id, layer_id, type, params_json, timestamp, order
)
```

### Export
When user exports:
1. Read project from SQLite
2. Render all operations
3. Encode final composite
4. Save to photo gallery

### Project Save
When user saves project:
1. Write operations to SQLite
2. Store layer structure
3. Store metadata
4. Keep original media reference

## Performance Considerations

### Optimization 1: Operation Caching
Don't re-render operations when:
- Scrolling timeline
- Adjusting unrelated layers

Strategy: Cache intermediate layer composites.

### Optimization 2: Lazy Evaluation
Some operations can be computed at export time:
- High-resolution upscaling
- Codec-specific encoding

### Optimization 3: Streaming
For large videos: Don't load entire file into memory.
Process frame-by-frame.

## Undo/Redo Implementation

```typescript
class UndoRedoManager {
  private history: Operation[] = []
  private currentIndex = -1

  apply(operation: Operation) {
    // Remove any redo history
    this.history = this.history.slice(0, this.currentIndex + 1)
    this.history.push(operation)
    this.currentIndex++
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--
      this.renderFromHistory()
    }
  }

  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++
      this.renderFromHistory()
    }
  }

  private renderFromHistory() {
    // Apply operations 0..currentIndex
    // Skip operations beyond currentIndex
    const activeOps = this.history.slice(0, this.currentIndex + 1)
    render(activeOps)
  }
}
```

## Collaboration Implications

With operation store, collaboration becomes:
```
User A adjusts brightness
  → Send { type: "brightness", value: 20 } to server
User B adds text overlay
  → Send { type: "text", text: "..." } to server
Both receive updates and render with all operations
```

No pixel-level conflicts, just operation ordering conflicts (resolvable).

## Consequences

### Positive
✅ Unlimited undo/redo  
✅ Works offline  
✅ Memory efficient  
✅ Supports layers  
✅ Enables collaboration  
✅ Flexible export  

### Negative
⚠️ Rendering can be slow (many operations)  
⚠️ Some operations aren't reversible (lossy formats)  
⚠️ More complex than destructive editing  

## Mitigation

**Slow rendering**: Cache composites, profile early.  
**Irreversible ops**: Never store them; make all ops reversible.  
**Complexity**: Good abstractions hide it from UI.

## Related Patterns

- **Event Sourcing**: Similar idea (store events, replay state)
- **Functional Immutability**: Operations don't mutate state
- **Redux Patterns**: Single state tree, reducers are operations

## Testing Strategy

Test that:
1. Operations apply correctly
2. Undo/redo works for each operation type
3. Export renders all operations
4. Save/load preserves operations
5. Multiple operations compose correctly
6. Blend modes work with operations
7. Performance acceptable for 10+ layers

## Related Documents

- [architecture.md](../architecture.md) - How this fits in architecture
- [domain.md](../domain.md) - Domain entity descriptions
- [backlog.md](../backlog.md) - Related tasks

---

**Reviewed By**: Architect Agent  
**Approved By**: Architecture Team

This decision enables all non-destructive editing features and sets the foundation for collaboration.
