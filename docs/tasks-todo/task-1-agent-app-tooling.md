# Agent App Tooling

Give coding agents a way to see and drive the running dev app: screenshots in light and dark mode, programmatic control (open the test vault, open files, run commands, type, resize), searchable logs, and a styleguide page. Also give the dev build its own identity so it never shares state with the installed release.

Done before task 3, which uses the styleguide for before/after checks of the Base UI migration.

## Context

- **Assumption:** Danny is running `bun run tauri:dev`. Nothing here starts a build or a dev server.
- **The Bash sandbox rules out OS-level control.** Inside it, `screencapture` sees no displays, process listing is blocked and Swift scripts can't run. AppleScript and `open` are blocked too. Localhost networking works. So the app takes its own screenshots, and the agent talks to it over localhost.
- **Native webview snapshots need no permissions.** `WKWebView.takeSnapshot` needs no Screen Recording permission, doesn't take focus, and works when the window is behind others. The one limit is that see-through areas come out transparent rather than blurred. The title bar is drawn in the webview, so the only things missing are native menus, native dialogs and the vibrancy blur.
- **Off-the-shelf options were rejected:**
  - `tauri-plugin-mcp-bridge` (hypothesi) takes focus on every eval or keystroke, listens on 0.0.0.0 with no auth by default, has an open cross-site WebSocket hijacking issue, and requires `withGlobalTauri`.
  - WebdriverIO's embedded Tauri WebDriver plugin is a better base for a real E2E suite than for quick agent iteration.

  Both are useful references for the native WKWebView code (eval with a result, `takeSnapshot`). Check licences before copying anything.
- **Dev and prod share everything today.** Both use the identifier `is.danny.astroeditor`, so they share preferences, the project registry, logs and window state. The single-instance plugin's socket (`/tmp/<identifier>_si.sock`) collides too. Dev builds also send telemetry and check for updates.
- **The app already has the hooks the bridge needs:**
  - every command palette action has an id (`toggle-sidebar`, `open-collection-*`, …);
  - `projectStore.setProject(path)` opens a project without a dialog;
  - `src/lib/editor/editor-view-ref.ts` holds the CodeMirror view;
  - the theme is a class on `<html>`, set through `ThemeProvider`.

## Decisions

- **Our own small bridge**, compiled into debug builds only. The Rust side stays generic: eval, snapshot, window. App-specific actions live in a dev-only TypeScript API inside the webview.
- **A CLI, not MCP:** `bun run app <command>`. It works from Bash, Danny can run it himself, and it matches the `shoot` script on the website.
- **Prefer named actions over clicks.** `app run toggle-sidebar` over clicking a selector; clicking exists for when there's no action.
- **Output goes to `docs/tasks-todo/temporary/`**, which is gitignored, so Danny sees the same PNGs.
- **Dev identity:** identifier `is.danny.astroeditor.dev`, product name `Astro Editor Dev`.
- **The default test vault is `temp-dummy-astro-project`.** It can be overridden per command, and is recreated from `test/dummy-astro-project` when missing.

## Phase 1: Separate dev and prod

- [ ] `src-tauri/tauri.dev.conf.json` overlay:
  - `identifier: is.danny.astroeditor.dev`;
  - `productName: "Astro Editor Dev"`;
  - `plugins.updater.active: false`.

  Overlays are JSON Merge Patch and replace arrays whole, so don't touch `app.windows`. Leave the deep-link scheme alone: deep links never reach `tauri dev` on macOS.
- [ ] `tauri:dev` script → `tauri dev --config src-tauri/tauri.dev.conf.json`. Check that the macOS platform config still applies with the overlay (vibrancy, no decorations)
- [ ] In Rust, `#[cfg(debug_assertions)]`:
  - skip telemetry;
  - set the window title to `Astro Editor (Dev)`;
  - skip the 5-second update check on the frontend (`import.meta.env.DEV`).
- [ ] Verify what moved: app data, logs (`~/Library/Logs/is.danny.astroeditor.dev/`), window state and the single-instance socket. **Unverified:** whether WKWebView storage (localStorage: theme, panel sizes) follows the identifier for an unbundled dev binary. It's keyed by origin anyway (`localhost:1420` vs `tauri://localhost`), so it's already separate in practice
- [x] Copy Danny's prod `preferences/` (global settings, project registry, per-project settings) and `.window-state.json` into the dev folder. `telemetry.json` was not copied, and `crash-reports/` and `recovery/` only held `.DS_Store`
- [x] Sandbox access in `.claude/settings.json` (Danny adds this): read/write on the dev app data folder, read-only on prod
- [ ] Run prod and dev side by side and confirm they don't affect each other

## Phase 2: Bridge core

Rust: a module under `src-tauri/src/`, registered only under `#[cfg(debug_assertions)]`.

- [ ] An HTTP server on `127.0.0.1` on a free port (try 1422 first; Vite has 1420/1421) on a background thread. Use a small crate such as `tiny_http`, or tokio, which is already a dependency
- [ ] On startup, write `{ port, token }` to `agent-bridge.json` in the dev app data folder, and delete it on exit. Every request must send the token in a header, which stops browser pages from reaching the bridge
- [ ] Endpoints, kept generic:
  - `eval`: run a JS snippet and return its result, awaiting promises. Use WKWebView `callAsyncJavaScript` through `with_webview` + objc2. Check first whether Tauri 2.12 has a built-in eval-with-callback;
  - `snapshot`: `takeSnapshot` → PNG written to a path the CLI passes. The app writes it, so the sandbox doesn't matter. Wait for a presentation update first, because WebKit can return blank images otherwise;
  - `window`: get and set size, set native appearance (`set_theme`), and navigate (for the styleguide);
  - `health`.
