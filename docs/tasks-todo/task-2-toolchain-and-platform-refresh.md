# Toolchain and Platform Refresh

Move to bun, Oxlint and Oxfmt, and TypeScript 7. Then clear the held dependency upgrades and clean up dead Tauri and Tailwind config.

## Branch strategy

- **Branch:** `modernise-2026-10`, shared with task 3 (Base UI).
- One commit (or a small group) per phase. Merge with a **merge commit**, not a squash, so phases stay bisectable and revertable.
- The bun phase changes `release.yml`, so this can't go on `main`. PR CI with the `ci` label runs the full build matrix before a release depends on it.
- If the branch gets unwieldy, merge after Phase 8 and start task 3 on a fresh branch.

## Phase order

Each phase builds on the one before:

1. bun first, because everything after installs through it.
2. Oxfmt's one-off reformat early, so later commits are already formatted.
3. TypeScript 7 only after ESLint is gone, since typescript-eslint is the only blocker.

## Phase 1: pnpm → bun

Everything we rely on has a bun equivalent:

- tauri-action detects bun from `bun.lock`; it checks for `pnpm-lock.yaml` first, so that has to be deleted.
- Vitest keeps running on Node through its shebang. Don't use `--bun`, and keep `setup-node` in CI.
- Dependabot has supported Bun 1.4 since 2026-10-20.

**Test fixtures leave the workspace.** Their `.astro/collections/*.schema.json` files are committed, so the editor's tests don't need the fixtures installed. Making them standalone:

- removes the workspace entirely;
- keeps Astro and sharp out of the root lockfile;
- fixes knip's workspace confusion;
- stops Dependabot security PRs aimed at fixture lockfiles (those ignore `exclude-paths`).

Steps:

- [x] Root `package.json`:
  - `"packageManager": "bun@1.4.x"`;
  - `"overrides": { "@lezer/common": "^1.5.0" }`, keeping the explanatory comment somewhere sensible;
  - `trustedDependencies`. It **replaces** bun's default allowlist, so list everything that needs a build script. Expect `@ast-grep/cli`, `@tailwindcss/oxide` and `esbuild`, and check with `bun pm untrusted`.
- [x] `bunfig.toml` with a minimum release age. pnpm 11+ has one by default and bun doesn't; check the exact key in bun's docs.
- [x] Delete `pnpm-workspace.yaml` and `pnpm-lock.yaml`, then `bun install`. Check `bun why @lezer/common` and `bun why @lezer/highlight` show a single version, and that `@codemirror/*` is deduplicated
- [x] Fixtures: each runs `bun install` on demand. Gitignore `test/*/bun.lock`. Update `reset:testdata` and the fixture READMEs
- [x] Replace `pnpm run` with `bun run` in the `package.json` scripts, `tauri.conf.json` (`beforeDevCommand` / `beforeBuildCommand`) and `scripts/prepare-release.js`
- [x] `telemetry-worker/`: switch to bun (delete its `pnpm-lock.yaml`; update `stats.sh` and the README). Update the root `stats` script
- [x] CI (`ci.yml`, `release.yml`):
  - swap `pnpm/action-setup` and the pnpm cache for `oven-sh/setup-bun@v2`;
  - `bun install --frozen-lockfile`;
  - `bun run check:all`;
  - keep `setup-node`.
- [x] `.github/dependabot.yml`: `/` from `npm` to `bun`. Drop `exclude-paths: test/**` if the fixtures no longer have lockfiles
- [x] `.coderabbit.yml`: `!pnpm-lock.yaml` → `!bun.lock`
- [x] knip: run it and confirm the output now makes sense (no live files reported unused, `compromise` not reported unused). Fix the config if not
- [x] Mechanical `pnpm` → `bun` replacement in AGENTS.md, README, `docs/CONTRIBUTING.md`, `docs/SECURITY.md`, `docs/developer/*` and the skills. Task 4 does the real rewrite
- [x] `bun run check:all` (737 frontend + 228 Rust tests), `bun run build`
- [x] Danny runs `bun run tauri dev`

