---
name: app-control
description: See and drive the running Astro Editor dev app with `bun run app`, using screenshots in light and dark mode, a UI outline, clicking, typing, commands, the test vault, the component styleguide and searchable logs. Use whenever a change affects the UI, when checking how something looks or behaves in the real app, when reproducing a bug, or when reading the app's logs.
---

# App control

`bun run app` drives the dev app that Danny keeps running with `bun run tauri:dev`. It talks to a debug-only bridge inside the app over localhost, so it works from the sandbox, doesn't need the app focused and never steals focus. Run `bun run --silent app help` for every command and flag (`--silent` drops bun's script echo).

**Never start the dev server.** If `app status` says the app isn't running, ask Danny to start `bun run tauri:dev`. After Rust changes, `tauri dev` rebuilds and restarts the app by itself; poll `app status` until it answers.

## The loop for UI work

1. Get the app into the right state: `app open-project`, `app open articles/first-post`, `app run toggle-sidebar`
2. Make the change. Vite hot-reloads the frontend
3. `app shot <name>` saves a PNG for each theme to `docs/tasks-todo/temporary/`. Read both images. Danny sees the same files
4. Check behaviour with `app state` and `app tree` rather than more screenshots where you can. Both are much cheaper to read

Always check light **and** dark (`shot` does both by default). Give shots descriptive names.

## Commands

| Command | What it does |
| --- | --- |
| `status` | App, version, window size and theme |
| `state` | Project, file, dirty flag, panels, modes, theme, editor selection, open dialogs and toasts |
| `tree` | Outline of the visible UI. Controls get `[n]` refs for `click @n` and `fill @n` |
| `shot [name]` | Light and dark PNGs. `--theme=light\|dark`, `--size=WxH` |
| `open-project [path]` | Defaults to the test vault |
| `reset` | Recreates the test vault and reloads the project |
| `open <file>` | Relative to the project or its `src/content`. The extension is optional |
| `run <id>` / `run --list` | Command palette commands. The most robust way to do things |
| `type <text>` / `key <combo>` | Type at the editor cursor; send `mod+b`, `escape`, `mod+shift+p` to the focused element |
| `click @n \| <selector> \| --text=…` / `fill <target> <value>` | When no command does the job |
| `resize WxH` | Logical pixels. The window's minimum is 1000x700 |
| `goto <path>` / `reload` | Load another dev-server page (`goto /` returns to the app); reload the page |
| `styleguide [section...]` | Shoot styleguide sections in both themes, then return to the app |
| `diff <a> <b>` | Pixel diff of two PNGs, or of two folders of shots matched by name. Writes diff images for pairs that differ |
| `logs` / `logs --crashes` | See below |
| `eval <js>` | Escape hatch: run JS in the page. `window.__agentBridge` holds the API the commands use |

## Test vault

`temp-dummy-astro-project` (gitignored, copied from `test/dummy-astro-project`) is yours to edit freely; `app reset` puts it back. Don't open or edit Danny's real projects unless he asks. The dev app has its own settings and data (`~/Library/Application Support/is.danny.astroeditor.dev`), separate from the installed app.

## Styleguide

`localhost:1420/styleguide.html` shows every UI component the app uses in each state, one section per page (`?section=<id>`), overlays rendered open. Use `app styleguide` (or `app styleguide select menus`) when changing shared components, and compare against earlier shots, such as the baseline in `docs/tasks-todo/temporary/baseline/` (if present), with `app diff docs/tasks-todo/temporary/baseline docs/tasks-todo/temporary`. It pairs each baseline shot with the newest shot of the same name, reports which are the same and boxes what changed (in image pixels, 2x on retina). Repeat shots of an unchanged page are pixel-identical, so any difference is real; look at the diff image (`docs/tasks-todo/temporary/diff/`) and the new shot to judge it. After `goto /styleguide.html?section=…`, `tree`, `click` and `key` work there too. Sections live in `src/styleguide/`; add to them when adding components.

## Logs

When something misbehaves, read the logs before guessing:

- `app logs` shows warnings and errors from the last 30 minutes, repeats collapsed
- `--source=rust|js|dev`: Rust, the webview (including `console.*`, marked `[console]`), or the `tauri:dev` terminal (Vite and cargo, including compile errors)
- `--level=debug`, `--since=2h`, `--grep=watcher`, `--limit=200`, `--full`
- `logs --crashes` summarises macOS crash reports

Reading logs doesn't need the app running.

## Limits and gotchas

- **Native UI can't be captured or driven:** menus, the file picker, and `ask()` confirmations (e.g. deleting from the file context menu). Native dialogs wait for Danny, so don't trigger them; use `run` or the store-level actions instead
- **Vibrancy isn't captured.** Snapshots show the webview, and the layout paints its own background, so this rarely matters
- **Synthetic input:** native menu accelerators (`Cmd+1` etc.) don't fire from `key`; use `run`. Events are untrusted, so anything checking `isTrusted` ignores them
- **After editing `src/lib/agent-bridge/`, run `app reload`.** The API object is created once per page load. Also reload if HMR hasn't picked up a change
- **The window may be hidden behind others.** That's fine: snapshots still render. It's why `idle` doesn't wait on animation frames, and why every command runs inside `withFrames` (Base UI popups wait on frames to open, take focus and unmount). Plain `eval` doesn't, so drive popups with `click` and `key` rather than dispatching events from `eval`, or wrap the snippet in `await window.__agentBridge.withFrames(async () => …)`. A popup that opened while the page loaded (the styleguide's open overlays) won't take focus until the window is visible

## How it works

- `src-tauri/src/agent_bridge/`: debug-only HTTP server on `127.0.0.1` with a per-run token in `agent-bridge.json` in the dev app data folder. Endpoints are eval, native WKWebView snapshot, and window size, appearance and navigation
- `src/lib/agent-bridge/`: the `window.__agentBridge` API. `page.ts` works on any page; `api.ts` adds the app actions
- `scripts/app.ts`, `scripts/app-logs.ts` and `scripts/app-diff.ts`: the CLI