- [ ] `scripts/app.ts` CLI skeleton:
  - finds and reads `agent-bridge.json`;
  - if the app isn't running, prints a clear error telling the user to start `bun run tauri:dev`;
  - compact text output by default, `--json` when useful;
  - `package.json` script `app`.
- [ ] `app eval '<js>'` and `app shot`
- [ ] Never take focus or raise the window. Confirm by driving the app while Danny types in another app

## Phase 3: App actions

A dev-only `window.__ae` API (e.g. `src/lib/agent-bridge/`), loaded from `main.tsx` only when `import.meta.env.DEV`. The CLI calls it through `eval`. The logic lives in TypeScript, so it can be unit tested.

- [ ] `app shot [name] [--theme light|dark|both] [--size WxH]`:
  - sets the app theme (expose the `ThemeProvider` setter) and the native appearance;
  - waits until the app is idle (no pending queries, two animation frames);
  - takes a snapshot per theme, then restores the previous theme and size.

  Output is `<name>-<theme>-<WxH>-<stamp>.png`, and all shots in a run share the timestamp. During the shot, put an opaque background behind the transparent areas (a temporary class on `<html>`) so PNGs don't come out see-through.
- [ ] `app open-project [path]`:
  - defaults to `temp-dummy-astro-project`;
  - copies it from `test/dummy-astro-project` if missing;
  - calls `setProject` and waits for collections to load.

  `app reset` recreates the vault, which is the same as `reset:testdata`.
- [ ] `app open <collection>/<file>` opens a file via the same path the file list uses
- [ ] `app run <command-id>` runs a command palette command by id. `app run --list` lists the ids available right now
- [ ] `app type "text"`: insert at the CodeMirror cursor through a transaction, so the normal update and auto-save paths run
- [ ] `app key mod+b`: a synthetic `keydown` on the focused element. react-hotkeys-hook and CodeMirror keymaps both accept these. Native menu accelerators don't, so use `app run`
- [ ] `app click <selector>` / `app click --text "…"` for when no named action exists
- [ ] `app resize WxH` (within the window's min size)
- [ ] `app state`: a compact summary of the stores (project, collection, current file, dirty flag, panel visibility, theme)
- [ ] `app tree`: a trimmed outline of the visible UI (landmarks, headings, buttons, inputs, list items with text) for finding things without a screenshot. Keep it short enough to read every time
- [ ] Unit tests for the `__ae` logic (key parsing, tree trimming, command lookup)

## Phase 4: Logs

All sources end up in the dev log folder, so one command searches everything.

- [ ] **Webview console:** in dev, forward `console.*` to `@tauri-apps/plugin-log` with a `[console]` marker. Nothing calls `attachConsole` today; if anything ever does, this would loop, so guard against it
- [ ] **Dev terminal:** `tauri:dev` also writes its output (Vite and cargo, including compile errors) to `tauri-dev.log` in the dev log folder, truncated each run. Keep colours in Danny's terminal (`CARGO_TERM_COLOR=always`, `FORCE_COLOR=1`) and strip them when reading. A small `scripts/tauri-dev.sh` is fine if the `package.json` one-liner gets unwieldy
- [ ] `app logs [--source rust|js|dev] [--level warn] [--since 5m] [--grep x] [--limit 50]`: compact lines with consecutive repeats collapsed. The default is recent warnings and errors from every source
- [ ] `app logs --crashes` lists recent Astro Editor reports in `~/Library/Logs/DiagnosticReports` and prints the relevant part of one. The app doesn't write to the macOS system log, so it's out of scope

## Phase 5: Styleguide

- [ ] `styleguide.html` + `src/styleguide/`, a second Vite entry. Vite only builds `index.html`, so it never ships; confirm with `bun run build`
- [ ] One scrollable page: every `src/components/ui/` component with its variants and states (disabled, invalid, checked, open). Each overlay is rendered open in its own fixed-height section, so they don't overlap
- [ ] The frontmatter field components with a seeded editor store, because task 3's Select and Checkbox changes land there
- [ ] `?theme=light|dark` overrides the colour scheme. Otherwise it follows `prefers-color-scheme`
- [ ] Any Tauri call that runs on render needs a stub. Keep that minimal; if a component needs much mocking, leave it out
- [ ] `bun run shoot`, ported from the website's `scripts/shoot.mjs`:
  - Playwright **WebKit**, which is closer to the app than Chromium;
  - full page, widths and themes as flags;
  - defaults to `/styleguide.html`;
  - add `playwright` as a devDependency and install WebKit.

  Test early whether Playwright can launch WebKit inside the sandbox. If it can't, fall back to `app goto /styleguide.html` plus `app shot`, and say so in the skill
- [ ] Take a baseline of the styleguide on Radix and keep it in `docs/tasks-todo/temporary/baseline/` for task 3. Add a step to task 3 that compares against it after each group

## Phase 6: Skill and docs

The sandbox blocks writes to `.claude/skills/`, so Danny approves or makes this one.

- [ ] `.claude/skills/app-control/SKILL.md`:
  - when to use it;
  - the commands;
  - the loop for visual work: change → HMR → `app shot` → read the PNG;
  - test vault conventions and `app reset`;
  - logs first when something breaks;
  - what can't be captured (native menus and dialogs, vibrancy blur);
  - always check light and dark.
- [ ] AGENTS.md: list the skill, and mention the dev identity and `bun run app` under development commands
- [ ] `docs/developer/`: a short note on the dev identity and the bridge, in the guide where it fits best. Task 4 does the full rewrite
- [ ] `bun run check:all`, then a release build to confirm the bridge and `__ae` aren't in it: no `agent-bridge` symbols or strings, and no `__ae` in `dist/`
