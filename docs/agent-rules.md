# Agent Rules & Conduct

These rules exist to prevent architectural decay and enable safe parallel work.

## Core Principles

1. **Architects decide architecture; agents execute within it**
2. **Code changes are reversible; architectural changes are not**
3. **Documentation is authority; undocumented behavior is a bug**
4. **Contracts are sacred; breaking them requires approval**
5. **When in doubt, don't change it**

## Mandatory Rules

### ❌ Architectural Changes
**Rule**: Never alter architecture without explicit Architect approval.

**Examples of architectural changes** (require approval):
- Moving a file from one module to another
- Creating new top-level directories
- Changing module dependency structure
- Merging or splitting modules
- Changing ports/interfaces
- Modifying core domain entities
- Changing data flow patterns

**How to get approval**:
1. Document the change (what, why, impact)
2. Create an ADR in `docs/decisions/`
3. Request Architect review
4. Wait for approval before implementing
5. Implement only approved changes

**Violation consequence**: Code review rejection + mandatory revert.

---

### ❌ Breaking Contracts
**Rule**: Never modify public interfaces without explicit approval.

**Public interfaces include**:
- Port definitions (`core/ports/`)
- Domain entities (`core/domain/entities/`)
- Public use cases
- API contracts
- Storage schemas

**What you CAN do**:
- Add new optional methods to ports (backward compatible)
- Add new optional fields to entities
- Implement existing ports
- Extend internal functionality

**What you CANNOT do**:
- Remove port methods
- Remove entity fields
- Change method signatures
- Change parameter types
- Remove validation rules

**If you need to break a contract**:
1. Document why in a comment
2. Create an ADR explaining the migration
3. Provide migration path for existing code
4. Update all consumers of the contract
5. Request Architect approval
6. Only then implement

**Violation consequence**: Code review rejection + mandatory fix.

---

### ❌ Undocumented Dependencies
**Rule**: Every external dependency must be justified.

**Before adding any npm package**:
1. Check [dependencies.md](dependencies.md) policy
2. Verify it's compatible with React Native, Android, iOS
3. Document in `docs/dependencies.md` why it's needed
4. Justify its complexity, maintenance status, license
5. Consider alternatives
6. Run through Architect evaluation

**Prohibited packages** (without explicit exception):
- Packages not maintained in 6+ months
- Packages with known security issues
- Packages requiring native build (except documented ones)
- Packages that duplicate core functionality
- Packages with GPL-like licenses (use carefully)
- Packages with zero documentation

**Violation consequence**: Dependency removal + PR rejection.

---

### ❌ Deleting Tests to Fix Build
**Rule**: Never remove tests because they fail.

**Correct approach**:
1. Test fails → investigate why
2. Fix the code, not the test
3. If test is wrong → fix the test, not by deleting it
4. If test is obsolete → mark it as `@deprecated` first
5. Only remove after confirming with code owner

**Exception**: Test files from incomplete implementations in branches can be removed if:
- No production code depends on them
- Architect confirms it's safe
- You document why

**Violation consequence**: Automatic PR rejection.

---

### ❌ Ignoring Lint Errors
**Rule**: All lint errors must pass before committing.

**Your process**:
1. Write code
2. Run `npm run lint`
3. Fix all errors
4. Run `npm run lint` again (verify)
5. Commit only when clean
6. If lint rule is wrong → discuss with team, then disable it globally (not locally)

**Exception**: Disabling lint for a single line is acceptable **only if**:
- You add a comment explaining why
- The reason is not "I don't like this rule"
- Example: `// eslint-disable-next-line no-unused-vars -- async handler required by RN`

**Violation consequence**: Code review rejection.

---

### ❌ Unscoped Implementation
**Rule**: Never implement features not in the current task.

**Only implement what's requested**. If you find related bugs or improvements:
1. **Don't fix them in this PR**
2. Document them in a comment
3. Create a task for later
4. Continue with assigned task

