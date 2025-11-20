# Task: Windows & Linux Support

**Issue:** https://github.com/dannysmith/astro-editor/issues/56

## TL;DR

Astro Editor currently only works on macOS. To support Windows and Linux, we need to fix **critical path handling issues** (11+ files using hardcoded `/`), create **platform-specific title bars**, and update the **build pipeline**. Tauri v2 handles most platform differences automatically - React, CodeMirror, state management all work unchanged. Path handling is 80% of the work.

**Key Decision:** Normalize all paths to forward slashes in Rust backend. Frontend never sees platform differences.

## Implementation Strategy

### Core Approach

1. **Path Normalization:** Rust serializes ALL paths with forward slashes (e.g., `C:/Users/foo` instead of `C:\Users\foo`)
2. **Platform-Specific UI:** Separate title bar components for macOS/Windows/Linux
3. **Conditional Compilation:** Use `#[cfg(target_os = "...")]` for platform-specific Rust code
4. **Progressive Enhancement:** macOS stays fully functional, Windows/Linux added incrementally

### Key Decisions

- ✅ **Forward slashes everywhere** - Consistent with Markdown image paths
- ✅ **Separate title bar components** - UnifiedTitleBarMacOS, UnifiedTitleBarWindows, UnifiedTitleBarLinux
- ✅ **Windows first, then Linux** - Larger user base on Windows
- ⚠️ **DECIDE:** Windows code signing certificate? (~$100-300/year for trusted installs)
- ⚠️ **DECIDE:** Linux packages - DEB only, or also AppImage/Flatpak?

## Implementation Phases

### Phase 0: Development Environment Setup

**Goal:** Ability to build, run, and test on Windows/Linux
**Duration:** 1-2 days
**Blocks:** Everything else

