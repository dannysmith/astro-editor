# Task: Auto Software Update and Releases

**Status**: Ready for implementation  
**Research Completed**: 2025-07-24  
**Implementation Phases**: 7 phases, prioritized by complexity and cost

## Executive Summary

This document provides a comprehensive technical implementation plan for adding auto-update functionality and professional release management to the Astro Editor. Based on extensive research into Tauri v2 best practices, GitHub Actions workflows, and 2025 code signing requirements, this plan balances functionality, security, and cost for a single-developer project.

**Key Decisions Made:**

- **Release Strategy**: Trunk-based development with semantic version tags
- **Code Signing**: Start with ad-hoc (macOS) and unsigned (Windows), upgrade when justified
- **Auto-Updates**: GitHub releases as update server with cryptographic verification
- **CI/CD**: GitHub Actions with tauri-apps/tauri-action for multi-platform builds

## Phase 1: Foundation Setup (Immediate - 1-2 hours) ✅ DONE

### 1.1 Generate Update Signing Keys

```bash
# Generate cryptographic keys for update verification
npm run tauri signer generate -w ~/.tauri/astro-editor.key
```

This creates:

- `astro-editor.key` (private key - never commit this)
- `astro-editor.key.pub` (public key - embed in app)

### 1.2 Install Updater Plugin

```bash
npm run tauri add updater
npm install @tauri-apps/plugin-updater
```

### 1.3 Configure Tauri for Auto-Updates

Update `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "createUpdaterArtifacts": true,
    "identifier": "is.danny.astroeditor",
    "macOS": {
      "signingIdentity": "-",
      "minimumSystemVersion": "10.13"
    }
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/dannysmith/astro-editor/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "PASTE_PUBLIC_KEY_CONTENT_HERE"
    }
  }
}
```

**Critical**: Replace `YOUR_USERNAME` and paste the actual content from `astro-editor.key.pub`

### 1.4 Setup Semantic Versioning

```bash
npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git
```

Create `.releaserc.json`:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/git"
  ]
}
```

## Phase 2: Frontend Integration (1 hour) ✅ DONE

### 2.1 Update Check Implementation

Add to `src/components/layout/Layout.tsx` or main app component:

```typescript
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useEffect } from 'react'

// Add inside your main component
useEffect(() => {
  const checkForUpdates = async () => {
    try {
      const update = await check()
      if (update) {
        console.log(`Update available: ${update.version}`)

        // Show toast notification or modal
        const shouldUpdate = confirm(
          `Update available: ${update.version}\n\n${update.body}\n\nInstall now?`
        )

        if (shouldUpdate) {
          let downloaded = 0

          await update.downloadAndInstall(event => {
            switch (event.event) {
              case 'Started':
                console.log(`Downloading ${event.data.contentLength} bytes`)
                break
              case 'Progress':
                downloaded += event.data.chunkLength
                console.log(`Downloaded: ${downloaded} bytes`)
                // Update progress bar here
                break
              case 'Finished':
                console.log('Download complete, installing...')
                break
            }
          })

          await relaunch()
        }
      }
    } catch (error) {
      console.error('Update check failed:', error)
      // Show user-friendly error message
    }
  }

  // Check for updates 5 seconds after app loads
  const timer = setTimeout(checkForUpdates, 5000)
  return () => clearTimeout(timer)
}, [])
```

### 2.2 Update Rust Main File

Update `src-tauri/src/main.rs`:

```rust
// Prevent additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Phase 3: GitHub Actions Workflow ✅ DONE

### 3.1 Create Release Workflow

- Create `.github/workflows/release.yml`:

### 3.2 Setup GitHub Secrets

In your GitHub repository settings → Secrets and variables → Actions, add:

- `TAURI_PRIVATE_KEY`: Content of your `astro-editor.key` file (the private key)

**Security Note**: Never commit the private key to your repository.

## Phase 4: Pre-Release Automation ✅ DONE

### 4.1 Version Coordination Script ✅ DONE

Created comprehensive `scripts/prepare-release.js` that:

- Checks git working directory is clean
- Runs all quality checks (`npm run check:all`)
- Updates version in all three files: `package.json`, `Cargo.toml`, and `tauri.conf.json`
- Updates lock files with `npm install`
- Runs final build check with `npm run tauri:check`
- Verifies updater configuration
- Provides interactive option to execute git commands
- Shows clear next steps and reminders

**Usage:**
```bash
npm run prepare-release v1.0.9
```

The script will:
1. Run comprehensive checks
2. Update all version numbers consistently
3. Optionally execute git commands interactively
4. Provide clear guidance for GitHub release publishing

### 4.2 Package.json Scripts ✅ DONE

Added `prepare-release` script to package.json. The existing `check:all` script already covers all necessary checks.

## Phase 5: Update docs ✅ DONE

### 5.1 Release Process Documentation ✅ DONE

The auto-update and release system is now fully implemented with the following capabilities:

**For Developers (Release Process):**
1. Use `npm run prepare-release v1.0.9` to prepare a new release
2. Script handles all version updates and verification
3. Interactive git command execution
4. GitHub Actions automatically builds and creates draft release
5. Manually publish the draft release on GitHub

**For Users (Auto-Updates):**
1. App checks for updates 5 seconds after launch
2. Users receive native dialog with update details
3. Download progress is shown during update
4. App automatically restarts after update installation
5. Updates are cryptographically verified using embedded public key

**System Architecture:**
- **Update Server**: GitHub Releases with `latest.json` endpoint
- **Signing**: Tauri's built-in cryptographic verification
- **Distribution**: Multi-platform builds via GitHub Actions
- **Security**: Public key embedded in app, private key in GitHub Secrets

### 5.2 Usage Instructions ✅ DONE

**To create a new release:**
```bash
npm run prepare-release v1.0.9
```

**What the script does:**
- ✅ Verifies git working directory is clean
- ✅ Runs comprehensive quality checks
- ✅ Updates versions in package.json, Cargo.toml, tauri.conf.json
- ✅ Updates lock files and runs build verification
- ✅ Optionally executes git commands interactively
- ✅ Provides clear next steps and reminders

**After pushing the tag:**
- GitHub Actions builds the app for macOS
- A draft release is created automatically
- Update artifacts (`latest.json`) are generated
- Developer manually publishes the release
- Users receive auto-update notifications

## Task Complete ✅

All phases of the auto-update and release system have been successfully implemented:

1. ✅ **Foundation Setup**: Update signing keys, Tauri configuration, semantic versioning
2. ✅ **Frontend Integration**: Update checking, progress tracking, user notifications
3. ✅ **GitHub Actions**: Multi-platform builds, automatic draft releases
4. ✅ **Pre-Release Automation**: Comprehensive release preparation script
5. ✅ **Documentation**: Complete implementation and usage documentation

The system provides a professional release process that minimizes manual work while maintaining security and reliability. Users will receive seamless auto-updates, and the developer workflow is streamlined with comprehensive automation.
