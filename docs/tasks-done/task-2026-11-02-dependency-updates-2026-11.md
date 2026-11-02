# Dependency Updates - November 2026

## Status

**Current Phase:** Done. Merged with a merge commit
**Branch:** deps-2026-11-02

A small round: the last sweep merged on 2026-10-05. Includes `website/` (Danny asked). One PR, one commit per phase, merged with a **merge commit**. The `zip` security fix ships with the rest, not as its own patch release.

## Remaining user actions

1. **Smoke test** in `tauri:dev`:
   - [x] Editor, highlighting and frontmatter form in light and dark; typing and auto-save (Claude)
   - [x] External edit to the open file reloads through the watcher (notify rc.7) (Claude). New files added outside don't appear in the sidebar, but that's an older bug, now on #347
   - [x] Sidebar and frontmatter panels collapse and reopen pixel-identical (react-resizable-panels 4.16) (Claude)
   - [x] Check for Updates (updater 2.14.1) (Danny)
   - [x] Open Project dialog (dialog plugin 2.8.4) (Danny)
   - [x] ~~Deep link (deep-link 2.6.3)~~: skipped. `astro-editor://` links go to the installed app, not `tauri dev`. Check it in the next release build
2. **Telemetry worker:** staging deploy and `./stats.sh` both work. The `d1_databases` warning on `env.staging` is expected (staging doesn't touch the production database). No production deploy needed: only wrangler changed, not the worker code, and the bundle is the same size
3. **PR:** opened with the `ci` label. This doc was moved to `tasks-done/` before pushing, so CI and review run once

## After merge

- Close Dependabot #355 (superseded)
- Merging deploys the website

## Plan

### Phase 1: Security fix

- [x] `zip` 4.6.1 → 9.2.2. Needed `tauri-plugin-updater` 2.14.1 too (2.14.0 capped `zip` at 4.x), so the JS updater plugin moved with it. Clears the three Dependabot alerts for `zip`. The macOS build doesn't compile `zip` at all (it wasn't downloaded until the Linux/Windows targets were fetched), so only Windows and Linux builds were affected

### Phase 2: Main app JS

- [x] `bun update` within ranges: TanStack Query 5.105, lucide 1.66, marked 18.1.2, react-resizable-panels 4.16, Tauri deep-link 2.6.3 and dialog 2.8.4, knip, oxlint 1.90, shadcn 4.23 and transitive patches. No unexpected majors; Babel stays on 7
- [x] `@rolldown/plugin-babel` 0.3.0 (adds an opt-in `parallel` option). Vite build still applies the React Compiler
- [x] `oxfmt` 0.75 (no formatting changes)
- [x] No nested `@lezer`/`@codemirror` copies

### Phase 3: Rust

- [x] `cargo update`: deep-link 2.6.3, dialog 2.8.4, single-instance 2.5.5 and small crates. The dialog plugin now uses only `rfd` 0.17, dropping the duplicate 0.16
- [x] `notify` `=9.0.0-rc.7`
- [x] Bindings regenerate unchanged

### Phase 4: Fixtures and website

- [x] Fixtures: Astro 7.4.5, Starlight 0.42.8. `astro sync` produced no schema changes. `reset:testdata` done
- [x] Website: Astro 7.4.5, Starlight 0.42.8, `@astrojs/check` 0.9.12 and tooling minors. Removed the Rolldown `onwarn` filter (Astro 7.4 dropped the head-inject directive). Text of all 71 built pages compared before and after: identical. Only CSS/JS change is Starlight adding `overflow: visible` to icons
- [x] `bun run check` in `website/` clean

### Phase 5: Telemetry worker

- [x] wrangler 4.156.2 (supersedes Dependabot #355), `wrangler deploy --dry-run` OK
- [x] Danny: `bun run deploy:staging` and `./stats.sh`

### Phase 6: CI

- No GitHub Actions bumps waiting

### Finish

- [x] `check:all`: 846 frontend and 286 Rust tests pass
- [x] Production build: `Astro Editor.app` 10.05 MiB, no new warnings (only `--no-sign` and Vite's existing chunk-size note)
- [x] Security audit (see Issues encountered)

## Holds

| Package                    | Current        | Latest         | Why hold                                               |
| -------------------------- | -------------- | -------------- | ------------------------------------------------------ |
| `@babel/core`              | 7.29.7         | 8.0.10         | React Compiler plugin is built against Babel 7         |
| specta / specta-typescript | rc.26 / 0.0.13 | rc.27 / 0.0.14 | tauri-specta is still rc.26; move all three together   |
| typescript (website)       | 6.0.3          | 7.0.2          | `@astrojs/check` 0.9.12 still peers `^5 \|\| ^6`        |
| Rust edition 2024          | 2021           | —              | Optional, low value                                    |
| Tauri 3                    | —              | alpha          | Alpha                                                  |

Holds from the September doc that no longer apply: pnpm (moved to bun), specta rc.25 stack overflow (fixed, now on rc.26), TypeScript 7 for the app (done).

## Decisions

- Two branches: this one first, the #347 bugs after it merges. Save-on-quit gets its own branch; the project-settings bugs moved to #361 for the project rework
- `zip` fix ships with everything else

## Issues encountered

1. **`bun audit`** finds two dev-only advisories that can't be fixed within range: `minimatch` <11.0.1 (via shadcn's CLI and ESLint/typescript-eslint, which require `^10`) and `deepmerge` ≤4.3.1 (via shadcn's CLI and the Svelte Vite plugin in `dummy-astro-project`, no patched release). Neither ships in the app
2. **`cargo audit`** 0.21 couldn't parse CVSS 4.0 entries in the advisory database; upgraded to 0.22.2. No vulnerabilities. Six warnings, all in crates Tauri or tauri-specta pull in: `paste`, `proc-macro-error`, `zbus_names`, `zvariant` and `zvariant_derive` unmaintained (the last three are Linux-only D-Bus crates), and `glib` 0.18 unsound (`VariantStrIter`, Linux GTK)
3. **Sandbox:** `cargo update`/`fetch` need to write to `~/.cargo/registry`, and `wrangler` to `~/Library/Preferences/.wrangler`, so both ran outside the sandbox
4. **Linux build failed in CI on `rfd`:** "You can't enable both `gtk3` and `xdg-portal` features at once". tauri-plugin-dialog 2.8.4 moved from `rfd` 0.16 to 0.17, the same version as our direct `rfd` dependency (used by `select_project_folder`), so Cargo merged them into one crate with the plugin's `gtk3` and our default `xdg-portal`. Fixed by giving our `rfd` `default-features = false, features = ["gtk3"]`. Only Linux is affected; both features are Linux backends. Dropping our direct `rfd` for the dialog plugin's Rust API would avoid this for good
5. **`demo-project` warns** "No entry type found" for its `.mdx` files during `astro sync`, because it doesn't install `@astrojs/mdx`. Not caused by this update
