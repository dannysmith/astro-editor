# Task: Migrate from pnpm to Bun Package Manager

## Overview

Evaluate and plan migration from pnpm to Bun as the package manager for Astro Editor. This document captures research findings, potential downsides, and implementation steps.

## Current State

### pnpm Usage Locations

**Configuration Files:**
- `package.json` - Scripts reference `pnpm run`, has `pnpm.overrides` section
- `src-tauri/tauri.conf.json` - `beforeDevCommand` and `beforeBuildCommand` use `pnpm`
- `pnpm-lock.yaml` - Lock file (root and test projects)

**CI/CD:**
- `.github/workflows/release.yml` - Uses `pnpm/action-setup@v4`, caches `pnpm-lock.yaml`

**Documentation (~100+ references):**
- `README.md` - Development quick start
- `CLAUDE.md` - Core rules, commands, and patterns
- `docs/CONTRIBUTING.md` - Setup instructions
- `docs/SECURITY.md` - Security practices
- `docs/developer/*.md` - Various developer guides
- `docs/tasks-done/*.md` - Historical task references
- `.claude/commands/*.md` - Claude command templates

**Scripts:**
- `scripts/prepare-release.js` - Lines 38, 63, 102 reference pnpm
- `scripts/complete-task.js` - Usage examples reference pnpm

**Test Projects:**
- `test/demo-project/pnpm-lock.yaml`
- `test/dummy-astro-project/pnpm-lock.yaml`
- `test/starlight-minimal/pnpm-lock.yaml`

**Telemetry Worker:**
- `telemetry-worker/` - Separate package, uses wrangler

### Critical pnpm-Specific Feature

```json
// package.json
"pnpm": {
  "overrides": {
    "@lezer/common": "1.2.3"
  }
}
```

This override is **critical** for CodeMirror 6 compatibility. Mismatched `@lezer/*` versions break syntax highlighting and cause runtime errors because Tag/Tree objects from different versions are incompatible.

---

## Research Findings

### Bun Compatibility with This Stack

