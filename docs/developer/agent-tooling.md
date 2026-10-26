# Agent Tooling

Dev builds include tooling that lets coding agents (and you) see and drive the running app from the terminal: screenshots, a UI outline, clicks and typing, a component styleguide and searchable logs. None of it ships in release builds. For day-to-day usage, see the `app-control` skill (`.claude/skills/app-control/SKILL.md`) or run `bun run app help`.

## Dev identity

`bun run tauri:dev` runs `scripts/tauri-dev.sh`, which applies `src-tauri/tauri.dev.conf.json`. That overlay gives dev builds their own identifier (`is.danny.astroeditor.dev`) and product name ("Astro Editor Dev"), so they get their own:

- app data and preferences: `~/Library/Application Support/is.danny.astroeditor.dev/`
- logs: `~/Library/Logs/is.danny.astroeditor.dev/`
- window state and single-instance socket

The installed app and the dev build can run side by side without touching each other's state. Config overlays are JSON Merge Patch, which replaces arrays whole, so keep window settings out of the overlay. Debug builds also skip telemetry and the automatic update check, and title the window "Astro Editor (Dev)".

## Agent bridge

Three parts, all debug-only:

- **`src-tauri/src/agent_bridge/`**: an HTTP server on `127.0.0.1` (port 1422, or a random one if that's taken) with endpoints for eval, snapshot, window (size, appearance and navigation) and health. On startup it writes `{ port, token, pid }` to `agent-bridge.json` in the app data folder, and removes it on exit. Requests must send the token in `x-agent-bridge-token`, which keeps web pages in a browser out.
  - **Eval:** wraps the snippet in an async function. `eval_with_callback` can't await, so the result is stored on `window.__agentBridgeResults` and polled for.
  - **Snapshots:** use `WKWebView.takeSnapshot`. It needs no Screen Recording permission, doesn't raise or focus the window, and works while the window is hidden. It captures the webview only, so native menus, dialogs and the vibrancy blur are missing.
- **`src/lib/agent-bridge/`**: the `window.__agentBridge` API the CLI calls through eval:
  - `page.ts` works on any page: theme, `idle`, shot mode, `tree`, `click`, `fill` and `key`;
  - `api.ts` adds the app's actions: open project or file, run commands, type, state;
  - `AgentBridge` (in `components/agent-bridge/`) installs it, and `Layout` renders that only when `import.meta.env.DEV`.
- **`scripts/app.ts`**: the `bun run app` CLI. `scripts/app-logs.ts` reads the logs, and `scripts/app-diff.ts` compares screenshots (pixelmatch).

To add an app action, add a method to `createAgentApi` (or `createPageApi` if it's useful on any page) and a CLI command that calls it with `ae('method', ...args)`. Prefer reusing app code (command palette commands, store actions, `openFileByPath`) over simulating clicks.

**Hidden windows:** when the dev window is behind other windows, WebKit stops `requestAnimationFrame`, throttles timers, and doesn't fire media-query changes or start transitions until it next renders. So `idle()` falls back to timeouts and finishes animations, and `shot` sets the page theme directly instead of relying on `prefers-color-scheme`.

## Styleguide

`styleguide.html` and `src/styleguide/` make up a second Vite entry. Vite only builds `index.html`, so it never ships. It shows every UI component the app uses, in each state. One section per page (`?section=<id>`) fits the dev window, so each can be screenshotted whole; overlays are rendered open on their own pages. `bun run app styleguide` shoots every section in both themes. It runs inside the dev app's webview, so Tauri calls work; it also opens in a browser at `localhost:1420/styleguide.html`.

When you add or change a shared component, add it to a section in `src/styleguide/sections.tsx`.

To check a change, shoot the sections before and after and compare them with `bun run app diff <before-dir> <after-dir>`. It matches shots by name (ignoring the timestamp), reports which are identical, and writes a diff image boxing what changed for the rest. Repeat snapshots of an unchanged page are pixel-identical, so it counts any changed pixel.

## Dev logs

Dev logs go to `~/Library/Logs/is.danny.astroeditor.dev/`:

- **`Astro Editor Dev.log`:** Rust `log` output and webview logging. In dev builds `console.*` is forwarded there too, marked `[console]` (`lib/agent-bridge/console.ts`). Dev builds allow it to grow to 10 MB instead of the plugin's default 40 KB
- **`tauri-dev.log`:** the `tauri:dev` terminal output (Vite and cargo), replaced on each run

`bun run app logs` searches both. See the skill for the flags.
