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

- [x] `src-tauri/tauri.dev.conf.json` overlay:
  - `identifier: is.danny.astroeditor.dev`;
  - `productName: "Astro Editor Dev"`.

  Overlays are JSON Merge Patch and replace arrays whole, so don't touch `app.windows`. Leave the deep-link scheme alone: deep links never reach `tauri dev` on macOS.
- [x] `tauri:dev` script → `tauri dev --config src-tauri/tauri.dev.conf.json`. Check that the macOS platform config still applies with the overlay (vibrancy, no decorations)
- [x] Debug builds:
  - skip telemetry (Rust);
  - set the window title to `Astro Editor (Dev)` (Rust);
  - skip the 5-second update check (frontend, `import.meta.env.DEV`).

  The updater plugin has no `active` option in v2 (the `"active": true` in `tauri.conf.json` is ignored), so the overlay can't turn it off. The manual menu check still works in dev.
- [x] Verify what moved: app data, logs (`~/Library/Logs/is.danny.astroeditor.dev/Astro Editor Dev.log`), window state and the single-instance socket (`/tmp/is_danny_astroeditor_dev_si.sock`). WKWebView storage (localStorage: theme, panel sizes) is keyed by origin (`localhost:1420` vs `tauri://localhost`), so it's separate either way
- [x] Copy Danny's prod `preferences/` (global settings, project registry, per-project settings) and `.window-state.json` into the dev folder. `telemetry.json` was not copied, and `crash-reports/` and `recovery/` only held `.DS_Store`
- [x] Sandbox access in `.claude/settings.json` (Danny adds this): read/write on the dev app data folder, read-only on prod
- [x] Run prod and dev side by side and confirm they don't affect each other

## Phase 2: Bridge core

Rust: `src-tauri/src/agent_bridge/`, compiled only under `#[cfg(debug_assertions)]`. CLI: `scripts/app.ts`.

- [x] An HTTP server (`tiny_http`, plus three small dependencies) on `127.0.0.1:1422`, falling back to a random port, on a background thread
- [x] On startup, write `{ port, token, pid }` to `agent-bridge.json` in the dev app data folder, and delete it on exit. Every request must send the token in the `x-agent-bridge-token` header, which stops browser pages from reaching the bridge
- [x] Endpoints, kept generic:
  - `POST /eval`: runs a snippet as the body of an async function and returns its JSON result. Tauri 2.12's `eval_with_callback` can't await, so the snippet's result is stored on `window.__agentBridge` and polled for every 10ms. No objc2 needed;
  - `POST /snapshot`: `takeSnapshot` via `with_webview` + objc2 → PNG at the path the CLI passes. The app writes it, so the sandbox doesn't matter. Output is at backing scale (2x on retina);
  - `GET/POST /window`: logical size, scale, and native appearance (`light` / `dark` / `system`). Setting the appearance also flips `prefers-color-scheme` in the webview. Navigation goes through `eval` (`location.href = …`);
  - `GET /health`.
