# Dependency Upgrades - January 2025

## Overview

Comprehensive dependency update covering 45 npm packages and ~100 Cargo crates. Organized into phases by risk level.

## Phase 1: Safe Batch Updates

**Status:** Not started

These are patch/minor updates within declared semver ranges.

### NPM Packages (via `pnpm update`)

| Package | Current | Latest | Type |
|---------|---------|--------|------|
| @codemirror/commands | 6.10.0 | 6.10.1 | patch |
| @codemirror/state | 6.5.2 | 6.5.4 | patch |
| @codemirror/language | 6.11.3 | 6.12.1 | minor |
| @codemirror/search | 6.5.11 | 6.6.0 | minor |
| @codemirror/view | 6.38.8 | 6.39.11 | minor |
| @tanstack/react-query | 5.90.12 | 5.90.20 | patch |
| @tauri-apps/api | 2.9.1 | (check) | - |
| @tauri-apps/cli | 2.9.5 | 2.9.6 | patch |
| @tauri-apps/plugin-fs | 2.4.4 | 2.4.5 | patch |
| @tauri-apps/plugin-opener | 2.5.2 | 2.5.3 | patch |
| @tauri-apps/plugin-shell | 2.3.3 | 2.3.4 | patch |
| @tauri-apps/plugin-dialog | 2.4.2 | 2.6.0 | minor |
| @tauri-apps/plugin-log | 2.7.1 | 2.8.0 | minor |
| react | 19.2.1 | 19.2.3 | patch |
| react-dom | 19.2.1 | 19.2.3 | patch |
| react-day-picker | 9.11.3 | 9.13.0 | minor |
| react-hook-form | 7.68.0 | 7.71.1 | minor |
| react-hotkeys-hook | 5.2.1 | 5.2.3 | patch |
| zustand | 5.0.9 | 5.0.10 | patch |
| compromise | 14.14.4 | 14.14.5 | patch |
| zod | 4.1.13 | 4.3.6 | minor |

**Dev dependencies:**

