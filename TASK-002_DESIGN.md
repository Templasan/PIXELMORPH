# TASK-002 Design Document
**Date**: 2026-09-08  
**Phase**: Design (Phase 3 of 5)

---

## 1. Domain Entities

### 1.1 ProjectType

```typescript
type ProjectType = 'photo' | 'video' | 'mixed';
```

**Semantics**:
- `photo`: Project primarily for photo editing
- `video`: Project primarily for video editing
- `mixed`: Project for mixed media

**Rules**:
- Must be one of the three values
- Cannot be null/undefined
- Immutable (set at creation)

---

### 1.2 ProjectStatus

```typescript
type ProjectStatus = 'active' | 'archived';
```

**Semantics**:
- `active`: Project is in active use
- `archived`: Project is archived (hidden from normal listing)

**Rules**:
- Can transition: active → archived, archived → active
- Deletion removes project entirely (not "soft delete" with status 'deleted')
- `not-found` is NOT a status, it's a query result (project doesn't exist)

**Implementation Decision**:
- Store only 'active' or 'archived' in Project
- Query result uses Result type or null to indicate not-found
- No ProjectStatus.notFound persistence

---

### 1.3 MediaType

```typescript
type MediaType = 'image' | 'video' | 'audio' | 'unknown';
```

**Semantics**:
- `image`: Still image (JPEG, PNG, etc.)
- `video`: Video file (MP4, MOV, etc.)
- `audio`: Audio file (MP3, WAV, etc.)
- `unknown`: Type couldn't be determined

**Rules**:
- Determined at import time from file MIME type
- Immutable
- Can be 'unknown' but should be rare (indicates data quality issue)

---

### 1.4 MediaMetadata

```typescript
interface MediaMetadata {
  mimeType: string;           // Required: image/jpeg, video/mp4, etc.
  
  // Image-specific
  width?: number;             // Pixels
  height?: number;            // Pixels
  orientation?: number;       // 1-8 (EXIF orientation)
  
  // Video/Audio-specific
  durationMs?: number;        // Milliseconds
  
  // All types
  fileSizeBytes?: number;     // Bytes (not KB/MB)
}
```

**Units (EXPLICIT)**:
- `durationMs`: Milliseconds (never seconds)
- `fileSizeBytes`: Bytes (never KB/MB)
- `width`/`height`: Pixels
- `orientation`: EXIF integer (1-8)

**Rules**:
- `mimeType` is mandatory
- Other fields optional (depend on media type)
- Fields are immutable (metadata from import time)
- No codec details, bitrate, FPS (deferred to future)
- No EXIF beyond orientation (deferred to future)

**Immutability**:
- MediaMetadata represents asset state at import
- Does not change during editing
- Separate from media asset operations

---

### 1.5 MediaAsset

```typescript
interface MediaAsset {
  id: string;                 // UUID or similar
  type: MediaType;            // image | video | audio | unknown
  originalUri: string;        // Path to immutable original
  workingUri: string;         // Path to editable copy
  metadata: MediaMetadata;
  createdAt: Date;
  updatedAt: Date;
}
```

**Rules**:
- `id` uniquely identifies asset within project scope
- `type` determined at creation
- `originalUri`: Points to original file, never modified
- `workingUri`: Points to working copy, used during editing
- `metadata`: Captured at creation, immutable
- `createdAt`: Set at creation, never changes
- `updatedAt`: Changes when asset is updated (metadata changes, etc.)

**Original vs Working Copy**:
```
originalUri (immutable)
    ↓
workingUri (editable)
    ↓
Editor modifies workingUri only
    ↓
Original stays safe
```