**Tasks:**
- [ ] Set up Windows test environment (see [Dev Environment Setup](#development-environment-setup))
- [ ] Set up Linux test environment
- [ ] Verify app builds on Windows (will be broken, that's OK)
- [ ] Verify app builds on Linux
- [ ] Add platform detection utility function
- [ ] Document how to build/test on each platform

**Acceptance Criteria:**
- Can build Windows binary from GitHub Actions or local VM
- Can build Linux binary from GitHub Actions or local VM
- Can launch app on Windows (even if it crashes)

### Phase 1: Path Handling (CRITICAL BLOCKER)

**Goal:** Fix all path operations to work on Windows
**Duration:** 3-5 days
**Dependencies:** Phase 0
**Blocks:** All other phases

**Why This Blocks Everything:** The app won't open projects, read files, or save preferences on Windows until this is fixed.

**Tasks:**

1. **Rust Backend (1-2 days)**
   - [ ] Create path normalization utility function
   - [ ] Add normalization to Collection, FileEntry, DirectoryInfo serialization
   - [ ] Fix `validate_project_path()` in `project.rs` (Windows security paths)
   - [ ] Fix `fix_path_env()` in `ide.rs` (Windows IDE paths)
   - [ ] Add Windows-specific PATH entries

2. **TypeScript Frontend (2-3 days)**
   - [ ] Audit and fix `projectStore.ts` (lines 136, 139)
   - [ ] Audit and fix `project-registry/utils.ts` (5 instances)
   - [ ] Audit and fix `project-registry/persistence.ts` (template literals)
   - [ ] Audit and fix `usePreferences.ts` (line 103)
   - [ ] Audit and fix `LeftSidebar.tsx` (lines 176, 226, 279)
   - [ ] Audit and fix `FileItem.tsx` (line 23)
   - [ ] Audit and fix `UnifiedTitleBar.tsx` (line 159)
   - [ ] Audit and fix `context-menu.tsx` (multiple lines)
   - [ ] Remove hardcoded path separators from any other files

3. **Testing**
   - [ ] Add path normalization tests (Rust)
   - [ ] Test opening project on Windows
   - [ ] Test file operations on Windows
   - [ ] Test directory navigation on Windows
   - [ ] Test preferences persistence on Windows

**Code Patterns to Use:**

```rust
// Rust: Path normalization utility
pub fn normalize_path_for_serialization(path: &Path) -> String {
    path.display().to_string().replace('\\', "/")
}

// Apply in serialization
#[derive(Serialize)]
struct Collection {
    #[serde(serialize_with = "serialize_path_normalized")]
    path: PathBuf,
}

// Windows security checks
#[cfg(target_os = "windows")]
fn is_system_directory(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    path_str.starts_with("c:\\windows\\")
        || path_str.starts_with("c:\\program files\\")
        || path_str.starts_with("c:\\program files (x86)\\")
}

#[cfg(not(target_os = "windows"))]
fn is_system_directory(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    path_str.starts_with("/System/")
        || path_str.starts_with("/usr/")
        // ... existing Unix checks
}
```

```typescript
// TypeScript: NEVER manipulate paths directly
// ❌ WRONG
const projectName = projectPath.split('/').pop()
const filePath = `${dir}/preferences.json`

// ✅ RIGHT - Let backend handle it
const projectName = await invoke('get_project_name', { projectPath })
const filePath = await invoke('join_paths', { base: dir, filename: 'preferences.json' })

// OR: If paths are already normalized to forward slashes from backend
const projectName = projectPath.split('/').pop() // Now safe because backend normalized it
```

**Acceptance Criteria:**
- [ ] App opens on Windows without path errors
- [ ] Can select and open Astro projects on Windows
- [ ] Can read/write files on Windows
- [ ] Can navigate directories on Windows
- [ ] Security checks work (C:\Windows blocked, user projects allowed)
- [ ] All existing macOS functionality still works

**Testing Checklist:**
```
Windows:
- [ ] Open project: C:\Users\{user}\Documents\my-astro-project
- [ ] Create new file
- [ ] Edit and save file
- [ ] Navigate subdirectories
- [ ] Copy file to assets
- [ ] Duplicate file
- [ ] Delete file
- [ ] Change collection

macOS (regression):
- [ ] All above scenarios still work
```

### Phase 2: IDE Integration Fix

**Goal:** Fix preferences crash and IDE detection on Windows/Linux
**Duration:** 1-2 days
**Dependencies:** Phase 1
**Blocks:** Users opening preferences on Windows/Linux

**Tasks:**
- [ ] Add Windows IDE path detection to `fix_path_env()`
- [ ] Add Linux IDE path detection to `fix_path_env()`
- [ ] Add fallback for empty IDE list (don't crash)
- [ ] Update preferences UI to handle empty IDE list gracefully
- [ ] Test IDE detection on Windows with VS Code, Cursor
- [ ] Test IDE detection on Linux with common editors

**Code Pattern:**

```rust
fn fix_path_env() {
    #[cfg(target_os = "macos")]
    {
        // Existing macOS code
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(path) = env::var("PATH") {
            let mut paths: Vec<&str> = path.split(';').collect();

            let common_paths = [
                "C:\\Program Files\\Microsoft VS Code\\bin",
                "C:\\Program Files\\Cursor\\bin",
                "C:\\Users\\{user}\\AppData\\Local\\Programs\\Microsoft VS Code\\bin",
            ];

            // Add missing paths...
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(path) = env::var("PATH") {
            let mut paths: Vec<&str> = path.split(':').collect();

            let common_paths = [
                "/usr/bin",
                "/usr/local/bin",
                "/home/{user}/.local/bin",
            ];

            // Add missing paths...
        }
    }
}
```

```typescript
// Frontend: Handle empty IDE list
const ides = await invoke('get_available_ides')

if (ides.length === 0) {
  // Show message: "No IDEs detected. Install VS Code, Cursor, etc."
  // Disable IDE integration
  return <EmptyStateMessage />
}

// Show IDE selector with first as default
```

**Acceptance Criteria:**
- [ ] App doesn't crash when opening preferences on Windows
- [ ] Detects installed IDEs on Windows (VS Code, Cursor)
- [ ] Gracefully handles no IDEs installed
- [ ] "Open in IDE" works on Windows
- [ ] Still works on macOS

### Phase 3: Platform-Specific UI

**Goal:** Create native-feeling title bars and UI for each platform
**Duration:** 3-4 days
**Dependencies:** Phase 1, Phase 2
**Blocks:** Shipping Windows/Linux versions

**Tasks:**

1. **Platform Detection Utility (0.5 days)**
   - [ ] Create `usePlatform()` hook
   - [ ] Create platform constants
   - [ ] Add platform to app context

2. **Title Bar Components (2 days)**
   - [ ] Rename `UnifiedTitleBar.tsx` → `UnifiedTitleBarMacOS.tsx`
   - [ ] Create `UnifiedTitleBarWindows.tsx` (controls on right, no vibrancy)
   - [ ] Create `UnifiedTitleBarLinux.tsx` (similar to Windows)
   - [ ] Create `UnifiedTitleBar.tsx` wrapper that selects platform version
   - [ ] Update Layout to use new wrapper

3. **Platform-Specific Strings (0.5 days)**
   - [ ] "Reveal in Finder" → platform-specific text in context menu
   - [ ] Update any other macOS-specific strings

4. **Remove macOS-Only Features (0.5 days)**
   - [ ] Conditional vibrancy effect (macOS only)
   - [ ] Make `window-vibrancy` dependency conditional in Cargo.toml
   - [ ] Test transparent windows on Windows (different behavior)

5. **Testing (0.5 days)**
   - [ ] Test title bar on Windows (dragging, buttons, layout)
   - [ ] Test title bar on Linux
   - [ ] Verify macOS title bar unchanged

**Code Patterns:**

```typescript
// Platform detection hook
import { platform } from '@tauri-apps/plugin-os'

export function usePlatform() {
  const [currentPlatform, setCurrentPlatform] = useState<'macos' | 'windows' | 'linux' | 'ios' | 'android'>()

  useEffect(() => {
    platform().then(setCurrentPlatform)
  }, [])

  return currentPlatform
}

// Platform-specific strings
const platformStrings = {
  macos: 'Reveal in Finder',
  windows: 'Show in File Explorer',
  linux: 'Show in File Manager',
}

const revealText = platformStrings[currentPlatform] || 'Show in File Manager'
```

```typescript
// Title bar wrapper
export const UnifiedTitleBar: React.FC = () => {
  const platform = usePlatform()

  if (!platform) return null // Loading

  switch (platform) {
    case 'macos':
      return <UnifiedTitleBarMacOS />
    case 'windows':
      return <UnifiedTitleBarWindows />
    default:
      return <UnifiedTitleBarLinux />
  }
}
```

```rust
// Conditional Cargo.toml
[target.'cfg(target_os = "macos")'.dependencies]
window-vibrancy = "0.5"

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }

[target.'cfg(target_os = "macos")'.features]
# This syntax might not work - just make macos-private-api conditional
```

**Acceptance Criteria:**
- [ ] Windows shows native-looking title bar (controls on right)
- [ ] Linux shows appropriate title bar
- [ ] macOS unchanged
- [ ] Window dragging works on all platforms
- [ ] Window controls (close/minimize/maximize) work on all platforms
- [ ] Transparency/vibrancy handled appropriately per platform

### Phase 4: Build Pipeline & Distribution

**Goal:** Automated builds for Windows and Linux
**Duration:** 2-3 days
**Dependencies:** Phase 3 (or can be parallel)

**Tasks:**

1. **GitHub Actions (1 day)**
   - [ ] Add Windows build matrix to `.github/workflows/release.yml`
   - [ ] Add Linux build matrix
   - [ ] Configure platform-specific bundle args
   - [ ] Test automated builds

2. **Tauri Configuration (0.5 days)**
   - [ ] Add Windows config to `tauri.conf.json`
   - [ ] Add Linux config
   - [ ] Verify icon files are correct

3. **Code Signing (1 day - if doing it)**
   - [ ] Obtain Windows code signing certificate
   - [ ] Add certificate to GitHub secrets
   - [ ] Configure signing in workflow
   - [ ] Test signed builds

4. **Testing (0.5 days)**
   - [ ] Test DMG on macOS
   - [ ] Test MSI/NSIS on Windows
   - [ ] Test DEB/AppImage on Linux
   - [ ] Verify auto-updater works on each platform

**GitHub Actions Changes:**

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: 'macos-14'
        args: '--target universal-apple-darwin --bundles app,dmg'

      - platform: 'windows-latest'
        args: '--bundles msi,nsis'

      - platform: 'ubuntu-22.04'
        args: '--bundles deb,appimage'
```

**Tauri Config Changes:**

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    },
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0",
          "libgtk-3-0",
          "libappindicator3-1"
        ]
      }
    },
    "macOS": {
      // ... existing config
    }
  }
}
```

**Acceptance Criteria:**
- [ ] GitHub Actions builds Windows MSI
- [ ] GitHub Actions builds Windows NSIS installer
- [ ] GitHub Actions builds Linux DEB
- [ ] GitHub Actions builds Linux AppImage
- [ ] macOS DMG still builds
- [ ] All bundles are signed (if doing code signing)
- [ ] `latest.json` includes all platforms
- [ ] Auto-updater can fetch updates for each platform

### Phase 5: Testing & Polish

**Goal:** Verify everything works on real machines
**Duration:** 2-3 days
**Dependencies:** Phase 4

**Tasks:**
- [ ] Full feature test on Windows (see [Testing Checklist](#testing-checklist))
- [ ] Full feature test on Linux
- [ ] Regression test on macOS
- [ ] Performance comparison across platforms
- [ ] Fix any platform-specific bugs discovered
- [ ] Update documentation
- [ ] Update website screenshots

**Acceptance Criteria:**
- [ ] All features work on Windows
- [ ] All features work on Linux
- [ ] macOS functionality unchanged
- [ ] No new crashes or errors
- [ ] Performance is acceptable on all platforms

## Development Environment Setup

### Option 1: GitHub Actions (Free, Recommended for CI)

**Pros:** Free, automated, matches production builds
**Cons:** Slower iteration, need to push to test

**Setup:**
1. Create `.github/workflows/test-builds.yml` for pull requests
2. Build on push to test branches
3. Download artifacts to test

### Option 2: Windows VM on macOS

**Best for:** Active Windows development

**Using Parallels (Paid, $100/year):**
1. Download Windows 11 ARM ISO (for Apple Silicon) or x64 (for Intel)
2. Install Parallels Desktop
3. Create Windows VM
4. Install Rust: https://rustup.rs
5. Install Node.js: https://nodejs.org
6. Install pnpm: `npm install -g pnpm`
7. Install WebView2 (usually pre-installed on Windows 11)
8. Install Visual Studio Build Tools
9. Clone repo in Windows
10. `pnpm install && pnpm run tauri:build`

**Using UTM (Free, Open Source):**
1. Download UTM: https://mac.getutm.app
2. Download Windows 11 ARM ISO
3. Create VM with 4GB+ RAM, 64GB+ disk
4. Follow Parallels steps 4-10

### Option 3: Linux VM on macOS

**Using UTM (Free):**
1. Download Ubuntu 22.04 ISO
2. Create VM in UTM
3. Install dependencies:
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```
4. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
5. Install Node.js and pnpm
6. Clone repo and build

### Option 4: Physical Machines

**If you have access to Windows/Linux machines:**
- Ideal for performance testing
- Follow respective installation steps above

### Quick Test Without Full Setup

**Cross-compile from macOS (builds but can't test):**
```bash
# Windows (requires mingw)
rustup target add x86_64-pc-windows-gnu
cargo build --target x86_64-pc-windows-gnu

# Linux (requires cross-compilation tools)
rustup target add x86_64-unknown-linux-gnu
# More complex - use GitHub Actions instead
```

**Recommendation:** Use GitHub Actions for automated testing, set up one VM (Windows or Linux) for interactive development.

## Code Patterns & Standards

### Path Handling

**Rule:** Frontend NEVER manipulates paths with string operations. Either use backend commands OR rely on normalized paths.

```typescript
// ❌ NEVER
const dir = path.substring(0, path.lastIndexOf('/'))
const filename = path.split('/').pop()
const newPath = `${directory}/${filename}`

// ✅ Option A: Use backend
const dir = await invoke('get_directory', { path })
const filename = await invoke('get_filename', { path })
const newPath = await invoke('join_paths', { directory, filename })

// ✅ Option B: Use normalized paths (after Phase 1)
// Backend guarantees all paths use forward slashes
const filename = path.split('/').pop() // Safe now
const newPath = `${directory}/${filename}` // Safe for display only, not for invoke()
```

**Rust Pattern:**
```rust
// ALWAYS use PathBuf/Path for manipulation
use std::path::{Path, PathBuf};

fn process_path(path_str: &str) -> Result<String, String> {
    let path = Path::new(path_str);

    // Do operations
    let parent = path.parent();
    let filename = path.file_name();

    // Normalize for serialization
    Ok(normalize_path_for_serialization(&path))
}
```

### Platform Detection

```typescript
// In a hook or component
import { platform } from '@tauri-apps/plugin-os'

const currentPlatform = await platform()

// For conditional rendering
{currentPlatform === 'windows' && <WindowsSpecificComponent />}

// For conditional logic
const shouldUseVibrancy = currentPlatform === 'macos'
```

### Conditional Compilation (Rust)

```rust
// Platform-specific code
#[cfg(target_os = "windows")]
fn platform_specific_function() {
    // Windows implementation
}

#[cfg(target_os = "macos")]
fn platform_specific_function() {
    // macOS implementation
}

#[cfg(target_os = "linux")]
fn platform_specific_function() {
    // Linux implementation
}

// Or use common code with platform-specific parts
fn common_function() {
    // Common logic

    #[cfg(target_os = "windows")]
    {
        // Windows-specific part
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Unix-like systems
    }
}
```

## Testing Checklist

Run this on each platform before marking phase complete:

### Core Functionality
- [ ] App launches
- [ ] App doesn't crash immediately
- [ ] Can open preferences
- [ ] Can select project folder
- [ ] Can open existing project
- [ ] Collections load correctly
- [ ] Files list appears

### File Operations
- [ ] Can open file for editing
- [ ] Can edit file content
- [ ] Can save file (Cmd/Ctrl+S)
- [ ] Auto-save works (wait 2 seconds after edit)
- [ ] Can create new file
- [ ] Can duplicate file
- [ ] Can delete file
- [ ] Can rename file

### Navigation
- [ ] Can switch between collections
- [ ] Can navigate subdirectories
- [ ] Can search files (if applicable)
- [ ] Sidebar shows correct file tree

### Frontmatter
- [ ] Frontmatter panel opens
- [ ] Can edit frontmatter fields
- [ ] Changes save correctly
- [ ] Schema validation works

### Editor
- [ ] CodeMirror renders correctly
- [ ] Syntax highlighting works
- [ ] Can use keyboard shortcuts
- [ ] Can format text (bold, italic, etc.)
- [ ] Can insert links

### UI
- [ ] Title bar renders correctly
- [ ] Window can be dragged via title bar
- [ ] Window controls work (close/minimize/maximize)
- [ ] Panels can be toggled
- [ ] Resizing works
- [ ] Dark mode works (if applicable)

### Assets
- [ ] Can copy image to assets
- [ ] Image preview works
- [ ] Drag and drop files works

### Context Menus
- [ ] Right-click on file shows menu
- [ ] "Reveal in Finder/Explorer" works
- [ ] "Copy Path" works
- [ ] "Open in IDE" works (if IDE configured)

### Keyboard Shortcuts
- [ ] Cmd/Ctrl+S saves
- [ ] Cmd/Ctrl+N new file
- [ ] Cmd/Ctrl+W close file
- [ ] Cmd/Ctrl+1 toggle sidebar
- [ ] Cmd/Ctrl+2 toggle frontmatter
- [ ] Cmd/Ctrl+P command palette
- [ ] Cmd/Ctrl+, preferences

### Platform-Specific
**Windows Only:**
- [ ] No crashes from path separators
- [ ] Window decorations look native
- [ ] Installer works

**Linux Only:**
- [ ] Package installs correctly
- [ ] Webkit renders properly

## Troubleshooting

### App won't open project on Windows
**Check:**
- Are paths being normalized to forward slashes in Rust?
- Look for `path.split('/')` errors in console
- Check if `validate_project_path()` has Windows paths

**Fix:** Review Phase 1 path normalization

### Preferences crash on Windows
**Check:**
- Does `get_available_ides()` return empty array?
- Is SelectItem receiving empty string?

**Fix:** Review Phase 2 IDE integration

### Title bar looks wrong on Windows
**Check:**
- Is platform detection working?
- Is `UnifiedTitleBarWindows` being rendered?
- Check CSS for macOS-specific styles

**Fix:** Review Phase 3 platform detection

### Build fails on Windows
**Check:**
- Are all dependencies installed?
- Is `window-vibrancy` dependency conditional?
- Check Cargo.toml for macOS-only features

**Fix:** Review Cargo.toml conditional compilation

## Known Limitations & Trade-offs

### What We're Not Doing (For Now)

1. **Windows-specific features:**
   - Windows 11 Snap Layouts (could add `tauri-plugin-decorum` later)
   - Windows notifications integration
   - Windows Hello integration

2. **Linux-specific features:**
   - GNOME/KDE-specific integrations
   - Wayland vs X11 optimizations
   - Flatpak/Snap packaging (DEB/AppImage only initially)

3. **Performance optimizations:**
   - Platform-specific rendering optimizations
   - Different WebView tuning

4. **Accessibility:**
   - Not specifically testing screen readers on Windows/Linux
   - (Should work via standard web a11y, but not verified)

### Design Trade-offs

**Why forward slashes everywhere?**
- Markdown images require forward slashes on all platforms
- Simpler frontend code (one pattern)
- Web convention (URLs, etc.)
- One place to normalize (Rust) vs 11+ places in TypeScript

**Why separate title bar components?**
- Platform-specific positioning (traffic lights left vs right)
- Platform-specific styling (vibrancy on macOS)
- Easier to maintain than one component with lots of conditionals
- Better matches platform conventions

**Why Windows before Linux?**
- Larger user base
- More likely to have Windows machines for testing
- Can use similar approach for Linux (both non-macOS)

## References & Research

### Official Documentation
- [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri Cross-Platform Compilation](https://v2.tauri.app/develop/cross-platform/)

### GitHub Issues
- [Issue #56: Windows Support](https://github.com/dannysmith/astro-editor/issues/56)

### Third-Party Tools
- [tauri-plugin-decorum](https://github.com/clearlysid/tauri-plugin-decorum) - Better Windows integration

### Platform-Specific Info

**WebView Engines:**
- macOS: WKWebView (WebKit)
- Windows: WebView2 (Chromium)
- Linux: webkit2gtk-4.1

**Minimum Versions:**
- Windows: Windows 10 1803+ (for WebView2)
- Linux: Ubuntu 22.04+ (for webkit2gtk-4.1)
- macOS: 10.15+ (current minimum)

**Known Issues from GitHub #56:**
1. Windows+P shortcut conflict (mitigated - we use Ctrl+P on Windows)
2. IDE detection returns empty list on Windows
3. Date picker off-by-one bug (may be platform-agnostic)
4. YAML frontmatter quoting issues (may be parser issue)

---

## Quick Start: Starting Phase 1

Ready to start implementing? Here's what to do:

1. **Set up a Windows test environment** (see [Dev Environment Setup](#development-environment-setup))
2. **Create a feature branch:** `git checkout -b feature/windows-support`
3. **Start with Rust path normalization:**
   - Create `src-tauri/src/utils/path.rs`
   - Add `normalize_path_for_serialization()` function
   - Update Collection, FileEntry serialization to use it
4. **Test on Windows** - try opening a project
5. **Fix crashes one by one** - console will show which paths are breaking
6. **Move to TypeScript files** - search for `split('/')` and `lastIndexOf('/')`
7. **Test again** - verify all file operations work

Check off tasks in Phase 1 as you complete them. When all acceptance criteria are met, move to Phase 2.