| Package | Current | Latest | Type |
|---------|---------|--------|------|
| @eslint/js | 9.39.1 | 9.39.2 | patch |
| @tailwindcss/vite | 4.1.17 | 4.1.18 | patch |
| @testing-library/react | 16.3.0 | 16.3.2 | patch |
| @types/react | 19.2.7 | 19.2.9 | patch |
| @vitejs/plugin-react | 5.1.1 | 5.1.2 | patch |
| @vitest/coverage-v8 | 4.0.15 | 4.0.18 | patch |
| @typescript-eslint/* | 8.48.1 | 8.53.1 | minor |
| autoprefixer | 10.4.22 | 10.4.23 | patch |
| baseline-browser-mapping | 2.9.7 | 2.9.18 | minor |
| eslint | 9.39.1 | 9.39.2 | patch |
| eslint-plugin-prettier | 5.5.4 | 5.5.5 | patch |
| jscpd | 4.0.5 | 4.0.7 | patch |
| jsdom | 27.2.0 | 27.4.0 | minor |
| knip | 5.71.0 | 5.82.1 | minor |
| prettier | 3.7.4 | 3.8.1 | minor |
| tailwindcss | 4.1.17 | 4.1.18 | patch |
| terser | 5.44.1 | 5.46.0 | minor |
| typescript-eslint | 8.48.1 | 8.53.1 | minor |
| vite | 7.2.6 | 7.3.1 | minor |
| vitest | 4.0.15 | 4.0.18 | patch |

### Cargo Crates (via `cargo update`)

Notable updates from dry-run:

- tauri 2.9.4 → 2.9.5
- tauri-plugin-dialog 2.4.2 → 2.6.0
- tauri-plugin-fs 2.4.4 → 2.4.5
- tauri-plugin-log 2.7.1 → 2.8.0
- tauri-plugin-opener 2.5.2 → 2.5.3
- tauri-plugin-shell 2.3.3 → 2.3.4
- tokio 1.48.0 → 1.49.0
- serde_json 1.0.145 → 1.0.149
- chrono 0.4.42 → 0.4.43
- indexmap 2.12.1 → 2.13.0
- reqwest 0.12.24 → 0.12.28
- swc_ecma_parser 29.0.0 → 29.0.2
- Plus ~90 transitive dependency updates

### Execution

```bash
# 1. Update npm packages
pnpm update

# 2. Update Cargo crates
cd src-tauri && cargo update && cd ..

# 3. Verify everything works
pnpm run check:all

# 4. Manual smoke test

# 5. Commit
git add -A && git commit -m "chore: update dependencies (phase 1 - safe updates)"
```

---

## Phase 2: Review Required

**Status:** Not started

These updates need individual attention before applying.

### 2a. `@lezer/common` Override

**Current:** Pinned to `1.2.3` in `pnpm.overrides`
**Available:** 1.3.0, 1.4.0, 1.5.0

**Why pinned:** Mismatched `@lezer/*` versions break CodeMirror syntax highlighting. All lezer packages must use the same version of `@lezer/common`.

**Investigation steps:**
1. Remove override temporarily
2. Run `pnpm install`
3. Check `pnpm why @lezer/common` for version alignment
4. If all CodeMirror packages resolve to same version, remove override
5. If not, update override to the version they align on
6. Test syntax highlighting thoroughly

**Risk:** Medium - could break editor highlighting

---

### 2b. `@types/node` (24.x → 25.x)

**Current:** 24.10.1
**Available:** 25.0.10

**Action:** Major version bump for Node.js types. Check what Node version the project targets and whether v25 types are appropriate.

**Risk:** Low - types only, no runtime impact

---

### 2c. `@ast-grep/cli` (0.39.9 → 0.40.5)

**Current:** 0.39.9
**Available:** 0.40.5

**Action:** 0.x version so minor bumps could be breaking. Update and verify:
```bash
pnpm update @ast-grep/cli
pnpm run ast:lint
```

**Risk:** Low-Medium - only affects linting

---

### 2d. `lucide-react` (0.539.0 → 0.563.0)

**Current:** 0.539.0
**Available:** 0.563.0

**Action:** Icon library updates rarely break. Update and verify icons still render:
```bash
pnpm update lucide-react
```

**Risk:** Low

---

## Phase 3: Breaking Changes

**Status:** Not started

These have known breaking changes requiring code modifications.

### 3a. `react-resizable-panels` (3.0.6 → 4.5.1)

**Current:** 3.0.6
**Available:** 4.5.1

**Breaking changes in v4:**

| v3 | v4 |
|----|-----|
| `PanelGroup` | `Group` |
| `PanelResizeHandle` | `Separator` |
| `direction="horizontal"` | `orientation="horizontal"` |
| `defaultSize={30}` | `defaultSize="30%"` |

**Files requiring changes:**
- `src/components/ui/resizable.tsx` - shadcn wrapper component
- `src/components/layout/Layout.tsx` - uses numeric sizes via LAYOUT_SIZES

**New v4 features:**
- Pixel, REM, EM units (not just percentages)
- Multi-panel resize support
- Better server rendering

**Recommendation:** Consider whether v4 features are needed. The current v3 implementation works well. If upgrading:
1. Update shadcn wrapper to use new exports
2. Convert all size values to strings with `%` suffix
3. Change `direction` to `orientation`
4. Test panel resizing thoroughly

**Risk:** Medium-High - requires code changes and testing

**References:**
- https://github.com/bvaughn/react-resizable-panels/pull/528
- https://github.com/shadcn-ui/ui/issues/9136

---

### 3b. `specta` & `tauri-specta` (Pinned RC versions)

**Current:**
- `specta = "=2.0.0-rc.22"` (exact pin)
- `tauri-specta = "=2.0.0-rc.21"` (exact pin)
- `specta-typescript = "0.0.9"`

**Status:** Still in Release Candidate - **no stable 2.0 release yet**

**Recommendation:** Keep pinned. The maintainers explicitly recommend locking RC versions since breaking changes may occur before final release. Monitor for stable release.

**Action:** Check periodically for stable release:
- https://github.com/specta-rs/tauri-specta/releases
- https://specta.dev/docs/tauri-specta/v2

**Risk:** High if updated prematurely - could break TypeScript bindings generation

---

## Phase 4: Not Updating (Intentional)

These are intentionally kept at current versions:

| Package | Current | Available | Reason |
|---------|---------|-----------|--------|
| `babel-plugin-react-compiler` | ~1.0.0 | - | Tilde pin for patch updates only, React Compiler still maturing |
| `specta` | =2.0.0-rc.22 | - | RC version, awaiting stable |
| `tauri-specta` | =2.0.0-rc.21 | - | RC version, awaiting stable |
| `reqwest` (Cargo) | 0.12.x | 0.13.1 | Major version, would need migration |
| `swc_ecma_parser` (Cargo) | 29.x | 33.0.0 | Major version, would need migration |

---

## Checklist

- [ ] **Phase 1:** Safe batch updates (`pnpm update` + `cargo update`)
- [ ] **Phase 1:** Run `check:all` and fix any issues
- [ ] **Phase 1:** Manual smoke test
- [ ] **Phase 1:** Commit
- [ ] **Phase 2a:** Investigate `@lezer/common` override
- [ ] **Phase 2b:** Update `@types/node` if appropriate
- [ ] **Phase 2c:** Update `@ast-grep/cli` and verify
- [ ] **Phase 2d:** Update `lucide-react`
- [ ] **Phase 2:** Commit
- [ ] **Phase 3a:** Decide on `react-resizable-panels` v4 migration
- [ ] **Phase 3b:** Monitor specta/tauri-specta for stable release

---

## Notes

- Last comprehensive update: October 2025 (see `docs/tasks-done/task-2025-10-03-dependency-updates-2025-10.md`)
- All Radix UI packages appear current
- Tailwind v4 and shadcn/ui v4 are already on latest

# Updating Sub-Projects

## Phase 1 - Test Astro Projects

For each of the Astro projects in `test/`:

1. Upgrade Astro version to 5.16.15 using `pnpm dlx @astrojs/upgrade`
2. Check for any other packages which can also be upgraded
3. Run the dev server and check that everything works in the browser etc
4. Run Astro Editor and point it at the project for a smoke test
5. Make a commit

## Phase 2 - Telemetry Worker

Upgrade the `telemetry-worker` dependencies. In particular https://github.com/dannysmith/astro-editor/pull/93.
Confirm it still works properly.

## Phase 3 - Finishing up

- [ ] Run all checks and manually smoke test
- [ ] Check for CodeRabbit suggestions
- [ ] Merge `deps-2026-01-24` into `main`
