# Optimisation

What the build does to keep the app small and fast, and why. Add to this as we find new ways to optimise it.

## Frontend build

The production frontend build is `bun run build` (`tsc && vite build`), which `tauri build` runs through `beforeBuildCommand`. Its settings are in `vite.config.ts`.

- **Minified with terser, which is a direct devDependency.** Vite treats terser as optional and fails the build if `minify: 'terser'` is set and it isn't installed, so it looks unused but isn't.
- **`console.*` and `debugger` are stripped** (`drop_console`, `drop_debugger`). That's why logging goes through plugin-log (see Logging in `architecture-guide.md`).
- **Every build writes `bundle-stats.html`** (gitignored) with `rollup-plugin-visualizer`, a treemap of the bundle with gzip and brotli sizes, and opens it in your browser (`open: true`).

## Rust build

The release profile in `src-tauri/Cargo.toml` favours a small binary over build speed: `opt-level = "s"`, LTO, one codegen unit, `panic = "abort"` and `strip`. That makes release builds slow, by design. With `panic = "abort"`, a panic in any command closes the app; nothing catches it.

CI's `build` job turns LTO off and raises codegen units to save time; `release.yml` keeps the full profile. See `releases.md`.

`removeUnusedCommands` in `tauri.conf.json` makes `tauri build` leave out plugin commands that no capability in `src-tauri/capabilities/` allows.

## Where to look

- **Bundle size:** `bundle-stats.html` after a build.
- **Re-renders:** the Zustand rules and React Compiler notes in `architecture-guide.md` cover most of it. Profile before adding manual memoisation.
