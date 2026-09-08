# Definition of Done

A task is **DONE** when ALL of the following are true. Not some. All.

## Universal Criteria (Every Task)

- [ ] **Acceptance criteria are met** - Every single one, verified
- [ ] **Acceptance criteria are testable** - Can be verified without human judgment
- [ ] **Code is implemented** - Not planned, not sketched, implemented
- [ ] **Tests are written** - Appropriate to the task scope
- [ ] **Tests pass** - All tests, locally verified
- [ ] **Lint passes** - `npm run lint` returns no errors
- [ ] **No console errors** - No warnings in console during development
- [ ] **Architecture is respected** - Ports/adapters used correctly, no layer violations
- [ ] **Dependencies are justified** - Any new dependencies documented
- [ ] **Code review is approved** - By designated reviewer
- [ ] **Merge conflicts are resolved** - PR cleanly merges to main
- [ ] **Relevant documentation updated** - If behavior changed, docs updated
- [ ] **No known bugs** - Issues are documented or fixed
- [ ] **No technical debt introduced** - Unless explicitly accepted
- [ ] **Commit messages are clear** - Future developers understand why

## Role-Specific Criteria

### Implementation Agent Tasks

Additionally:
- [ ] **Task scope not exceeded** - Only implemented what was requested
- [ ] **No refactoring beyond task scope** - Unscoped cleanup is deferred
- [ ] **Tests are meaningful** - Not just for coverage, actually test functionality
- [ ] **Edge cases considered** - Boundary conditions tested
- [ ] **Error handling implemented** - Not swallowed, logged or raised appropriately
- [ ] **Performance acceptable** - Meets performance requirements if specified
- [ ] **Code is readable** - Variable names are clear, complex logic has comments
- [ ] **No temporary code left behind** - No `// TODO: fix this`, no mock implementations

### Feature Tasks

Additionally:
- [ ] **Feature works end-to-end** - Not just unit tested, actually works in app
- [ ] **User experience is acceptable** - No crashes, reasonable performance
- [ ] **Offline behavior documented** - If applicable
- [ ] **Platform compatibility verified** - Works on Android and iOS

### Bug Fix Tasks

Additionally:
- [ ] **Root cause identified** - Not just the symptom
- [ ] **Fix addresses root cause** - Not a workaround
- [ ] **Regression test added** - So this bug doesn't come back
- [ ] **No new bugs introduced** - Other tests still pass
- [ ] **Related bugs checked** - Similar issues investigated

### Refactor Tasks

Additionally:
- [ ] **Behavior unchanged** - Refactor doesn't change functionality
- [ ] **All tests still pass** - No regression
- [ ] **Rationale documented** - Why this refactor was needed
- [ ] **Scope is contained** - Not sprawling across codebase
- [ ] **Performance not degraded** - Benchmarks show same or better

### Research Tasks

Additionally:
- [ ] **Findings documented** - In PR description or new doc
- [ ] **Recommendations provided** - What should we do next?
- [ ] **Alternatives evaluated** - Not just one option
- [ ] **Risks identified** - Honest about downsides
- [ ] **Time estimates included** - If implementation follows

## Testing Checklist

### Unit Tests
- [ ] Exist for new functions/classes
- [ ] Test happy path
- [ ] Test edge cases (empty input, null, max values)
- [ ] Test error conditions
- [ ] Pass locally

### Integration Tests
- [ ] Exist for use cases
- [ ] Use real implementations (or well-documented mocks)
- [ ] Test module interactions
- [ ] Test with different configurations

### End-to-End Tests
- [ ] Exist if feature is user-facing
- [ ] Test complete workflow
- [ ] Test on actual device or realistic emulator
- [ ] Pass without manual intervention

### Performance Tests
- [ ] Exist if performance requirement specified
- [ ] Measure on representative device
- [ ] Meet specified targets
- [ ] Document results

### Edge Case Coverage
- [ ] Empty/null inputs handled
- [ ] Boundary values tested
- [ ] Error scenarios covered
- [ ] Concurrent operations if applicable

## Code Quality Checklist

### Readability
- [ ] Variable names are descriptive
- [ ] Function names describe what they do
- [ ] Complex logic has comments (WHY, not WHAT)
- [ ] No magic numbers or strings (use constants)
- [ ] Functions are reasonably sized (< 30 lines guideline)

### Maintainability
- [ ] Code follows project conventions
- [ ] No unnecessary duplication
- [ ] No dead code (commented-out blocks)
- [ ] Architecture patterns respected
- [ ] Future developers can understand it

### Safety
- [ ] No hardcoded credentials
- [ ] No sensitive data in logs
- [ ] Errors handled appropriately
- [ ] No deprecated APIs used
- [ ] Security best practices followed

