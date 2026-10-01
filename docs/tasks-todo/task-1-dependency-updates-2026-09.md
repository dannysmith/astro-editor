# Dependency Updates - September 2026

## Status

**Current Phase:** Step 1 done (uncommitted) — next up is Step 2
**Branch:** deps-2026-10-01

This round is bigger than usual: Astro 7 for the fixtures and website, Tauri 2.12, several test-tooling majors, a CI overhaul, and a live schema-parsing bug for current users.

**Strategy:** one PR, one commit (or small group of commits) per step below, merged with a **merge commit, not squash** so steps stay bisectable and individually revertable. Caveats:

- The hotfix is the first commit. If the rest of the PR starts dragging, cherry-pick it into its own PR and ship a patch release — the bug is live for users on fresh Astro 6 installs.
- tauri-action v1 can't be exercised by PR CI (release only runs on `v*` tags). Verify it with a throwaway tag from this branch before merging, or drop that change from the PR.
- Merging deploys the website (`deploy-website.yml` runs on pushes to `main` touching `website/**`).

## Plan

### Step 1 — Hotfix

- [x] Fix clippy error at `src-tauri/src/commands/project.rs:461` ("redundant reference in `debug!` argument"). `check:all` currently fails on `main` because of this. Also fix the test-only clippy warning at `files.rs:2703`
- [x] Fix nullable primitive parsing (see [Zod 4.5 nullable type arrays](#zod-45-nullable-type-arrays-live-bug)): treat `type: [T, "null"]` as `T` in `handle_primitive_type` / `determine_field_type` (`schema_merger.rs:~691`). Keep the existing `anyOf` path for older schemas
- [x] Rust test: `test_parse_type_array_nullable_primitives` (number, boolean, string, null-first, multi-type fallback)
- [x] Fix tests on Node 25+ (see Issues Encountered #1)
- [x] `check:all` — 737 frontend + 228 Rust tests pass

### Step 2 — Test fixtures + website → Astro 7

Fixtures:
- [ ] `git rm` the stale `test/*/pnpm-lock.yaml` files (pnpm ignores them because `test/*` are workspace members; root `pnpm-lock.yaml` governs them. Dependabot security PRs keep targeting these orphans)
- [ ] Rename `test/demo-project/package.json` `name` from `dummy-astro-project` to `demo-project`
- [ ] demo-project + dummy-astro-project: `astro ^7.3.5` (no config changes expected)
- [ ] starlight-minimal: `astro ^7.3.5`, `@astrojs/starlight ^0.42.4`, `sharp ^0.35.5`
- [ ] `pnpm install` at root, `astro sync` in each fixture, commit regenerated `.astro/collections`
- [ ] Add `z.number().nullish()` and `z.boolean().nullish()` fields to dummy-astro-project to exercise the Step 1 fix against real Astro 7 output
- [ ] `pnpm run reset:testdata`
- [ ] User: open each fixture in Astro Editor, check collections + frontmatter forms (esp. the new nullish fields)

Website (bun) — all Starlight-ecosystem packages must move together (each drops Astro 6 / older Starlight):
- [ ] `astro ^7.3.5`, `@astrojs/starlight ^0.42.4`, `astro-auto-import ^0.6.0`, `starlight-llms-txt ^0.12.0`, `starlight-theme-flexoki ^0.3.0`, `starlight-page-actions ^0.7.1`, `sharp ^0.35.5`, `starlight-kbd` (already latest 0.4.0)
- [ ] Dev: `eslint-plugin-astro ^3.2.1`, `prettier-plugin-astro ^1.1.0`, `@astrojs/check ^0.9.10`, eslint/prettier/typescript-eslint minors. **Keep TypeScript 6** (`@astrojs/check` peers `^5 || ^6`)
- [ ] Remove unused direct `zod` dependency (nothing imports it; `content.config.ts` uses `astro/zod`)
- [ ] Bump `website/.nvmrc` 22.12.0 → 24 (eslint-plugin-astro 3 Node floor)
- [ ] Update stale AutoImport ordering comment at `website/astro.config.mjs:128-131` (Sätteri makes ordering irrelevant)
- [ ] `compressHTML` now defaults to `'jsx'` — drops whitespace between inline elements on separate lines. ~7 likely spots in `src/pages/index.astro`, ~2 in `src/components/HeroDownload.astro`. Check visually or set `compressHTML: true`
- [ ] `bun run build` + `bun run check`; `prettier --write .` as a separate commit (plugin v1 rewrite will reformat `.astro` files)
- [ ] Update `website/src/content/docs/getting-started/introduction.mdx:116` ("Astro 5+") if needed

Docs:
- [ ] Fix misspelled `docs/developer/astro-generated-conentcollection-schemas.md` → `...-contentcollection-...` (AGENTS.md already uses the correct name). It still describes Astro 5's draft-07 `$ref` format — update for the flat Astro 6/7 format and the Zod 4.5 type-array form
- [ ] `docs/developer/schema-system.md` — same

### Step 3 — Main app deps

**3a. Housekeeping**
- [ ] Add `"packageManager": "pnpm@10.34.6"` to root `package.json`; remove `version: 9` from `pnpm/action-setup` in `ci.yml` + `release.yml` (action reads `packageManager`)
- [ ] Remove `semantic-release`, `@semantic-release/changelog`, `@semantic-release/git`, `.releaserc.json` (unused — releases go `prepare-release.js` → tag → tauri-action)
- [ ] Remove `eslint-plugin-react` + its config in `eslint.config.js` (we enable zero of its rules; no ESLint 10 support)
- [ ] Remove unused deps: `zod`, `react-hook-form`, `@hookform/resolvers`, `next-themes`, `date-fns`, `autoprefixer`, `postcss` — and their entries in `knip.json` `ignoreDependencies`. Check the other `ignoreDependencies` entries while there
- [ ] Optional (pnpm ≥10.26 in CI first): move `pnpm.overrides` into `pnpm-workspace.yaml`, `onlyBuiltDependencies` → `allowBuilds`. Makes a later pnpm 11 move painless

**3b. JS minor/patch sweep**
- [ ] `pnpm update` (CodeMirror, Radix, React 19.3 + types, lucide 1.48, TanStack, zustand, Vite 8.3, `@vitejs/plugin-react` 6.1.1, `@rolldown/plugin-babel`, Tailwind 4.3.3, ESLint 10.11, typescript-eslint 8.71, knip 6.38, marked, etc.) — **excluding `@tauri-apps/*`** (done in 3c)
- [ ] `@lezer/markdown` `1.6.4` → `^1.7.2`, `@codemirror/lang-markdown` → `^6.5.2`, then `pnpm dedupe`. Verify `pnpm why @lezer/markdown` / `pnpm why @lezer/common` each show a single version. Keep the `@lezer/common` override
- [ ] Migrate to unified `radix-ui` package: `pnpm dlx shadcn@latest migrate radix` (shadcn's recommended setup since mid-2025). `@radix-ui/react-icons` isn't part of it — only used in `breadcrumb.tsx`
- [ ] `check:all`
- [ ] Manual: GFM table/checklist highlighting, Select close animation (now actually plays)

**3c. Tauri 2.12 + Rust** — single commit; the Tauri CLI refuses to build if JS and Rust minor versions differ
- [ ] `cargo update` (tauri 2.12, tauri-build 2.7, all `tauri-plugin-*`, tokio, serde, regex, uuid, reqwest…)
- [ ] All `@tauri-apps/*` JS packages to matching 2.12.x / plugin minors
- [ ] **Replace `window-vibrancy` with Tauri's built-in effects API**: `src-tauri/src/lib.rs:~307` `apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))` → `window.set_effects(EffectsBuilder::new().effect(Effect::HudWindow).radius(12.0).build())`. Tauri's macOS impl calls the same `apply_vibrancy` internally. Delete the crate + pin comment from `Cargo.toml`; update `docs/developer/cross-platform.md`. Fallback if it doesn't look identical: pin `window-vibrancy = "0.8.1"` (tauri 2.12 uses `^0.8.1`, so versions align). **Keeping 0.6 with tauri 2.12 will bring back the LTO symbol conflict**
- [ ] swc `21/23/39/23` → `26/29/45/29` (no code changes needed; verified in a scratch copy — all 228 Rust tests passed)
- [ ] `notify = "=9.0.0-rc.5"` (pin exactly; still pre-release)
- [ ] `dirs` — drop it and use `std::env::home_dir()` (fixed in Rust 1.85, un-deprecated in 1.87). Used in `project.rs:99`, `project.rs:1015` (test), `ide.rs:104`. Otherwise `dirs = "7"`
- [ ] `check:all` + `pnpm run tauri:build` — confirm the **universal** release build links (only native aarch64 was tested)
- [ ] User smoke test: vibrancy looks identical, clipboard, dialogs, deep links, file watching (notify rc.5 coalesces nested watches — `watcher.rs` watches the content config inside the recursive content-dir watch), window state, updater check

**3d. Test stack + dev tools**
- [ ] `vitest` + `@vitest/coverage-v8` 5.0.2 (exact peer — bump together), `jsdom ^30.1.1` (not 30.0.x/30.1.0 — regressions), `@testing-library/jest-dom ^7.0.1`, `@types/node ^26`. Vitest 5 notes: `clearMocks` defaults to true, unawaited async assertions fail, coverage globs are relative
- [ ] `jscpd ^5` (Rust rewrite, same config/report format; no longer follows symlinks) — run `pnpm jscpd` to confirm
- [ ] `@ast-grep/cli ^0.45` — run `ast:lint` to confirm
- [ ] `check:all`

**3e. Prettier 3.9**
- [ ] Bump prettier + `pnpm format` as its own commit (TS union formatting + micromark v4 Markdown parser will churn some files)

### Step 4 — CI + auxiliary

- [ ] `actions/checkout` v6 → v7, `actions/setup-node` v6 → v7, `actions/github-script` v8 → v9 (no workflow changes needed)
- [ ] Consider pinning `node-version` explicitly (24 or 26) — `lts/*` flips from 24 to 26 on 2026-10-28
- [ ] Make `publish-release-notes.yml` consistent with the others (it pins by SHA; others use tags)
- [ ] `tauri-apps/tauri-action` v0.6.2 → v1.0.0 in `release.yml`:
  - `includeUpdaterJson` → `uploadUpdaterJson`; remove `updaterJsonKeepUniversal` (always on now)
  - `latest.json` URLs change from `browser_download_url` to `api.github.com/.../releases/assets/{id}` — the "tagName keeps URLs tag-pinned" comment goes stale; `tagName` can go since we pass `releaseId`
  - `.app.tar.gz` names now include the version (`publish-stable-assets` unaffected)
  - Verify with a throwaway tag from this branch **before merging**: draft handling, `latest.json` contents, and that an installed client can update from it. Delete the tag + draft release afterwards. If this can't be verified, drop the tauri-action bump from the PR
- [ ] Add a Dependabot `package-ecosystem: "bun"` entry for `/website` (currently not covered)
- [ ] Telemetry worker: wrangler 4.95 → 4.143, `wrangler deploy --dry-run`, staging deploy, `./stats.sh`

### Step 5 — Finalize

- [ ] `pnpm audit`
- [ ] Update `AGENTS.md` / `docs/developer/` for anything removed (window-vibrancy, lezer pin notes, semantic-release)
- [ ] Final `check:all` + user smoke test
- [ ] Push + PR; add `ci` label so the build job runs; CI green
- [ ] Merge with a **merge commit** (not squash)
- [ ] Close superseded Dependabot PRs; `pnpm task:complete dependency-updates`

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

1. **window-vibrancy**: Try replacing with Tauri's `set_effects`; fall back to pinning 0.8.1 if the effect isn't identical
2. **Unused deps**: Remove (explained to user; reconfirm when reaching 3a)
3. **Radix**: Migrate to unified `radix-ui` package in 3b
4. **Open non-Dependabot PRs** (#274, #173, #272): Leave; rework after this update
5. **TypeScript 7, specta rc.25, pnpm 11/12**: Hold (see Holds)
6. **Single PR** with per-step commits and a merge commit, rather than four PRs. Hotfix goes first and can be split out if needed; tauri-action v1 verified with a throwaway tag before merge

## Issues Encountered

1. **Frontend tests fail on Node 25+** (`updateStore.test.ts`: `Cannot read properties of undefined (reading 'getItem')`). Node 25+ has a built-in `localStorage` global that's `undefined` without `--localstorage-file` and shadows jsdom's. Local is Node 26; CI only passes because `lts/*` is still 24 (flips to 26 on 2026-10-28). Fixed with `execArgv: ['--no-experimental-webstorage']` in `vitest.config.ts`. When upgrading to Vitest 5 (3d), check whether it handles this itself and the flag can go.
2. **Verified Zod 4.6.5 output directly**: only bare `number`/`boolean`/`string` collapse to `type: [T, "null"]`. `.int()` (has min/max), enums, arrays, dates, and constrained/formatted strings keep `anyOf`.
