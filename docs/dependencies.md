# Dependency Management Policy

This document defines the policy for external libraries and dependencies.

## Core Principle

**Use established libraries. Avoid reinventing the wheel.**

We prefer using mature, well-maintained third-party solutions over custom implementations. However, we're selective about dependencies to minimize bundle size, maintenance burden, and risk.

## Evaluation Criteria

Before adding any npm package, evaluate:

### 1. Necessity (Must Have)
- ❓ Does this solve a real problem we can't solve ourselves quickly?
- ❓ Would implementing this ourselves take significantly longer?
- ❓ Is this a well-known, solved problem?

**If NO to any** → Don't add the dependency

### 2. Maintenance Status (Must Have)
- ✅ Last updated within 6 months
- ✅ Active issues being addressed
- ✅ Regular releases
- ✅ Not in maintenance mode (unless stable/mature)

**Check**:
- GitHub last commit date
- Open vs closed issues ratio
- Release frequency
- Community activity

**Red flags**:
- ❌ No updates in 12+ months
- ❌ Author deprecated the project
- ❌ Many unresolved security issues
- ❌ Zero community activity

### 3. React Native Compatibility (Must Have)
- ✅ Works with current React Native version
- ✅ Supports both Android and iOS
- ✅ No or minimal native code required (unless documented)

**Check**:
- README mentions React Native explicitly
- Package has expo compatibility flag
- Android and iOS sections documented
- Issue tracker has React Native discussions

**Red flags**:
- ❌ Only works on web (not React Native)
- ❌ Only works on Android or iOS
- ❌ Requires native code but not documented
- ❌ Last RN version is 0.60 (too old)

### 4. Size & Performance (Important)
- ✅ Bundle size overhead < 500KB (uncompressed)
- ✅ Runtime performance acceptable
- ✅ No unnecessary dependencies (tree-shakeable)
- ✅ Lazy-loadable if heavy feature

**Check with**:
- `npm pack` and check size
- Bundlephobia.com for web size estimates
- Profiling on actual devices

**Red flags**:
- ❌ Adds > 1MB uncompressed
- ❌ Large number of sub-dependencies
- ❌ Non-tree-shakeable code

### 5. Maturity & Stability (Important)
- ✅ Version >= 1.0.0 (production-ready)
- ✅ Stable API (not pre-release)
- ✅ Good documentation
- ✅ Active community support

**Red flags**:
- ❌ 0.x versions (actively changing)
- ❌ Alpha/beta/RC releases
- ❌ No documentation
- ❌ Stack Overflow has zero answers about it

### 6. License (Must Have)
- ✅ MIT, Apache 2.0, ISC, or BSD-compatible
- ✅ Not GPL or AGPL (too restrictive)
- ⚠️ Check license for commercial restrictions

**Red flags**:
- ❌ GPL or AGPL licensed (incompatible with proprietary app)
- ❌ Custom/restrictive license
- ❌ No license declared

### 7. Security (Must Have)
- ✅ No known security vulnerabilities
- ✅ Dependency security audit passes
- ✅ No hardcoded secrets

**Check with**:
- `npm audit`
- Snyk.io
- GitHub security advisories
- NIST NVD database

**Red flags**:
- ❌ High/critical vulnerabilities
- ❌ Unpatched known exploits
- ❌ Dependency audit warnings

### 8. Alternatives Evaluated (Important)
- ❓ Are there other libraries that solve this?
- ❓ What are the tradeoffs?
- ❓ Why choose this one over alternatives?

**Document**: Why we chose this library over alternatives

---

## Pre-Adoption Checklist

Before adding a dependency:

```
[ ] Necessity: Solves real problem, not easily solvable ourselves
[ ] Maintenance: Last update < 6 months, active community
[ ] React Native: Explicitly compatible, both Android & iOS
[ ] Size: Bundle overhead < 500KB
[ ] Maturity: >= v1.0.0, stable API
[ ] License: MIT/Apache/BSD/ISC
[ ] Security: npm audit passes, no known CVEs
[ ] Alternatives: Evaluated and justified choice
[ ] Documentation: Added to docs/dependencies.md
[ ] Team: No objections from Architect/Review Agent
```

