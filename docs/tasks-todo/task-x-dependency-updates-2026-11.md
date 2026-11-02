# Dependency Updates - November 2026

## Status

**Current Phase:** Research done, waiting for go-ahead
**Branch:** deps-2026-11-02

A small round: the last sweep merged on 2026-10-05. Everything is in range apart from a few 0.x bumps and the `notify` rc. Includes `website/` (Danny asked). One PR, one commit per phase, merged with a **merge commit**. The `zip` security fix ships with the rest, not as its own patch release.

## Plan

### Phase 1: Security fix

- [ ] `cargo update -p zip`: 4.6.1 → 9.2.2 (via `tauri-plugin-updater`). Clears Dependabot alerts for `zip` (critical: zip cloaking, fixed in 9.0.5; high: symlink targets; medium: AES HMAC bypass)

### Phase 2: Main app JS

- [ ] `bun update` within ranges: TanStack Query 5.105, lucide 1.66, marked 18.1.2, react-resizable-panels 4.16, `@types/node`, baseline-browser-mapping, knip 6.44, oxlint 1.90, shadcn 4.23
- [ ] `@rolldown/plugin-babel` 0.2.4 → 0.3.0 (only adds an opt-in `parallel` option; peer range still allows Babel 7)
- [ ] `oxfmt` 0.74 → 0.75 (formatter fixes only), reformat as its own commit if anything changes
- [ ] Check for nested `@lezer`/`@codemirror` copies and unexpected majors in peers

### Phase 3: Rust

- [ ] `cargo update` (tauri plugins deep-link 2.6.3, dialog 2.8.4, single-instance 2.5.5, updater 2.14.1, plus small crates)
- [ ] Matching JS: `@tauri-apps/plugin-deep-link` 2.6.3, `plugin-dialog` 2.8.4, `plugin-updater` 2.14.1
- [ ] `notify` `=9.0.0-rc.6` → `=9.0.0-rc.7` (macOS: keeps pending FSEvents across stream rebuilds, keeps the stream running on unchanged rewatch)

### Phase 4: Fixtures and website

- [ ] Fixtures (`demo-project`, `dummy-astro-project`, `starlight-minimal`): Astro 7.3.5 → 7.4.5, Starlight → 0.42.8, integrations to latest. `astro sync`, commit regenerated schemas, `reset:testdata`
- [ ] Website: Astro 7.4.5, Starlight 0.42.8, `@astrojs/check` 0.9.12, eslint, prettier, typescript-eslint, playwright-core minors
- [ ] Website: withastro/astro#18088 merged 2026-10-05. If it's in 7.4.x, remove the Rolldown `onwarn` filter in `website/astro.config.mjs`
- [ ] `bun run build` + `bun run check` in `website/`

### Phase 5: Telemetry worker

- [ ] wrangler 4.152 → 4.156 (supersedes Dependabot #355), `wrangler deploy --dry-run`
- [ ] Danny: `bun run deploy:staging` and `./stats.sh`

### Phase 6: CI

- No GitHub Actions bumps waiting

### Finish

- [ ] `check:all`, production build, check for new warnings
- [ ] Security audit (`bun audit` in each project)
- [ ] Danny: smoke test
- [ ] Push, PR with `ci` label, merge commit, close #355, move this doc to `tasks-done/`

## Holds

| Package                       | Current | Latest  | Why hold                                                                 |
| ----------------------------- | ------- | ------- | ------------------------------------------------------------------------ |
| `@babel/core`                 | 7.29.7  | 8.0.10  | React Compiler plugin is built against Babel 7 (AGENTS.md)               |
| specta / specta-typescript    | rc.26 / 0.0.13 | rc.27 / 0.0.14 | tauri-specta is still rc.26; move all three together           |
| typescript (website)          | 6.0.3   | 7.0.2   | `@astrojs/check` 0.9.12 still peers `^5 \|\| ^6`                          |
| Rust edition 2024             | 2021    | —       | Optional, low value                                                      |
| Tauri 3                       | —       | alpha   | Alpha                                                                    |

Holds from the September doc that no longer apply: pnpm (moved to bun), specta rc.25 stack overflow (fixed, now on rc.26), TypeScript 7 for the app (done).

## Decisions

- Two branches: this one first, the #347 bugs after it merges. Save-on-quit gets its own branch; the project-settings bugs wait for the project rework
- `zip` fix ships with everything else

## Issues encountered