**Exception**: If fixing an unscoped bug is necessary to make the task pass (clarify with Architect).

**Violation consequence**: PR rejection + request to revert unscoped changes.

---

### ❌ Unauthorized Refactoring
**Rule**: Only refactor within the scope of the current task.

**Bad**:
- "While implementing X, I'll refactor Y because it's messy"
- "This module could be better structured"
- "Let me extract these utilities"

**Good**:
- Refactoring required to make the current task pass
- Refactoring explicitly requested in the task
- Small cleanups within the file you're editing

**How to handle refactoring urges**:
1. Document the refactoring opportunity
2. Create a task for it
3. Mark it as **REFACTORING** in backlog
4. Only implement if Refactoring Agent picks it up

**Violation consequence**: PR rejection + revert request.

---

### ❌ Cross-Module Contamination
**Rule**: Minimize coupling between modules.

**Allowed**:
- Module A imports from `core/`
- Module A imports from `infrastructure/`
- Module A imports types from Module B (through `core/`)

**Forbidden**:
- Photo-editor imports from video-editor
- Video-editor imports from camera
- Any module imports from presentation of another module
- Direct imports across module folders (except core/infrastructure)

**Correct pattern**:
```typescript
// ❌ Wrong
import { VideoPlayer } from 'modules/video-editor/presentation/components/VideoPlayer';

// ✅ Right
import { VideoPlayerPort } from 'core/ports/VideoPlayerPort';
// Then video-editor implements this port
```

**Violation consequence**: Code review rejection + refactoring required.

---

### ❌ Incomplete Work
**Rule**: Don't mark tasks done unless completely done.

**A task is done when**:
- [ ] Code is implemented
- [ ] Tests are written
- [ ] Tests pass
- [ ] Lint passes
- [ ] No known bugs
- [ ] Architecture respected
- [ ] Documentation updated

**Don't mark as done if**:
- "I'll write tests tomorrow"
- "I'll refactor this later"
- "Just need to fix one lint error"
- "There's a bug but it's edge-casey"

**Violation consequence**: QA rejection + task sent back to IN PROGRESS.

---

### ❌ Masking Errors
**Rule**: Don't hide errors behind try/catch without handling.

**Bad**:
```typescript
try {
  await saveProject();
} catch (error) {
  console.log("Error"); // Silent failure
}
```

**Good**:
```typescript
try {
  await saveProject();
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn("Project validation failed", error);
    return { success: false, message: error.message };
  } else if (error instanceof StorageError) {
    logger.error("Storage failed", error);
    return { success: false, message: "Could not save project" };
  } else {
    logger.error("Unexpected error while saving", error);
    throw error; // Re-throw unknown errors
  }
}
```

**Guideline**: Log errors and handle them appropriately. If you can't handle an error, re-throw it.

---

### ❌ Mock-Based Solutions
**Rule**: Mocks are for testing, not for permanent implementation.

**Correct use of mocks**:
- Unit tests mock external dependencies
- Integration tests use real implementations
- Never commit `// TODO: replace with real implementation`

**Common mistake**:
```typescript
// ❌ Wrong
export class MockStorageAdapter implements StoragePort {
  // Returns fake data forever
}
// This is used in production! That's wrong!
```

**Right**:
```typescript
// ✅ This only exists in tests
export class MockStorageAdapter implements StoragePort {
  // Fake data for testing only
}

// Production uses:
export class SQLiteStorageAdapter implements StoragePort {
  // Real implementation
}
```

---

### ❌ API Modification Without Documentation
**Rule**: Document all API changes and maintain compatibility when possible.

**If you modify an API**:
1. Document the change in a comment
2. If breaking: explain why in code or ADR
3. If non-breaking: no extra docs needed
4. Update all consumers
5. Add to changelog

**Breaking changes need**:
- Architect approval
- ADR documenting the migration
- Migration path documented
- All consumers updated in same PR

