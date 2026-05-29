# Dependency Updates - May 2026

## Status

**Current Phase:** Test Sites complete + committed — moving to Telemetry Worker
**Branch:** deps-2026-05-29

## Research Findings

### Dependabot PRs (open)

| PR  | Description                                                                 | Type                   |
| --- | --------------------------------------------------------------------------- | ---------------------- |
| 225 | bump the production-dependencies group across 1 directory with 20 updates   | npm grouped (prod)     |
| 224 | bump the rust-dependencies group across 1 directory with 12 updates         | Cargo grouped          |
| 223 | bump the development-dependencies group across 1 directory with 19 updates  | npm grouped (dev)      |
| 220 | astro 5.15.4 → 6.1.10 (test/dummy-astro-project)                            | npm individual         |
| 219 | astro 5.14.1 → 6.1.10 (test/starlight-minimal)                             | npm individual         |
| 218 | astro 5.15.4 → 6.1.10 (test/demo-project)                                  | npm individual         |
| 214 | tauri 2.10.3 → 2.11.1 (src-tauri)                                          | Cargo individual       |
| 210 | apple-actions/import-codesign-certs 6 → 7                                   | GitHub Actions         |
| 209 | actions/upload-pages-artifact 4 → 5                                         | GitHub Actions         |
| 208 | pnpm/action-setup 5 → 6                                                     | GitHub Actions         |
| 207 | typescript 5.9.3 → 6.0.3                                                    | npm individual (major) |
| 204 | window-vibrancy 0.6.0 → 0.7.1 (src-tauri)                                  | Cargo individual       |
| 203 | wrangler 4.83.0 → 4.85.0 (telemetry-worker)                                | npm individual         |
| 202 | rustls-webpki 0.103.12 → 0.103.13 (src-tauri)                              | Cargo (transitive)     |

Note: PRs 218–220 target astro 6.1.10, but our test sites are already on Astro 6.1.8 (ahead of the 5.x base dependabot branched from) — these will likely be superseded. GitHub Actions PRs (208–210) to be applied to workflow files during Finalization. All should auto-close when our deps PR merges.

### Outdated Packages — Main App (npm)

Minor/patch updates (safe):
- `@codemirror/autocomplete` 6.20.1 → 6.20.2
- `@codemirror/search` 6.6.0 → 6.7.0
- `@codemirror/view` 6.41.0 → 6.43.0
- `@tauri-apps/plugin-dialog` 2.7.0 → 2.7.1
- `@tauri-apps/plugin-fs` 2.5.0 → 2.5.1
- `@tauri-apps/plugin-opener` 2.5.3 → 2.5.4
- `@tauri-apps/api` 2.10.1 → 2.11.0
- `@tauri-apps/cli` 2.10.1 → 2.11.2
- `@tanstack/react-query` 5.99.0 → 5.100.14
- `@hookform/resolvers` 5.2.2 → 5.4.0
- `@tailwindcss/vite` / `tailwindcss` 4.2.2 → 4.3.0
- `@types/react` 19.2.14 → 19.2.15
- `@types/node` 25.6.0 → 25.9.1
- `@typescript-eslint/*` / `typescript-eslint` 8.58.2 → 8.60.0
- `@vitejs/plugin-react` 6.0.1 → 6.0.2
- `@vitest/coverage-v8` / `vitest` 4.1.4 → 4.1.7
- `@ast-grep/cli` 0.42.1 → 0.43.0
- `baseline-browser-mapping` 2.10.20 → 2.10.32
- `compromise` 14.15.0 → 14.15.1
- `date-fns` 4.1.0 → 4.3.0
- `eslint` 10.2.1 → 10.4.0
- `eslint-plugin-prettier` 5.5.5 → 5.5.6
- `jscpd` 4.0.9 → 4.2.4
- `jsdom` 29.0.2 → 29.1.1
- `knip` 6.4.1 → 6.14.2
- `lucide-react` 1.8.0 → 1.17.0
- `marked` 18.0.2 → 18.0.4
- `postcss` 8.5.10 → 8.5.15
- `react` / `react-dom` 19.2.5 → 19.2.6
- `react-hook-form` 7.72.1 → 7.76.1
- `react-hotkeys-hook` 5.2.4 → 5.3.2
- `react-resizable-panels` 4.10.0 → 4.11.2
- `tailwind-merge` 3.5.0 → 3.6.0
- `terser` 5.46.1 → 5.48.0
- `vite` 8.0.8 → 8.0.14
- `zod` 4.3.6 → 4.4.3
- `zustand` 5.0.12 → 5.0.14