**Don't proceed without all checkmarks.**

---

## Current Approved Dependencies

### Core Framework
| Package | Version | Reason | Notes |
|---------|---------|--------|-------|
| react-native | ^0.73 | Foundation | Required |
| react | ^18 | Foundation | Required |

### State Management
*To be evaluated and added during Phase 1*
- Candidates: Redux, Zustand, MobX, Context API
- Research phase required before adoption

### Navigation
| Package | Version | Reason | Notes |
|---------|---------|--------|-------|
| @react-navigation/native | - | Industry standard | Evaluate in Phase 1 |
| @react-navigation/stack | - | Stack navigation | Evaluate in Phase 1 |
| @react-navigation/bottom-tabs | - | Tab navigation | Evaluate in Phase 1 |

### Media Processing
*Critical research needed - High risk*
- FFmpeg (video encoding)
- React Native Skia (rendering)
- React Native Vision Camera (camera access)
- Audio handling library

### Storage
*Research phase*
- SQLite (local database)
- Firebase Realtime/Firestore (sync)
- File system access library

### Testing
| Package | Version | Reason | Notes |
|---------|---------|--------|-------|
| jest | Latest | Unit testing | Standard |
| @testing-library/react-native | - | Component testing | Evaluate |
| detox | - | E2E testing | Evaluate |

### Build & Tooling
| Package | Version | Reason | Notes |
|---------|---------|--------|-------|
| typescript | Latest | Type safety | Required |
| eslint | Latest | Linting | Required |
| prettier | Latest | Formatting | Required |

---

## Prohibited Dependencies

These are NOT allowed without exceptional justification:

| Category | Example | Reason |
|----------|---------|--------|
| Unmaintained | old-package (no updates in 2 years) | Risk of stale code, security issues |
| Web-only | react-router, d3 | Incompatible with React Native |
| GPL licensed | some-gpl-package | Incompatible with proprietary app |
| Massive | lodash (if full) | Bloat, use individual utils instead |
| Beta/unstable | beta-package@0.0.1 | Production risk |
| Deprecated | deprecated-lib | Risk and unsupported |
| Monolithic | framework-overkill | Too much overhead for task |

**Exception process**:
1. Document why it's necessary
2. Create ADR explaining exception
3. Get unanimous Architect + Review Agent approval
4. Add to prohibited list with justification
5. Plan migration path if needed

---

## Dependency Organization

### Framework Layer
```
React Native
  ├── react-native-core
  └── Metro bundler
```

### State Management
```
Redux / Zustand / Context
  ├── Middleware for async operations
  └── DevTools for debugging
```

### Navigation
```
React Navigation
  ├── Stack navigator
  ├── Tab navigator
  └── Linking configuration
```

### Media Processing
```
FFmpeg adapter
  ├── React Native FFmpeg (candidate)
  └── Alternative implementations

Rendering
  ├── React Native Skia (candidate)
  └── Canvas API alternatives

Camera
  ├── React Native Vision Camera (candidate)
  └── Native implementation fallback
```

### Storage
```
Local
  ├── SQLite adapter
  └── File system adapter

Remote
  ├── Firebase adapter
  └── Custom backend adapter
```

---

## Adding a New Dependency

### Step 1: Identify Need
Document:
- What problem does it solve?
- Can we solve it ourselves quickly?
- Why not use existing library?

### Step 2: Research
- Check github.com, npmjs.com, alternatives
- Run evaluation checklist
- Document findings in PR description

### Step 3: Get Approval
- PR with dependency research
- Architect reviews
- Review Agent checks security
- Team consensus before merge

### Step 4: Document
- Add to [dependencies.md](dependencies.md)
- Add comment explaining choice
- Document alternatives considered
- Add to package.json with version lock

