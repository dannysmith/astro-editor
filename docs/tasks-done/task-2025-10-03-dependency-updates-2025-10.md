# Task 2: Dependency Updates - October 2025

## Summary

Routine maintenance to update all JavaScript/TypeScript and Rust dependencies to their latest versions. Most updates are minor/patch versions with minimal breaking changes.

## Assessment Date

October 3, 2025

## Current Status

- Node.js: v22.19.0 ✅ (meets all requirements)
- Last dependency update: ~2-3 months ago

## Dependency Categories

### Category 1: Simple Patch/Minor Updates (Low Risk)

These can be updated with minimal concern - no breaking changes expected:

#### JavaScript/TypeScript Dependencies

**Patch Updates (Same minor version):**
- `@codemirror/view`: 6.38.1 → 6.38.4
- `@hookform/resolvers`: 5.2.1 → 5.2.2
- `@tailwindcss/vite`: 4.1.12 → 4.1.14
- `@tauri-apps/plugin-fs`: 2.4.1 → 2.4.2
- `@tauri-apps/plugin-shell`: 2.3.0 → 2.3.1
- `react-resizable-panels`: 3.0.4 → 3.0.6
- `rollup-plugin-visualizer`: 6.0.3 → 6.0.4
- `semantic-release`: 24.2.7 → 24.2.9
- `tailwindcss`: 4.1.12 → 4.1.14
- `typescript`: 5.9.2 → 5.9.3
- `zustand`: 5.0.7 → 5.0.8
- `terser`: 5.43.1 → 5.44.0
- `lucide-react`: 0.539.0 → 0.544.0

**Minor Updates (Low risk):**
- `@codemirror/autocomplete`: 6.18.6 → 6.19.0
- `@codemirror/commands`: 6.8.1 → 6.9.0
- `@codemirror/lang-markdown`: 6.3.4 → 6.4.0
- `@eslint/js`: 9.33.0 → 9.36.0
- `eslint`: 9.33.0 → 9.36.0
- `@tanstack/react-query`: 5.85.3 → 5.90.2
- `@testing-library/jest-dom`: 6.7.0 → 6.9.1
- `@types/react`: 19.1.10 → 19.2.0
- `@types/react-dom`: 19.1.7 → 19.2.0
- `@typescript-eslint/eslint-plugin`: 8.39.1 → 8.45.0
- `@typescript-eslint/parser`: 8.39.1 → 8.45.0
- `typescript-eslint`: 8.39.1 → 8.45.0
- `react-day-picker`: 9.9.0 → 9.11.0
- `react-hook-form`: 7.62.0 → 7.63.0
- `tw-animate-css`: 1.3.7 → 1.4.0

**Tauri Plugin Updates (Minor):**
- `@tauri-apps/api`: 2.7.0 → 2.8.0
- `@tauri-apps/cli`: 2.7.1 → 2.8.4
- `@tauri-apps/plugin-dialog`: 2.3.2 → 2.4.0
- `@tauri-apps/plugin-log`: 2.6.0 → 2.7.0
- `@tauri-apps/plugin-opener`: 2.4.0 → 2.5.0

**React Updates:**
- `react`: 19.1.1 → 19.2.0
- `react-dom`: 19.1.1 → 19.2.0

#### Rust Dependencies

All Rust dependency updates appear to be compatible minor/patch updates via `cargo update`. Notable updates:
- `tauri`: 2.7.0 → 2.8.5
- `tauri-build`: 2.3.1 → 2.4.1
- `tauri-plugin-*`: All patch/minor updates available
- Various ecosystem dependencies (tokio, serde, etc.) have minor updates available

### Category 2: Updates Requiring Attention (Medium Risk)

These updates include minor breaking changes or require configuration updates:

#### 1. Zod: 4.0.17 → 4.1.11

**Status:** Medium risk - minor version jump, no documented breaking changes between 4.0 and 4.1

**Action Required:**
- Update dependency
- Run existing tests to ensure schema parsing still works
- Watch for any TypeScript type errors in frontmatter/schema handling

**Files to Monitor:**
- `src/lib/schema.ts` (main Zod usage)
- Any components using Zod validation

#### 2. @types/eslint__js: 8.42.3 → 9.14.0

**Status:** Medium risk - major version bump in types

**Breaking Change:** Type definitions may have changed for ESLint 9

**Action Required:**
- Update after ESLint config is confirmed working
- Check `eslint.config.js` for any type errors
- May require minor config adjustments