**Phase 1 notes:**

- `bun install` migrated `pnpm-lock.yaml`, so every resolved version stayed the same. With no workspace, bun uses the hoisted linker. Only `@ast-grep/cli` needed `trustedDependencies`; esbuild and sharp left the tree with the fixtures
- Single `@lezer/common` (1.5.3), `@lezer/highlight` (1.2.5) and `@codemirror/*` versions confirmed
- `telemetry-worker` resolved fresh (its lockfile was deleted first), so wrangler moved 4.147 → 4.152 within range
- knip's bogus results weren't caused by the workspace. `copyedit-mode.css` sat next to the `copyedit-mode/` directory, and knip resolved `./copyedit-mode` to the CSS file, which made the whole copyedit module (and `compromise`) look unused. Fixed by moving the CSS into the directory. Also added `.css` to the knip project so CSS imports such as `tw-animate-css` are followed, and dropped the ignores knip flagged as redundant
- knip's remaining findings are real, for a later `codebase-hygiene` pass:
  - unused files: `DebugScreen.tsx`, `store/mdxComponentsStore.ts`, `hooks/mutations/useSaveFileMutation.ts` and `useDeleteFileMutation.ts` (only referenced by `src/test/mock-hooks.ts`), and the unused barrels `components/icons/index.ts`, `hooks/commands/index.ts`, `hooks/settings/index.ts`, `lib/commands/index.ts`, `lib/editor/index.ts`, `lib/editor/markdown/index.ts` and `lib/index.ts`
  - unused deps: `@tauri-apps/plugin-window-state` (JS side; the Rust plugin is used) and `@tauri-apps/plugin-clipboard-manager` (Phase 6)
  - unused shadcn components are task 3's job
  - 79 unused exports and 23 unused exported types

## Phase 2: ESLint + Prettier → Oxlint + Oxfmt

- **Oxlint:** type-aware linting is stable (tsgolint, 59 of 61 typescript-eslint type-aware rules). It has native React Compiler lint rules: still marked experimental, enabled through the react plugin's `correctness` category.
- **Oxfmt:** pre-1.0, but passes 100% of Prettier's JS/TS conformance tests and targets our Prettier version (3.9.9).
- **ast-grep stays:** three rules that work, and Oxlint's custom-rule API is alpha.

Oxlint:

- [x] `bunx @oxlint/migrate --type-aware`, and read `--details` for anything it couldn't migrate
- [x] Keep our current rules:
  - `no-unused-vars` with `argsIgnorePattern: ^_`;
  - `no-explicit-any` as a warning;
  - `no-console` as a warning;
  - `prefer-const` and `no-var`;
  - fail on warnings (`--deny-warnings`);
  - report unused disable directives.
- [x] Port the ESLint ignores, e.g. `src/lib/bindings.ts`, the fixtures, `website/` and `telemetry-worker/`
- [x] React Compiler rules: run the old ESLint and Oxlint against the same code and compare findings before deleting ESLint. If the native rules miss things, run `eslint-plugin-react-hooks` through `jsPlugins`
- [x] Check the existing `eslint-disable` comments (about 77) still apply under Oxlint, or convert them
- [x] Remove `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` (unless used through `jsPlugins`), `eslint-config-prettier` and `eslint.config.js`

Oxfmt:

- [x] `bunx oxfmt --migrate prettier`. Port `.prettierignore`, then delete `.prettierrc`, `.prettierignore` and `prettier`
- [x] **Decision:** code and config: `src/`, root configs, `.github`, `scripts`, `src-tauri` JSON/TOML and the ast-grep rules. Not markdown, `website/` (own Prettier) or `test/` fixtures. `src-tauri/tauri.conf.json` is excluded because `prepare-release.js` rewrites it with `JSON.stringify`
- [x] **Decision:** Tailwind class sorting on (`sortTailwindcss.stylesheet: ./src/App.css`), applied in the reformat commit
- [x] Reformat in a single commit, and add that commit to `.git-blame-ignore-revs`
- [x] Update the `lint`, `lint:fix`, `format`, `format:check`, `check:all` and `fix:all` scripts
- [x] `.vscode`: swap the ESLint/Prettier extensions for `oxc.oxc-vscode` and set it as the formatter

