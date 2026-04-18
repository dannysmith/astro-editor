# Dependency Updates - April 2026

## Status

**Current Phase:** Main App complete — awaiting user confirmation to start Test Sites Phase
**Branch:** deps-2026-04-18

## Research Findings

### Dependabot PRs (open)

| PR  | Description                                                              | Type                   |
| --- | ------------------------------------------------------------------------ | ---------------------- |
| 192 | bump the development-dependencies group across 1 directory with 17 updates | npm grouped (dev)      |
| 190 | marked 17.0.5 → 18.0.0                                                   | npm individual (major) |
| 189 | bump the production-dependencies group with 10 updates                    | npm grouped (prod)     |
| 185 | vite 8.0.3 → 8.0.5                                                       | npm individual         |
| 184 | swc_ecma_parser 36.0.0 → 38.0.0                                          | Cargo individual       |
| 183 | swc_common 19.0.0 → 21.0.0                                               | Cargo individual       |
| 182 | swc_ecma_visit 21.0.0 → 23.0.0                                           | Cargo individual       |
| 181 | swc_ecma_ast 21.0.0 → 23.0.0                                             | Cargo individual       |
| 179 | wrangler 4.78.0 → 4.80.0 (telemetry-worker)                              | npm individual         |
| 178 | pnpm/action-setup 4 → 5                                                  | GitHub Actions         |
| 177 | tauri-apps/tauri-action 0.6.1 → 0.6.2                                    | GitHub Actions         |
| 176 | actions/deploy-pages 4 → 5                                               | GitHub Actions         |
| 175 | actions/configure-pages 5 → 6                                            | GitHub Actions         |

### Outdated Packages — Main App (npm)

Minor/patch updates (safe):
- `@tauri-apps/plugin-updater` 2.10.0 → 2.10.1
- `@vitest/coverage-v8`, `vitest` 4.1.2 → 4.1.4
- `baseline-browser-mapping` 2.10.11 → 2.10.20
- `jscpd` 4.0.8 → 4.0.9
- `jsdom` 29.0.1 → 29.0.2
- `postcss` 8.5.8 → 8.5.10
- `prettier` 3.8.1 → 3.8.3
- `react`/`react-dom` 19.2.4 → 19.2.5
- `react-hook-form` 7.72.0 → 7.72.1
- `vite` 8.0.3 → 8.0.8
- `@codemirror/view` 6.40.0 → 6.41.0
- `@tanstack/react-query` 5.95.2 → 5.99.0
- `@tauri-apps/plugin-dialog` 2.6.0 → 2.7.0
- `@tauri-apps/plugin-fs` 2.4.5 → 2.5.0
- `@types/node` 25.5.0 → 25.6.0
- `@typescript-eslint/*`, `typescript-eslint` 8.57.2 → 8.58.2
- `autoprefixer` 10.4.27 → 10.5.0
- `eslint-plugin-react-hooks` 7.0.1 → 7.1.1
- `knip` 6.0.6 → 6.4.1
- `lucide-react` 1.7.0 → 1.8.0
- `react-resizable-panels` 4.7.6 → 4.10.0
- `@ast-grep/cli` 0.42.0 → 0.42.1
- `@rolldown/plugin-babel` 0.2.2 → 0.2.3

Major version bumps (require attention):
- `@eslint/js` 9.39.4 → 10.0.1 — previously deferred (typescript-eslint compat)
- `eslint` 9.39.2 → 10.2.1 — previously deferred (typescript-eslint compat)
- `marked` 17.0.5 → 18.0.2 — dependabot PR #190
- `typescript` 5.9.3 → 6.0.3 — large jump, needs investigation

### Outdated Packages — Cargo (direct)