Major version bumps (require attention):
- `typescript` 5.9.3 → 6.0.3 — deferred in April (released ~1wk before). Dependabot PR #207. Now ~5wks old — reconsider.
- `react-day-picker` 9.14.0 → 10.0.1 — major bump, used by date fields / calendar.

### Outdated Packages — Cargo (direct)

| Package              | Current     | Compat     | Latest      | Notes                                       |
| -------------------- | ----------- | ---------- | ----------- | ------------------------------------------- |
| log                  | 0.4.29      | 0.4.30     | 0.4.30      | patch                                       |
| notify               | 9.0.0-rc.3  | 9.0.0-rc.4 | 9.0.0-rc.4  | RC bump (`Cargo.toml = "9.0.0-rc.2"` range) |
| reqwest              | 0.13.2      | 0.13.4     | 0.13.4      | patch                                       |
| serde_json           | 1.0.149     | 1.0.150    | 1.0.150     | patch                                       |
| specta               | 2.0.0-rc.22 | —          | 2.0.0-rc.25 | RC pinned `=rc.22` (still no stable)        |
| specta-typescript    | 0.0.9       | —          | 0.0.12      | tied to specta                              |
| swc_common           | 21.0.1      | 21.0.2     | 23.0.0      | major available — `Cargo.toml = "21"`       |
| swc_ecma_ast         | 23.0.0      | 23.0.1     | 25.0.0      | major available — `Cargo.toml = "23"`       |
| swc_ecma_parser      | 39.0.0      | 39.1.1     | 41.0.0      | major available — `Cargo.toml = "39"`       |
| swc_ecma_visit       | 23.0.0      | —          | 25.0.0      | major available — `Cargo.toml = "23"`       |
| tauri                | 2.10.3      | 2.11.2     | 2.11.2      | minor (dependabot PR #214)                  |
| tauri-build          | 2.5.6       | 2.6.2      | 2.6.2       | minor                                       |
| tauri-plugin-dialog  | 2.7.0       | 2.7.1      | 2.7.1       | patch                                       |
| tauri-plugin-fs      | 2.5.0       | 2.5.1      | 2.5.1       | patch                                       |
| tauri-plugin-opener  | 2.5.3       | 2.5.4      | 2.5.4       | patch                                       |
| tauri-specta         | 2.0.0-rc.21 | —          | 2.0.0-rc.25 | RC pinned `=rc.21`                          |
| tokio                | 1.52.1      | 1.52.3     | 1.52.3      | patch                                       |
| uuid                 | 1.23.1      | 1.23.2     | 1.23.2      | patch                                       |
| window-vibrancy      | 0.6.0       | —          | 0.7.1       | pinned to 0.6 to match tauri internal (PR #204) |

### Pinned / Special Package Status

| Package                       | Current      | Location            | Decision | Notes                                                        |
| ----------------------------- | ------------ | ------------------- | -------- | ------------------------------------------------------------ |
| `specta`                      | =2.0.0-rc.22 | src-tauri/Cargo.toml | Pending  | rc.25 latest; rc.24 needed nightly Rust in April — recheck   |
| `tauri-specta`                | =2.0.0-rc.21 | src-tauri/Cargo.toml | Pending  | rc.25 latest; no rc.23 on crates.io in April                 |
| `swc_common`                  | "21"         | src-tauri/Cargo.toml | Pending  | 23 available                                                 |
| `swc_ecma_ast`                | "23"         | src-tauri/Cargo.toml | Pending  | 25 available                                                 |
| `swc_ecma_parser`             | "39"         | src-tauri/Cargo.toml | Pending  | 41 available                                                 |
| `swc_ecma_visit`              | "23"         | src-tauri/Cargo.toml | Pending  | 25 available                                                 |
| `window-vibrancy`             | "0.6"        | src-tauri/Cargo.toml | Keep?    | Downgraded in April to avoid LTO linker conflict w/ tauri 2.10. Tauri now bumping to 2.11 — recheck whether 0.7 is now safe |
| `babel-plugin-react-compiler` | ~1.0.0       | package.json        | Keep     | Tilde pin, compiler still maturing                           |
| `typescript`                  | ^5.9.3       | package.json        | Pending  | v6 — dependabot PR #207, deferred in April                   |

### pnpm Overrides

```json
"pnpm": {
  "overrides": {
    "@lezer/common": "^1.5.0"
  }
}
```

Ensures consistent `@lezer/common` across CodeMirror packages (prevents syntax-highlighting regressions from lezer version mismatch). Still required.

### Previous Upgrade Context (April 2026, PR #193, merged 2026-04-18)

- **TypeScript 6**: Deferred — released ~1wk before April session. Now reconsider (PR #207).
- **ESLint 10**: Upgraded successfully in April (typescript-eslint v10 support landed). New react-hooks rules required 3 suppressions/fixes — already in main.
- **marked 18**: Upgraded in April.
- **SWC crates**: Bumped to 21/23/39/23 in April.
- **specta / tauri-specta**: rc.24 required nightly Rust (`debug_closure_helpers`); tauri-specta had no rc.23. Stayed on rc.22/rc.21.
- **window-vibrancy**: **Downgraded 0.7 → 0.6** to fix LTO linker symbol conflict (`__CLASS_NSVisualEffectViewTagged`) with tauri 2.10's internal copy after objc2 bump. Recheck now that tauri is moving to 2.11.
- **Vite 8 + Astro 6**: Astro warns (officially supports Vite 7). Accepted — not forcing a downgrade on the editor app. Revisit when Astro 7 ships.
- `@lezer/common` override still required.

### Test Sites

All three on Astro 6.1.8 (package.json `^6.1.8`). Latest Astro is 6.4.2. Starlight 0.38.3 → 0.39.2.
(Dependabot PRs 218–220 reference 6.1.10 from a stale 5.x base — superseded.)

### Telemetry Worker

`wrangler` 4.83.0 → 4.95.0 (dependabot PR #203 covers 4.83 → 4.85). No pinned packages.

---

## Phase Checklist

### Main App
- [x] npm dependencies (non-pinned) — `pnpm update` run
- [x] Cargo dependencies (non-pinned) — `cargo update` run (tauri 2.10.3 → 2.11.2, notify rc.4, etc.)
- [x] Review pinned packages (see Decisions Log)
- [x] Run check:all — 704 frontend + 220 Rust tests pass, clippy clean with tauri 2.11
- [x] Production build — binary compiles + LTO links clean with window-vibrancy 0.6 + tauri 2.11 (`Finished release profile in 1m 41s`). DMG bundling fails on local signing only (same as main).
- [x] User smoke test (tauri:dev) — vibrancy/editor/forms all working
- [x] Committed main-app deps work

### Test Sites
- [x] demo-project (Astro 6.1.8 → 6.4.2) — `astro build` clean
- [x] dummy-astro-project (Astro 6.1.8 → 6.4.2) — `astro sync` clean (build image-opt fails on missing Sharp, pre-existing env issue, not a regression)
- [x] starlight-minimal (Astro 6.1.8 → 6.4.2, Starlight 0.38.3 → 0.39.2) — `astro build` clean after config fix
- [x] Run reset:testdata
- [x] User dev/editor verification — all sites render + load in Astro Editor OK; committed

### Telemetry Worker
- [ ] Update wrangler (4.83.0 → 4.95.0)
- [ ] Review pinned packages — none
- [ ] Test staging deployment
- [ ] Verify stats.sh works

### Finalization
- [ ] Apply GitHub Actions updates (pnpm/action-setup v6, upload-pages-artifact v5, import-codesign-certs v7)
- [ ] Check scripts/ compatibility
- [ ] Run check:all
- [ ] Security audit (pnpm audit)
- [ ] Update docs (remove obsolete override/version notes)
- [ ] Manual smoke test (user)
- [ ] Push + create PR (user)
- [ ] Merge + verify CI (user)
- [ ] Verify dependabot PRs auto-close (user)

---

## Decisions Log

1. **TypeScript 5.9 → 6.0**: Upgraded (was deferred in April; now ~5wks stable). Required two fixes:
   - Removed deprecated `baseUrl` from `tsconfig.json` (TS6 deprecates it; `paths` resolves relative to tsconfig under `moduleResolution: bundler`, and Vite defines the `@` alias independently).
   - `eslint --fix` removed 23 now-redundant `as` assertions (TS6's improved inference) across 6 files; removed two newly-unused `HeadingLevel` test imports.
2. **window-vibrancy 0.6 → 0.7**: **Reverted to 0.6** — the LTO linker conflict still recurs with tauri 2.11.2. Release build failed with `Linking globals named '__CLASS_NSVisualEffectViewTagged': symbol multiply defined!` / `failed to load bitcode of module "window_vibrancy..."`. tauri 2.11.2 still bundles window-vibrancy 0.6 internally, so our 0.7.1 puts two copies in the tree. Restored the explanatory comment in `Cargo.toml` (updated to note the May re-test). Dependabot PR #204 should stay closed/declined.
3. **specta / tauri-specta**: **Keep pinned** (`=rc.22` / `=rc.21`). rc.23–25 are a major architectural overhaul (Language trait removed, `export`→`collect` feature rename, reference-system rewrite, new `specta-serde` crate split). Bumping is a migration, not a routine update — out of scope.
4. **swc crates**: **Keep pinned** (21/23/39/23; majors 23/25/41/25 available). Working fine; only used in one file (`commands/mdx_components.rs`, 6 usages). Low value, defer.
5. **notify**: `cargo update` moved rc.3 → rc.4 within the existing `"9.0.0-rc.2"` range. Fine.
6. **Starlight 0.38 → 0.39 breaking change**: 0.39 requires `autogenerate` sidebar entries to be wrapped in an `items` array. Updated `test/starlight-minimal/astro.config.mjs` (`autogenerate: {...}` → `items: [{ autogenerate: {...} }]`). Build verified — reference pages generate correctly.
7. **Test sites are pnpm workspace packages** (`test/*` in `pnpm-workspace.yaml`). The root `pnpm-lock.yaml` governs them and is correctly updated (astro 6.4.2, starlight 0.39.2). The per-site `test/*/pnpm-lock.yaml` files are stale orphans (showing starlight 0.36/astro 5.14, predating April) that the workspace does not use — left untouched, out of scope.
8. **Sharp build failure (dummy-astro-project)**: `astro build` fails image optimization with "Could not find Sharp" — Sharp is not installed anywhere in the workspace, so this predates the upgrade (not a regression). `astro sync` (what the editor relies on) works fine.

## Issues Encountered

1. **TS6 `baseUrl` deprecation** — see decision #1. Removed cleanly.
2. **TS6 redundant type assertions** — `@typescript-eslint/no-unnecessary-type-assertion` flagged 23 casts as unnecessary under TS6's stronger inference. Auto-fixed; verified production-code fixes in `sorting.ts` (target var is `unknown`, casts genuinely redundant) and `sonner.tsx`.
