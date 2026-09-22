# Testing Strategy - Phase 3

**Goal**: 80%+ coverage for domain + application layers

---

## Test Pyramid

```
UI Layer (manual testing / e2e)
        ↓
Integration Tests (ports + adapters)
        ↓
Application Tests (use cases) ✓ Phase 3
        ↓
Domain Tests (entities) ✓ Phase 3
```

Phase 3 focuses on **Domain + Application** (bottom 2 layers).

---

## Domain Layer Tests

**What to test**: Pure business logic

**Files**: `src/modules/{module}/domain/**/*.test.ts`

**Example**: `Project.test.ts`
- Entity creation
- Validation rules
- Business invariants
- Edge cases (empty strings, null, very large values)
- State transitions (status changes)
- Immutability

**Pattern**:
```typescript
describe('Entity', () => {
  describe('method', () => {
    it('should do X', () => {
      const entity = create();
      const result = entity.method();
      expect(result).toEqual(expected);
    });

    it('should handle edge case', () => {
      const entity = create();
      expect(() => entity.method(null)).toThrow();
    });
  });
});
```

---

## Application Layer Tests

**What to test**: Use case orchestration

**Files**: `src/modules/{module}/application/**/*.test.ts`

**Example**: `CreateProjectUseCase.test.ts`
- Use case execution
- Repository interaction
- Error handling
- State changes

**Pattern**:
```typescript
describe('UseCase', () => {
  let repository: MockRepository;
  let useCase: UseCase;

  beforeEach(() => {
    repository = new MockRepository();
    useCase = new UseCase(repository);
  });

  it('should execute successfully', async () => {
    const result = await useCase.execute(input);
    expect(result).toEqual(expected);
  });

  it('should persist state', async () => {
    const result = await useCase.execute(input);
    const saved = await repository.find(result.id);
    expect(saved).toBeDefined();
  });

  it('should handle error', async () => {
    await expect(useCase.execute(invalidInput)).rejects.toThrow();
  });
});
```

---

## Mocking Strategy

**DO Mock**:
- Repository ports (data persistence)
- External service ports
- Network calls

**DO NOT Mock**:
- Domain entities (test the real thing)
- Application logic (test the orchestration)
- Value types (UUID, dates, etc)

**Example Mock**:
```typescript
class MockProjectRepository implements ProjectRepository {
  private storage = new Map();

  async save(project: any): Promise<void> {
    this.storage.set(project.id, project);
  }

  async findById(id: string): Promise<any | undefined> {
    return this.storage.get(id);
  }
}
```

---

## Coverage Target: 80%

**Per module**:
- Domain: 90%+ (pure logic, easy to cover)
- Application: 75%+ (use cases, test happy path + errors)
- Ports: N/A (interfaces, no implementation)
- Infrastructure: Deferred (adapters tested via integration tests)

**Calculation**:
```
Coverage = (Lines Covered) / (Executable Lines)

Target: 80% = (0.9 * domain lines + 0.75 * app lines) / total
```

---

## Priority Modules (Phase 3)

1. **Projects** (most critical)
   - Domain entities
   - Use cases: Create, List, Delete, Update, AddAsset, RemoveAsset
   - Domain: 25 tests
   - App: 30 tests

2. **Photo-Editor** (core feature)
   - Domain: Mask, Layer (if applicable)
   - Filters already tested via integration
   - Estimate: 20 tests

3. **Export** (user-facing)
   - Domain: ExportQuality, ExportFormat
   - Use cases: ExportImage, ExportVideo
   - Estimate: 15 tests

4. **Video-Editor** (complex)
   - Domain: Clip, Track, Timeline
   - Use cases: CreateClip, TrimClip
   - Estimate: 25 tests

---

## Running Tests

```bash
# All tests
npm test

# Single module
npm test -- projects

# Single file
npm test -- Project.test

# Coverage report
npm test -- --coverage

# Watch mode
npm test -- --watch
```

---

## Example: Full Projects Coverage

```
Project.test.ts
├── createProject (5 tests)
├── addAssetToProject (5 tests)
├── updateProject (6 tests)
└── invariants (3 tests)
Total: 19 tests, ~90% coverage

CreateProjectUseCase.test.ts
├── happy path (3 tests)
├── edge cases (4 tests)
└── errors (2 tests)
Total: 9 tests

ListProjectsUseCase.test.ts
├── empty list (1 test)
├── filtering (3 tests)
├── multiple calls (2 tests)
Total: 6 tests

DeleteProjectUseCase.test.ts
├── delete existing (3 tests)
├── delete non-existent (2 tests)
├── edge cases (2 tests)
Total: 7 tests

Total Projects: 41 tests, ~85% coverage
```

---

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Run tests
  run: npm test -- --coverage --ci

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

---

## Maintenance

- Update tests when requirements change
- Add tests for new bugs (bug ↔ test → fix)
- Refactor tests when domain changes
- Keep mocks in sync with ports

