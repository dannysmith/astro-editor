# Task: Windows & Linux Support

**Issue:** https://github.com/dannysmith/astro-editor/issues/56

## TL;DR

Astro Editor currently only works on macOS. This task prepares the codebase for cross-platform support through careful refactoring that **doesn't break macOS functionality**. The work is split into three sections:

1. **Part A: Preparatory Work** - Everything we can do on macOS, merge to main, and release without breaking anything
2. **Part B: Windows-Specific Work** - Requires a Windows environment to test and refine
3. **Part C: Linux-Specific Work** - Requires a Linux environment to test and refine

**Key Decision:** Normalize all paths to forward slashes in Rust backend. Frontend receives consistent paths regardless of platform.

**Scope Decisions:**
- No Windows code signing (can add later if users request it)
- No paid test environments (GitHub Actions CI only for automated builds)
- Linux: Build-from-source initially; binary distribution only if there's demand

---

## Part A: Preparatory Work (macOS-Safe)

Everything in Part A can be done on macOS, merged to main, and released. It makes the codebase cross-platform ready without changing macOS behavior.

---

### Phase 1: Path Normalization (Rust Backend)

**Goal:** Ensure all paths sent to the frontend use forward slashes, regardless of platform.

**Why:** Windows uses backslashes (`C:\Users\foo`) but our frontend code assumes forward slashes. By normalizing in Rust, the frontend works unchanged.

**Current State (from codebase audit):**
- Rust mostly uses `PathBuf` correctly
- However, serialization sends platform-native separators
- Frontend has 15+ instances of hardcoded `/` path manipulation

**Tasks:**

1. **Create path utility module**
   - [ ] Create `src-tauri/src/utils/path.rs`
   - [ ] Implement `normalize_path_for_serialization(path: &Path) -> String`
   - [ ] Add comprehensive tests for Windows-style paths (even on macOS)

2. **Apply normalization to all serialized types**
   - [ ] Update `Collection` serialization in `src-tauri/src/types.rs`
   - [ ] Update `FileEntry` serialization
   - [ ] Update `DirectoryInfo` serialization
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

/// Custom serializer for PathBuf fields
pub fn serialize_path_normalized<S>(path: &PathBuf, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&normalize_path_for_serialization(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_windows_path() {
        // Test string that looks like Windows path (works on any platform)
        let normalized = "C:\\Users\\foo\\project".replace('\\', "/");
        assert_eq!(normalized, "C:/Users/foo/project");
    }

    #[test]
    fn test_normalize_unix_path() {
        let path = Path::new("/Users/foo/project");
        assert_eq!(normalize_path_for_serialization(path), "/Users/foo/project");
    }
}
```

**Acceptance Criteria:**
- [ ] All path-containing types serialize with forward slashes
- [ ] Tests pass for Windows-style path strings
- [ ] macOS behavior unchanged

---

### Phase 2: IDE Integration Robustness

**Goal:** Make IDE detection graceful when no IDEs are found, and prepare structure for platform-specific paths.

**Current State (from codebase audit):**
- `fix_path_env()` in `ide.rs` only handles macOS paths
- `validate_file_path()` rejects Windows absolute paths (`C:\...`)
- Frontend may crash if IDE list is empty

**Tasks:**

1. **Refactor IDE path detection structure**
   - [ ] Create platform-specific sections using `#[cfg(target_os = "...")]`
   - [ ] Keep macOS paths working as-is
   - [ ] Add placeholder structure for Windows/Linux (actual paths added in Part B/C)

2. **Fix path validation for Windows**
   - [ ] Update `validate_file_path()` to accept Windows paths (`C:\`, `D:\`, etc.)
   - [ ] Handle UNC paths (`\\server\share`) as invalid for IDE opening

3. **Make frontend handle empty IDE list gracefully**
   - [ ] Update preferences UI to show message when no IDEs detected
   - [ ] Ensure "Open in IDE" context menu item is disabled/hidden when no IDE configured

**Code Pattern:**

```rust
// Structure for platform-specific IDE paths
fn fix_path_env() {
    #[cfg(target_os = "macos")]
    {
        // Existing macOS code stays here unchanged
        if let Ok(path) = std::env::var("PATH") {
            let mut paths: Vec<&str> = path.split(':').collect();
            let macos_paths = [
                "/usr/local/bin",
                "/opt/homebrew/bin",
                "/Applications/Visual Studio Code.app/Contents/Resources/app/bin",
                "/Applications/Cursor.app/Contents/Resources/app/bin",
            ];
            // ... existing logic
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Placeholder - actual paths added when testing on Windows
        // Windows uses `;` as PATH separator
    }

    #[cfg(target_os = "linux")]
    {
        // Placeholder - actual paths added when testing on Linux
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

### Phase 3: Platform Detection Utilities

**Goal:** Create reusable platform detection for React components and establish patterns.

**Tasks:**

1. **Create platform detection hook**
   - [ ] Create `src/hooks/usePlatform.ts`
   - [ ] Use `@tauri-apps/plugin-os` for detection
   - [ ] Export platform type and detection hook

2. **Create platform-specific strings utility**
   - [ ] Create `src/lib/platform-strings.ts`
   - [ ] Map platform to UI strings (e.g., "Reveal in Finder" vs "Show in Explorer")
   - [ ] Export utility function

3. **Update context menu**
   - [ ] Replace hardcoded "Reveal in Finder" with platform-aware string
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
      // Map Tauri platform to our simplified type
      if (p === 'macos') setCurrentPlatform('macos')
      else if (p === 'windows') setCurrentPlatform('windows')
      else setCurrentPlatform('linux') // All other Unix-like
    })
  }, [])

  return currentPlatform
}

