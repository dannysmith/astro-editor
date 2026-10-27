# Cross-Platform Development Guide

## Overview

Astro Editor supports macOS, Windows, and Linux. This guide documents the patterns and configurations used to achieve cross-platform compatibility while maintaining platform-native experiences.

## Platform Support Summary

| Platform | Title Bar | Window Chrome | Dependencies |
|----------|-----------|---------------|--------------|
| macOS | Custom (traffic lights) | `decorations: false`, vibrancy via `windowEffects` | None |
| Windows | Custom (controls on right) | `decorations: false` | None |
| Linux | Native + toolbar | `decorations: true` | None |

### Webview Versions

Each platform renders with a different engine, so CSS features have to work in all three:

- **macOS:** WKWebView, which is the system WebKit and updates with Safari. Tailwind v4 needs Safari 16.4+ and the colour tokens use `light-dark()` (Safari 17.5+), so in practice the app needs macOS 12 Monterey or later with current Safari updates. `minimumSystemVersion` in `tauri.conf.json` still says 10.15.
- **Windows:** WebView2, evergreen Chromium. Anything current works.
- **Linux:** the system WebKitGTK (`libwebkit2gtk-4.1`), or the copy the AppImage bundles from the ubuntu-22.04 build runner. Supported distros ship 2.50+ in their updates (Ubuntu 22.04 and 24.04, Debian 12), which has `light-dark()`.

## Conditional Compilation (Rust)

### Cargo.toml Configuration

Platform-specific dependencies are handled using Cargo's target-specific dependencies:

```toml
[dependencies]
# Base tauri features (cross-platform)
tauri = { version = "2", features = ["protocol-asset"] }
```

macOS window vibrancy uses Tauri's built-in `windowEffects` in `tauri.macos.conf.json` (see [macOS Configuration](#macos-configuration-taurimacosconfjson)), so no macOS-only crates are needed.

### Conditional Code in Rust

Use `#[cfg()]` attributes for platform-specific code:

```rust
// Conditional import
#[cfg(target_os = "macos")]
use tauri_plugin_window_state::WindowExt as _;

// Conditional execution
#[cfg(target_os = "macos")]
{
    // macOS-only setup
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

> **⚠️ Important: Arrays are replaced, not merged!**
>
> JSON Merge Patch replaces arrays entirely. If your platform config specifies a `windows` array, it completely replaces the base config's `windows` array. This means you must include ALL window settings in each platform config, not just the overrides.

### Base Configuration (`tauri.conf.json`)

The base config uses safe cross-platform defaults (serves as fallback if no platform config matches):

```json
{
  "app": {
    "windows": [{
      "title": "Astro Editor",
      "width": 1400,
      "height": 900,
      "minWidth": 1000,
      "minHeight": 700,
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
      "title": "Astro Editor",
      "width": 1400,
      "height": 900,
      "minWidth": 1000,
      "minHeight": 700,
      "decorations": false,
      "transparent": true,
      "windowEffects": { "effects": ["hudWindow"], "radius": 12 },
      "shadow": true
    }]
  }
}
```

### Windows Configuration (`tauri.windows.conf.json`)

```json
{
  "app": {
    "windows": [{
      "title": "Astro Editor",
      "width": 1400,
      "height": 900,
      "minWidth": 1000,
      "minHeight": 700,
      "decorations": false,
      "shadow": true
    }]
  }
}
```

### Linux Configuration (`tauri.linux.conf.json`)

```json
{
  "app": {
    "windows": [{
      "title": "Astro Editor",
      "width": 1400,
      "height": 900,
      "minWidth": 1000,
      "minHeight": 700,
      "decorations": true,
      "shadow": true
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

**Workaround:** Declare any Tauri feature that a config value requires (e.g. `protocol-asset` for `assetProtocol`) on the base `tauri` dependency, never only in a target-specific section. (Transparent windows and `windowEffects` no longer need `macOSPrivateApi` / `macos-private-api`, which have been no-ops since Tauri 2.12.1.)

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
