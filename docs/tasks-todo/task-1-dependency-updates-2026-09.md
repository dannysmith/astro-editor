# Dependency Updates - September 2026

## Status

**Current Phase:** Steps 1–5 done except the user-only items (smoke test, telemetry staging deploy, tauri-action tag test, push/PR)
**Branch:** deps-2026-10-01

This round is bigger than usual: Astro 7 for the fixtures and website, Tauri 2.12, several test-tooling majors, a CI overhaul, and a live schema-parsing bug for current users.

**Strategy:** one PR, one commit (or small group of commits) per step below, merged with a **merge commit, not squash** so steps stay bisectable and individually revertable. Caveats:

- The hotfix is the first commit. If the rest of the PR starts dragging, cherry-pick it into its own PR and ship a patch release — the bug is live for users on fresh Astro 6 installs.
- tauri-action v1 can't be exercised by PR CI (release only runs on `v*` tags). Verify it with a throwaway tag from this branch before merging, or drop that change from the PR.
- Merging deploys the website (`deploy-website.yml` runs on pushes to `main` touching `website/**`).

## Remaining user actions

Everything else is done and committed on `deps-2026-10-01`. These need Danny:

1. **Retest dev reloads** with the Tailwind/Vite watcher fix (see Issues Encountered #13): restart `pnpm run tauri:dev`, open `test/demo-project`, edit + save a file, change frontmatter. The app should no longer reload. Leave the fixtures' `astro dev` servers running while testing — they used to trigger reloads too
2. **Smoke test** in `tauri:dev`:
   - [ ] Vibrancy + rounded corners look the same as before (now via `windowEffects` config)
   - [ ] Editor: syntax highlighting incl. GFM tables and checklists
   - [ ] Select dropdowns (close animation now plays), dialogs, tooltips, dropdown menus (unified `radix-ui` package)
   - [ ] Clipboard (copy/paste), file dialogs, deep links, window size/position restored on relaunch
   - [ ] External file changes picked up (edit a file outside the app) — notify rc.5
   - [ ] Update check runs without errors
   - [ ] `test/dummy-astro-project` → `notes`: `rating` is a number field, `pinned` is a toggle (Zod 4.5 nullable fix)
   - [ ] Open `test/demo-project` and `test/starlight-minimal`: collections + frontmatter forms load
3. **Telemetry worker**: `pnpm run deploy:staging` and `./stats.sh` in `telemetry-worker/` (need Cloudflare auth)
4. **tauri-action v1 decision**: verify with a throwaway tag from this branch (Claude can push it on request; check draft release + `latest.json`; delete both after) — or drop commit `654b491a`
5. **Push + PR**: add the `ci` label, CI green, merge with a **merge commit** (not squash), close superseded Dependabot PRs, `pnpm task:complete dependency-updates`

## Plan

### Step 1 — Hotfix

- [x] Fix clippy error at `src-tauri/src/commands/project.rs:461` ("redundant reference in `debug!` argument"). `check:all` currently fails on `main` because of this. Also fix the test-only clippy warning at `files.rs:2703`
- [x] Fix nullable primitive parsing (see [Zod 4.5 nullable type arrays](#zod-45-nullable-type-arrays-live-bug)): treat `type: [T, "null"]` as `T` in `handle_primitive_type` / `determine_field_type` (`schema_merger.rs:~691`). Keep the existing `anyOf` path for older schemas
- [x] Rust test: `test_parse_type_array_nullable_primitives` (number, boolean, string, null-first, multi-type fallback)
- [x] Fix tests on Node 25+ (see Issues Encountered #1)
- [x] `check:all` — 737 frontend + 228 Rust tests pass

### Step 2 — Test fixtures + website → Astro 7

Fixtures:
- [x] `git rm` the stale `test/*/pnpm-lock.yaml` files (pnpm ignores them because `test/*` are workspace members; root `pnpm-lock.yaml` governs them. Dependabot security PRs keep targeting these orphans)
- [x] Rename `test/demo-project/package.json` `name` from `dummy-astro-project` to `demo-project`
- [x] demo-project + dummy-astro-project: `astro ^7.3.5` (no config changes expected)
- [x] starlight-minimal: `astro ^7.3.5`, `@astrojs/starlight ^0.42.4`, `sharp ^0.35.5`
- [x] `pnpm install` at root, `astro sync` in each fixture, commit regenerated `.astro/collections`
- [x] Add `rating: z.number().nullish()` and `pinned: z.boolean().nullish()` to dummy-astro-project `notes` to exercise the Step 1 fix against real Astro 7 output
- [x] `pnpm run reset:testdata`
- [ ] User (deferred to final smoke test): open each fixture in Astro Editor, check collections + frontmatter forms (esp. `notes` → `rating`/`pinned`). Parser output for every fixture schema already verified in a throwaway Rust test

Website (bun) — all Starlight-ecosystem packages must move together (each drops Astro 6 / older Starlight):
- [x] `astro ^7.3.5`, `@astrojs/starlight ^0.42.4`, `astro-auto-import ^0.6.0`, `starlight-llms-txt ^0.12.0`, `starlight-theme-flexoki ^0.3.0`, `starlight-page-actions ^0.7.1`, `sharp ^0.35.5`, `starlight-kbd` (already latest 0.4.0)
- [x] Dev: `eslint-plugin-astro ^3.2.1`, `prettier-plugin-astro ^1.1.0`, `@astrojs/check ^0.9.10`, eslint/prettier/typescript-eslint minors. **Keep TypeScript 6** (`@astrojs/check` peers `^5 || ^6`)
- [x] Remove unused direct `zod` dependency (nothing imports it; `content.config.ts` uses `astro/zod`)
- [x] Bump `website/.nvmrc` 22.12.0 → 24 (eslint-plugin-astro 3 Node floor)
- [x] Update stale AutoImport ordering comment at `website/astro.config.mjs:128-131` (Sätteri makes ordering irrelevant)
- [x] `compressHTML` now defaults to `'jsx'` — drops whitespace between inline elements on separate lines. ~7 likely spots in `src/pages/index.astro`, ~2 in `src/components/HeroDownload.astro`. Check visually or set `compressHTML: true`
- [x] `bun run build` + `bun run check`; `prettier --write .` as a separate commit (plugin v1 rewrite will reformat `.astro` files)
- [x] `introduction.mdx:116` ("Astro 5+") — still accurate, left as is

Docs:
- [x] Fix misspelled `docs/developer/astro-generated-conentcollection-schemas.md` → `...-contentcollection-...` (AGENTS.md already uses the correct name). It still describes Astro 5's draft-07 `$ref` format — update for the flat Astro 6/7 format and the Zod 4.5 type-array form
- [x] `docs/developer/schema-system.md` — same

### Step 3 — Main app deps

**3a. Housekeeping**
- [x] `"packageManager": "pnpm@10.34.6"`; removed `version: 9` from `pnpm/action-setup` in `ci.yml` + `release.yml`
- [x] Moved `pnpm.overrides` into `pnpm-workspace.yaml`; `onlyBuiltDependencies` → `allowBuilds`
- [x] Removed `semantic-release`, `@semantic-release/changelog`, `@semantic-release/git`, `.releaserc.json`
- [x] Removed `eslint-plugin-react` + its config
- [x] Removed unused `zod`, `react-hook-form`, `@hookform/resolvers`, `next-themes`, `date-fns`, `autoprefixer`, `postcss`
- [x] Also removed `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` (bundled by `typescript-eslint`) and `eslint-plugin-prettier` (only `eslint-config-prettier` is used). `@testing-library/user-event` was removed then restored — `docs/developer/testing.md` uses it in its component-test examples

**3b. JS minor/patch sweep**
- [x] `pnpm update` within ranges (excluding `@tauri-apps/*` and Prettier). lucide ended up on 1.50; typecheck confirms all icons exist
- [x] `@lezer/markdown` → `^1.7.2`, `pnpm dedupe`. Lockfile has a single version of every `@lezer/*` and `@codemirror/*` package
- [x] Migrated to unified `radix-ui` (`shadcn migrate radix --yes`), removed all individual `@radix-ui/react-*` packages except `react-icons`. No duplicate Radix internals in the lockfile; bundle size unchanged
- [x] `check:all`; two new `unbound-method` lint errors in `useEditorHandlers.test.ts` suppressed (matches the pattern used elsewhere)
- [ ] User (smoke test): GFM table/checklist highlighting, Select close animation (now actually plays)

**3c. Tauri 2.12 + Rust**
- [x] `cargo update` → tauri 2.12.1, all plugins; matching `@tauri-apps/*` JS versions (verified major.minor match for every plugin)
- [x] **window-vibrancy replaced with config**: `windowEffects: { effects: ["hudWindow"], radius: 12 }` in `tauri.macos.conf.json` (applied at window creation; same `apply_vibrancy(HudWindow, None, 12.0)` call internally). Removed the crate, the pin comment and the Rust call; updated `cross-platform.md`
- [x] swc 26/29/45/29 (no code changes), `notify = "=9.0.0-rc.5"`, `dirs` dropped for `std::env::home_dir()`
- [x] `check:all` + universal release build (`tauri build --target universal-apple-darwin --no-bundle`) links cleanly with LTO; binary has `x86_64 arm64`
- [ ] User smoke test: vibrancy looks identical, clipboard, dialogs, deep links, file watching (notify rc.5 coalesces nested watches), window state, updater check

**3d. Test stack + dev tools**
- [x] Vitest 5 + coverage-v8 5, jsdom 30.1, jest-dom 7, `@types/node` 26. `src/test/setup.ts` now imports `@testing-library/jest-dom/vitest` (the bare import no longer augments Vitest's types in v7). Vitest 5 handles Node's built-in `localStorage`, so the Step 1 `execArgv` workaround was removed
- [x] jscpd 5.4 (report path unchanged), ast-grep 0.45.3 (clean)
- [x] `check:all`

**3e. Prettier 3.9**
- [x] Bumped + reformatted (4 files, union types). `coverage/` added to `.gitignore` (Vitest 5 coverage run appended it)

### Step 4 — CI + auxiliary

- [x] `actions/checkout` v7 (SHA-pinned v7.0.1 in `publish-release-notes.yml`, kept its SHA-pinning style), `actions/setup-node` v7, `actions/github-script` v9. All other actions already latest
- [x] `node-version: 'lts/*'` left as is — tests now pass on Node 26
- [x] `tauri-action` v1.0.0 in `release.yml` + `ci.yml` (separate commit): `uploadUpdaterJson`, dropped `updaterJsonKeepUniversal` and `tagName`
- [ ] **tauri-action v1 verification (user decision)**: throwaway tag from this branch → check draft handling, `latest.json` URLs, and that an installed client updates from it; delete tag + draft afterwards. Or drop commit `654b491a`
- [x] Dependabot `bun` entry for `/website`
- [x] Telemetry worker: wrangler 4.95 → 4.147, `wrangler deploy --dry-run` OK
- [ ] User: `pnpm run deploy:staging` and `./stats.sh` in `telemetry-worker/` (need Cloudflare auth)

### Step 5 — Finalize

- [x] `pnpm audit` / `bun audit`: refreshed `devalue`, `postcss-selector-parser`, `braces` within range. Remaining: `http-cache-semantics` (via Astro, build-time only, no patched release). The app's own dependencies have no findings
- [x] Docs updated (AGENTS.md versions + override location, testing.md, cross-platform.md, knip-cleanup command)
- [x] Final `check:all` — 737 frontend + 228 Rust tests pass
- [ ] User smoke test (see 3b/3c + Step 2 fixture check)
- [ ] Push + PR; add `ci` label so the build job runs; CI green
- [ ] Merge with a **merge commit** (not squash)
- [ ] Close superseded Dependabot PRs; `pnpm task:complete dependency-updates`

### Follow-ups (not in this PR)

- **knip is misconfigured**: with pnpm workspaces it ignores the top-level `entry`/`project` and reports 24 "unused files" (incl. live code like copyedit mode) and 10 "unused deps" (incl. `compromise`). Pre-existing; fix the config (move to `workspaces["."]`) before trusting `/knip-cleanup`
- `.claude/commands/knip-cleanup.md` previously listed `zod`, `react-hook-form`, `@hookform/resolvers`, `next-themes`, `date-fns` as deps to keep (presumably for future shadcn form/calendar/toast components). Updated to match their removal — re-add via `shadcn add` if those components are ever needed
- `compromise` is ~557 KB unminified in the main bundle — candidate for lazy-loading with copyedit mode
- Website still prints Starlight's `i18n` / `404` content warnings; remove the Rolldown `onwarn` filter once withastro/astro#18088 ships

## Holds

| Package                          | Current       | Latest       | Why hold                                                              |
| -------------------------------- | ------------- | ------------ | --------------------------------------------------------------------- |
| typescript (app + website)       | 6.0.3         | 7.0.2        | No JS API until 7.1; typescript-eslint and `@astrojs/check` need it   |
| specta / tauri-specta            | rc.22 / rc.21 | rc.25        | rc.25 stack-overflows exporting `serde_json::Value`; fix unreleased   |
| specta-typescript                | 0.0.9         | 0.0.12       | Tied to specta                                                        |
| pnpm                             | 10.x          | 11.x / 12.x  | pnpm 11 silently ignores `package.json#pnpm` (our lezer override)     |
| babel-plugin-react-compiler      | ~1.0.0        | 1.0.0        | Nothing newer on `latest`; oxc-native compiler in plugin-react 6.1 is experimental |
| Rust edition 2024                | 2021          | —            | Optional, low value. `cargo fix` rewrites 3 `if let … else` into ugly `match` — keep by hand |
| Tauri 3                          | —             | 3.0.0-alpha.3 | Alpha                                                                |

**When specta rc.26 / 2.0 lands:** generated `bindings.ts` changes shape — no `export type Result<T,E>` (breaks the re-export at `src/types/domain.ts:119`), `JsonValue` likely inlined (used in `useSaveFileMutation.ts`, `useEditorActions.ts`, `lib/recovery/*`), possible `_Serialize`/`_Deserialize` split for `Collection`. May need `.dangerously_cast_bigints_to_number()` for `i64` in `serde_json::Number`.

## Research Findings

### Zod 4.5 nullable type arrays (live bug)

Zod 4.5.0 ([colinhacks/zod#6339](https://github.com/colinhacks/zod/pull/6339)) collapses `anyOf` branches into a `type` array when every branch is a bare `{type}`. Astro generates `.astro/collections/*.schema.json` via `z.toJSONSchema`, so:

| Schema                      | zod 4.4.3                               | zod ≥4.5                  |
| --------------------------- | --------------------------------------- | ------------------------- |
| `z.number().nullish()`      | `anyOf:[{type:number},{type:null}]`     | `type:["number","null"]`  |
| `z.boolean().nullable()`    | `anyOf:[{type:boolean},{type:null}]`    | `type:["boolean","null"]` |
| `z.string().nullish()`      | `anyOf:[{type:string},{type:null}]`     | `type:["string","null"]`  |
| enums, arrays, dates, refs  | `anyOf`                                 | unchanged                 |
| constrained (e.g. `.min(1)`) | `anyOf`                                | unchanged                 |

`handle_primitive_type`'s `StringOrArray::Array(_)` branch returns `"string"`, so nullable numbers/booleans render as text inputs (regression of issue #68). Astro 6.4 depends on `zod ^4.3.6`, so fresh Astro 6 installs already get 4.5+; Astro 7 requires `^4.5.4`.

### Astro 7

- Content collections essentially unchanged: same JSON schema generation (draft 2020-12, flat format, `.astro/collections/<name>.schema.json`), same `src/content.config.*` location, legacy `src/content/config.*` still behind `legacy.collectionsBackwardsCompat`. `reference()` now also accepts numbers — `is_reference_field` still detects it. Node floor unchanged (`>=22.12.0`)
- Editor needs no version-specific handling: `parse_json_schema` (`schema_merger.rs:231`) detects the format (Astro 5 `$ref` vs flat 6/7), not the version
- Other breaking changes (Vite 8, Rust compiler only, Sätteri default Markdown processor, `compressHTML: 'jsx'`, `src/fetch.ts` reserved) only matter for the fixtures/website
- `astro dev` runs detached in the background when it detects an AI agent (writes `.astro/dev.json`)
- Pre-existing gaps (not Astro 7): editor only looks for `content.config.ts` / `content/config.ts`, not `.js`/`.mjs`/`.mts`; `JsonSchemaProperty.enum_: Vec<String>` fails on numeric enums (falls back to Zod-only parsing)
- Idea: commit captured `.schema.json` outputs (Astro 5, 6+zod 4.4, 7+zod 4.5) as Rust unit-test fixtures, rather than relying on fixture projects for version coverage
- Upgrade guide: https://docs.astro.build/en/guides/upgrade-to/v7/

### Website plugin compatibility

| Package                  | Target  | Astro 7 notes                                                              |
| ------------------------ | ------- | -------------------------------------------------------------------------- |
| `@astrojs/starlight`     | 0.42.4  | Needs astro ≥7.2.10 (0.41 dropped Astro 6)                                 |
| `astro-auto-import`      | 0.6.0   | Adds Sätteri support; needs astro ≥7.2.4                                   |
| `starlight-llms-txt`     | 0.12.0  | Needs astro ^7, starlight ≥0.41                                            |
| `starlight-theme-flexoki` | 0.3.0  | Needs starlight ≥0.42                                                      |
| `starlight-page-actions` | 0.7.1   | Bundled `vite-plugin-virtual` peers vite ≤7 — expect a peer warning        |
| `starlight-kbd`          | 0.4.0   | Already latest; no known Astro 7 issues (unverified)                       |
| `eslint-plugin-astro`    | 3.2.1   | ESLint 10 OK; config unchanged; Node ^22.22.3 / ^24.16 / ≥26.3             |
| `prettier-plugin-astro`  | 1.1.0   | Rewritten on Rust compiler; expect formatting diff                         |

### Unused dependencies (main app)

All added in July 2025 during initial shadcn/Tailwind setup and never used (or usage later removed). knip didn't flag them because they're listed in `knip.json` `ignoreDependencies`:

- `zod`, `react-hook-form`, `@hookform/resolvers` — added with shadcn's form scaffolding. The app deliberately doesn't use React Hook Form (Direct Store Pattern); Zod schema parsing happens in Rust
- `next-themes`, `date-fns` — pulled in by shadcn components (sonner / calendar templates); nothing imports them now (`react-day-picker` brings its own `date-fns`)
- `autoprefixer`, `postcss` — Tailwind v3-style PostCSS setup; Tailwind v4 uses `@tailwindcss/vite` and there's no PostCSS config

### Rust notes

- tauri 2.12: MSRV 1.90, fixes GHSA-w28w-mhc8-qvjv (channel IPC), no config/capability changes needed. Updater JS `check()` dropped `allowDowngrades` — we call it with no args
- tauri 2.12 depends on `window-vibrancy ^0.8.1` (2.11.x used `^0.6`) — confirmed on crates.io
- With current specta pins, tauri 2.12 compiles and regenerated `bindings.ts` is byte-identical

### Dependabot PRs (open)

All will be superseded by this update and can be closed afterwards: #324 js-yaml, #323 prod group, #322 dev group, #321 devalue, #319 rust group, #318 baseline-browser-mapping, #317 vitest, #316 sharp (starlight-minimal), #315 astro (root, transitive), #312–#314 astro (test fixtures), #304 postcss, #301 setup-node, #300 quinn-proto, #291 serde_with, #283 jscpd, #282 @types/node, #278 wrangler, #277 checkout, #276 tauri-action, #275 github-script.

#312–#316 carry the default `javascript` label — they're **security** updates, which ignore `exclude-paths` ([dependabot-core#14408](https://github.com/dependabot/dependabot-core/issues/14408)). Deleting the orphan lockfiles in Step 2 should stop most of them.

Non-dependency PRs #274 (semantic colour tokens), #173 (project settings rework) and #272 (ImgBot) are deliberately left open — they'll be reworked after this update.

### Previous Upgrade Context (May 2026, PR #226)

- window-vibrancy 0.7 was reverted to 0.6 because tauri 2.11 bundled 0.6 → LTO conflict. Tauri 2.12 now bundles 0.8.1, so this is resolved by aligning or removing the crate
- specta held at rc.22/rc.21 (rc.23+ is an architectural overhaul) — still held
- swc was held at 21/23/39/23 — now verified safe to bump
- Sharp missing in dummy-astro-project caused `astro build` image-opt failure (pre-existing); `astro sync` is what the editor relies on

---

## Decisions Log

1. **window-vibrancy**: Replaced with `windowEffects` in `tauri.macos.conf.json` (simpler than `set_effects` in Rust — no code at all). Fall back to pinning 0.8.1 if the effect doesn't look identical
2. **Unused deps**: Removed (user confirmed)
3. **Radix**: Migrate to unified `radix-ui` package in 3b
4. **Open non-Dependabot PRs** (#274, #173, #272): Leave; rework after this update
5. **TypeScript 7, specta rc.25, pnpm 11/12**: Hold (see Holds)
6. **Single PR** with per-step commits and a merge commit, rather than four PRs. Hotfix goes first and can be split out if needed; tauri-action v1 verified with a throwaway tag before merge

## Issues Encountered

1. **Frontend tests fail on Node 25+** (`updateStore.test.ts`: `Cannot read properties of undefined (reading 'getItem')`). Node 25+ has a built-in `localStorage` global that's `undefined` without `--localstorage-file` and shadows jsdom's. Local is Node 26; CI only passes because `lts/*` is still 24 (flips to 26 on 2026-10-28). Fixed with `execArgv: ['--no-experimental-webstorage']` in `vitest.config.ts`. When upgrading to Vitest 5 (3d), check whether it handles this itself and the flag can go.
2. **Verified Zod 4.6.5 output directly**: only bare `number`/`boolean`/`string` collapse to `type: [T, "null"]`. `.int()` (has min/max), enums, arrays, dates, and constrained/formatted strings keep `anyOf`.
3. **Website whitespace (`compressHTML`)**: Astro 7's `'jsx'` default ran words together across Starlight, starlight-kbd and our own components (e.g. `Danny Smith·Privacy Policy`, `CmdShiftF` in kbd groups). Set `compressHTML: true`; a text diff of all 68 built pages against the Astro 6 build then matched exactly, apart from Starlight 0.42's new mobile "Menu" label.
4. **prettier-plugin-astro 1 reformat changed rendered output**: it formats for `'jsx'` whitespace semantics by default, which introduced a visible stray space (`Content Collections .` on the homepage). Fixed by setting `astroCompressHTML: true` in `prettier.config.js` to mirror the Astro config; builds with and without the reformat now render identical text on all pages.
5. **Rolldown `MODULE_LEVEL_DIRECTIVE` warnings** (65 per website build) for Astro's dead `"use astro:head-inject"` directive. Filtered in `astro.config.mjs` via `vite.build.rolldownOptions.onwarn`; remove once [withastro/astro#18088](https://github.com/withastro/astro/pull/18088) ships.
6. **Website prints Starlight content warnings** (`collection "i18n" does not exist`, `Entry docs → 404 was not found`) — new with Starlight 0.42, also seen in starlight-minimal. Harmless; the 404 page renders the same text as before.
7. **`starlight-page-actions` pulls in a second Vite (7.3.6)** via `vite-plugin-virtual`'s peer range. Harmless — that plugin only imports `path`.
8. **Fixture lockfile side effect**: Astro 7 brings esbuild 0.28, so Vite's optional esbuild peer in the root lockfile moved 0.27.7 → 0.28.2.
9. **dummy-astro-project `astro build`** still fails image optimisation on missing Sharp (pre-existing since May). `astro sync`, which the editor relies on, works.
10. **Sandbox `EPERM` during `pnpm install --force`**: the sandbox blocks writing a package's `.idea/` files, leaving `node_modules` half-installed. Re-running outside the sandbox fixed it.
11. **typescript-eslint 8.71 `unbound-method`** now flags `expect(window.dispatchEvent)` in `useEditorHandlers.test.ts`; suppressed per-line like the other tests.
12. **Bundle grew ~66 KB minified / 23 KB gzip** in the JS sweep — React DOM 19.3 (+78 KB pre-minify) and react-resizable-panels 4.14 (+33 KB). Upstream, expected.
13. **App fully reloads on every save in `tauri:dev`** (when the open project is `test/demo-project` or `test/starlight-minimal`, or while the fixtures' `astro dev` servers run). Cause: Tailwind's Vite plugin uses automatic source detection from the repo root (respecting `.gitignore`), so it scanned the test fixtures, website and docs; when a scanned non-module file changes it sends a `full-reload`. Only `temp-dummy-astro-project` (gitignored) was immune, which is why this went unnoticed. Same logic in `@tailwindcss/vite` 4.3.0 and 4.3.3, so not caused by this upgrade. Fix: `@import 'tailwindcss' source('.')` in `src/App.css` (scan `src/` only), plus Vite `server.watch.ignored` now covers all of `test/` and `website/`. Built CSS drops ~9 KB of classes that only appeared in docs/website/fixtures; no class used in `src/` was lost (checked token by token).