### Performance
- [ ] No obvious inefficiencies
- [ ] No N+1 queries or loops
- [ ] Memory usage reasonable
- [ ] Meets performance requirements
- [ ] Benchmarked on real device

## Documentation Checklist

### Code Comments
- [ ] WHY comments for non-obvious logic
- [ ] No redundant comments (code speaks for itself)
- [ ] All public APIs documented
- [ ] @deprecated markers used if applicable

### Task Documentation
- [ ] PR description explains changes
- [ ] Related issues/tasks referenced
- [ ] Breaking changes documented
- [ ] Migration guide provided (if breaking)

### Project Documentation
- [ ] Architecture docs updated if structure changed
- [ ] New ports documented
- [ ] New modules described in modules.md
- [ ] Risk register updated if applicable

## Checklist by Task Type

### NEW FEATURE

**Must have**:
- [ ] Acceptance criteria met
- [ ] Tests written (unit + integration + E2E)
- [ ] Architecture respected (ports/adapters)
- [ ] Documentation updated
- [ ] Works on real device
- [ ] No known bugs

### BUG FIX

**Must have**:
- [ ] Root cause identified and fixed
- [ ] Regression test written
- [ ] No new bugs introduced
- [ ] Other tests still pass
- [ ] Related issues checked

### REFACTOR

**Must have**:
- [ ] Behavior unchanged
- [ ] All tests pass
- [ ] Rationale documented
- [ ] Performance not degraded
- [ ] Scope contained

### INFRASTRUCTURE

**Must have**:
- [ ] Build/test still works
- [ ] CI/CD passing
- [ ] Documentation updated
- [ ] Rollback plan if needed

## The "Is It Really Done?" Test

Ask yourself:

1. **Could a new agent pick this up and understand what was done?**
   - If no → incomplete documentation

2. **Are all acceptance criteria met?**
   - If no → not done

3. **Did I do anything unrelated to this task?**
   - If yes → need to revert or split

4. **Are there any `TODO`, `FIXME`, or `XXX` comments?**
   - If yes → not done (unless documented in task)

5. **Does this require documentation or migration?**
   - If yes → did you provide it?

6. **Would I feel comfortable shipping this tomorrow?**
   - If no → not done

## Common "Not Done" Mistakes

### ❌ "It compiles"
Compiling ≠ working. Does it pass tests? Does it meet acceptance criteria?

### ❌ "Tests exist"
Do tests actually test the right things? Do they pass? Are they meaningful?

### ❌ "Lint passes"
Lint is just style. Is the logic correct? Are edge cases handled?

### ❌ "No merge conflicts"
Conflicts aren't the only integration issue. Do other tests still pass?

### ❌ "I'll document it tomorrow"
Documentation is part of done. Write it now.

### ❌ "The main scenario works"
Edge cases matter. What about empty input? Null values? Max values?

### ❌ "It passes review"
Review might approve conditional on fixes. Are those fixes done?

### ❌ "It works on my machine"
Did you test on actual device? Emulator ≠ reality.

## Approval Gates

A task cannot be marked DONE without:

1. **Architect approval** (if architectural changes)
2. **Code reviewer approval** (all tasks)
3. **QA approval** (if QA assigned)
4. **Performance sign-off** (if performance requirements)

## Acceptance Criteria Never Negotiable

The acceptance criteria in the task are the truth. If the task says:
- "Supports 10 layers"
- "Runs in < 100ms"
- "Works offline"

Then it must do exactly that. No exceptions.

If you discover you can't meet acceptance criteria:
1. **Stop** - Don't work around it
2. **Document** - Add comment to task
3. **Request change** - Talk to Architect
4. **Wait for approval** - Don't proceed until clarified

## When Something Is "Almost Done"

A task is either DONE or NOT DONE. No "almost done".

Statuses:
- **IN_PROGRESS**: Working on it
- **IMPLEMENTED**: Code done, waiting for testing
- **TESTING**: Testing in progress
- **REVIEW**: Waiting for code review
- **DONE**: Everything done, approved

There's no "90% done". It's either done or it's not.

## Definition of Done is Immutable

Once the team agrees on Definition of Done, it doesn't change mid-project. If you think Definition of Done needs to change, propose it as an architectural decision, not as an exception.

## Self-Assessment

Before requesting review, ensure:

```typescript
const isDone = (task: Task) => {
  return (
    task.acceptanceCriteria.every(c => c.met) &&
    task.tests.every(t => t.passes) &&
    task.lint.passes &&
    task.architecture.respected &&
    task.documentation.updated &&
    task.review.notRequiredYet &&
    task.noBugsCaught &&
    task.noUnrelatedChanges
  );
};
```

---

**Remember**: "Done" means ready to ship. Not "ready to review", not "ready to test", not "mostly works". Ready to ship.

If there's any doubt whether something is done, it's not done. Clarify with the team.
