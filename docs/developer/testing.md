# Testing

TypeScript tests use Vitest with React Testing Library in jsdom. Rust tests are ordinary `cargo test` modules. `bun run check:all` runs both, and CI runs `check:all`.

## Where Tests Go

- **Unit tests sit next to their source:** `formatting.ts` and `formatting.test.ts` in the same folder. This covers single modules, hooks and components.
- **`__tests__/` is only for integration tests** that span modules, like store + query + Tauri flows. Today that's `src/store/__tests__/`.
- **`src/test/` is infrastructure only:** the global setup, `test-utils.tsx`, shared helpers (`utils/integration-helpers.tsx`) and shared mocks (`mocks/toast.ts`). No tests.
- **`scripts/*.test.ts` run in the same suite.** `vitest.config.ts` has no `include`, so Vitest's default pattern picks them up alongside `src/`.

## Running Them

- **`bun run test`** (watch) or **`bun run test:run`** (once). Not `bun test`, which is bun's own test runner and doesn't understand Vitest's mocks.
- **Vitest runs on Node,** through its `#!/usr/bin/env node` shebang, even when started with bun. Don't add `--bun`: Vitest targets Node, not bun's runtime. That's why CI still has a `setup-node` step.
- **`bun run rust:test`** runs the Rust tests.

## Global Mocks

`src/test/setup.ts` runs before every test file and mocks these globally:

- **`invoke`** (`@tauri-apps/api/core`) and **`listen`** (`@tauri-apps/api/event`). The mocks are on `globalThis.mockTauri`, with a `reset()`.
- **`@tauri-apps/plugin-log`.** Vitest loads plugin-log outside its module graph, so the `invoke` mock never reaches it and its real `invoke` throws. Mocking it once here lets app code import it directly.
- **The whole `lib/project-registry`.** Most tests want settings without touching disk. A test of the real module must `vi.unmock` it and its submodules first; see `src/lib/project-registry/index.test.ts`.

Because these are global, a test can pass against a mock without anyone noticing. If you're testing code that reads settings or calls Tauri, check which version you're getting.

## Mocking Tauri Commands

Mock `commands` from `@/lib/bindings` when testing code that calls them. Commands that return a Rust `Result` don't throw: they resolve to `{ status: 'ok', data }` or `{ status: 'error', error }`, so mocks must return that shape. A mock that returns a bare value or rejects makes the code under test take a path it never takes in the app. `src/lib/files/fileProcessing.test.ts` shows both cases.

## Components and Queries

`renderWithProviders` in `src/test/test-utils.tsx` wraps a component in a fresh `QueryClient` with `retry: false` and `refetchOnWindowFocus: false`, so a failing query fails at once instead of retrying until the test times out. It returns the `queryClient` too. `src/components/frontmatter/FrontmatterPanel.test.tsx` uses it.

`projectStore` imports the `queryClient` singleton from `lib/query-client` directly, so tests that drive the stores mock that module; otherwise `invalidateQueries` can hang. See the two tests in `src/store/__tests__/`, which also show fake timers for auto-save.

## The `test/` Projects

`test/dummy-astro-project`, `test/demo-project` and `test/starlight-minimal` are Astro sites for trying the app by hand, and for agents driving the dev app. They aren't fixtures for automated tests; nothing in the Vitest or Rust suites reads them.

- **`dummy-astro-project`** is the main vault: collections with most field types, references, images and MDX components. `bun run reset:testdata` (or `bun run app reset`) copies it to `temp-dummy-astro-project`, which is gitignored, so you can edit freely and reset.
- **`demo-project`** has the same shape with realistic articles, books and notes, for demos.
- **`starlight-minimal`** is the Starlight starter, for checking a Starlight `docs` collection.
- **Their generated `.astro/collections/*.schema.json` files are committed,** so the app can read the schemas without anyone installing the projects. After changing a project's content config, run `bun install` and `bun run astro sync` in it and commit the regenerated files.

## Rust Tests

Rust tests are `#[cfg(test)] mod tests` blocks inside the module they test, using `tempfile` for anything that touches the filesystem. The tests in `src-tauri/src/schema_merger.rs` and `parser.rs` hold samples of each schema shape we parse.

One test is `#[ignore]`d on purpose: `export_bindings` in `src-tauri/src/bindings.rs` regenerates `src/lib/bindings.ts` without launching the app. Run it with `cd src-tauri && cargo test export_bindings -- --ignored` after changing a command's signature, and commit the result.