#### 3. eslint-plugin-react-hooks: 5.2.0 → 6.1.0

**Status:** Medium risk - requires config changes

**Breaking Changes:**
- Must update to "recommended" config (was "recommended-latest")
- Component names must start with uppercase letter (stricter validation)
- New rule: "component-hook-factories" (opt-in)
- Supports ESLint 9 flat config

**Action Required:**
1. Update ESLint config to use "recommended" instead of "recommended-latest"
2. Verify all component names start with uppercase
3. Test that React hooks linting still works correctly

**Files to Check:**
- `eslint.config.js`
- All component files (should already be compliant)

### Category 3: Major Updates (Higher Risk)

These require careful migration and testing:

#### 1. Vite: 6.3.5 → 7.1.8

**Status:** MAJOR version update - requires Node.js 20.19+ (✅ we have 22.19.0)

**Breaking Changes:**
1. **Node.js Requirement:** Must use Node 20.19+ or 22.12+ (already satisfied)
2. **Browser Target:** Default changed from 'modules' to 'baseline-widely-available'
3. **Sass Legacy API:** Removed (not used in this project)
4. **splitVendorChunkPlugin:** Removed (not used in this project)
5. **transformIndexHtml Hook:** Changed signature (need to verify plugins don't use this)

**Action Required:**
1. Update Vite and @vitejs/plugin-react together
2. Test dev server: `pnpm run dev`
3. Test build: `pnpm run build`
4. Verify Tauri integration still works
5. Check bundle size changes
6. Test HMR (Hot Module Replacement)

**Files to Monitor:**
- `vite.config.ts`
- All build outputs
- Development server behavior

#### 2. @vitejs/plugin-react: 4.7.0 → 5.0.4

**Status:** MAJOR version update - must update alongside Vite 7

**Breaking Changes:**
1. **Node.js Requirement:** 20.19+ or 22.12+ (already satisfied)
2. **React Dedupe:** `react` and `react-dom` no longer auto-added to `resolve.dedupe`
3. **Node Modules Processing:** Default exclude changed to allow processing files in node_modules
4. **Plugin Return Type:** Changed from `PluginOption[]` to `Plugin[]`

**Action Required:**
1. Check if `resolve.dedupe` needs manual configuration for React
2. Verify no issues with node_modules processing
3. Test React Fast Refresh still works
4. Check TypeScript types in vite.config.ts

**Files to Update:**
- `vite.config.ts` (may need to add resolve.dedupe config)

#### 3. jsdom: 26.1.0 → 27.0.0

**Status:** MAJOR version update - used in Vitest testing

**Breaking Changes:**
1. **Node.js Requirement:** v20+ (already satisfied)
2. **User Agent Stylesheet:** Now from HTML Standard (was Chromium)
3. **Window Object:** Improved spec conformance
4. **getComputedStyle():** Results may differ slightly

**Potential Impact:**
- Component tests using `getComputedStyle()` may have different results
- Window object behavior more spec-compliant (generally good)
- Some window.location mocking patterns may break

**Action Required:**
1. Update dependency
2. Run full test suite: `pnpm run test:run`
3. Watch for any failing tests related to DOM or window behavior
4. Check if any tests mock window.location (may need updates)

**Files to Monitor:**
- All test files (especially integration tests)
- Any tests using window/DOM APIs

## Recommended Update Strategy

### Phase 1: Simple Updates (1 commit)

Update all Category 1 dependencies in a single batch:

```bash
pnpm update @codemirror/view @hookform/resolvers @tailwindcss/vite @tauri-apps/plugin-fs @tauri-apps/plugin-shell react-resizable-panels rollup-plugin-visualizer semantic-release tailwindcss typescript zustand @codemirror/autocomplete @codemirror/commands @codemirror/lang-markdown @eslint/js eslint @tanstack/react-query @tauri-apps/api @tauri-apps/cli @tauri-apps/plugin-dialog @tauri-apps/plugin-log @tauri-apps/plugin-opener @testing-library/jest-dom @types/react @types/react-dom @typescript-eslint/eslint-plugin @typescript-eslint/parser typescript-eslint react react-dom react-day-picker react-hook-form terser tw-animate-css lucide-react

cargo update
```

Then run:
```bash
pnpm run check:all
```

### Phase 2: Medium Risk Updates (1 commit per package)

Update each package individually and test:

1. **Zod Update**
   ```bash
   pnpm update zod
   pnpm run test:run
   pnpm run typecheck
   ```

2. **ESLint React Hooks**
   - Update `eslint.config.js` first (change config name)
   - Then: `pnpm update eslint-plugin-react-hooks @types/eslint__js`
   - Test: `pnpm run lint`

### Phase 3: Major Updates (1 commit, thorough testing)

Update Vite, plugin-react, and jsdom together since they're all dev/build tools:

```bash
pnpm update vite @vitejs/plugin-react jsdom
```

Then comprehensive testing:
```bash
pnpm run typecheck
pnpm run test:run
pnpm run build
pnpm run tauri:check
```

Manual testing:
- Ask user to run `pnpm run dev` and verify app works
- Test HMR by editing a component
- Test build output
- Verify tests still pass

## Rollback Plan

If issues arise:
1. Git status before each phase
2. Keep phases in separate commits
3. Can revert individual commits if needed
4. Document any issues encountered

## Post-Update Checklist

After all updates:
- [ ] Run `pnpm run check:all` successfully
- [ ] Dev server starts and works (`pnpm run dev`)
- [ ] Production build succeeds (`pnpm run build`)
- [ ] Tauri build check passes (`pnpm run tauri:check`)
- [ ] All tests pass (`pnpm run test:run` and `pnpm run rust:test`)
- [ ] Manual smoke testing in dev mode
- [ ] Update this task file with any issues encountered

## Notes

- Total packages to update: ~40 JavaScript packages + Rust dependencies
- Most updates are low-risk patches/minor versions
- 3 major version updates require careful attention (Vite, plugin-react, jsdom)
- React 19.2 includes new features (Activity component, useEffectEvent) but no breaking changes
- Tauri plugins are all compatible minor updates

## Decision

Recommend proceeding with updates in 3 phases as outlined above. The risk is relatively low for most updates, with the main attention needed on Vite 7, @vitejs/plugin-react 5, and jsdom 27.

---

## Execution Summary

**Date Completed:** October 3, 2025

### Phase 1: Low-Risk Updates ✅

Successfully updated:
- 35+ JavaScript/TypeScript patch and minor version updates
- ~160 Rust dependency updates via `cargo update`
- React 19.1 → 19.2 (minor update with new features, no breaking changes)
- All CodeMirror, Tauri plugins, TanStack Query, and other ecosystem packages

**Result:** All checks passed (`pnpm run check:all`)

### Phase 2: Medium-Risk Updates ✅

Successfully updated:
- **Zod:** 4.0.17 → 4.1.11 (minor version, no breaking changes detected)
- **eslint-plugin-react-hooks:** 5.2.0 → 6.1.0 (major version, ESLint 9 compatibility)
- **@types/eslint__js:** Removed (deprecated - ESLint 9 provides own types)

**Result:** All linting and type checking passed

### Phase 3: Major Updates ✅

Successfully updated:
- **Vite:** 6.3.5 → 7.1.8 (major version)
- **@vitejs/plugin-react:** 4.7.0 → 5.0.4 (major version)
- **jsdom:** 26.1.0 → 27.0.0 (major version)

**Changes Required:**
- Removed deprecated `@types/eslint__js` package
- Updated `tauri:check` script (removed deprecated `--check` flag from Tauri CLI 2.8)

**Result:** All tests pass, build succeeds, no runtime issues detected

### Final Status

✅ All dependency updates completed successfully
✅ All tests passing (388 frontend tests, 55 Rust tests)
✅ TypeScript compilation successful
✅ ESLint checks passing
✅ Rust clippy checks passing
✅ Production build successful with Vite 7

### Notable Changes

1. **Tauri CLI 2.8** removed the `--check` flag for builds
   - Updated `package.json` script: `tauri:check` now runs `typecheck + rust:clippy` instead

2. **@types/eslint__js** deprecated
   - ESLint 9 now provides its own type definitions
   - Removed from dependencies

3. **Vite 7 Build Warnings**
   - Some warnings about dynamic imports and chunk sizes (informational only)
   - No action required - these are optimization suggestions, not errors

### Total Packages Updated

- **JavaScript/TypeScript:** 40+ packages
- **Rust:** ~160 packages
- **Major Version Jumps:** 3 (Vite, plugin-react, jsdom)

### Next Steps

Ready for user testing:
- Ask user to run `pnpm run dev` to test development server
- Verify HMR (Hot Module Replacement) works correctly
- Test application functionality
- Consider creating a release after verification