**Phase 2 notes:**

- **Parity check:** in a scratch worktree with every disable comment stripped, ESLint and Oxlint reported the same findings. The only differences:
  - `exhaustive-deps` is reported on the hook call line instead of the deps array;
  - tsgolint doesn't flag `expect(window.dispatchEvent)` for `unbound-method` (2 test cases).

  The native React Compiler rules matched exactly, so no `jsPlugins` fallback is needed.
- **Suppressions opt the whole component out:** any `react-hooks/*` suppression makes the React Compiler skip the entire component. Oxlint's rules follow that, which is why the `react-hooks/refs` directive in `Editor.tsx` showed as unused (the component also suppresses `exhaustive-deps`). This also means **the `Editor` component has never been compiled by React Compiler**. Worth looking at in the architecture review. Now documented in `performance-patterns.md`
- Disable comments were converted with `@oxlint/migrate --replace-eslint-comments`, which keeps the `@typescript-eslint/*` and `react-hooks/*` rule names (Oxlint accepts them)
- Type-aware linting is set in the config (`options.typeAware`), so plain `oxlint` runs it
- The reformat touched 56 files and is listed in `.git-blame-ignore-revs`. Oxfmt matched Prettier almost exactly: only 5 `src/` files changed before Tailwind sorting

## Phase 3: TypeScript 7

- [x] `typescript` → latest 7.x. Use 7.1 if it's final by then, but 7.0 is fine because nothing needs the JS API any more
- [x] TS 7 defaults `types` to `[]`. Check that Vitest globals (`globals: true`) and Node types still resolve in `tsconfig.json` / `tsconfig.node.json`, and add an explicit `types` only if needed
- [x] `typecheck` and `build` keep using `tsc --noEmit`. Don't also turn on Oxlint's `typeCheck`, which would duplicate it
- [x] Check knip and `tauri-specta`'s generated output still work
- [x] `website/` stays on TS 6 (`@astrojs/check` needs the JS API), so this only affects the main app

**Phase 3 notes:**

- On 7.0.2; 7.1 is still beta. `tsc --noEmit` passed first time with no tsconfig changes, and a probe file confirmed it reports errors
- No `types` entry needed: every test imports from `vitest` explicitly, and `src/` uses no Node globals
- No package in the tree declares a `typescript` peer range, so there are no peer conflicts. knip, Vitest, the build and tsgolint (which bundles its own tsgo) are unaffected

## Phase 4: Dependency sweep

- [x] JS minor/patch updates:
  - `radix-ui` 1.8;
  - `lucide-react`;
  - `@tanstack/react-query`;
  - `react` / `react-dom` 19.3.1;
  - `react-resizable-panels`;
  - Vite, Vitest, jsdom, knip;
  - ast-grep 0.51.
- [x] `@codemirror/language` 6.13 and `@lezer/markdown` 1.8: re-check that there's a single `@lezer/*` version afterwards
- [x] Tauri: `cargo update` (tauri 2.12.5 and the plugins), with matching `@tauri-apps/*` JS versions. Every plugin's major.minor must match between JS and Rust
- [x] `notify` `=9.0.0-rc.5` → `=9.0.0-rc.6` (fixes intermittent macOS FSEvents hangs during rapid watch/unwatch)
- [x] `bun run check:all`

**Phase 4 notes:**

