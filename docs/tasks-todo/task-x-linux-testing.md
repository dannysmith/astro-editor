# Task: Linux Testing & Refinement (Part C)

**Issue:** https://github.com/dannysmith/astro-editor/issues/56

## Overview

This task covers Linux-specific testing and refinement that **requires a Linux environment**. It should be done after Part A (Cross-Platform Preparation) is complete and merged to main.

**Prerequisites:**
- Part A completed and merged
- CI producing Linux AppImage artifacts
- Linux test environment available

**Scope:**
- AppImage via CI (works across most distros)
- No DEB/RPM/Flatpak/Snap packages initially
- Native window decorations (not custom title bar)

---

## Testing Environment Setup

Options include:

- Linux VM (Ubuntu 22.04 recommended for webkit2gtk compatibility)
- Physical Linux machine
- WSL2 with GUI support (limited)
- GitHub Actions for automated testing

**Recommended Desktop Environments to Test:**
- GNOME (most common)
- KDE Plasma (second most common)

---

## Tasks

### 1. Native Decorations Verification

Verify the toolbar-below-native-decorations approach works.

**Tasks:**
- [ ] Confirm native title bar renders correctly
- [ ] Verify `UnifiedTitleBarLinux.tsx` toolbar appears below decorations
- [ ] Test on GNOME desktop
- [ ] Test on KDE Plasma (if possible)
- [ ] Verify no duplicate window controls appear
- [ ] Adjust toolbar styling if needed

---

### 2. IDE Path Detection Verification

IDE paths for Linux were added in Part A. Verify they work correctly.

**Tasks:**
- [ ] Test that VS Code is detected correctly (system, snap, flatpak installs)
- [ ] Refine paths in `get_augmented_path()` in `ide.rs` if needed

---

### 3. Webkit Rendering Verification

Verify webkit2gtk renders the app correctly.

**Tasks:**
- [ ] Verify webkit2gtk-4.1 renders correctly
- [ ] Test CodeMirror editor functionality
- [ ] Check syntax highlighting works
- [ ] Verify fonts render correctly
- [ ] Check for any CSS/layout differences from macOS/Windows
- [ ] Test scrolling performance

---

### 4. General Testing Checklist

Run through complete application testing on Linux.

**Core Functionality:**
- [ ] Open existing Astro project
- [ ] Navigate file tree
- [ ] Open and edit markdown files
- [ ] Edit frontmatter fields
- [ ] Auto-save triggers correctly
- [ ] Manual save works (Ctrl+S)
- [ ] Create new files
- [ ] Delete files
- [ ] Rename files

**UI/UX:**
- [ ] Dark mode toggle works
- [ ] Keyboard shortcuts work (Ctrl-based)
- [ ] Context menus appear correctly
- [ ] "Show in File Manager" opens correct folder
- [ ] Preferences dialog opens and saves
- [ ] Command palette works (Ctrl+K)

**Editor:**
- [ ] CodeMirror renders correctly
- [ ] Syntax highlighting works
- [ ] Drag and drop files into editor

**Window Management:**
- [ ] Window resizing works
- [ ] Minimum size constraints enforced (1000×700)
- [ ] Panel resizing works
- [ ] Window opens at correct size (1400×900)

**AppImage:**
- [ ] AppImage runs without installation
- [ ] App launches correctly
- [ ] Auto-updater can check for updates

---

### 5. Platform-Specific Bug Fixes

Document and fix any Linux-specific bugs discovered during testing.

**Known Areas to Watch:**
- Webkit rendering differences from other platforms
- File manager integration (`xdg-open`)
- Font availability and rendering
- Desktop environment-specific quirks
- Permissions and sandbox issues with AppImage

---

## Definition of Done

- [ ] App runs on Ubuntu 22.04+ with GNOME
- [ ] Native decorations work correctly
- [ ] Toolbar renders below native title bar
- [ ] IDE detection finds installed IDEs
- [ ] Core functionality works
- [ ] No critical bugs blocking Linux release
- [ ] AppImage tested and working

---

## Related Tasks

- **Part A:** Cross-Platform Preparation (completed) - see `tasks-done/task-2025-12-15-windows-support.md`
- **Part B:** [Windows Testing](task-x-windows-testing.md) - Can be done in parallel

## References

- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri Linux Prerequisites](https://v2.tauri.app/start/prerequisites/#linux)
- [GitHub Issue #56](https://github.com/dannysmith/astro-editor/issues/56)