#### Tauri v2 Support ✅
- Tauri officially supports Bun as a package manager since Tauri 1.5
- Commands like `bun tauri dev`, `bun tauri build` work
- **Issue (resolved):** Lock file detection was updated for `bun.lock` format in [PR #12998](https://github.com/tauri-apps/tauri/issues/12914)
- **Potential issue:** Some users reported build failures on Linux with certain Rust dependencies

**Sources:**
- [Tauri CLI Reference](https://v2.tauri.app/reference/cli/)
- [Tauri 1.5 Announcement](https://v2.tauri.app/blog/tauri-1-5/)
- [Bun Discussion](https://github.com/tauri-apps/tauri/discussions/5837)

#### Dependency Overrides ✅
- Bun supports npm's `overrides` and Yarn's `resolutions` syntax
- Migration: Move from `pnpm.overrides` to root-level `overrides`

```json
// Before (pnpm)
{
  "pnpm": {
    "overrides": {
      "@lezer/common": "1.2.3"
    }
  }
}

// After (bun)
{
  "overrides": {
    "@lezer/common": "1.2.3"
  }
}
```

- Bun automatically migrates when detecting `pnpm-lock.yaml`

**Sources:**
- [Bun Package Manager Docs](https://bun.sh/docs/pm/cli/install)
- [Overrides Support Issue](https://github.com/oven-sh/bun/issues/1134)

#### Vite 7 Compatibility ⚠️
- Vite 7 works with Bun but has known issues
- **Current issue:** `@tailwindcss/vite` declares peer dependency `vite: "^5.2.0 || ^6"` - incompatible with Vite 7
- **Workarounds:**
  1. Use `--legacy-peer-deps` or `--force` (not ideal)
  2. Downgrade to Vite 6 (loses Vite 7 features)
  3. Wait for Tailwind to update peer deps
  4. Use `overrides` to force compatibility

**Sources:**
- [Vite 7 + Tailwind Issue](https://github.com/vitejs/vite/issues/20284)
- [Tailwind Vite 7 Support Issue](https://github.com/tailwindlabs/tailwindcss/issues/18381)

#### Vitest + React Testing Library ✅ (with caveats)
- Bun works as package manager for Vitest
- **Important:** Use `bun run test` NOT `bun test` (latter runs Bun's built-in test runner)
- Known warning: "The current testing environment is not configured to support act(...)" persists but tests work

**Sources:**
- [Testing Library with Bun Guide](https://bun.sh/guides/test/testing-library)
- [Bun Test Docs](https://bun.sh/docs/test)

#### CodeMirror 6 / Lezer ❓ Untested
- No specific documented issues found
- The `@lezer/common` override pattern should work with Bun's `overrides`
- Risk: Potential duplicate package issues if Bun's resolution differs from pnpm
- **Recommendation:** Test thoroughly before committing to migration

#### GitHub Actions ⚠️
- Official action: `oven-sh/setup-bun@v2`
- **No built-in caching** like `pnpm/action-setup` provides
- Manual cache setup required using `actions/cache` for `~/.bun/install/cache`
- Alternative: `antongolub/action-setup-bun@v1` has built-in cache options

**Issue:** `tauri-apps/tauri-action` expects the package manager from `tauri.conf.json`. If `bun` isn't installed, builds fail with "bun: not found".

**Sources:**
- [setup-bun Action](https://github.com/oven-sh/setup-bun)
- [Bun CI/CD Guide](https://bun.com/docs/guides/runtime/cicd)
- [tauri-action Bun Issue](https://github.com/tauri-apps/tauri-action/issues/986)

---

## Potential Downsides

### 1. **CodeMirror Version Isolation Risk** 🔴 HIGH
The project relies on `pnpm.overrides` to force `@lezer/common` to a specific version. While Bun supports `overrides`, its dependency resolution algorithm differs from pnpm's strict isolation.

**Risk:** Duplicate packages could slip through, breaking syntax highlighting.
**Mitigation:** After migration, verify with `bun pm ls @lezer/common` that only one version exists.

### 2. **CI/CD Caching Regression** 🟡 MEDIUM
pnpm's GitHub Action provides seamless caching. Bun's official action lacks this, requiring manual cache configuration.

**Impact:** Potentially slower CI builds if caching isn't configured properly.
**Mitigation:** Use `actions/cache` with appropriate paths.

### 3. **Ecosystem Maturity** 🟡 MEDIUM
pnpm is battle-tested in production. Bun's package manager, while fast, is newer.

**Concerns:**
- Less community troubleshooting knowledge
- Potential edge cases with complex dependency trees
- Some tools may have undocumented pnpm-specific assumptions

### 4. **Vite 7 + Tailwind Peer Dep Issue** 🟡 MEDIUM
Currently blocked by Tailwind's peer dependency not including Vite 7.

**Options:**
1. Wait for Tailwind update
2. Use `overrides` to force compatibility
3. Downgrade Vite (not recommended)

### 5. **Team/Contributor Friction** 🟢 LOW
Contributors familiar with pnpm need to install/learn Bun.

**Mitigation:** Document migration clearly.

### 6. **Rollback Complexity** 🟢 LOW
Can revert by restoring `pnpm-lock.yaml` and removing `bun.lock`.

---

## Benefits of Migration

### 1. **Speed** ⚡
Bun is significantly faster for package installation:
- ~7× faster than npm
- ~4× faster than pnpm
- ~17× faster than Yarn

### 2. **Simpler Toolchain**
Bun provides runtime, bundler, and package manager in one tool. While this project uses Vite/Vitest, the unified experience is still valuable.

### 3. **Modern Defaults**
Bun supports isolated installs (like pnpm) and modern ESM-first approach.

### 4. **Future-Proofing**
Bun is gaining adoption rapidly; early migration avoids technical debt.

---

## Implementation Plan

### Phase 1: Local Testing (Pre-Migration Validation)

1. **Create test branch**
   ```bash
   git checkout -b experiment/bun-migration
   ```

2. **Install Bun globally**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Update package.json overrides**
   ```json
   {
     "overrides": {
       "@lezer/common": "1.2.3"
     }
   }
   ```
   (Keep `pnpm.overrides` temporarily for comparison)

4. **Run Bun migration**
   ```bash
   bun install
   ```
   This auto-migrates from `pnpm-lock.yaml` to `bun.lock`

5. **Verify @lezer/common resolution**
   ```bash
   bun pm ls @lezer/common
   ```
   Must show only version 1.2.3

6. **Run all tests**
   ```bash
   bun run check:all
   ```

7. **Test dev server**
   ```bash
   bun run tauri:dev
   ```
   Verify editor, syntax highlighting, frontmatter forms work

8. **Test production build**
   ```bash
   bun run tauri:build
   ```

### Phase 2: Configuration Updates

**package.json:**
```diff
  "scripts": {
-   "tauri:dev": "source ~/.cargo/env && pnpm run tauri dev",
-   "tauri:build": "pnpm run tauri build",
-   "tauri:check": "pnpm run typecheck && pnpm run rust:clippy",
-   "test:all": "pnpm run test:run && pnpm run rust:test",
-   "check:all": "pnpm run typecheck && ...",
-   "fix:all": "pnpm run lint:fix && ...",
+   "tauri:dev": "source ~/.cargo/env && bun run tauri dev",
+   "tauri:build": "bun run tauri build",
+   "tauri:check": "bun run typecheck && bun run rust:clippy",
+   "test:all": "bun run test:run && bun run rust:test",
+   "check:all": "bun run typecheck && ...",
+   "fix:all": "bun run lint:fix && ...",
    ...
  },
- "pnpm": {
-   "overrides": {
-     "@lezer/common": "1.2.3"
-   }
- }
+ "overrides": {
+   "@lezer/common": "1.2.3"
+ }
```

**src-tauri/tauri.conf.json:**
```diff
  "build": {
-   "beforeDevCommand": "pnpm run dev",
+   "beforeDevCommand": "bun run dev",
    "devUrl": "http://localhost:1420",
-   "beforeBuildCommand": "pnpm run build",
+   "beforeBuildCommand": "bun run build",
    ...
  }
```

### Phase 3: CI/CD Updates

**.github/workflows/release.yml:**
```diff
- - name: Setup pnpm
-   uses: pnpm/action-setup@v4
-   with:
-     version: 9
-     run_install: false
+ - name: Setup Bun
+   uses: oven-sh/setup-bun@v2
+   with:
+     bun-version: latest

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: 'lts/*'
-     cache: 'pnpm'
-     cache-dependency-path: 'pnpm-lock.yaml'
+     # Node.js still needed for some tooling

+ - name: Cache Bun dependencies
+   uses: actions/cache@v4
+   with:
+     path: ~/.bun/install/cache
+     key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
+     restore-keys: |
+       ${{ runner.os }}-bun-

  - name: Install frontend dependencies
-   run: pnpm install --frozen-lockfile
+   run: bun install --frozen-lockfile
```

### Phase 4: Documentation Updates

Files to update (search and replace `pnpm` → `bun`):

1. **README.md** - Quick start section
2. **CLAUDE.md** - Critical rules, development commands
3. **docs/CONTRIBUTING.md** - Setup instructions
4. **docs/SECURITY.md** - Security practices
5. **docs/developer/releases.md** - Release workflow
6. **docs/developer/architecture-guide.md** - Commands
7. **docs/developer/testing.md** - Test commands
8. **docs/developer/optimization.md** - Build commands
9. **docs/developer/ast-grep-linting.md** - Lint commands
10. **docs/TASKS.md** - Task completion examples
11. **scripts/prepare-release.js** - Lines 38, 63, 102
12. **scripts/complete-task.js** - Usage help

**Global Claude instructions:**
- Update `~/.claude/CLAUDE.md` to prefer `bun` over `pnpm`

### Phase 5: Cleanup

1. Delete `pnpm-lock.yaml` (root)
2. Delete test project lockfiles:
   - `test/demo-project/pnpm-lock.yaml`
   - `test/dummy-astro-project/pnpm-lock.yaml`
   - `test/starlight-minimal/pnpm-lock.yaml`
3. Add `bun.lock` to git
4. Update `.gitignore` if needed

### Phase 6: Telemetry Worker (Optional)

The `telemetry-worker/` is a separate Cloudflare Worker project. It can remain on npm/pnpm or migrate independently:
```bash
cd telemetry-worker
bun install
```

---

## Verification Checklist

Before completing migration:

- [ ] `bun install` completes without errors
- [ ] `bun pm ls @lezer/common` shows only 1.2.3
- [ ] `bun run check:all` passes
- [ ] `bun run tauri:dev` starts correctly
- [ ] Editor syntax highlighting works
- [ ] Frontmatter forms render correctly
- [ ] Image field drag-and-drop works
- [ ] Auto-save functions
- [ ] `bun run tauri:build` produces working DMG
- [ ] GitHub Actions release workflow succeeds
- [ ] All documentation updated

---

## Rollback Plan

If issues arise post-migration:

1. Restore `pnpm-lock.yaml` from git history
2. Remove `bun.lock`
3. Revert `package.json` changes
4. Revert `tauri.conf.json` changes
5. Revert CI/CD changes
6. Run `pnpm install`

---

## Decision: Proceed or Wait?

### Recommendation: **Proceed with Caution**

The migration is feasible but should be approached carefully:

1. **Phase 1 testing is critical** - Do not proceed past Phase 1 without confirming CodeMirror works correctly
2. **Address Tailwind/Vite 7 peer dep** - May need temporary override
3. **CI caching setup** - Ensure build times don't regress

### Alternative: **Wait**

If risk-averse, wait for:
- Tailwind to officially support Vite 7
- More community validation of Bun + Tauri workflows
- Bun's setup-action to add built-in caching

---

## References

- [Bun Package Manager Docs](https://bun.sh/docs/pm)
- [Tauri + Bun Discussion](https://github.com/tauri-apps/tauri/discussions/5837)
- [pnpm vs Bun Comparison](https://benjamincrozat.com/bun-package-manager)
- [setup-bun GitHub Action](https://github.com/oven-sh/setup-bun)
- [Bun CI/CD Guide](https://bun.com/docs/guides/runtime/cicd)
- [Vite 7 + Tailwind Issue](https://github.com/vitejs/vite/issues/20284)
- [tauri-action Bun Issue](https://github.com/tauri-apps/tauri-action/issues/986)
