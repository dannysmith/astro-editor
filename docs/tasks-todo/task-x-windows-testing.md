# Task: Windows Testing & Refinement (Part B)

**Issue:** https://github.com/dannysmith/astro-editor/issues/56

## Overview

This task covers Windows-specific testing and refinement that **requires a Windows environment**. It should be done after Part A (Cross-Platform Preparation) is complete and merged to main.

**Prerequisites:**
- Part A completed and merged
- CI producing Windows MSI artifacts
- Windows test environment available

**Scope:**
- No Windows code signing (can add later if users request it)
- No in-window menu bars - all functionality accessible via keyboard shortcuts, command palette, and buttons

---

## Testing Environment Setup

Options include:

- Windows VM (Parallels, UTM, or VirtualBox)
- Physical Windows machine
- GitHub Actions for automated testing (limited for UI testing)

**Recommended:** Set up a Windows VM that can run the built MSI installer and allow interactive testing.

---

## Tasks

### 1. IDE Path Detection Verification

IDE paths for Windows were added in Part A. Verify they work correctly.

**Tasks:**
- [ ] Test that VS Code is detected correctly (system and user installs)
- [ ] Test that Cursor is detected correctly
- [ ] Refine paths in `get_augmented_path()` in `ide.rs` if needed

---

### 2. Path Handling Verification

Verify all path operations work correctly with Windows paths.

**Tasks:**
- [ ] Test project opening with `C:\Users\...` paths
- [ ] Test file operations (create, save, delete)
- [ ] Test asset copying between directories
- [ ] Verify preferences persist correctly to AppData
- [ ] Test paths with spaces (e.g., `C:\Users\John Doe\Documents\...`)
- [ ] Test paths with special characters

---

### 3. Title Bar Verification

Verify the Windows title bar component works correctly.

**Tasks:**
- [ ] Verify window controls (minimize, maximize, close) work correctly
- [ ] Test window dragging via `data-tauri-drag-region`
- [ ] Verify touch/pen input works with `app-region: drag` CSS
- [ ] Test maximize/restore behavior
- [ ] Adjust styling as needed for Windows aesthetics
- [ ] Verify focus mode correctly hides/fades the title bar

---

### 4. General Testing Checklist

Run through complete application testing on Windows.

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
- [ ] Theme persists after restart
- [ ] Keyboard shortcuts work (Ctrl instead of Cmd)
- [ ] Context menus appear correctly
- [ ] "Show in Explorer" opens correct folder
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

**Installer/Updates:**
- [ ] MSI installer works correctly
- [ ] App launches after installation
- [ ] Auto-updater can check for updates
- [ ] Uninstaller works cleanly

---

### 5. Platform-Specific Bug Fixes

Document and fix any Windows-specific bugs discovered during testing.

**Known Areas to Watch:**
- Shell command execution differences
- Font rendering differences
- Window chrome and shadows
- High DPI display handling

---

## Definition of Done

- [ ] All core functionality works on Windows
- [ ] IDE detection finds installed IDEs
- [ ] Path operations handle Windows paths correctly
- [ ] Title bar looks and works correctly
- [ ] Keyboard shortcuts use Ctrl appropriately
- [ ] No critical bugs blocking Windows release
- [ ] MSI installer tested and working

---

## Related Tasks

- **Part A:** Cross-Platform Preparation (completed) - see `tasks-done/task-2025-12-15-windows-support.md`
- **Part C:** [Linux Testing](task-x-linux-testing.md) - Can be done in parallel

## References

- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/)
- [GitHub Issue #56](https://github.com/dannysmith/astro-editor/issues/56)