**Invariants**:
- `originalUri` and `workingUri` must both be present
- `type` must match actual content (validated at infrastructure)
- Cannot have null id
- Cannot remove asset from MediaAsset (it's immutable once created)

**No Subclasses**:
- Use `MediaAsset` with `type` field
- No ImageAsset, VideoAsset, AudioAsset
- Rationale: Single entity is simpler and sufficient

---

### 1.6 Project (Aggregate)

```typescript
interface Project {
  id: string;                 // UUID or similar
  name: string;               // Project name
  type: ProjectType;          // photo | video | mixed
  status: ProjectStatus;      // active | archived
  createdAt: Date;
  updatedAt: Date;
  assets: MediaAsset[];       // Zero or more
  
  // Optional: for future ProjectHub thumbnail
  thumbnailUri?: string;      // Not generated, just stored reference
}
```

**Project Aggregate Rules**:
- `Project` is the aggregate root
- `MediaAsset[]` are aggregated (part of project)
- Operations on assets operate through project
- `Project` maintains consistency of asset collection

**ID Generation**:
- Generate locally (UUID v4)
- No database dependency
- No synchronous ID generation from backend

**Timestamps**:
- `createdAt`: Set at creation, immutable
- `updatedAt`: Changes when project or any asset changes
- Never null

**Status Transitions**:
```
ACTIVE ↔ ARCHIVED (via archiveProject / unarchiveProject)
```

**Deletion**:
```
Project exists → deleteProject() → Project removed entirely
Next query → null / NotFound
```

**Assets**:
- Can be empty (zero assets allowed)
- No size limit enforced at domain level
- Order matters (preserve order of addition)
- Duplicates not possible (unique IDs)

**Invariants**:
- Cannot have null name
- Cannot have null type or status
- Cannot have null or empty assets array... wait, **can be empty**
- All assets must have unique IDs within project
- createdAt ≤ updatedAt always

**Thumbnail (Optional)**:
- `thumbnailUri` can be undefined
- Not auto-generated in core
- If set, just a reference to image file
- Rationale: Allows ProjectHub to show thumb without processing

---

## 2. Repository Port (Abstraction)

### 2.1 ProjectRepository Interface

```typescript
interface ProjectRepository {
  // Create
  create(project: Project): Promise<void>;
  
  // Read
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  
  // Update
  update(project: Project): Promise<void>;
  
  // Delete
  delete(id: string): Promise<void>;
  
  // Archive (business operation)
  archive(id: string): Promise<void>;
  unarchive(id: string): Promise<void>;
  
  // Filtering
  findByType(type: ProjectType): Promise<Project[]>;
  findByStatus(status: ProjectStatus): Promise<Project[]>;
}
```

**Error Handling**:
- `findById(nonexistent)` returns `null` (not throws)
- `update(nonexistent)` throws meaningful error
- `delete(nonexistent)` throws meaningful error (or silently succeeds)
- `archive(nonexistent)` throws error
- Corrupption: throws error, doesn't silently ignore

**Design Decision**:
- Single `ProjectRepository` for Project + Assets aggregated
- NOT separate `MediaAssetRepository`
- Rationale: Assets are aggregated within Project, not first-class entities

---

## 3. Application Layer (Use Cases)

### 3.1 CreateProject

```
Input:
  name: string
  type: ProjectType

Process:
  1. Generate ID
  2. Create Project with empty assets
  3. Set timestamps
  4. Persist

Output:
  Project
```

### 3.2 GetProject

```
Input:
  id: string

Process:
  1. Query repository
  2. Return project or null

Output:
  Project | null
```

### 3.3 ListProjects

```
Input:
  options?: { 
    status?: ProjectStatus,
    type?: ProjectType,
    archived?: boolean
  }

Process:
  1. Query repository with filters
  2. Return array (can be empty)

Output:
  Project[]
```

### 3.4 UpdateProject

```
Input:
  id: string
  changes: Partial<Project>

Process:
  1. Load project
  2. Apply changes (name, type, etc.)
  3. Update updatedAt
  4. Persist

Output:
  Project
```

### 3.5 ArchiveProject

```
Input:
  id: string

Process:
  1. Load project
  2. Set status = 'archived'
  3. Update updatedAt
  4. Persist

Output:
  Project
```

### 3.6 DeleteProject

```
Input:
  id: string

Process:
  1. Delete from repository
  2. Project removed entirely

Output:
  void
```

### 3.7 AddMediaAsset

```
Input:
  projectId: string
  asset: MediaAsset

Process:
  1. Load project
  2. Validate asset (no duplicates by id)
  3. Add to assets array
  4. Update project updatedAt
  5. Persist project

Output:
  Project
```

### 3.8 RemoveMediaAsset

```
Input:
  projectId: string
  assetId: string

Process:
  1. Load project
  2. Remove asset by id
  3. Update project updatedAt
  4. Persist project

Output:
  Project
```

### 3.9 UpdateMediaAsset

```
Input:
  projectId: string
  assetId: string
  changes: Partial<MediaAsset>

Process:
  1. Load project
  2. Find asset in project
  3. Update asset fields (not id, type, uris)
  4. Update project updatedAt
  5. Persist project

Output:
  Project
```

---

## 4. Data Transfer Objects (DTOs)

### 4.1 Persistence DTO

```typescript
interface ProjectPersistenceDTO {
  version: number;           // For future migrations
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
  assets: MediaAssetDTO[];
  thumbnailUri?: string;
}

interface MediaAssetDTO {
  id: string;
  type: MediaType;
  originalUri: string;
  workingUri: string;
  metadata: MediaMetadata;
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
}
```

**Design Decision**:
- Dates as ISO 8601 strings (stable, serializable)
- Version field for future format changes
- DTOs match domain entities closely (minimal transformation)

---

## 5. Mappers

### 5.1 ProjectMapper

```typescript
class ProjectMapper {
  static toPersistence(project: Project): ProjectPersistenceDTO {
    // Domain → DTO
    // Dates: Date → ISO string
  }

  static toDomain(dto: ProjectPersistenceDTO): Project {
    // DTO → Domain
    // Dates: ISO string → Date
    // Validation
  }

  static validate(dto: unknown): dto is ProjectPersistenceDTO {
    // Check shape, types, required fields
    // Throw if invalid
  }
}
```

---

## 6. Storage Strategy (AsyncStorage)

### 6.1 Key Structure

```
project:{projectId}     → ProjectPersistenceDTO (JSON string)
projectList             → Array<string> (project IDs)
meta:version            → Current version (optional)
```

### 6.2 Operations

**Create**:
```
1. Serialize project → JSON
2. Store: project:{id} = JSON
3. Load projectList
4. Add id to projectList
5. Store projectList
```

**FindById**:
```
1. Load: AsyncStorage.getItem("project:{id}")
2. If null, return null
3. Parse JSON → DTO
4. Validate (throw if corrupt)
5. Map to Domain
6. Return Project
```

**FindAll**:
```
1. Load: AsyncStorage.getItem("projectList")
2. If null, return []
3. For each id:
   a. Load: AsyncStorage.getItem("project:{id}")
   b. Parse, validate, map
4. Return Project[]
```

**Update**:
```
1. Serialize project → JSON
2. Store: project:{id} = JSON (overwrites)
3. projectList unchanged (id still in list)
```

**Delete**:
```
1. Load projectList
2. Remove id from array
3. Store projectList
4. Remove: AsyncStorage.removeItem("project:{id}")
```

---

## 7. Error Handling

### 7.1 Error Categories

**Validation Errors**:
- Invalid project name
- Invalid type/status
- Duplicate asset IDs
- Missing required fields

**Not Found**:
- Project doesn't exist
- Asset doesn't exist
- Result: Return null or throw NotFoundException

**Corruption**:
- Stored data doesn't match schema
- Invalid JSON
- Missing critical field
- Result: Throw DataCorruptionError (don't silently ignore)

**Storage Errors**:
- AsyncStorage full
- Permission denied
- I/O error
- Result: Throw StorageError

---

## 8. Concurrency & Consistency

### 8.1 Assumptions (Current Phase)

- Single user per app instance
- No multiple tabs/processes editing same project simultaneously
- Autosave within same session is safe
- No offline sync complexity

### 8.2 Future Considerations (Don't implement)

- Conflict resolution (undo/redo persistence)
- Optimistic locking
- Operational transformation
- Collaborative merging

### 8.3 Implementation Safeguard

- Document that repository assumes single-writer
- If collaboration added later, revisit at that time
- Interface doesn't preclude future changes

---

## 9. File Organization

```
src/modules/projects/
├── domain/
│   ├── entities/
│   │   ├── Project.ts
│   │   ├── MediaAsset.ts
│   │   ├── MediaMetadata.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── ProjectType.ts
│   │   ├── ProjectStatus.ts
│   │   ├── MediaType.ts
│   │   └── index.ts
│   └── index.ts
│
├── application/
│   ├── usecases/
│   │   ├── CreateProject.ts
│   │   ├── GetProject.ts
│   │   ├── ListProjects.ts
│   │   ├── UpdateProject.ts
│   │   ├── ArchiveProject.ts
│   │   ├── DeleteProject.ts
│   │   ├── AddMediaAsset.ts
│   │   ├── RemoveMediaAsset.ts
│   │   ├── UpdateMediaAsset.ts
│   │   └── index.ts
│   └── index.ts
│
├── ports/
│   ├── ProjectRepository.ts
│   └── index.ts
│
├── infrastructure/
│   ├── repositories/
│   │   ├── LocalProjectRepository.ts
│   │   └── index.ts
│   ├── mappers/
│   │   ├── ProjectMapper.ts
│   │   └── index.ts
│   ├── dtos/
│   │   ├── ProjectPersistenceDTO.ts
│   │   ├── MediaAssetDTO.ts
│   │   └── index.ts
│   └── index.ts
│
└── tests/
    ├── domain/
    │   ├── entities.test.ts
    │   └── types.test.ts
    ├── application/
    │   └── usecases.test.ts
    ├── infrastructure/
    │   ├── repositories.test.ts
    │   ├── mappers.test.ts
    │   └── persistence.test.ts
    └── integration/
        └── end-to-end.test.ts
```

---

## 10. Dependencies

### 10.1 New Dependencies Needed

**None for TASK-002.**

- AsyncStorage is already in Expo SDK 56 (no npm install)
- UUID generation: Use standard crypto from React Native
- No external storage library needed

### 10.2 If UUID Needed

Option: Use built-in `Math.random()` based simple UUID or crypto from React Native.

Defer `uuid` package unless real need.

---

## 11. Design Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Single `MediaAsset` entity, not subclasses | Simpler, sufficient type field |
| `ProjectStatus` limited to active/archived | not-found is query result, not state |
| AsyncStorage as persistencebackend | Simplest, Expo native, clear upgrade path |
| Project as aggregate root | Maintains consistency, matches domain |
| Single ProjectRepository | Assets aggregated, not separate entities |
| Dates as ISO 8601 in storage | Stable, serializable, no timezone issues |
| Optional thumbnailUri | Allows ProjectHub future, not generated here |
| UUID generated locally | No backend dependency |
| Mapper layer | Decouples domain from persistence format |

---

## 12. Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│         Application Layer (Use Cases)           │
│  CreateProject, GetProject, ListProjects, etc. │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│       Domain Layer (Entities & Contracts)      │
│  Project, MediaAsset, MediaMetadata, Types     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│              Ports (Abstractions)               │
│           ProjectRepository                    │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│   Infrastructure (Concrete Implementation)     │
│  LocalProjectRepository, Mappers, AsyncStorage │
└─────────────────────────────────────────────────┘
```

No bidirectional dependencies. Strict unidirectional flow.

---

## 13. Pre-Implementation Checklist

- [x] Entities defined
- [x] Aggregate boundaries clear
- [x] Repository port designed
- [x] Use cases specified
- [x] DTOs for persistence created
- [x] Mapper strategy defined
- [x] Error handling approach defined
- [x] Storage strategy documented
- [x] File organization planned
- [x] Dependencies identified (none new!)
- [x] Design decisions documented
- [ ] Ready to implement

---

**Next Phase**: Phase 4 — Implementation

Ready to begin code.
