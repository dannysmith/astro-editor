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

- [ ] Root `package.json`:
  - `"packageManager": "bun@1.4.x"`;
  - `"overrides": { "@lezer/common": "^1.5.0" }`, keeping the explanatory comment somewhere sensible;
  - `trustedDependencies`. It **replaces** bun's default allowlist, so list everything that needs a build script. Expect `@ast-grep/cli`, `@tailwindcss/oxide` and `esbuild`, and check with `bun pm untrusted`.
- [ ] `bunfig.toml` with a minimum release age. pnpm 11+ has one by default and bun doesn't; check the exact key in bun's docs.
- [ ] Delete `pnpm-workspace.yaml` and `pnpm-lock.yaml`, then `bun install`. Check `bun why @lezer/common` and `bun why @lezer/highlight` show a single version, and that `@codemirror/*` is deduplicated
- [ ] Fixtures: each runs `bun install` on demand. Gitignore `test/*/bun.lock`. Update `reset:testdata` and the fixture READMEs
- [ ] Replace `pnpm run` with `bun run` in the `package.json` scripts, `tauri.conf.json` (`beforeDevCommand` / `beforeBuildCommand`) and `scripts/prepare-release.js`
- [ ] `telemetry-worker/`: switch to bun (delete its `pnpm-lock.yaml`; update `stats.sh` and the README). Update the root `stats` script
- [ ] CI (`ci.yml`, `release.yml`):
  - swap `pnpm/action-setup` and the pnpm cache for `oven-sh/setup-bun@v2`;
  - `bun install --frozen-lockfile`;
  - `bun run check:all`;
  - keep `setup-node`.
- [ ] `.github/dependabot.yml`: `/` from `npm` to `bun`. Drop `exclude-paths: test/**` if the fixtures no longer have lockfiles
- [ ] `.coderabbit.yml`: `!pnpm-lock.yaml` → `!bun.lock`
- [ ] knip: run it and confirm the output now makes sense (no live files reported unused, `compromise` not reported unused). Fix the config if not
- [ ] Mechanical `pnpm` → `bun` replacement in AGENTS.md, README, `docs/CONTRIBUTING.md`, `docs/SECURITY.md`, `docs/developer/*` and the skills. Task 4 does the real rewrite
- [ ] `bun run check:all`; Danny runs `bun run tauri dev`

## Phase 2: ESLint + Prettier → Oxlint + Oxfmt

- **Oxlint:** type-aware linting is stable (tsgolint, 59 of 61 typescript-eslint type-aware rules). It has native React Compiler lint rules: still marked experimental, enabled through the react plugin's `correctness` category.
- **Oxfmt:** pre-1.0, but passes 100% of Prettier's JS/TS conformance tests and targets our Prettier version (3.9.9).
- **ast-grep stays:** three rules that work, and Oxlint's custom-rule API is alpha.

Oxlint:

- [ ] `bunx @oxlint/migrate --type-aware`, and read `--details` for anything it couldn't migrate
- [ ] Keep our current rules:
  - `no-unused-vars` with `argsIgnorePattern: ^_`;
  - `no-explicit-any` as a warning;
  - `no-console` as a warning;
  - `prefer-const` and `no-var`;
  - fail on warnings (`--deny-warnings`);
  - report unused disable directives.
- [ ] Port the ESLint ignores, e.g. `src/lib/bindings.ts`, the fixtures, `website/` and `telemetry-worker/`
- [ ] React Compiler rules: run the old ESLint and Oxlint against the same code and compare findings before deleting ESLint. If the native rules miss things, run `eslint-plugin-react-hooks` through `jsPlugins`
- [ ] Check the existing `eslint-disable` comments (about 77) still apply under Oxlint, or convert them
- [ ] Remove `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` (unless used through `jsPlugins`), `eslint-config-prettier` and `eslint.config.js`

Oxfmt:

- [ ] `bunx oxfmt --migrate prettier`. Port `.prettierignore`, then delete `.prettierrc`, `.prettierignore` and `prettier`
- [ ] **Decision:** keep the current format scope (`src/**` only) or widen it?
- [ ] **Decision:** turn on Oxfmt's built-in Tailwind class sorting? If yes, do it in the same reformat commit so the churn happens once
- [ ] Reformat in a single commit, and add that commit to `.git-blame-ignore-revs`
- [ ] Update the `lint`, `lint:fix`, `format`, `format:check`, `check:all` and `fix:all` scripts
- [ ] `.vscode`: swap the ESLint/Prettier extensions for `oxc.oxc-vscode` and set it as the formatter

## Phase 3: TypeScript 7

- [ ] `typescript` → latest 7.x. Use 7.1 if it's final by then, but 7.0 is fine because nothing needs the JS API any more
- [ ] TS 7 defaults `types` to `[]`. Check that Vitest globals (`globals: true`) and Node types still resolve in `tsconfig.json` / `tsconfig.node.json`, and add an explicit `types` only if needed
- [ ] `typecheck` and `build` keep using `tsc --noEmit`. Don't also turn on Oxlint's `typeCheck`, which would duplicate it
- [ ] Check knip and `tauri-specta`'s generated output still work
- [ ] `website/` stays on TS 6 (`@astrojs/check` needs the JS API), so this only affects the main app

