# Task: Windows Testing & Refinement (Part B)

**Issue:** https://github.com/dannysmith/astro-editor/issues/56

## Overview

This task covers Windows-specific testing and refinement that **requires a Windows environment**. It should be done after [Part A (Cross-Platform Preparation)](task-1-windows-support.md) is complete and merged to main.

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

### 1. IDE Path Detection

Fill in the Windows IDE paths placeholder created in Part A.

**Tasks:**
- [ ] Research common Windows IDE installation paths
- [ ] Add paths to `fix_path_env()` in `ide.rs`:
  - VS Code: `C:\Program Files\Microsoft VS Code\bin`, `%LOCALAPPDATA%\Programs\Microsoft VS Code\bin`
  - Cursor: Similar paths
  - Other IDEs as needed
- [ ] Test that VS Code and Cursor are detected correctly
- [ ] Verify PATH separator uses `;` correctly

**Common Windows IDE Paths:**
```rust
#[cfg(target_os = "windows")]
{
    // Windows uses `;` as PATH separator
    let windows_paths = [
        r"C:\Program Files\Microsoft VS Code\bin",
        r"C:\Program Files (x86)\Microsoft VS Code\bin",
        // Also check %LOCALAPPDATA%\Programs\...
    ];
}
```

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

### 3. Title Bar Refinement

Verify and refine the Windows title bar component.

**Tasks:**
- [ ] Verify window controls (minimize, maximize, close) work correctly
- [ ] Test window dragging via `data-tauri-drag-region`
- [ ] Verify touch/pen input works with `app-region: drag` CSS
- [ ] Test maximize/restore behavior
- [ ] Adjust styling as needed for Windows aesthetics
- [ ] Verify focus mode correctly hides the title bar

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
- [ ] Markdown preview (if applicable)
- [ ] Drag and drop files into editor

**Window Management:**
- [ ] Window resizing works
- [ ] Minimum size constraints enforced
- [ ] Panel resizing works
- [ ] Window state persists after restart

**Installer/Updates:**
- [ ] MSI installer works correctly
- [ ] App launches after installation
- [ ] Auto-updater can check for updates
- [ ] Uninstaller works cleanly

---

### 5. Platform-Specific Bug Fixes

Document and fix any Windows-specific bugs discovered during testing.

**Known Areas to Watch:**
- File path handling (backslashes vs forward slashes)
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

- **Part A:** [Cross-Platform Preparation](task-1-windows-support.md) - Must be completed first
- **Part C:** [Linux Testing](task-x-linux-testing.md) - Can be done in parallel

## References

- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/)
- [GitHub Issue #56](https://github.com/dannysmith/astro-editor/issues/56)
