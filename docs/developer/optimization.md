# Optimisation

What the build does to keep the app small, and why. Measure before optimising anything else.

## Frontend Build

The production frontend build is `bun run build` (`tsc && vite build`), which `tauri build` runs through `beforeBuildCommand`. Its settings are in `vite.config.ts`.

- **Minified with terser, which is a direct devDependency.** Vite treats terser as optional and fails the build if `minify: 'terser'` is set and it isn't installed, so it looks unused but isn't. Vite's default minifier (Oxc) might now do the same job; nobody has compared them.
- **`console.*` and `debugger` are stripped** (`drop_console`, `drop_debugger`). Release builds never print `console` output, so anything users or support need goes through `@tauri-apps/plugin-log`. `console.*` is for temporary debugging only.
- **No source maps** in production.
- **Every build writes `bundle-stats.html`** (gitignored) with `rollup-plugin-visualizer`, a treemap of the bundle with gzip and brotli sizes, and opens it in your browser (`open: true`). That's the place to start when looking at bundle size.

## Rust Build

The release profile in `src-tauri/Cargo.toml` favours a small binary over build speed: `opt-level = "s"`, LTO, one codegen unit, `panic = "abort"` and `strip`. That makes release builds slow, by design. `panic = "abort"` also means a panic ends the process rather than unwinding.

CI's `build` job overrides LTO and codegen units through `CARGO_PROFILE_RELEASE_*` env vars, because it only checks that every platform builds. It stays a release build rather than `--debug`, which would compile dev-only code like the agent bridge. `release.yml` keeps the full profile. See `releases.md`.

`removeUnusedCommands` in `tauri.conf.json` makes `tauri build` leave out plugin commands that no capability in `src-tauri/capabilities/` allows.

## Where to Look

- **Bundle size:** `bundle-stats.html` after a build.
- **Re-renders:** the React Compiler and the Zustand rules in `architecture-guide.md` cover most of it; profile before adding manual memoisation.
- **Binary size:** the release profile above, and the Cargo dependencies in `src-tauri/Cargo.toml`.
