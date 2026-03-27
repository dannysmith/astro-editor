# Fix macOS Window Lifecycle & Crash Resilience

## Background

Closing Astro Editor's main window kills the entire process, making it impossible to reopen via the dock icon. This is incorrect macOS behavior for a document editor -- the expected pattern is that closing the window hides it while the app stays running, and clicking the dock icon reopens it. Additionally, the file watcher has no resilience to process suspension (App Nap, system sleep), which can silently break file change detection.

## Phased Approach

### Phase 1: Fix macOS window close behavior — DONE

**Goal:** Closing the main window hides it instead of quitting. Dock icon click reopens it. Cmd+Q and Quit menu item still quit properly.

**Changes in `src-tauri/src/lib.rs`:**

1. **Intercept `CloseRequested` for the main window on macOS:**
   - Call `api.prevent_close()` so the window isn't destroyed
   - Call `window.hide()` on the main window
   - Call `save_window_state()` to persist position/size before hiding

2. **Add `RunEvent::Reopen` handler:**
   - When the dock icon is clicked and there are no visible windows, show the main window
   - Explicitly call `window.restore_state(StateFlags::all())` after showing -- the plugin only auto-restores on app startup, not after a hide/show cycle
   - Focus the window after restoring

3. **Move cleanup to `RunEvent::Exit`:**
   - Any teardown logic should run in `RunEvent::Exit` instead of on window close
   - `RunEvent::Exit` fires reliably before the process exits, unlike `RunEvent::ExitRequested` which doesn't fire for Cmd+Q on macOS (tauri-apps/tauri#9198)
   - Do NOT use `prevent_exit()` anywhere -- avoids the infinite `windowDidMove` loop issue with `tauri_plugin_window_state` (tauri-apps/tauri discussions#11489)

4. **Non-macOS behavior unchanged:** On other platforms, closing the main window still quits the app.

**Expected behavior:**

| Action | Result |
|--------|--------|
| Red X (close button) | Main window hides. App stays running in dock. |
| Dock icon click (window hidden) | Main window shows at saved position. |
| Cmd+H | macOS hides entire app (system-level). Standard behavior. |
| Dock icon click (after Cmd+H) | macOS unhides the app. Main window reappears. |
| Cmd+Q / menu Quit | Cleanup runs via `RunEvent::Exit`, then app exits. |

**Key references:**
- tauri-apps/tauri#3084 -- `RunEvent::Reopen` feature
- tauri-apps/tauri#9198 -- `ExitRequested` unreliable on macOS
- tauri-apps/tauri#13511 -- `prevent_exit()` blocks normal termination
- tauri-apps/tauri discussions#11489 -- `window-state` + `prevent_exit()` infinite loop

### Phase 2: File watcher error recovery & periodic rescan — DONE

**Goal:** The file watcher recovers from crashes and a periodic rescan catches missed changes.

**Changes in `src-tauri/src/commands/watcher.rs`:**

- Add error handling in the watcher callback -- detect when the watcher has died and trigger a rebuild (drop old watcher, full rescan, create new watcher)
- Handle the `Rescan` event kind from notify (maps to `kFSEventStreamEventFlagMustScanSubDirs`) -- trigger a full directory scan when this fires, as it means events were coalesced or dropped
- Add a periodic rescan timer (e.g. every 5 minutes) as a safety net -- compare file mtimes against last known state to detect missed changes
- Emit a frontend event when the watcher is rebuilt so the UI can refresh its queries

**Why this matters:** When macOS suspends the process (App Nap, system sleep), FSEvents queue up. On resume they arrive all at once, possibly coalesced. If the watcher thread panics, file changes stop being detected with no recovery path.

### Phase 3: Upgrade notify crate — DONE

**Goal:** Pick up FSEvents crash fixes.

- Evaluate upgrading `notify` from v8 to v9 when stable
- Key fixes in notify 9.0.0-rc: preventing panics in the FSEvents callback, fixing stream start errors, fixing empty path crashes
- Test thoroughly after upgrade -- may have breaking API changes

**References:**
- notify-rs/notify CHANGELOG
- notify-rs/notify#283 (watcher panic on suspend/resume)

### Phase 4: App Nap and sleep/wake handling — DEFERRED

**Goal:** Prevent aggressive App Nap suspension and rebuild the watcher after system sleep.

This phase may not be necessary if Phases 1-3 resolve the issues. Evaluate after those are done.

- **App Nap prevention:** Use `NSProcessInfo.beginActivityWithOptions:reason:` to prevent macOS from aggressively suspending while the file watcher is active
- **Sleep/wake detection:** Listen for `NSWorkspaceDidWakeNotification` and rebuild the file watcher on wake
- Both require `objc2` crate calls from Rust