| Package              | Current     | Compat     | Latest      | Notes                            |
| -------------------- | ----------- | ---------- | ----------- | -------------------------------- |
| indexmap             | 2.13.0      | 2.14.0     | 2.14.0      | minor                            |
| notify               | 9.0.0-rc.2  | 9.0.0-rc.3 | 9.0.0-rc.3  | RC bump                          |
| specta               | 2.0.0-rc.22 | —          | 2.0.0-rc.24 | RC version pinned (still no stable) |
| specta-typescript    | 0.0.9       | —          | 0.0.11      | tied to specta                   |
| swc_common           | 19.0.0      | —          | 21.0.1      | major jump — `Cargo.toml = "19"` |
| swc_ecma_ast         | 21.0.0      | —          | 23.0.0      | major jump — `Cargo.toml = "21"` |
| swc_ecma_parser      | 36.0.0      | —          | 39.0.0      | major jump — `Cargo.toml = "36"` |
| swc_ecma_visit       | 21.0.0      | —          | 23.0.0      | major jump — `Cargo.toml = "21"` |
| tauri-plugin-dialog  | 2.6.0       | 2.7.0      | 2.7.0       | minor                            |
| tauri-plugin-fs      | 2.4.5       | 2.5.0      | 2.5.0       | minor                            |
| tauri-plugin-updater | 2.10.0      | 2.10.1     | 2.10.1      | patch                            |
| tauri-specta         | 2.0.0-rc.21 | —          | 2.0.0-rc.24 | RC version pinned                |
| tokio                | 1.50.0      | 1.52.1     | 1.52.1      | minor                            |
| uuid                 | 1.23.0      | 1.23.1     | 1.23.1      | patch                            |

### Pinned / Special Package Status

| Package                       | Current            | Location           | Decision | Notes                                         |
| ----------------------------- | ------------------ | ------------------ | -------- | --------------------------------------------- |
| `specta`                      | =2.0.0-rc.22       | src-tauri/Cargo.toml | Research | Latest rc.24 — still RC                       |
| `tauri-specta`                | =2.0.0-rc.21       | src-tauri/Cargo.toml | Research | Latest rc.24 — still RC                       |
| `swc_common`                  | "19"               | src-tauri/Cargo.toml | Research | Major version pinned via Cargo semver (21 available) |
| `swc_ecma_ast`                | "21"               | src-tauri/Cargo.toml | Research | Major version pinned (23 available)           |
| `swc_ecma_parser`             | "36"               | src-tauri/Cargo.toml | Research | Major version pinned (39 available)           |
| `swc_ecma_visit`              | "21"               | src-tauri/Cargo.toml | Research | Major version pinned (23 available)           |
| `babel-plugin-react-compiler` | ~1.0.0             | package.json        | Keep     | Tilde pin, compiler still maturing            |
| `eslint` / `@eslint/js`       | ^9                 | package.json        | Research | Previously deferred — typescript-eslint v10 compat |
| `typescript`                  | ^5.9.3             | package.json        | Research | v6 major release — needs investigation       |
| `marked`                      | ^17.0.5            | package.json        | Research | v18 major — dependabot PR #190                |

### pnpm Overrides

```json
"pnpm": {
  "overrides": {
    "@lezer/common": "^1.5.0"
  }
}
```

Ensures consistent `@lezer/common` across CodeMirror packages (prevents syntax-highlighting regressions from lezer version mismatch).

### Previous Upgrade Context (Feb 2026)

- ESLint 10 deferred because typescript-eslint didn't support it yet. Still unresolved — need to recheck.
- `specta` / `tauri-specta` kept pinned — still RC.
- `react-resizable-panels` migrated to v4 — wrapper uses `Group/Panel/Separator`, `orientation`, custom localStorage persistence via `onLayoutChange`.
- `@lezer/common` override still required.
- `mdast-util-to-hast` audit finding in demo-project test site (transitive) — not critical.

### Test Sites

All three test sites (`demo-project`, `dummy-astro-project`, `starlight-minimal`) are on Astro 6.1.1. Latest Astro is 6.1.8. Starlight is 0.38.2 (latest 0.38.3).

### Telemetry Worker