---

### ❌ Ignoring Compatibility
**Rule**: Maintain compatibility with established requirements.

**Don't**:
- Remove platforms (e.g., dropping iOS support)
- Remove features (e.g., disabling offline mode)
- Change core behavior without warning
- Break data format (projects, exports)

**If you need to break compatibility**:
1. Create migration code
2. Document in ADR
3. Get Architect approval
4. Provide fallback path
5. Plan migration for users

---

### ✅ DO: Ask for Clarification
**Rule**: If a task is unclear, ask before implementing.

**Unclear situations**:
- "The requirement doesn't specify enough detail"
- "I don't understand the acceptance criteria"
- "The architecture doesn't cover this scenario"
- "This conflicts with another requirement"

**What to do**:
1. Don't guess
2. Add comment to task: "Need clarification on: ..."
3. Request Architect input
4. Wait for response
5. Proceed only when clear

---

## Role-Based Rules

### Implementation Agent Specific

1. **Follow the architecture** - Don't invent new patterns
2. **Write tests first** - TDD when possible
3. **Don't touch unrelated modules** - Stay focused
4. **Document complex logic** - WHY, not WHAT
5. **Run tests locally** - Before committing
6. **Request code review** - After tests pass

### Review Agent Specific

1. **Check architecture compliance** - Not just syntax
2. **Verify tests are adequate** - Not just that they exist
3. **Check for unscoped changes** - Only review requested changes
4. **Validate contracts** - Public interfaces must be stable
5. **Confirm dependencies** - New deps must be justified

### QA Agent Specific

1. **Test acceptance criteria** - Not beyond scope
2. **Check offline behavior** - If applicable
3. **Verify performance** - Especially media operations
4. **Test on real devices** - Not just emulator
5. **Report edge cases** - Not just happy path

### Research Agent Specific

1. **Evaluate alternatives** - Not just one option
2. **Document findings** - So others learn
3. **Don't implement** - Just research and recommend
4. **Identify risks** - Be honest about downsides
5. **Provide time estimates** - Integration complexity

## Workflow Rules

### Before Committing
- [ ] Tests pass
- [ ] Lint passes
- [ ] No console errors
- [ ] Only committed file changes are for this task
- [ ] Commit message is clear
- [ ] No sensitive data in commits

### Before Creating PR
- [ ] All tests pass
- [ ] No merge conflicts
- [ ] Based on latest main
- [ ] Related issues/tasks referenced
- [ ] Clear description of changes

### Before Marking Done
- [ ] Code review approved
- [ ] All tests pass
- [ ] Architecture approved (if applicable)
- [ ] Acceptance criteria met
- [ ] No known bugs
- [ ] Documentation updated

## Violation Severity

### 🔴 CRITICAL (Automatic rejection)
- Deleting tests to fix build
- Breaking architectural contracts without approval
- Adding dependencies without justification
- Modifying core domain without approval
- Security vulnerabilities

**Consequence**: PR rejected, must revert and rethink approach.

### 🟠 MAJOR (Rejection + discussion)
- Unscoped implementation
- Unauthorized refactoring
- Ignoring lint errors
- Cross-module contamination
- Masking errors silently

**Consequence**: PR rejected, must fix before resubmitting.

### 🟡 MINOR (Warning + fix)
- Incomplete documentation
- Suboptimal code structure (but functional)
- Missing edge case handling
- Unclear variable names

**Consequence**: Request changes, can approve with fixes.

## The Golden Question

When you're about to make a change:

> "Is this change **requested by my task**, **approved by architecture**, and **does it not break existing contracts**?"

If all three are YES → proceed  
If any is NO → stop and ask first

---

**Remember**: These rules exist to keep the project healthy, not to slow you down. Good architecture makes it possible for multiple agents to work safely in parallel. Respecting these rules is how we maintain that safety.

**Last updated**: 2026-09-07  
**Architect**: Templasan
