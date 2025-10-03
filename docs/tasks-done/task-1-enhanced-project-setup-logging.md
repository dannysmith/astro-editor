# Task 1: Enhanced Project Setup Logging

## Overview

Users are experiencing "Failed to set project - Unknown error occurred" during project setup. We need comprehensive logging that goes to macOS Console.app so users can easily extract logs for support.

## Problem Analysis

Based on codebase analysis, the project setup flow has multiple failure points:

1. **Project Registry Initialization** (`projectRegistryManager.initialize()`)
2. **Project Registration** (`projectRegistryManager.registerProject(path)`)
   - Project discovery (reading package.json, path validation)
   - Project ID generation and conflict resolution
   - Registry persistence
3. **Settings Loading** (`projectRegistryManager.getEffectiveSettings(projectId)`)
4. **File Watcher Setup** (`startFileWatcher()`)
   - Path validation and content directory detection
   - Tauri command execution

## Current Logging State

**Frontend Logging (via @tauri-apps/plugin-log → macOS Console):**
- ✅ Basic error logging in projectStore.ts (5 locations)
- ✅ Basic error logging in editorStore.ts (2 locations)
- ✅ Recovery system error logging
- ❌ No diagnostic context (app version, paths, system info)
- ❌ No detailed step-by-step project setup logging

**Backend Logging (via log crate → macOS Console):**
- ✅ IDE operations comprehensively logged
- ✅ Blocked directory access logged
- ❌ Project setup operations have minimal logging
- ❌ No structured diagnostic information

**Key Advantage:** All logs already go to macOS Console.app via Tauri's log plugin

## Implementation Plan

### 1. Enhanced Console Logging with Context

**Goal:** Make all project setup steps and errors clearly visible in macOS Console.app

**Key Changes:**
- Add app version and platform to startup logs
- Add step-by-step project setup logging  
- Ensure all Rust errors are properly logged
- Pass through JavaScript errors to logging system

### 2. Comprehensive Project Setup Logging

Add detailed logging at each step of project setup:

**Frontend (projectStore.ts):**
```typescript
// App startup context (log once on app start)
await info(`Astro Editor v${appVersion} started on ${platform}`)

// Project setup steps
await info(`Astro Editor [PROJECT_SETUP] Starting project setup: ${path}`)
await info(`Astro Editor [PROJECT_SETUP] Registering project: ${path}`)
await debug(`Astro Editor [PROJECT_SETUP] Project ID generated: ${projectId}`)
await info(`Astro Editor [PROJECT_SETUP] Loading project settings for: ${projectId}`)
await info(`Astro Editor [PROJECT_SETUP] Starting file watcher`)
await info(`Astro Editor [PROJECT_SETUP] Project setup completed successfully: ${projectId}`)

// Enhanced error logging with step identification
await error(`Astro Editor [PROJECT_SETUP] Failed at step: ${currentStep} - Path: ${path} - Error: ${error.message}`)
```

**Backend (Rust commands):**
```rust
// In scan_project command
info!("Astro Editor [PROJECT_SCAN] Scanning project at path: {}", project_path);
info!("Astro Editor [PROJECT_SCAN] Content directory: {:?}", content_directory.as_deref().unwrap_or("src/content"));

// In project discovery/registration
info!("Astro Editor [PROJECT_DISCOVERY] Reading package.json: {}/package.json", project_path);
info!("Astro Editor [PROJECT_DISCOVERY] Project name found: {}", project_name);

// Error handling - ensure all Rust errors make it to logs
error!("Astro Editor [PROJECT_SCAN] Scan failed for {}: {}", project_path, error);
error!("Astro Editor [PROJECT_DISCOVERY] Package.json read failed for {}: {}", project_path, error);
```

### 3. JavaScript Error Logging

Ensure uncaught JavaScript errors also go to console:

```typescript
// Add to main.tsx or App.tsx
window.addEventListener('error', async (event) => {
  await error(`Astro Editor [JS_ERROR] ${event.error?.message || event.message} at ${event.filename}:${event.lineno}`)
})

window.addEventListener('unhandledrejection', async (event) => {
  await error(`Astro Editor [PROMISE_REJECTION] ${event.reason}`)
})
```

### 4. Specific Implementation Steps

#### Step 1: App Context Logging
1. Add app version/platform logging to main.tsx startup
2. Create diagnostic helper in `src/lib/diagnostics.ts`

#### Step 2: Enhanced Frontend Logging  
1. Modify `projectStore.ts` with step-by-step logging
2. Add error context to all project-related failures
3. Add global error handlers for JS errors

#### Step 3: Enhanced Backend Logging
1. Add comprehensive logging to `scan_project` commands
2. Add logging to project registry file operations  
3. Ensure all Rust errors include path context

#### Step 4: Update Documentation
1. Update `docs/logging.md` with exact Console.app instructions
2. Add specific search terms users should use

### 5. Files to Modify

**New Files:**
- `src/lib/diagnostics.ts` - App version/platform helpers

**Modified Files:**
- `src/main.tsx` - Add global error handlers and startup logging
- `src/store/projectStore.ts` - Enhanced project setup logging
- `src/lib/project-registry/index.ts` - Registry operation logging  
- `src/lib/project-registry/utils.ts` - Project discovery logging
- `src-tauri/src/commands/project.rs` - Backend project logging
- `docs/logging.md` - Updated user instructions with search terms

### 6. User Support Workflow

After implementation, when a user reports project setup issues:

**You tell them:**
"Please open Console.app and search for 'Astro Editor' to see the logs, then copy and send me everything from the last few minutes."

**Or more specifically:**
"In Console.app, search for 'Astro Editor [PROJECT_SETUP]' to see exactly where the project setup failed."

### 7. Log Categories and Levels

**Info Level:**
- `Astro Editor [PROJECT_SETUP]` - Step-by-step project setup progress
- `Astro Editor [PROJECT_SCAN]` - Backend project scanning operations  
- `Astro Editor [PROJECT_DISCOVERY]` - Project metadata discovery
- `Astro Editor` startup with version info

**Error Level:**
- All failures with step identification and full context
- `Astro Editor [JS_ERROR]` - JavaScript runtime errors
- `Astro Editor [PROMISE_REJECTION]` - Unhandled promise rejections

**Debug Level:**
- Project ID generation details
- Settings loading specifics
- File path processing details

### 8. Success Criteria

- [ ] Every project setup failure is clearly tagged with step identifier
- [ ] App version and platform info available in startup logs
- [ ] All Rust command failures are logged with full context
- [ ] JavaScript errors are captured in macOS console
- [ ] Users can easily find relevant logs by searching for specific tags
- [ ] Support can identify exact failure points from console output

### 9. Testing Strategy

**Manual Testing:**
- Test with various project types (valid/invalid Astro projects)
- Test with permission issues  
- Test with corrupted package.json
- Test with missing directories
- Verify all scenarios produce searchable logs in Console.app

**Verification:**
- Search for `Astro Editor [PROJECT_SETUP]` shows complete project setup flow
- Search for `Astro Editor` shows all app logs including startup info with version
- All error scenarios include project path and step context
- Logs are easily filterable from macOS Console noise

This simplified approach leverages the existing macOS logging infrastructure without adding any user-facing features, making support much easier.