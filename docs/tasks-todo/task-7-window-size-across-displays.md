# Window size across displays

## Problem

With a Retina screen and a 1x external display, the window can open twice the size it was closed at, and keep doubling. The dev app reached 2978×1784 points, with 5956×3568 saved, double a near-full-width laptop window.

`tauri-plugin-window-state` (2.5.0) saves the window's size and position in physical pixels and restores them as physical pixels (`restore_state` in the plugin's `lib.rs`). Turning those back into points uses the scale of whichever display the window is on when they're applied. If that's the 1x display, a size saved on the Retina screen comes back doubled. tao's macOS position handling across mixed scales is unreliable too (tao#816). The plugin's 2.2.2 fixed a similar bug; this one remains.

Our own code makes it more likely: `RunEvent::Reopen` (`lib.rs`) calls `restore_state` again after the window was hidden, though hiding never changes its size. `tauri dev` restarts the app on every Rust change, so the dev app hits this far more often than the installed one, but both can.

Not reproduced yet; the diagnosis is from the saved file and the code.

## Work

- [ ] Reproduce: move the window between the two displays and restart, and Dock-reopen after closing.
- [ ] Save and restore size and position in points, not pixels: keep the plugin for the other flags, or replace it with a few lines in `lib.rs`.
- [ ] Stop restoring on Dock reopen.
- [ ] Check a window saved on a display that's since been unplugged opens on the main one.