- **Duplicate copies:** `bun update` left older `@codemirror/view` and `@lezer/markdown` copies nested under `@codemirror/lang-markdown` and others. Typecheck caught it (private-property mismatches). The earlier top-level-only lockfile check missed it. Regenerating `bun.lock` fixed it: a single copy of every `@codemirror/*` and `@lezer/*` package, and 90 fewer packages overall. AGENTS.md and the deps-update skill now give a check for nested copies
- **Babel:** the update auto-installed `@babel/core` 8 as the peer of `@rolldown/plugin-babel` (its range allows 8). `babel-plugin-react-compiler` 1.0 is built against Babel 7 (`@babel/types ^7.26`), so `@babel/core ^7.29.7` is now a direct devDependency. Documented in AGENTS.md
- Versions: tauri 2.12.5, every plugin's JS and Rust major.minor matched, notify rc.6, radix-ui 1.8.1, ast-grep 0.51, `@codemirror/language` 6.13, `@lezer/markdown` 1.8
- Plugin release notes checked:
  - fs 2.7.1 changed how the `write-all` / `write-files` permission sets expand. We grant individual `allow-*` permissions, so it doesn't affect us
  - fs 2.7.0 adds `scopeDroppedPaths` (default `true`), which is moot while the fs scope is `**`. Revisit in Phase 6
  - updater 2.14 and clipboard 2.5 are Linux fixes and new APIs only

## Phase 5: specta / tauri-specta

We've held this since rc.22 because rc.25 stack-overflowed when exporting `serde_json::Value`. Both that bug (specta#498) and the `i64`-in-Value BigInt error (#500) are fixed in the 2026-10-21 releases.

- [x] Read the specta and tauri-specta changelogs for rc.23 to rc.26 first. Known breaking changes:
  - the new `Typescript` exporter API (`bindings.rs`);
  - stricter untagged-enum output;
  - serde phases (can be turned off with `disable_serde_phases`);
  - BigInt handling.