// src/lib/platform-strings.ts
import type { AppPlatform } from '@/hooks/usePlatform'

const strings = {
  revealInFileManager: {
    macos: 'Reveal in Finder',
    windows: 'Show in Explorer',
    linux: 'Show in File Manager',
  },
  // Add more as needed
} as const

export function getPlatformString(
  key: keyof typeof strings,
  platform: AppPlatform | undefined
): string {
  if (!platform) return strings[key].macos // Default to macOS
  return strings[key][platform]
}
```

**Acceptance Criteria:**
- [ ] `usePlatform()` hook works on macOS (returns 'macos')
- [ ] Context menu shows "Reveal in Finder" on macOS
- [ ] Pattern is documented for future use

---

### Phase 4: Windows Title Bar Component

**Goal:** Build a Windows-style title bar in React that can be tested on macOS.

**Background (from Tauri v2 research):**
- Windows custom title bars use `decorations: false` in Tauri config
- We build the title bar in HTML/CSS with `data-tauri-drag-region`
- Window controls (close/minimize/maximize) are on the RIGHT side
- We wire up buttons to `getCurrentWindow().minimize()` etc.

**Approach:**
- Keep existing `UnifiedTitleBar.tsx` for macOS (rename to `UnifiedTitleBarMacOS.tsx`)
- Create `UnifiedTitleBarWindows.tsx` with Windows-style layout
- Create wrapper `UnifiedTitleBar.tsx` that selects based on platform
- Test Windows component on macOS by temporarily forcing platform

**Tasks:**

1. **Refactor existing title bar**
   - [ ] Rename `UnifiedTitleBar.tsx` to `UnifiedTitleBarMacOS.tsx`
   - [ ] Extract shared logic (save button, toolbar items) into shared components
   - [ ] Ensure macOS version still works identically

2. **Create Windows title bar**
   - [ ] Create `UnifiedTitleBarWindows.tsx`
   - [ ] Position window controls on the right
   - [ ] Use Windows-style icons (not traffic lights)
   - [ ] Apply `data-tauri-drag-region` for dragging
   - [ ] Wire up minimize/maximize/close buttons

3. **Create platform wrapper**
   - [ ] Create new `UnifiedTitleBar.tsx` that uses `usePlatform()`
   - [ ] Render macOS version for 'macos'
   - [ ] Render Windows version for 'windows'
   - [ ] Render Windows version for 'linux' initially (revisit in Phase 5)

4. **Add development toggle for testing**
   - [ ] Add dev-only prop to force platform for visual testing
   - [ ] Test Windows layout renders correctly (even on macOS)

**Code Pattern:**

```typescript
// src/components/layout/UnifiedTitleBar.tsx (wrapper)
import { usePlatform } from '@/hooks/usePlatform'
import { UnifiedTitleBarMacOS } from './UnifiedTitleBarMacOS'
import { UnifiedTitleBarWindows } from './UnifiedTitleBarWindows'