## Phase 4: Dependency sweep

- [ ] JS minor/patch updates:
  - `radix-ui` 1.8;
  - `lucide-react`;
  - `@tanstack/react-query`;
  - `react` / `react-dom` 19.3.1;
  - `react-resizable-panels`;
  - Vite, Vitest, jsdom, knip;
  - ast-grep 0.51.
- [ ] `@codemirror/language` 6.13 and `@lezer/markdown` 1.8: re-check that there's a single `@lezer/*` version afterwards
- [ ] Tauri: `cargo update` (tauri 2.12.5 and the plugins), with matching `@tauri-apps/*` JS versions. Every plugin's major.minor must match between JS and Rust
- [ ] `notify` `=9.0.0-rc.5` → `=9.0.0-rc.6` (fixes intermittent macOS FSEvents hangs during rapid watch/unwatch)
- [ ] `bun run check:all`

## Phase 5: specta / tauri-specta

We've held this since rc.22 because rc.25 stack-overflowed when exporting `serde_json::Value`. Both that bug (specta#498) and the `i64`-in-Value BigInt error (#500) are fixed in the 2026-10-21 releases.

- [ ] Read the specta and tauri-specta changelogs for rc.23 to rc.26 first. Known breaking changes:
  - the new `Typescript` exporter API (`bindings.rs`);
  - stricter untagged-enum output;
  - serde phases (can be turned off with `disable_serde_phases`);
  - BigInt handling.
- [ ] Pin `tauri-specta = "=2.0.0-rc.26"`, `specta = "=2.0.0-rc.26"` (**not** rc.27, which tauri-specta doesn't accept) and `specta-typescript` at the version tauri-specta rc.26 requires (`^0.0.13`)
- [ ] Regenerate `src/lib/bindings.ts`; it regenerates in debug mode on `tauri dev`. Expected fallout from earlier research:
  - no exported `Result<T, E>`, which breaks the re-export at `src/types/domain.ts:119`;
  - `JsonValue` may be inlined (used in `useSaveFileMutation.ts`, `useEditorActions.ts` and `lib/recovery/*`);
  - possibly a `_Serialize` / `_Deserialize` split for `Collection`.
- [ ] `serde_json::Value` is used in `schema_merger.rs` and `file_entry.rs`, so check those types export cleanly
- [ ] If rc.26 turns out broken, revert this phase, record why in the holds table and move on

## Phase 6: Tauri config and capabilities

- [ ] Remove `macOSPrivateApi` from `tauri.conf.json` and `tauri.macos.conf.json`, and the `macos-private-api` feature from `Cargo.toml`. They've done nothing since 2.12.1
- [ ] Remove the duplicate `tauri` dependency in `Cargo.toml`'s macOS target section
- [ ] Remove `plugins.shell` from `tauri.conf.json`, which is left over from before the opener plugin
- [ ] Fix the `Cargo.toml` metadata (`description = "A Tauri App"`, `authors = ["you"]`)
- [ ] Trim capabilities to what the **frontend** calls; plugin calls made from Rust need no capability:
  - fs: the frontend only uses `remove` → `fs:allow-remove` plus the scope;
  - drop the `core:*:default` entries already covered by `core:default` (keep the specific `core:window:allow-*` ones);
  - drop the `updater:allow-*` and `process:allow-restart` entries covered by their `:default`, and the duplicate `updater:default` in `desktop.json`;
  - clipboard is only used through our own Rust command (`copy_text_to_clipboard`). Drop the clipboard capabilities, and the `@tauri-apps/plugin-clipboard-manager` JS package if nothing imports it.
- [ ] Danny checks transparency, vibrancy and rounded corners still look identical

## Phase 7: Tailwind and CSS cleanup

PR #274 (semantic colour tokens) is out of scope. It gets re-implemented later on top of this work.

- [ ] Delete `tailwind.config.js` (Tailwind 4 only loads it through `@config`, which we don't use) and set `components.json` `tailwind.config` to `""`
- [ ] **Double-wrapped colours.** `body`, `#root` and the `::placeholder` rules in `src/App.css` use `hsl(var(--x))` where `--x` is already `hsl(...)`. That's invalid, so the declarations are silently ignored, which means:
  - `body` and `#root` backgrounds are currently transparent, and **the vibrancy effect may depend on that**;
  - the `#root` border isn't drawn.

  Take screenshots first, then make the intended behaviour explicit (probably transparent backgrounds) rather than "fixing" them to opaque. Fix the placeholder colour and check it.
- [ ] **Mixed token formats.** `--heading`, `--color-draft`, `--color-filter`, `--color-required` and `--color-warning` are bare v3-style HSL triplets. `--color-draft` is also the name `@theme inline` redefines, so the generated utilities only work because hand-written `@layer utilities` rules come later. Fix it:
  - rename them to full colour values (`--draft: hsl(...)`);
  - map them in `@theme inline` (`--color-draft: var(--draft)`);
  - delete the hand-written `.text-*` / `.bg-*` / `.border-*` utilities;
  - check every usage, including opacity modifiers.
- [ ] Remove the duplicate `* { @apply border-border }` (it appears twice)
- [ ] Optional: derive `--radius-*` from `--radius` the way shadcn does now. No OKLCH conversion; our tokens are neutral greys

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
