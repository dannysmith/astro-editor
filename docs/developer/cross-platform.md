# Cross-Platform Development Guide

## Overview

Astro Editor supports macOS, Windows, and Linux. This guide documents the patterns and configurations used to achieve cross-platform compatibility while maintaining platform-native experiences.

## Platform Support Summary

| Platform | Title Bar | Window Chrome | Dependencies |
|----------|-----------|---------------|--------------|
| macOS | Custom (traffic lights) | `decorations: false`, vibrancy | `window-vibrancy` |
| Windows | Custom (controls on right) | `decorations: false` | None |
| Linux | Native + toolbar | `decorations: true` | None |

## Conditional Compilation (Rust)

### Cargo.toml Configuration

Platform-specific dependencies are handled using Cargo's target-specific dependencies:

```toml
[dependencies]
# Base tauri features (cross-platform)
# Note: macos-private-api is kept here because tauri-build's feature check
# runs before Cargo resolves target-specific deps. It's a no-op on other platforms.
tauri = { version = "2", features = ["macos-private-api", "protocol-asset"] }

# macOS-only dependencies
[target.'cfg(target_os = "macos")'.dependencies]
window-vibrancy = "0.6"
```

### Conditional Code in Rust

Use `#[cfg()]` attributes for platform-specific code:

```rust
// Conditional import
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

// Conditional execution
#[cfg(target_os = "macos")]
{
    if let Some(window) = app.get_webview_window("main") {
        let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
    }
}
```

### Desktop vs Mobile

For dependencies that should only compile for desktop:

```toml
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2"
```

## Tauri Configuration

### Config Merging

Tauri uses JSON Merge Patch (RFC 7396) to merge platform-specific configs:

- `tauri.conf.json` - Base configuration (safe cross-platform defaults)
- `tauri.macos.conf.json` - macOS overrides
- `tauri.windows.conf.json` - Windows overrides
- `tauri.linux.conf.json` - Linux overrides

Platform-specific configs are **automatically** detected and merged during build.

### Base Configuration (`tauri.conf.json`)

The base config uses safe cross-platform defaults:

```json
{
  "app": {
    "windows": [{
      "decorations": true,
      "shadow": true
    }]
  }
}
```

### macOS Configuration (`tauri.macos.conf.json`)

```json
{
  "app": {
    "windows": [{
      "decorations": false,
      "transparent": true
    }],
    "macOSPrivateApi": true
  }
}
```

### Windows Configuration (`tauri.windows.conf.json`)

```json
{
  "app": {
    "windows": [{
      "decorations": false
    }]
  }
}
```

### Linux Configuration (`tauri.linux.conf.json`)

```json
{
  "app": {
    "windows": [{
      "decorations": true
    }]
  }
}
```

### Required Capabilities

Window dragging must be permitted in capabilities:

```json
// capabilities/default.json
{
  "permissions": [
    "core:window:allow-start-dragging"
  ]
}
```

## Platform Detection (React)

### usePlatform Hook

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
```

### Platform-Specific Strings

```typescript
// src/lib/platform-strings.ts
const strings = {
  revealInFileManager: {
    macos: 'Reveal in Finder',
    windows: 'Show in Explorer',
    linux: 'Show in File Manager',
  },
  // Add more as needed
} as const
```

## Title Bar Architecture

### Component Structure

```
src/components/layout/titlebar/
├── UnifiedTitleBar.tsx          # Platform router
├── UnifiedTitleBarMacOS.tsx     # macOS implementation
├── UnifiedTitleBarWindows.tsx   # Windows implementation
├── UnifiedTitleBarLinux.tsx     # Linux implementation (toolbar only)
├── shared/                      # Shared components
│   ├── TitleBarToolbar.tsx
│   └── WindowControls.tsx
└── index.ts
```

### Platform Router

```typescript
// UnifiedTitleBar.tsx
export function UnifiedTitleBar({ forcePlatform }: { forcePlatform?: AppPlatform }) {
  const detectedPlatform = usePlatform()
  const platform = forcePlatform ?? detectedPlatform

  if (!platform) return null

  switch (platform) {
    case 'macos':
      return <UnifiedTitleBarMacOS />
    case 'windows':
      return <UnifiedTitleBarWindows />
    case 'linux':
      return <UnifiedTitleBarLinux />
  }
}
```

### Window Dragging

For custom title bars, use `data-tauri-drag-region`:

```tsx
<div data-tauri-drag-region className="titlebar">
  {/* Content */}
</div>
```

**Important for Windows:** For proper touch/pen support:

```css
*[data-tauri-drag-region] {
  app-region: drag;
}
```

### Window Controls (Windows)

Wire up minimize/maximize/close buttons:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

// Minimize
await appWindow.minimize()

// Toggle maximize
await appWindow.toggleMaximize()

// Close
await appWindow.close()
```

## Known Issues and Workarounds

### Opacity Transitions (WebKit)

**Problem:** Opacity fade transitions on Windows title bar didn't work properly.

**Solution:** Add `transform-gpu` class to the container. This forces GPU compositing and fixes a WebKit quirk where child elements don't participate in parent opacity transitions.

```tsx
<div className="transform-gpu">
  {/* Children now properly fade with parent */}
</div>
```

### tauri-build Feature Checking

**Problem:** `tauri-build` checks Cargo.toml features against config values before Cargo resolves target-specific dependencies.

**Workaround:** Keep `macos-private-api` in base `[dependencies]` even though it's macOS-specific. It's a no-op on other platforms but satisfies the build-time check.

## Testing Cross-Platform

### Visual Testing on macOS

Use the `forcePlatform` prop during development:

```tsx
// Force Windows layout for testing
<UnifiedTitleBar forcePlatform="windows" />
```

### CI/CD Matrix

```yaml
strategy:
  matrix:
    include:
      - platform: 'macos-14'
        args: '--target universal-apple-darwin'
      - platform: 'windows-latest'
        args: ''
      - platform: 'ubuntu-22.04'
        args: ''
```

### Linux Dependencies

When building on Linux (Ubuntu), install:

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

## Related Documentation

- [Tauri Window Customization](https://v2.tauri.app/learn/window-customization/)
- [Tauri Cross-Platform Compilation](https://v2.tauri.app/develop/cross-platform/)
- [Architecture Guide](./architecture-guide.md)