- [x] Pin `tauri-specta = "=2.0.0-rc.26"`, `specta = "=2.0.0-rc.26"` (**not** rc.27, which tauri-specta doesn't accept) and `specta-typescript` at the version tauri-specta rc.26 requires (`^0.0.13`)
- [x] Regenerate `src/lib/bindings.ts`; it regenerates in debug mode on `tauri dev`. Expected fallout from earlier research:
  - no exported `Result<T, E>`, which breaks the re-export at `src/types/domain.ts:119`;
  - `JsonValue` may be inlined (used in `useSaveFileMutation.ts`, `useEditorActions.ts` and `lib/recovery/*`);
  - possibly a `_Serialize` / `_Deserialize` split for `Collection`.
- [x] `serde_json::Value` is used in `schema_merger.rs` and `file_entry.rs`, so check those types export cleanly
- [x] ~~If rc.26 turns out broken, revert this phase~~ (not needed)

**Phase 5 notes:**

- Pinned `tauri-specta =2.0.0-rc.26`, `specta =2.0.0-rc.26` and `specta-typescript =0.0.13`, all published 2026-10-21. No Rust code changes were needed beyond the builder options below
- **Regenerating bindings without the app:** added an ignored test, `cd src-tauri && cargo test export_bindings -- --ignored`. On rc.22 it reproduced the committed `bindings.ts` byte for byte
- **BigInt check (decision):** the new exporter refuses `i64`/`u64`-style types because `JSON.parse` truncates above 2^53. Affected exports:
  - `FileEntry.last_modified: Option<u64>` (Unix seconds)
  - `serde_json::Value` in `FileEntry.frontmatter`, `MarkdownContent.frontmatter`, the `frontmatter` args of `update_frontmatter` / `save_markdown_content`, and `save_recovery_data` / `save_crash_report`

  `serde_json::Value` can't be annotated per field, and that's the case where Specta's docs say the global opt-out "might be required". We use `.dangerously_cast_bigints_to_number()`, which gives the same runtime and the same types as rc.22. The cost is that new 64-bit fields won't be flagged; the reasoning is in a comment in `bindings.rs`. (`min_length`/`max_length` in `schema_merger.rs` aren't exported; they reach the frontend inside a JSON string)
- **Serde phases off:** `.disable_serde_phases()`. Phases emit `X_Serialize | X_Deserialize` for every struct, but the frontend never sends these structs to Rust, so the split only added churn. With phases off, the exported types match rc.22 except:
  - `JsonValue` → `Value` (re-exported as `JsonValue` from `src/types/domain.ts`, so consumers are unchanged)
  - frontmatter maps are `{ [key]: Value }` rather than `Partial<…>`; the two casts in `useSaveFileMutation.ts` / `useEditorActions.ts` were updated
  - no exported `Result` type (our re-export was unused, so it was removed)
- Commands are now arrow-function properties wrapped by a shared `typedError` helper. Runtime semantics are identical: same `{ status, data | error }` shape, `Error` instances still rethrown, and infallible commands still return bare values. The `unbound-method` suppression in `fileProcessing.test.ts` became unused and was removed

## Phase 6: Tauri config and capabilities

- [x] Remove `macOSPrivateApi` from `tauri.conf.json` and `tauri.macos.conf.json`, and the `macos-private-api` feature from `Cargo.toml`. They've done nothing since 2.12.1
- [x] Remove the duplicate `tauri` dependency in `Cargo.toml`'s macOS target section
- [x] Remove `plugins.shell` from `tauri.conf.json`, which is left over from before the opener plugin
- [x] Fix the `Cargo.toml` metadata (`description = "A Tauri App"`, `authors = ["you"]`)
- [x] Trim capabilities to what the **frontend** calls; plugin calls made from Rust need no capability:
  - fs: the frontend only uses `remove` → `fs:allow-remove` plus the scope;
  - drop the `core:*:default` entries already covered by `core:default` (keep the specific `core:window:allow-*` ones);
  - drop the `updater:allow-*` and `process:allow-restart` entries covered by their `:default`, and the duplicate `updater:default` in `desktop.json`;
  - clipboard is only used through our own Rust command (`copy_text_to_clipboard`). Drop the clipboard capabilities, and the `@tauri-apps/plugin-clipboard-manager` JS package if nothing imports it.
- [x] Danny checks transparency, vibrancy and rounded corners still look identical (plus window controls, delete with confirm dialog, project picker, opener, updater, clipboard and window-state restore: all fine)

**Phase 6 notes:**

- `macOSPrivateApi` and the `macos-private-api` feature were confirmed as no-ops in the Tauri 2.12.5 source ("No-op since Tauri 2.12.1"). Removed from both configs and `Cargo.toml`, along with the macOS-target duplicate `tauri` dependency. `cross-platform.md` is updated; its tauri-build gotcha is now stated generally (keep config-required features on the base `tauri` dependency)
- Capabilities went from 44 entries to 24, plus `desktop.json` removed. Each removal was checked against the default sets in `gen/schemas/acl-manifests.json` and the frontend's actual `@tauri-apps/*` imports:
  - **covered by `core:default`:** `core:app/event/window/path/menu:default`
  - **covered by their `:default`:** the `updater:allow-*` entries and `process:allow-restart`
  - **frontend never imports these plugins:** clipboard-manager (only used through our `copy_text_to_clipboard` command), window-state (Rust-only)
  - **frontend only calls fs `remove`:** dropped `fs:default` and the read/write/dir/exists/mkdir entries
  - **unchanged:** every specific `core:window:allow-*` entry, the fs and opener scopes, and dialog, opener, log, os and deep-link
- Removed the unused JS packages `@tauri-apps/plugin-clipboard-manager` and `@tauri-apps/plugin-window-state`; their Rust crates stay
- fs `scopeDroppedPaths` left at its default; moot while the fs scope is `**`
- Spotted while auditing, unchanged: `dialog:default` doesn't include `allow-ask`, yet the context-menu delete uses `ask()`. It goes through the `message` command, and the smoke test should confirm that

## Phase 7: Tailwind and CSS cleanup

PR #274 (semantic colour tokens) is out of scope. It gets re-implemented later on top of this work.

- [x] Delete `tailwind.config.js` (Tailwind 4 only loads it through `@config`, which we don't use) and set `components.json` `tailwind.config` to `""`
- [x] **Double-wrapped colours.** `body`, `#root` and the `::placeholder` rules in `src/App.css` use `hsl(var(--x))` where `--x` is already `hsl(...)`. That's invalid, so the declarations are silently ignored, which means:
  - `body` and `#root` backgrounds are currently transparent, and **the vibrancy effect may depend on that**;
  - the `#root` border isn't drawn.

  Take screenshots first, then make the intended behaviour explicit (probably transparent backgrounds) rather than "fixing" them to opaque. Fix the placeholder colour and check it.
- [x] **Mixed token formats.** `--heading`, `--color-draft`, `--color-filter`, `--color-required` and `--color-warning` are bare v3-style HSL triplets. `--color-draft` is also the name `@theme inline` redefines, so the generated utilities only work because hand-written `@layer utilities` rules come later. Fix it:
  - rename them to full colour values (`--draft: hsl(...)`);
  - map them in `@theme inline` (`--color-draft: var(--draft)`);
  - delete the hand-written `.text-*` / `.bg-*` / `.border-*` utilities;
  - check every usage, including opacity modifiers.
- [x] Remove the duplicate `* { @apply border-border }` (it appears twice)
- [x] Optional: derive `--radius-*` from `--radius` the way shadcn does now. No OKLCH conversion; our tokens are neutral greys

**Phase 7 notes:**

- `hsl(var(--x))` with `--x` already `hsl(...)` is invalid *at computed-value time*, so the property computes as `unset` rather than the declaration being skipped. So:
  - `body` and `#root` backgrounds computed as transparent, which the vibrancy relies on;
  - the `#root` border never drew.

  The declarations were removed, so rendering is identical, and a comment explains why they stay transparent
- **Placeholders:** the rule now uses `var(--muted-foreground)`. Before, placeholders without shadcn's `placeholder:` class inherited the full text colour. The redundant `-webkit-` / `-moz-` copies are removed
- **Status tokens:** these are now full colour values (`--draft`, `--filter`, …), mapped via `@theme inline`, and the hand-written utilities are deleted. The built CSS has no `hsl(var(` left. This fixed a real bug: `hover:bg-draft/80` and `hover:bg-filter/50`/`/80` were generated from the *text* colour, because the plain `bg-*` classes were hand-written but their variants weren't. On hover, the active Drafts/filter buttons turned into tan/dark squares behind dark icons (visible in Danny's before screenshot). Background tints are now `bg-draft-bg` / `bg-filter-bg`, hover variants included (`LeftSidebar.tsx`)
- Fixed the same `hsl(var())` bug in the shadcn sidebar's outline-variant shadow
- `color-system.md` is updated, including the two rules that caused all this: use tokens as `var(--x)`, and don't name `:root` variables `--color-*`
- CSS bundle: 104.2 → 103.1 kB

## Phase 8: Verify

- [ ] `bun run check:all`
- [ ] Production build: `bun run tauri build --bundles app --no-sign --config '{"bundle":{"createUpdaterArtifacts":false}}'`
- [ ] Danny smoke-tests the `.app`:
  - vibrancy, rounded corners and window chrome;
  - editor syntax highlighting, including GFM tables and checklists;
  - frontmatter forms in each fixture;
  - file watching, clipboard and dialogs;
  - deep links and window state;
  - delete file (fs capability);
  - update check;
  - placeholder and draft colours in light and dark mode.
- [ ] Push, PR with the `ci` label, CI green on all platforms
- [ ] Either merge with a merge commit, or continue straight into task 3 on the same branch

## Holds (after this task)

| Package                     | Why hold                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| babel-plugin-react-compiler | plugin-react's native (oxc) compiler is still experimental       |
| Tauri 3                     | Alpha                                                            |
| Rust edition 2024           | Low value; `cargo fix` rewrites some `if let … else` badly       |
| website TypeScript 7        | `@astrojs/check` needs the TS JS API                             |
