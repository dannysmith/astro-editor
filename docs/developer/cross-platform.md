# Cross-Platform

Astro Editor runs on macOS, Windows and Linux. macOS is the main platform, and the one it's developed on. Each platform has its own title bar component in `src/components/layout/unified-title-bar/`, chosen by `usePlatform()`: macOS draws custom traffic lights, Windows draws its own caption buttons, and Linux keeps native decorations with our toolbar below them.

## Webview Versions

Each platform renders with a different engine, so CSS features have to work in all three:

- **macOS:** WKWebView, which is the system WebKit and updates with Safari. Tailwind v4 needs Safari 16.4+ and the colour tokens use `light-dark()` (Safari 17.5+), so the app needs macOS 12 Monterey or later with current Safari updates. `minimumSystemVersion` in `tauri.conf.json` is set to match.
- **Windows:** WebView2, evergreen Chromium. Anything current works.
- **Linux:** the system WebKitGTK (`libwebkit2gtk-4.1`), or the copy the AppImage bundles from the ubuntu-22.04 build runner. Supported distros ship 2.50+ in their updates (Ubuntu 22.04 and 24.04, Debian 12), which has `light-dark()`.

Checking something in Chrome DevTools proves nothing for macOS or Linux.

## Previewing Other Platforms

Set `DEBUG_PLATFORM_OVERRIDE` in `src/hooks/usePlatform.ts` to `'windows'` or `'linux'` to see that platform's title bar and strings on a Mac. It only applies to dev builds. Remember it still renders in WebKit, not WebView2.

## Tauri Config

- **Platform configs are JSON Merge Patch, which replaces arrays whole.** `tauri.macos.conf.json`, `tauri.windows.conf.json` and `tauri.linux.conf.json` each carry a full `windows` entry, so a window setting changed only in `tauri.conf.json` silently does nothing on any platform. Change it in all four files. The same applies to the dev overlay (`tauri.dev.conf.json`), which is why it holds no window settings.
- **Features the config needs go on the base `tauri` dependency, and only config shared by every platform may need one.** `tauri-build` compares the config-driven features (`protocol-asset`, `macos-private-api`, `isolation`) on the base `tauri` entry in `Cargo.toml` with what the merged config for the platform being built needs, and fails on a mismatch in either direction. It ignores target-specific `tauri` entries when a base one exists. So `assetProtocol` lives in `tauri.conf.json` and `protocol-asset` on the base dependency. #150 hit the other direction: `macos-private-api` on the base dependency broke Linux builds, whose config didn't enable it.

## macOS Window Lifecycle

Astro Editor behaves like a macOS document app: closing the window doesn't quit. The handlers are in `run()` in `src-tauri/src/lib.rs`.

- **Close hides the window.** `CloseRequested` (Cmd+W, the Close menu item) saves the window state and hides the main window instead of closing it. The custom traffic-light close button calls `hide()` directly. Cmd+Q and the Quit menu item still quit. On Windows and Linux, closing the window quits.
- **The dock icon reopens it.** `RunEvent::Reopen` shows the window when there are no visible windows, then calls `restore_state`. That has to come after `show()`: the window-state plugin only restores at startup, not after a hide and show.
- **Teardown belongs in `RunEvent::Exit`.** It fires before the process exits, unlike `ExitRequested`, which doesn't fire for Cmd+Q on macOS (tauri#9198). Don't use `prevent_exit()`: with the window-state plugin it can cause an endless `windowDidMove` loop.

## Gotchas

- **The title bar toolbar needs `transform-gpu` to fade.** In WebKit, the children of `TitleBarToolbar` didn't take part in its opacity transition when the distraction-free bars hide, so they stayed visible and then vanished at once. Putting the container on its own compositing layer fixes it.
- **The Webview log target is off on Linux.** It deadlocks inside `setup()` on WebKitGTK, so the window never appears (#150). Rust logs still reach stdout and the log file; they just don't show in the webview console.