- `wrangler` 4.72.0 (wanted 4.78.0) → latest 4.83.0. Dependabot PR #179 covers 4.78.0 → 4.80.0.

---

## Phase Checklist

### Main App
- [x] npm dependencies (non-pinned) — pnpm update run
- [x] Cargo dependencies (non-pinned) — cargo update run
- [x] Review pinned packages (see Decisions)
- [x] Run check:all — all 704 frontend + 220 Rust tests pass
- [x] Production build — compiles (DMG bundling fails on signing, same as main)

### Test Sites
- [x] demo-project (Astro 6.1.1 → 6.1.8)
- [x] dummy-astro-project (Astro 6.1.1 → 6.1.8)
- [x] starlight-minimal (Astro 6.1.1 → 6.1.8, Starlight 0.38.2 → 0.38.3)
- [x] Run reset:testdata

### Telemetry Worker
- [x] Update wrangler (4.72.0 → 4.83.0)
- [x] Review pinned packages — none pinned
- [x] Test staging deployment — dry-run passes, staging deploy succeeded
- [x] Verify stats.sh works

### Finalization
- [ ] Apply GitHub Actions updates (pnpm/action-setup v5, tauri-action 0.6.2, deploy-pages v5, configure-pages v6)
- [ ] Check scripts/ compatibility
- [ ] Run check:all
- [ ] Security audit (pnpm audit)
- [ ] Update docs (remove obsolete override notes if any)
- [ ] Manual smoke test (user)
- [ ] Push + create PR (user)
- [ ] Merge + verify CI (user)
- [ ] Verify dependabot PRs auto-close (user)

---

## Decisions Log

1. **TypeScript 6**: Deferred to a separate PR. TS 6.0 was only released ~1 week ago; ecosystem support too new to mix into routine deps update.
2. **ESLint 10**: Upgraded. typescript-eslint now officially supports ESLint 10 (blocker from Feb 2026 cleared). `eslint-plugin-react@7.37.5` still declares peer range up to `^9.7` but works with v10 in practice (peer warning only).
3. **marked 17 → 18**: Upgraded (dependabot PR #190).
4. **SWC crates**: Upgraded `swc_common 19→21`, `swc_ecma_ast 21→23`, `swc_ecma_parser 36→39`, `swc_ecma_visit 21→23` in `src-tauri/Cargo.toml`.
5. **specta / tauri-specta**: Attempted to bump to rc.24 but rc.24 requires nightly Rust (`debug_closure_helpers` unstable feature). `tauri-specta` has no rc.23 on crates.io. Reverted to current pins (`specta =rc.22`, `tauri-specta =rc.21`).
6. **window-vibrancy**: **Downgraded 0.7 → 0.6** to match tauri v2.10.3's internal version. After `cargo update` bumped `objc2 0.6.3 → 0.6.4`, having two window-vibrancy versions (0.6 from tauri, 0.7 from our direct dep) caused an LTO linker symbol conflict on `__CLASS_NSVisualEffectViewTagged`. API (`apply_vibrancy`, `NSVisualEffectMaterial`) is compatible.

## Issues Encountered

1. **ESLint 10 new rules**: The updated `eslint-plugin-react-hooks` introduced stricter rules that flagged three existing patterns:
   - `src/components/editor/Editor.tsx:78` — `react-hooks/refs` on `viewRef.current` passed to `useImageHover`. Suppressed with comment (hook only reads the ref inside its own effect).
   - `src/components/preferences/PreferencesDialog.tsx:94` — `react-hooks/set-state-in-effect`. Suppressed with comment (guarded setState; cannot loop).
   - `src/lib/editor/dragdrop/handlers.ts:16` — `no-useless-assignment`. Fixed by removing redundant init.

2. **specta rc.24 requires nightly Rust** — uses unstable `debug_closure_helpers`. Stayed on rc.21/22 pins.

3. **window-vibrancy LTO linker conflict** — see decision #6 above. Downgrading to 0.6 resolved it.
