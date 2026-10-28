# Agent tooling

Dev builds include tooling that lets coding agents (and you) see and drive the running app from the terminal: screenshots, a UI outline, clicks and typing, a component styleguide and searchable logs. None of it ships in release builds. For day-to-day usage, see the `app-control` skill (`.claude/skills/app-control/SKILL.md`) or run `bun run app help`.

## Dev identity

`bun run tauri:dev` runs `scripts/tauri-dev.sh`, which applies `src-tauri/tauri.dev.conf.json`. That overlay gives dev builds their own identifier (`is.danny.astroeditor.dev`) and product name ("Astro Editor Dev"), so they get their own:

- app data and preferences: `~/Library/Application Support/is.danny.astroeditor.dev/`
- logs: `~/Library/Logs/is.danny.astroeditor.dev/`
- window state and single-instance socket

The installed app and the dev build can run side by side without touching each other's state. Keep window settings out of the overlay (see Tauri config in `cross-platform.md`).

The identity comes from the overlay; the agent bridge, telemetry skip and window title depend on it being a debug build. `tauri:dev` gives you both. Debug builds skip telemetry and the automatic update check, and title the window "Astro Editor (Dev)".

## Agent bridge

Three parts, all debug-only:

- **`src-tauri/src/agent_bridge/`**: an HTTP server on `127.0.0.1` (port 1422, or a random one if that's taken) with endpoints for eval, snapshot, window (size, appearance and navigation) and health. On startup it writes `{ port, token, pid }` to `agent-bridge.json` in the app data folder, and removes it on exit. Requests must send the token in `x-agent-bridge-token`, so a web page open in a browser can't call it.
  - **Eval:** wraps the snippet in an async function. `eval_with_callback` can't await, so the result is stored on `window.__agentBridgeResults` and polled for.
  - **Snapshots:** use `WKWebView.takeSnapshot`. It needs no Screen Recording permission, doesn't raise or focus the window, and works while the window is hidden. It captures the webview only, so native menus, dialogs and the vibrancy blur are missing. macOS only; elsewhere the endpoint returns an error.
- **`src/lib/agent-bridge/`**: the `window.__agentBridge` API the CLI calls through eval:
  - `page.ts` works on any page: theme, `idle`, shot mode (transitions and caret off while screenshotting), `tree`, `click`, `fill` and `key`;
  - `api.ts` adds the app's actions: open project or file, run commands, type, state;
  - `AgentBridge` (in `components/agent-bridge/`) installs it, and `Layout` renders that only when `import.meta.env.DEV`.
- **`scripts/app.ts`**: the `bun run app` CLI. `scripts/app-logs.ts` reads the logs, and `scripts/app-diff.ts` compares screenshots (pixelmatch).

To add an app action, add a method to `createAgentApi` (or `createPageApi` if it's useful on any page) and a CLI command that calls it with the `ae()` helper in `scripts/app.ts`. Prefer reusing app code (command palette commands, store actions, `openFileByPath`) over simulating clicks.

**Hidden windows:** when the dev window is behind other windows, WebKit stops `requestAnimationFrame`, throttles timers, and doesn't fire media-query changes or start transitions until it next renders. The bridge works around it:

- `idle()` falls back to timeouts and finishes animations, and `shot` sets the page theme directly instead of relying on `prefers-color-scheme`.
- Base UI waits for an animation frame before opening a popup from a click, moving focus into it and unmounting it after it closes, so the CLI runs every API call inside `withFrames()`: during the call, frame requests also fire from a short timeout. Outside bridge calls nothing changes.
- `tree`, `click` and `fill` wait for idle first, because an overlay that has just opened sits at opacity 0 until its animation is finished.

## Styleguide

`styleguide.html` and `src/styleguide/` make up a second Vite entry. Vite only builds `index.html`, so it never ships. It shows every UI component the app uses, in each state. One section per page (`?section=<id>`) fits the dev window, so each can be screenshotted whole; overlays are rendered open on their own pages. `bun run app styleguide` shoots every section in both themes. The styleguide runs inside the dev app's webview, so Tauri calls work; it also opens in a browser at `localhost:1420/styleguide.html`.

When you add or change a shared component, add it to a section in `src/styleguide/sections.tsx`.

To check a change, shoot the sections before and after and compare them with `bun run app diff <before-dir> <after-dir>`. It matches shots by name (ignoring the timestamp), reports which are identical, and writes a diff image boxing what changed for the rest. Repeat snapshots of an unchanged page are pixel-identical, so it counts any changed pixel.

## Logs

Rust's `log` macros and the frontend's `@tauri-apps/plugin-log` calls both go through the log plugin, configured in `run()` in `src-tauri/src/lib.rs`. It writes to stdout, the log file and (except on Linux) the webview console. How to log from code is in `architecture-guide.md`.

### Release logs

The installed app writes `Astro Editor.log` to:

- **macOS:** `~/Library/Logs/is.danny.astroeditor/`
- **Windows:** `%LOCALAPPDATA%\is.danny.astroeditor\logs\`
- **Linux:** `~/.local/share/is.danny.astroeditor/logs/`

When the file reaches 5 MB it's renamed with its date and a new one starts; the two most recent old files are kept. The plugin's default (40 KB, then delete the file) would leave a support log nearly empty.

Messages are prefixed `Astro Editor [TAG]` where an area has a tag, so a log can be searched by area. The common ones are `[PROJECT_SETUP]`, `[PROJECT_SCAN]`, `[PROJECT_DISCOVERY]`, `[PROJECT_REGISTRY]`, `[PREFERENCES]`, `[MIGRATION]`, `[FILE_COLLECTION]`, `[SCHEMA_MERGER]`, `[JSON_SCHEMA]` and `[WATCHER]`, plus `[JS_ERROR]` and `[PROMISE_REJECTION]` for uncaught frontend errors. Reuse an existing tag before adding one.

What to ask users for when they report a problem is on the website's troubleshooting page (`website/src/content/docs/reference/troubleshooting.mdx`); keep its paths and tags in step with this section.

### Dev logs

Dev logs go to `~/Library/Logs/is.danny.astroeditor.dev/`:

- **`Astro Editor Dev.log`:** Rust `log` output and webview logging. In dev builds `console.*` is forwarded there too, marked `[console]` (`lib/agent-bridge/console.ts`). It rotates like the release log.
- **`tauri-dev.log`:** the `tauri:dev` terminal output (Vite and cargo), replaced on each run

`bun run app logs` searches both. See the skill for the flags.
