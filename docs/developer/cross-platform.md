# Cross-platform

macOS is the supported platform and the one Astro Editor is developed on. Windows and Linux builds ship but aren't officially supported (Linux is in beta). Each platform has its own title bar component in `src/components/layout/unified-title-bar/`, chosen by `usePlatform()`: macOS draws custom traffic lights, Windows draws its own caption buttons, and Linux keeps native decorations with our toolbar below them.

## Webview versions

Each platform renders with a different engine, so CSS features have to work in all three:

- **macOS:** WKWebView, which is the system WebKit and updates with Safari. Tailwind v4 needs Safari 16.4+ and the colour tokens use `light-dark()` (Safari 17.5+), so the app needs macOS 12 Monterey or later with current Safari updates. `minimumSystemVersion` in `tauri.conf.json` is set to match.
- **Windows:** WebView2, evergreen Chromium. Anything current works.
- **Linux:** the system WebKitGTK (`libwebkit2gtk-4.1`), or the copy the AppImage bundles from the ubuntu-22.04 build runner. The distros we target (Ubuntu 22.04 and 24.04, Debian 12) ship 2.50+ in their updates, which has `light-dark()`.

Checking something in Chrome DevTools proves nothing for macOS or Linux.

## Previewing other platforms

Set `DEBUG_PLATFORM_OVERRIDE` in `src/hooks/usePlatform.ts` to `'windows'` or `'linux'` to see that platform's title bar and strings on a Mac. It only applies to dev builds. Remember it still renders in WebKit, not WebView2.

## Tauri config

- **Platform configs are JSON Merge Patch, which replaces arrays whole.** `tauri.macos.conf.json`, `tauri.windows.conf.json` and `tauri.linux.conf.json` each carry a full `windows` entry, so a window setting changed only in `tauri.conf.json` silently does nothing on any platform. Change it in all four files. The same applies to the dev overlay (`tauri.dev.conf.json`), which is why it holds no window settings.
- **Only enable a config-driven feature that every platform's config needs, and put it on the base `tauri` dependency.** `tauri-build` compares the config-driven features (`protocol-asset`, `macos-private-api`, `isolation`) on the base `tauri` entry in `Cargo.toml` with what the merged config for the platform being built needs, and fails on a mismatch in either direction. It ignores target-specific `tauri` entries when a base one exists. So `assetProtocol` lives in `tauri.conf.json` and `protocol-asset` on the base dependency. #150 hit the other direction: `macos-private-api` on the base dependency broke Linux builds, whose config didn't enable it.

## macOS window lifecycle

Astro Editor behaves like a macOS document app: closing the window doesn't quit. The handlers are in `run()` in `src-tauri/src/lib.rs`.

- **Close hides the window.** `CloseRequested` (Cmd+W, the Close menu item) saves the window state and hides the main window instead of closing it. The custom traffic-light close button calls `hide()` directly. Cmd+Q and the Quit menu item still quit. On Windows and Linux, closing the window quits.
- **The dock icon reopens it.** `RunEvent::Reopen` shows the window when there are no visible windows, then calls `restore_state`. That has to come after `show()`: the window-state plugin only restores at startup, not after a hide and show.
- **Teardown belongs in `RunEvent::Exit`.** It fires before the process exits, unlike `ExitRequested`, which doesn't fire for Cmd+Q on macOS ([tauri#9198](https://github.com/tauri-apps/tauri/issues/9198)). Don't use `prevent_exit()`: with the window-state plugin it can cause an endless `windowDidMove` loop.

## Native menu and shortcuts

The native menu is built in `setup()` in `src-tauri/src/lib.rs` on every platform, but only macOS and Linux show it:

- **macOS:** the system menu bar.
- **Windows:** the menu exists but isn't drawn, because the window has `decorations: false`. The title bar's overflow menu (`WindowsMenu.tsx`) stands in for it, and the JS hotkeys and CodeMirror keymaps handle the keys. The native accelerators most likely never fire, because Tauri only checks them against key messages in the app's own message loop and WebView2's key presses don't pass through it. That's inferred from the code, but until muda 0.20, `Cmd+B` was registered on Windows as a bare B key and nobody saw "b" turn into Bold.
- **Linux:** a GTK menu bar below the native title bar.

**Accelerators use `CmdOrCtrl`, never `Cmd`, `Command`, `Super` or `Meta`.** Windows menus only support Ctrl, Alt and Shift. Since muda 0.20 (Tauri 2.12), any other modifier fails the menu build, and because that happens in `setup()`, the app panics before its window opens. That's what broke v1.0.18 to v1.0.20 on Windows (#351); older muda dropped the modifier without an error. A macOS-only shortcut goes behind `#[cfg(target_os = "macos")]`, like Enter Full Screen's Ctrl+Cmd+F. On Windows and Linux, F11 toggles full screen through a JS hotkey in `useKeyboardShortcuts` instead.

A bad accelerator compiles on every platform, and the macOS and Linux menus accept it, so only running the app on Windows catches it. CI's build job does that as a smoke test (see `releases.md`).

## Gotchas

- **The title bar toolbar needs `transform-gpu` to fade.** Without it, WebKit leaves the children of `TitleBarToolbar` out of its opacity transition when the distraction-free bars hide, so they stay visible and then vanish at once. Putting the container on its own compositing layer fixes it.
- **The webview log target is off on Linux.** It deadlocks inside `setup()` on WebKitGTK, so the window never appears (#150). Rust logs still reach stdout and the log file; they just don't show in the webview console.
