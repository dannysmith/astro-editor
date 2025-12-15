# Task: Cross-Platform Preparation (Part A)

**Issue:** https://github.com/dannysmith/astro-editor/issues/56

## Overview

Astro Editor currently only works on macOS. This task prepares the codebase for cross-platform support through careful refactoring that **doesn't break macOS functionality**.

This is **Part A** of the cross-platform work - everything that can be done on macOS, merged to main, and released. Parts B (Windows testing) and C (Linux testing) are separate tasks that require their respective environments.

**Key Decision:** Normalize all paths to forward slashes in Rust backend. Frontend receives consistent paths regardless of platform.

**Scope Decisions:**

- No Windows code signing (can add later if users request it)
- No in-window menu bars for Windows/Linux - all functionality is accessible via keyboard shortcuts, command palette, and buttons
- Keyboard shortcuts: `react-hotkeys-hook` uses `mod+` prefix which automatically maps to Cmd on macOS and Ctrl on Windows/Linux

---

## Phase 1: Path Normalization (Rust Backend)

**Goal:** Ensure all paths sent to the frontend use forward slashes, regardless of platform.

**Why:** Windows uses backslashes (`C:\Users\foo`) but our frontend code assumes forward slashes. By normalizing in Rust, the frontend works unchanged.

**Current State:**

- Rust mostly uses `PathBuf` correctly
- However, serialization sends platform-native separators
- Frontend has 15+ instances of hardcoded `/` path manipulation

**Existing Normalization (extend this pattern):**

- `FileEntry.id` in `models/file_entry.rs` already uses `replace('\\', "/")` for ID generation
- `DirectoryInfo.relative_path` in `models/directory_info.rs` already normalizes to forward slashes
- The pattern exists - Phase 1 centralizes and applies it consistently

**Tasks:**

1. **Create path utility module**
   - [ ] Create `src-tauri/src/utils/path.rs`
   - [ ] Implement `normalize_path_for_serialization(path: &Path) -> String`
   - [ ] Add comprehensive tests for Windows-style paths (even on macOS)

2. **Apply normalization to all serialized types**
   - [ ] Update `Collection` serialization in `src-tauri/src/models/collection.rs`
   - [ ] Update `FileEntry` serialization in `src-tauri/src/models/file_entry.rs`
   - [ ] Update `DirectoryInfo` serialization in `src-tauri/src/models/directory_info.rs`
   - [ ] Audit all `#[derive(Serialize)]` types that contain paths

3. **Fix path validation for Windows**
   - [ ] Update `validate_project_path()` in `project.rs` to recognize Windows paths
   - [ ] Add Windows system directory checks (`C:\Windows`, `C:\Program Files`, etc.)
   - [ ] Ensure Unix checks still work

**Code Pattern:**

```rust
// src-tauri/src/utils/path.rs
use std::path::Path;

/// Normalizes a path to use forward slashes for consistent frontend handling.
/// Windows paths like `C:\Users\foo` become `C:/Users/foo`.
pub fn normalize_path_for_serialization(path: &Path) -> String {
    path.display().to_string().replace('\\', "/")
}
```

**Acceptance Criteria:**

- [ ] All path-containing types serialize with forward slashes
- [ ] Tests pass for Windows-style path strings
- [ ] macOS behavior unchanged

---

## Phase 2: IDE Integration Robustness

**Goal:** Make IDE detection graceful when no IDEs are found, and prepare structure for platform-specific paths.

**Current State:**