### Step 5: Verify
- npm audit passes
- Builds on both Android and iOS
- Works in target React Native version
- No unexpected size impact

### Step 6: Monitor
- Keep eye on updates
- Subscribe to security advisories
- Periodically audit all dependencies

---

## Removing a Dependency

If a dependency is no longer needed:

1. Ensure nothing imports it
2. Create PR removing it
3. Document why it's removed
4. Run `npm audit` to verify no vulnerabilities introduced
5. Test build on both platforms

---

## Updating Dependencies

### Minor Updates (Patch)
- Can update anytime
- Run tests locally
- Update package.json

### Minor Updates (New Features)
- Check changelog
- Verify compatibility
- Update in main PR
- Test thoroughly

### Major Updates
- Create separate PR
- Full testing required
- Architect review
- Document breaking changes
- Update migration notes

### Security Updates
- Update immediately
- Test suite must pass
- Document patched vulnerabilities

---

## Handling Security Issues

### If vulnerability found:
1. Run `npm audit` to identify
2. Check if patch available
3. Update immediately
4. Run full test suite
5. Deploy fix

### If no patch available:
1. Check alternatives
2. Document workaround
3. Monitor for patch
4. Plan replacement

### If critical vulnerability:
1. Immediate mitigation
2. Communicate to team
3. Plan fix/replacement
4. Add to risk register

---

## Bundle Size Monitoring

Keep bundle size in check:

```bash
# Check bundle size
npm run analyze-bundle

# Acceptable sizes:
App bundle: < 50MB (compressed)
Core dependencies: < 20MB
Per-module overhead: < 2MB
```

**Monthly review**:
- Track bundle size trends
- Identify growth sources
- Optimize if exceeding limits

---

## Dependency Audit Schedule

| Frequency | Task | Owner |
|-----------|------|-------|
| Weekly | Run `npm audit` | CI/CD |
| Monthly | Dependency review | Review Agent |
| Quarterly | Bundle size analysis | Architect |
| Semi-annually | Technology evaluation | Research Agent |

---

## Current Status

### Evaluated & Approved
- react-native (required)
- react (required)
- typescript (required)
- eslint (required)
- prettier (required)

### Pending Research
- State management (Redux/Zustand/MobX)
- Navigation (@react-navigation or alternative)
- Media processing (FFmpeg, Skia)
- Camera (Vision Camera or native)
- Storage (SQLite, Firebase)
- Testing framework (Jest, Detox)
- Audio processing
- AI inference (TensorFlow Lite, Core ML, ML Kit)

### Research Timeline
- Week 1-2: Core libraries research
- Week 3: Make go/no-go decisions
- Week 4: Prototype with candidates
- Week 5: Final decision + ADRs

---

**Last Updated**: 2026-09-07  
**Owner**: Architect Agent  
**Review Cycle**: Monthly

---

## Questions for Research Agent

Before using any of these libraries in implementation, Research Agent must evaluate:

1. **React Native State Management**
   - Redux vs Zustand vs MobX vs Context API
   - Performance for large app state
   - Developer experience

2. **Media Processing**
   - FFmpeg library options (React Native FFmpeg vs alternatives)
   - Performance on mid-range devices
   - 4K video support

3. **Rendering Engine**
   - React Native Skia: compatibility, performance, learning curve
   - Alternative rendering approaches
   - 3D capabilities if needed

4. **Camera Library**
   - React Native Vision Camera: stability, feature completeness
   - Native implementation requirements
   - RAW capture support

5. **Storage**
   - SQLite: React Native SQLite library recommendations
   - Firebase: Realtime DB vs Firestore for collaboration
   - Sync strategy

6. **AI/ML**
   - TensorFlow Lite vs Core ML vs ML Kit
   - On-device model size and performance
   - Remote inference platforms

7. **Testing**
   - Jest configuration for React Native
   - Component testing approach
   - E2E testing with Detox or Maestro

Report findings in dedicated ADR or tech spike PR.
