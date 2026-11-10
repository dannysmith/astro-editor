# Window size across displays

## Status

Done. `tauri-plugin-window-state` is replaced by `window_state.rs`, which keeps size in points. Checked in the dev app on one display; the two-display check is in task 8's prerelease testing, since storing points removes the conversion that doubled the size.

## Problem

With a Retina screen and a 1x external display, the window can open twice the size it was closed at, and keep doubling. The dev app reached 2978×1784 points, with 5956×3568 saved, double a near-full-width laptop window.

`tauri-plugin-window-state` (2.5.0) saves the window's size and position in physical pixels and restores them as physical pixels (`restore_state` in the plugin's `lib.rs`). Turning those back into points uses the scale of whichever display the window is on when they're applied. If that's the 1x display, a size saved on the Retina screen comes back doubled. tao's macOS position handling across mixed scales is unreliable too (tao#816). The plugin's 2.2.2 fixed a similar bug; this one remains.

Our own code makes it more likely: `RunEvent::Reopen` (`lib.rs`) calls `restore_state` again after the window was hidden, though hiding never changes its size. `tauri dev` restarts the app on every Rust change, so the dev app hits this far more often than the installed one, but both can.

Not reproduced; the diagnosis is from the saved file and the code.

The timing matches the Tauri 2.12 upgrade (3 October), which took tao from 0.35 to 0.37 and moved its macOS code to objc2; the plugin's 2.4.1 to 2.5.0 change was only refactoring. Whatever tao changed, keeping a size in pixels is the weak point.

## Work

- [x] Replace `tauri-plugin-window-state` with `window_state.rs`: size in points everywhere, position in points on macOS and pixels on Windows and Linux (their shared coordinate spaces), plus maximised and full screen. Saved on close and on exit, kept up to date as the window moves and resizes.
- [x] Stop restoring on Dock reopen.
- [x] Skip a saved position that's on no connected display, so the window stays centred on the main one.
- [x] Check in the dev app: a resize saves points and comes back after a restart.
- [x] Two-display check: moved to task 8's prerelease testing.