- `fix_path_env()` in `ide.rs` only handles macOS paths (uses `:` separator, hardcoded macOS paths)
- `validate_file_path()` rejects Windows absolute paths (`C:\...`)
- `escape_shell_arg()` uses Unix-style single-quote escaping (won't work on Windows CMD/PowerShell)
- Frontend may crash if IDE list is empty

**Tasks:**

1. **Refactor IDE path detection structure**
   - [ ] Create platform-specific sections using `#[cfg(target_os = "...")]`
   - [ ] Keep macOS paths working as-is
   - [ ] Add placeholder structure for Windows/Linux (add appropriate paths now, can be refined later in Parts B/C)

2. **Fix path validation for Windows**
   - [ ] Update `validate_file_path()` to accept Windows paths (`C:\`, `D:\`, etc.)
   - [ ] Handle UNC paths (`\\server\share`) as invalid for IDE opening
   - [ ] Make `escape_shell_arg()` platform-aware (Windows uses different escaping rules)

3. **Make frontend handle empty IDE list gracefully**
   - [ ] Update preferences UI to show message when no IDEs detected
   - [ ] Ensure "Open in IDE" context menu item is disabled/hidden when no IDE configured

**Code Pattern:**

```rust
fn fix_path_env() {
    #[cfg(target_os = "macos")]
    {
        // Existing macOS code stays here unchanged
        // Uses `:` as PATH separator
    }

    #[cfg(target_os = "windows")]
    {
        // Placeholder - actual paths added in Part B
        // Windows uses `;` as PATH separator
    }

    #[cfg(target_os = "linux")]
    {
        // Placeholder - actual paths added in Part C
        // Linux uses `:` as PATH separator
    }
}

fn validate_file_path(path: &str) -> Result<(), String> {
    // Unix absolute paths
    if path.starts_with('/') || path.starts_with('~') {
        return Ok(());
    }

    // Windows absolute paths (C:\, D:\, etc.)
    if path.len() >= 3 {
        let bytes = path.as_bytes();
        if bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/') {
            return Ok(());
        }
    }

    Err("Path must be absolute".to_string())
}
```

**Acceptance Criteria:**

- [ ] macOS IDE detection unchanged
- [ ] Windows/Linux sections exist (can be empty placeholders)
- [ ] Frontend handles empty IDE list without crashing
- [ ] Path validation accepts Windows-style paths

---

## Phase 3: Platform Detection Utilities

**Goal:** Create reusable platform detection for React components and establish patterns.

**Prerequisites:**

```bash
pnpm add @tauri-apps/plugin-os
cargo add tauri-plugin-os  # in src-tauri
```

Then add `tauri_plugin_os` to the Tauri plugin initialization in `lib.rs`.

**Tasks:**

1. **Create platform detection hook**
   - [x] Install `@tauri-apps/plugin-os` (npm + cargo)
   - [x] Create `src/hooks/usePlatform.ts`
   - [x] Use `@tauri-apps/plugin-os` for detection
   - [x] Export platform type and detection hook

2. **Create platform-specific strings utility**
   - [x] Create `src/lib/platform-strings.ts`
   - [x] Map platform to UI strings (e.g., "Reveal in Finder" vs "Show in Explorer")
   - [x] Export utility function

3. **Update context menu**
   - [x] Replace hardcoded "Reveal in Finder" with platform-aware string
   - [ ] Test on macOS (should still show "Reveal in Finder")

**Code Pattern:**

```typescript
// src/hooks/usePlatform.ts
import { useState, useEffect } from 'react'
import { platform, type Platform } from '@tauri-apps/plugin-os'

export type AppPlatform = 'macos' | 'windows' | 'linux'

export function usePlatform(): AppPlatform | undefined {
  const [currentPlatform, setCurrentPlatform] = useState<AppPlatform>()

  useEffect(() => {
    platform().then((p: Platform) => {
      if (p === 'macos') setCurrentPlatform('macos')
      else if (p === 'windows') setCurrentPlatform('windows')
      else setCurrentPlatform('linux')
    })
  }, [])

  return currentPlatform
}

// src/lib/platform-strings.ts
const strings = {
  revealInFileManager: {
    macos: 'Reveal in Finder',
    windows: 'Show in Explorer',
    linux: 'Show in File Manager',
  },
} as const
```

**Acceptance Criteria:**

- [ ] `usePlatform()` hook works on macOS (returns 'macos')
- [ ] Context menu shows "Reveal in Finder" on macOS
- [x] Pattern is documented for future use

---

## Phase 4: Windows Title Bar Component

**Goal:** Build a Windows-style title bar in React that can be tested on macOS.

**Background:**

- Windows custom title bars use `decorations: false` in Tauri config
- We build the title bar in HTML/CSS with `data-tauri-drag-region`
- Window controls (close/minimize/maximize) are on the RIGHT side
- We wire up buttons to `getCurrentWindow().minimize()` etc.

**Note on `tauri-controls`:** This package provides ready-made components but was last updated March 2024. We'll build a custom implementation using official Tauri APIs. Reference `tauri-controls` (MIT licensed) for Windows control styling if needed.

**Windows CSS Requirement:** For drag regions to work properly with touch/pen input:

```css
*[data-tauri-drag-region] {
  app-region: drag;
}
```

**Tasks:**

1. **Refactor existing title bar**
   - [x] Rename `UnifiedTitleBar.tsx` to `UnifiedTitleBarMacOS.tsx`
   - [x] Extract shared logic (save button, toolbar items) into shared components
   - [x] Ensure macOS version still works identically

2. **Create Windows title bar**
   - [x] Create `UnifiedTitleBarWindows.tsx`
   - [x] Position window controls on the right
   - [x] Use Windows-style icons (not traffic lights)
   - [x] Apply `data-tauri-drag-region` for dragging
   - [x] Add Windows-specific CSS (`app-region: drag`)
   - [x] Wire up minimize/maximize/close buttons

3. **Create platform wrapper**
   - [x] Create new `UnifiedTitleBar.tsx` that uses `usePlatform()`
   - [x] Render macOS version for 'macos'
   - [x] Render Windows version for 'windows'
   - [x] Render Windows version for 'linux' initially (revisit in Phase 5)

4. **Add development toggle for testing**
   - [x] Add dev-only prop to force platform for visual testing
   - [x] Test Windows layout renders correctly (even on macOS)

**Acceptance Criteria:**

- [ ] macOS title bar unchanged in appearance and behavior
- [ ] Windows title bar renders with controls on right
- [ ] Window dragging works on Windows title bar (test via dev toggle)
- [ ] Shared components extracted and reused

---

## Phase 5: Linux Title Bar Approach

**Goal:** Determine and implement the Linux title bar strategy.

**Background:**

- Linux has many desktop environments (GNOME, KDE, XFCE, etc.)
- Each has different title bar conventions
- Best approach: **Use native decorations and add toolbar below**

**Approach:**

- On Linux, keep `decorations: true` (native window chrome)
- Render a toolbar-only component below the native title bar

**Tasks:**

1. **Create Linux title bar/toolbar**
   - [x] Create `UnifiedTitleBarLinux.tsx`
   - [x] Render as toolbar only (no window controls)
   - [x] Include same toolbar items as macOS/Windows (save, panels, etc.)
   - [x] Adjust styling to work below native decorations

2. **Update platform wrapper**
   - [x] Update `UnifiedTitleBar.tsx` to use Linux version for 'linux'

3. **Document Tauri config requirements**
   - [x] Note that Linux builds need different window settings

**Acceptance Criteria:**

- [x] Linux toolbar component created
- [x] No window control buttons in Linux version
- [x] Documented that Linux uses native decorations

---

## Phase 6: Conditional Compilation & Configuration

**Goal:** Set up proper conditional compilation in Rust and Tauri config for platform differences.

**Current State:** The main `tauri.conf.json` has macOS-specific settings that need to move:

- `decorations: false` → move to `tauri.macos.conf.json` and `tauri.windows.conf.json`
- `transparent: true` → move to `tauri.macos.conf.json` only
- `macOSPrivateApi: true` → move to `tauri.macos.conf.json` only (or use `titleBarStyle: "transparent"` as modern alternative)

Base config should have safe cross-platform defaults (`decorations: true`, `transparent: false`).

**Note:** Tauri v2 also supports `titleBarStyle: "transparent"` as an alternative to `macOSPrivateApi` for transparent title bars on macOS. Either approach works.

**Tasks:**

1. **Make window-vibrancy macOS-only**
   - [x] Update `Cargo.toml` to make `window-vibrancy` conditional
   - [x] Ensure builds don't fail on Windows/Linux

2. **Create platform-specific Tauri configs**
   - [x] Move macOS-specific settings from `tauri.conf.json` to `tauri.macos.conf.json`
   - [x] Set safe defaults in base `tauri.conf.json` (`decorations: true`, `transparent: false`, remove `macOSPrivateApi`)
   - [x] Create `tauri.windows.conf.json` with `decorations: false`
   - [x] Create `tauri.linux.conf.json` with `decorations: true` (explicit, matches default)
   - [x] Add window dragging permissions to capability file (`core:window:allow-start-dragging`) - Already existed
   - [x] Verify config merging works correctly

3. **Handle macos-private-api feature**
   - [x] Make this feature conditional in Cargo.toml (kept in base due to tauri-build limitation, no-op on other platforms)
   - [x] Ensure Windows/Linux builds don't require it

4. **Document patterns**
   - [x] Create `docs/developer/cross-platform.md`
   - [x] Document conditional compilation patterns
   - [x] Document Tauri config merging
   - [x] Document platform detection usage

**Code Pattern:**

```toml
# Cargo.toml
[dependencies]
# Note: macos-private-api is kept in base features because tauri-build's feature
# check runs before Cargo resolves target-specific deps. It's a no-op on other platforms.
tauri = { version = "2", features = ["macos-private-api", "protocol-asset"] }

# macOS-only dependencies
[target.'cfg(target_os = "macos")'.dependencies]
window-vibrancy = "0.6"
```

```json
// tauri.macos.conf.json
{
  "app": {
    "windows": [{ "decorations": false, "transparent": true }],
    "macOSPrivateApi": true
  }
}
```

```json
// tauri.windows.conf.json
{
  "app": {
    "windows": [{ "decorations": false }]
  }
}
```

```json
// tauri.linux.conf.json
{
  "app": {
    "windows": [{ "decorations": true }]
  }
}
```

**Acceptance Criteria:**

- [x] macOS build still works with vibrancy
- [x] Windows/Linux configs exist
- [x] Patterns documented
- [x] No build failures from macOS-only code

---

## Phase 7: CI/Build System Setup

**Goal:** Configure GitHub Actions to build for all platforms.

**Tasks:**

1. **Update release workflow**
   - [x] Add Windows build to matrix
   - [x] Add Linux build to matrix
   - [x] Configure platform-specific bundle arguments
   - [x] Add Linux dependency installation step

2. **Configure Tauri bundle settings**
   - [x] Set up Windows bundle config (MSI, no code signing)
   - [x] Set up Linux bundle config (AppImage only initially)
   - [x] Keep macOS config unchanged

3. **Auto-updater configuration**
   - [x] Verify updater plugin is configured for all platforms
   - [x] Update `latest.json` generation to include all platforms
   - [x] Test that updater endpoints work

4. **Test builds via CI**
   - [x] Trigger test build on feature branch
   - [x] Verify Windows MSI artifact is produced
   - [x] Verify Linux AppImage artifact is produced
   - [x] Verify macOS DMG still works

**Code Pattern:**

```yaml
# .github/workflows/release.yml
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: 'macos-14'
        args: '--target universal-apple-darwin'
      - platform: 'windows-latest'
        args: ''
      - platform: 'ubuntu-22.04'
        args: ''

steps:
  - name: Install Linux dependencies
    if: matrix.platform == 'ubuntu-22.04'
    run: |
      sudo apt-get update
      sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

  - uses: tauri-apps/tauri-action@v0
    with:
      args: ${{ matrix.args }}
```

**Acceptance Criteria:**

- [x] GitHub Actions produces Windows artifact
- [x] GitHub Actions produces Linux artifact
- [x] macOS release unchanged
- [x] Auto-updater configured for all platforms

How to Test

1. Push your branch:
   git add .github/workflows/release.yml
   git commit -m "Add Windows and Linux builds to release workflow"
   git push origin windows-support
2. Trigger the workflow manually:
   - Go to GitHub → Actions → "Release Astro Editor"
   - Click "Run workflow"
   - Select windows-support branch
   - Enter a test version like v0.0.0-test.1
   - Click "Run workflow"

3. Watch the three jobs - they'll run in parallel:
   - publish-tauri (macos-14)
   - publish-tauri (windows-latest)
   - publish-tauri (ubuntu-22.04)

4. If successful, a draft release will be created with:
   - .dmg for macOS
   - .msi for Windows
   - .AppImage for Linux
   - latest.json for auto-updater (all platforms)

- 5. Clean up - delete the test release and tag after verification

---

## Phase 8: Documentation Updates and Reviews

**Goal:** Update developer documentation and fo a full final check

**Tasks:**

- [x] Fix any codeRabbit issues
- [x] Final once-over of the code we've written on this branch and run checks.
- [x] Check all documentation in `docs/developer` for any updates we should make off the back of this work. This includes fixing any examples which are no longer relevant, adding any necessary notes on cross platform stuff to the higher level docs (architecture guide and performance patterns), updating any references to the title bar to be accurate. We will also need to update any of the documentation on the release process Where relevant.
- [x] Update CLAUDE.md and README.md As appropriate. Remember: this is still primarily a Mac app for now, but we may need to just mention that it does include builds for other platforms, although they're not officially supported FOR END USERS yet.
- [x] Final manual review and testing on macOS

## Reference: Files Requiring Attention

### Path Handling (Phase 1)

**TypeScript files with hardcoded `/`:**

- `src/lib/project-registry/persistence.ts` (lines 28-31, 44, 52, 209, 258)
- `src/lib/project-registry/utils.ts` (lines 54, 67, 93, 117, 128)
- `src/components/ui/context-menu.tsx` (lines 40-52, 131-133)
- `src/components/layout/FileItem.tsx` (line 23)
- `src/components/layout/UnifiedTitleBar.tsx` (line 159)
- `src/components/layout/LeftSidebar.tsx` (line 186)
- `src/hooks/usePreferences.ts` (line 104)
- `src/hooks/queries/useDirectoryScanQuery.ts` (line 42)
- `src/hooks/useCreateFile.ts` (line 103)

**Note:** After Rust normalizes paths to forward slashes, many of these become safe. Audit each for correctness.

**Already cross-platform aware:**

- `src/lib/editor/dragdrop/fileProcessing.ts` - Uses `split(/[/\\]/)`

### Rust Files

- `src-tauri/src/commands/ide.rs` - IDE detection and path validation
- `src-tauri/src/commands/preferences.rs` - Already has platform-specific code (good reference)
- `src-tauri/src/models/` - Path serialization (collection.rs, file_entry.rs, directory_info.rs)
- `src-tauri/Cargo.toml` - Conditional dependencies

### UI Files

- `src/components/layout/UnifiedTitleBar.tsx` - Title bar refactoring
- `src/App.css` - Traffic light styling (macOS only)

---

## Documentation To-Do

When rewriting docs after this task is complete, document the following:

- **`transform-gpu` fix for opacity transitions**: The Windows title bar's opacity fade (for distraction-free mode) didn't work until `transform-gpu` was added to the `TitleBarToolbar` container. This forces the element onto a GPU compositing layer, which fixes a WebKit rendering quirk where child elements weren't properly participating in the parent's opacity transition. Without this, elements would stay visible until window blur, then instantly disappear (no transition).

---

## Related Tasks

- **Part B:** [Windows Testing](task-x-windows-testing.md) - Requires Windows environment
- **Part C:** [Linux Testing](task-x-linux-testing.md) - Requires Linux environment

## References

- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri Cross-Platform Compilation](https://v2.tauri.app/develop/cross-platform/)
- [GitHub Issue #56](https://github.com/dannysmith/astro-editor/issues/56)