interface Props {
  // Dev-only: force a specific platform for testing
  _forcePlatform?: 'macos' | 'windows' | 'linux'
}

export function UnifiedTitleBar({ _forcePlatform }: Props) {
  const detectedPlatform = usePlatform()
  const platform = _forcePlatform ?? detectedPlatform

  if (!platform) return null // Loading

  if (platform === 'macos') {
    return <UnifiedTitleBarMacOS />
  }

  // Windows and Linux use Windows-style title bar
  return <UnifiedTitleBarWindows />
}
```

```typescript
// src/components/layout/UnifiedTitleBarWindows.tsx
import { getCurrentWindow } from '@tauri-apps/api/window'

export function UnifiedTitleBarWindows() {
  const appWindow = getCurrentWindow()

  return (
    <div data-tauri-drag-region className="flex h-10 items-center justify-between">
      {/* Left side: App title and toolbar */}
      <div className="flex items-center gap-2 pl-3">
        {/* Shared toolbar components */}
      </div>

      {/* Right side: Window controls */}
      <div className="flex">
        <button
          onClick={() => appWindow.minimize()}
          className="h-10 w-12 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {/* Minimize icon */}
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="h-10 w-12 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {/* Maximize icon */}
        </button>
        <button
          onClick={() => appWindow.close()}
          className="h-10 w-12 hover:bg-red-500 hover:text-white"
        >
          {/* Close icon */}
        </button>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] macOS title bar unchanged in appearance and behavior
- [ ] Windows title bar renders with controls on right
- [ ] Window dragging works on Windows title bar (test via dev toggle)
- [ ] Shared components extracted and reused

---

### Phase 5: Linux Title Bar Approach

**Goal:** Determine and implement the Linux title bar strategy.

**Background (from research):**
- Linux has many desktop environments (GNOME, KDE, XFCE, etc.)
- Each has different title bar conventions
- Trying to mimic any one would look wrong on others
- Best approach: **Use native decorations and add toolbar below**

**Approach:**
- On Linux, keep `decorations: true` (native window chrome)
- Render a toolbar-only component below the native title bar
- This avoids the impossible task of matching every Linux DE

**Tasks:**

1. **Create Linux title bar/toolbar**
   - [ ] Create `UnifiedTitleBarLinux.tsx`
   - [ ] Render as toolbar only (no window controls)
   - [ ] Include same toolbar items as macOS/Windows (save, panels, etc.)
   - [ ] Adjust styling to work below native decorations

2. **Update platform wrapper**
   - [ ] Update `UnifiedTitleBar.tsx` to use Linux version for 'linux'

3. **Document Tauri config requirements**
   - [ ] Note that Linux builds need different window settings
   - [ ] Add to Phase 6 (conditional compilation) checklist

**Code Pattern:**

```typescript
// src/components/layout/UnifiedTitleBarLinux.tsx
export function UnifiedTitleBarLinux() {
  // No window controls - those are in native decorations
  // This is just a toolbar
  return (
    <div className="flex h-10 items-center border-b px-3">
      {/* Shared toolbar components only */}
      <ProjectTitle />
      <ToolbarActions />
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Linux toolbar component created
- [ ] No window control buttons in Linux version
- [ ] Documented that Linux uses native decorations

---

### Phase 6: Conditional Compilation & Configuration

**Goal:** Set up proper conditional compilation in Rust and Tauri config for platform differences.

**Tasks:**

1. **Make window-vibrancy macOS-only**
   - [ ] Update `Cargo.toml` to make `window-vibrancy` conditional
   - [ ] Ensure builds don't fail on Windows/Linux

2. **Create platform-specific Tauri configs**
   - [ ] Create `tauri.macos.conf.json` for macOS-specific settings
   - [ ] Create `tauri.windows.conf.json` with `decorations: false`
   - [ ] Create `tauri.linux.conf.json` with `decorations: true`
   - [ ] Verify config merging works correctly

3. **Handle macos-private-api feature**
   - [ ] Make this feature conditional in Cargo.toml
   - [ ] Ensure Windows/Linux builds don't require it

4. **Document patterns**
   - [ ] Create `docs/developer/cross-platform.md`
   - [ ] Document conditional compilation patterns
   - [ ] Document Tauri config merging
   - [ ] Document platform detection usage

**Code Pattern:**

```toml
# Cargo.toml

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }

# macOS-only dependencies
[target.'cfg(target_os = "macos")'.dependencies]
window-vibrancy = "0.6"

# macOS-only features
[target.'cfg(target_os = "macos")'.dependencies.tauri]
version = "2"
features = ["macos-private-api"]
```

```json
// tauri.windows.conf.json
{
  "app": {
    "windows": [
      {
        "decorations": false
      }
    ]
  }
}
```

```json
// tauri.linux.conf.json
{
  "app": {
    "windows": [
      {
        "decorations": true
      }
    ]
  }
}
```

**Acceptance Criteria:**
- [ ] macOS build still works with vibrancy
- [ ] Windows/Linux configs exist
- [ ] Patterns documented
- [ ] No build failures from macOS-only code

---

### Phase 7: CI/Build System Setup

**Goal:** Configure GitHub Actions to build for all platforms.

**Tasks:**

1. **Update release workflow**
   - [ ] Add Windows build to matrix
   - [ ] Add Linux build to matrix
   - [ ] Configure platform-specific bundle arguments
   - [ ] Add Linux dependency installation step

2. **Configure Tauri bundle settings**
   - [ ] Set up Windows bundle config (MSI, no code signing)
   - [ ] Set up Linux bundle config (AppImage only initially)
   - [ ] Keep macOS config unchanged

3. **Auto-updater configuration**
   - [ ] Verify updater plugin is configured for all platforms
   - [ ] Update `latest.json` generation to include all platforms
   - [ ] Test that updater endpoints work

4. **Test builds via CI**
   - [ ] Trigger test build on feature branch
   - [ ] Verify Windows MSI artifact is produced
   - [ ] Verify Linux AppImage artifact is produced
   - [ ] Verify macOS DMG still works

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

```json
// tauri.conf.json bundle additions
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    },
    "linux": {
      "appimage": {
        "bundleMediaFramework": false
      }
    }
  }
}
```

**Acceptance Criteria:**
- [ ] GitHub Actions produces Windows artifact
- [ ] GitHub Actions produces Linux artifact
- [ ] macOS release unchanged
- [ ] Auto-updater configured for all platforms

---

## Part B: Windows-Specific Work

Everything in Part B requires a Windows environment to test. This work should be done as a **separate task** after Part A is complete and a Windows test environment is available.

---

### Windows Testing Environment Setup

*(To be defined in separate task)*

Options include:
- Windows VM (Parallels, UTM, or VirtualBox)
- Physical Windows machine
- GitHub Actions for automated testing

---

### Windows-Specific Tasks (Requires Testing)

The following cannot be completed without Windows testing:

1. **IDE Path Detection**
   - Fill in Windows IDE paths in `fix_path_env()`
   - Common paths: `C:\Program Files\Microsoft VS Code\bin`, etc.
   - Test that VS Code, Cursor are detected

2. **Path Handling Verification**
   - Test project opening with `C:\Users\...` paths
   - Test file operations (create, save, delete)
   - Test asset copying
   - Verify preferences persist correctly

3. **Title Bar Refinement**
   - Verify window controls work correctly
   - Test window dragging
   - Adjust styling as needed
   - Test maximize/restore behavior

4. **General Testing**
   - Run through full testing checklist (see [Testing Checklist](#testing-checklist))
   - Fix any platform-specific bugs discovered
   - Verify keyboard shortcuts work (Ctrl instead of Cmd)

---

## Part C: Linux-Specific Work

Everything in Part C requires a Linux environment to test. This work should be done as a **separate task** after Part A is complete.

---

### Linux Distribution Strategy

**Initial Approach:** Build-from-source only

Given the complexity of Linux distribution (DEB, RPM, AppImage, Flatpak, Snap) and the variety of desktop environments, the initial approach is:

1. Document how to build from source
2. Produce an AppImage via CI (low effort, works everywhere)
3. Do NOT produce other package formats initially
4. If users request specific formats, add them based on demand

This avoids the overhead of maintaining multiple package formats until there's proven demand.

---

### Linux-Specific Tasks (Requires Testing)

The following cannot be completed without Linux testing:

1. **Native Decorations Verification**
   - Test that native title bar renders correctly
   - Verify toolbar component works below decorations
   - Test on at least one DE (GNOME or KDE)

2. **IDE Path Detection**
   - Fill in Linux IDE paths in `fix_path_env()`
   - Common paths: `/usr/bin/code`, `/snap/bin/code`, etc.
   - Test detection

3. **Webkit Rendering**
   - Verify webkit2gtk renders correctly
   - Test CodeMirror editor
   - Check for any rendering differences

4. **General Testing**
   - Run through full testing checklist
   - Fix any platform-specific bugs

---

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

**Note:** After Rust normalizes paths to forward slashes, many of these become safe. However, audit each for correctness.

**Already cross-platform aware:**
- `src/lib/editor/dragdrop/fileProcessing.ts` - Uses `split(/[/\\]/)`

### Rust Files

- `src-tauri/src/commands/ide.rs` - IDE detection and path validation
- `src-tauri/src/commands/preferences.rs` - Already has platform-specific code (good reference)
- `src-tauri/src/types.rs` - Path serialization
- `src-tauri/Cargo.toml` - Conditional dependencies

### UI Files

- `src/components/layout/UnifiedTitleBar.tsx` - Title bar refactoring
- `src/App.css` - Traffic light styling (macOS only)

---

## Testing Checklist

Run this on each platform:

### Core Functionality
- [ ] App launches without crash
- [ ] Can open preferences
- [ ] Can select project folder
- [ ] Can open existing project
- [ ] Collections load correctly
- [ ] Files list appears

### File Operations
- [ ] Can open file for editing
- [ ] Can edit and save file
- [ ] Auto-save works
- [ ] Can create new file
- [ ] Can duplicate file
- [ ] Can delete file
- [ ] Can rename file

### Navigation
- [ ] Can switch between collections
- [ ] Can navigate subdirectories
- [ ] Sidebar shows correct file tree

### Editor
- [ ] CodeMirror renders correctly
- [ ] Syntax highlighting works
- [ ] Keyboard shortcuts work

### UI
- [ ] Title bar renders correctly
- [ ] Window controls work
- [ ] Window dragging works
- [ ] Panels can be toggled
- [ ] Resizing works

### Context Menus
- [ ] Right-click shows menu
- [ ] "Reveal in Explorer/Finder" works
- [ ] "Open in IDE" works (if configured)

---

## Code Patterns Reference

### Path Normalization (Rust)

```rust
pub fn normalize_path_for_serialization(path: &Path) -> String {
    path.display().to_string().replace('\\', "/")
}
```

### Platform Detection (TypeScript)

```typescript
import { platform } from '@tauri-apps/plugin-os'

export function usePlatform() {
  const [p, setP] = useState<'macos' | 'windows' | 'linux'>()
  useEffect(() => { platform().then(setP) }, [])
  return p
}
```

### Conditional Compilation (Rust)

```rust
#[cfg(target_os = "macos")]
fn macos_only() { }

#[cfg(target_os = "windows")]
fn windows_only() { }

#[cfg(target_os = "linux")]
fn linux_only() { }
```

### Conditional Dependencies (Cargo.toml)

```toml
[target.'cfg(target_os = "macos")'.dependencies]
window-vibrancy = "0.6"
```

---

## References

- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri Cross-Platform Compilation](https://v2.tauri.app/develop/cross-platform/)
- [GitHub Issue #56](https://github.com/dannysmith/astro-editor/issues/56)