- [x] `scripts/app.ts` CLI (`bun run app`, or `bun run --silent app` to drop bun's script echo):
  - finds `agent-bridge.json` using the identifier from `tauri.dev.conf.json`;
  - tells the user to start `bun run tauri:dev` when the file is missing or the bridge doesn't answer;
  - prints strings raw and everything else as JSON.
- [x] `app status`, `app eval '<js>'` (an expression, or a function body if it contains `return`; `--timeout=<ms>`), `app shot [name]` and `app resize WxH`
- [x] Release builds: `cargo clippy --release` is clean, so nothing references the bridge outside debug builds
- [x] Never take focus or raise the window. Danny confirmed the dev window stayed put while the bridge was driven (eval, snapshot, resize, theme)

## Phase 3: App actions

A dev-only `window.__ae` API (`src/lib/agent-bridge/api.ts`), installed by the `AgentBridge` component, which `Layout` renders only when `import.meta.env.DEV`. It reuses `useCommandContext()`, `useTheme()` and `openFileByPath`. The CLI calls it through `eval`. The production bundle has no trace of it (checked with `bun run build`).

- [x] `app shot [name] [--theme=light|dark|both] [--size=WxH]`, both themes by default:
  - turns transitions off (`shotMode`);
  - sets the native appearance **and** the app theme explicitly;
  - waits for idle;
  - snapshots;
  - restores the theme, appearance and size.

  Output is `<name>-<theme>-<WxH>-<stamp>.png`, and all shots in a run share the timestamp. No opaque backing is needed: the layout root paints its own background. A `--1x` flag was considered and skipped
- [x] `app open-project [path]`: defaults to `temp-dummy-astro-project` and copies it from `test/dummy-astro-project` (without `node_modules` / `dist`) if missing. It waits for the project registry to initialise (right after a page load it may not be), then for collections. `app reset` recreates the vault and, if it's open, closes the file, restarts the watcher and refetches everything (`refreshProject`)
- [x] `app open <file>`: absolute, or relative to the project or its `src/content`, with an optional extension. Reuses `openFileByPath` (the deep-link handler), whose window-focusing moved into `useDeepLink` so the bridge doesn't steal focus
- [x] `app run <command-id>` runs a command palette command by id. `app run --list` lists the ids available right now
- [x] `app type "text"`: inserts at the CodeMirror cursor through a transaction, so the normal update and auto-save paths run
- [x] `app key mod+b`: synthetic `keydown`/`keyup` on the focused element, reporting whether it was handled. react-hotkeys-hook and CodeMirror keymaps both accept these. Native menu accelerators don't, so use `app run`
- [x] `app click @ref | <selector> | --text=…`: the pointer and mouse event sequence of a real click. `app fill <target> <value>` sets inputs through React's value setter
- [x] `app state`: project, collection, file, dirty flag, panels, modes, theme, editor (lines, selection, focus), open dialogs, toasts, viewport
- [x] `app tree`: an outline of the visible UI with numbered refs. Screen-reader-only text and empty containers are left out, and CodeMirror is summarised
- [x] `app reload`: reloads the webview and waits for the API. Needed after changing `lib/agent-bridge` (the API object is created once) and when HMR doesn't re-mount something
- [x] Unit tests for key parsing and the UI tree
- [x] **Hidden windows:** when the dev window is covered by other windows, WebKit stops `requestAnimationFrame`, throttles timers, and doesn't fire media-query changes or start transitions until it next renders. Snapshots still show fresh content (taking one forces a render). So `idle()` doesn't wait on frames (it falls back to 50ms), forces a style recalc and finishes animations; `shot` sets the app theme directly
- [x] **Found along the way:** stopping or replacing a project's file watcher brought it back, and a page reload set two watchers on the same project replacing each other forever. Fixed separately (watcher generations)
- [ ] **Noted, not fixed:** frontmatter field labels aren't associated with their inputs, so `tree` shows placeholders instead of field names (and the Draft switch has no name). It's an accessibility gap worth fixing with the form work

## Phase 4: Logs

All sources end up in the dev log folder (`~/Library/Logs/is.danny.astroeditor.dev/`), so one command searches everything. Reading logs doesn't need the app running.

- [x] Log levels on the `tauri-plugin-log` builder, for both builds: Debug overall, Info for `tao` and `wry` (which logged every window focus change at trace level). Nothing of ours logs at trace, so prod logs are unchanged. Dev builds raise the file limit from 40 KB to 10 MB: with the default `KeepOne` rotation, the dev log was being deleted every few minutes
- [x] **Webview console:** in dev, `main.tsx` forwards `console.*` to plugin-log with a `[console]` marker (`lib/agent-bridge/console.ts`). Messages that already carry the marker are skipped, so nothing that echoes logs back to the console can loop
- [x] **Dev terminal:** `tauri:dev` runs `scripts/tauri-dev.sh`, which on macOS tees the output (Vite, cargo, app stdout) to `tauri-dev.log`, replaced each run, with colours forced on for the terminal. Other platforms run plain `tauri dev`
- [x] Danny restarted `bun run tauri:dev` with the new script: colours still show in the terminal, and `app logs --source=dev` reads the run
- [x] `app logs [--source=rust|js|dev] [--level=warn] [--since=30m] [--grep=x] [--limit=50] [--full]` (`scripts/app-logs.ts`):
  - consecutive repeats are collapsed;
  - multi-line messages are trimmed unless `--full`;
  - dev-terminal lines are classed by keyword, keep cargo's indented and `10 |` lines with the error, and skip the plugin-log lines the app also prints to stdout.
- [x] `app logs --crashes` lists recent reports in `~/Library/Logs/DiagnosticReports` and summarises the newest: exception, termination reason and the crashed thread's frames. Tested against a synthetic `.ips`, since there are no real ones. The app doesn't write to the macOS system log, so that's out of scope
- [x] Every project scan logged an ERROR and a WARN for the `schemaless` test collection. A collection without a schema is supported, so it's now a single debug line; other schema failures still warn

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
