# Screen Refactoring Pattern - Phase 4

**Goal**: All screens use `AppCompositionRoot` for dependency injection.

---

## Pattern: Before → After

### Before (Legacy)
```typescript
import { createProjectsModule } from '@modules/projects';

export default function MyScreen({ navigation }: Props) {
  const moduleRef = useRef(createProjectsModule());
  
  const handleAction = () => {
    moduleRef.current.createProject.execute(name);
  };
}
```

### After (Hexagonal)
```typescript
import { useAppModules } from '../hooks';

export default function MyScreen({ navigation }: Props) {
  const { projects: projectsModule } = useAppModules();
  
  const handleAction = () => {
    projectsModule.createProject.execute(name);
  };
}
```

---

## Steps to Refactor a Screen

### 1. **Remove `useRef` import** (if used)
```typescript
- import { useCallback, useRef, useState } from 'react';
+ import { useCallback, useState } from 'react';
```

### 2. **Remove direct module creation imports**
Replace:
```typescript
- import { createProjectsModule } from '@modules/projects';
```

With:
```typescript
+ import { useAppModules } from '../hooks';
```

### 3. **Add hook call** at start of component
```typescript
export default function MyScreen({ navigation }: Props) {
  const { projects: projectsModule, photoEditor, videoEditor, ... } = useAppModules();
  // rest of component
}
```

### 4. **Replace all module instantiations**
Replace any:
```typescript
- const mod = createProjectsModule();
- const { method } = createProjectsModule();
```

With:
```typescript
+ const mod = projectsModule;
+ const { method } = projectsModule;
```

---

## Available Modules in AppCompositionRoot

```typescript
{
  projects: ProjectsModule,
  photoEditor: PhotoEditorModule,
  videoEditor: VideoEditorModule,
  camera: CameraModule,
  audio: AudioModule,
  export: ExportModule,
  ai: AIModule,
  core: CoreModule,
}
```

---

## Screens Refactored ✅

- ✅ ProjectsScreen
- ✅ PhotoEditorScreen
- ✅ VideoEditorScreen

---

## Screens Remaining (17)

- [ ] AccountScreen
- [ ] CameraScreen
- [ ] CommunityScreen
- [ ] HelpScreen
- [ ] LoginScreen
- [ ] PhotoEditorSpikeScreen
- [ ] PresetsScreen
- [ ] RawConverterScreen
- [ ] SignUpScreen
- [ ] StorageScreen
- [ ] TutorialsScreen
- [ ] (+ 6 others in src/app/screens/)

---

## Notes

- The hook is **memoized** so it won't recreate modules on every render
- CompositionRoot is a **singleton** — all screens share the same instances
- No need to pass modules through props or Context — inject via hook
- Modules are **thread-safe** for concurrent operations

---

## Automation

To find screens still using legacy pattern:
```bash
grep -r "createProjectsModule\|createVideoEditorModule\|createCameraModule" src/app/screens/
```

To batch-refactor (manual still recommended for complex screens):
1. Remove `useRef` from imports
2. Add `import { useAppModules } from '../hooks';`
3. Find `const.*Ref = useRef(create.*Module())`
4. Replace with hook call
5. Replace all `moduleName.current` → `moduleName`

