# Task: Fix Image Field Race Condition Bug

## Original Bug Report (2025-11-07)

When adding a cover image to a book item in the demo project via the frontmatter panel, the system appears to run the code to rename and copy the image multiple times. The number of times is random (sometimes 2-3, sometimes 20+). This results in:

1. **Multiple duplicate files** in the assets directory:
   - `2025-11-07-braiding-sweetgrass-cover.jpg`
   - `2025-11-07-braiding-sweetgrass-cover-1.jpg`
   - `2025-11-07-braiding-sweetgrass-cover-2.jpg`
   - etc.

2. **Content wipe**: Sometimes the file content is completely wiped EXCEPT for the single `cover: <path>` line of YAML and the surrounding `---` delimiters

**Important**: This does NOT happen when dragging files/images into the editor - only when using the frontmatter panel image field.

## Hypothesis and Initial Fixes (2025-11-07)

### Bug #1: File Switching Race Condition
**Theory**: User switches files while async image processing is in progress, causing frontmatter update to apply to wrong file.

**Fix Applied**: Added file-switching guard in `ImageField.tsx:76-87`:
```typescript
const startingFileId = currentFile?.id
// ... async operation ...
const { currentFile: currentFileNow } = useEditorStore.getState()
if (currentFileNow?.id !== startingFileId) {
  return // Abort to prevent data corruption
}
```

### Bug #2: Rust TOCTOU Race Condition
**Theory**: Multiple simultaneous calls to `copy_file_to_assets_with_override` all check if file exists, then all write their own copies.

**Fix Applied**: Replaced check-then-act pattern with atomic file creation using `OpenOptions::create_new()` in `src-tauri/src/commands/files.rs:257-262`:
```rust
match fs::OpenOptions::new()
    .write(true)
    .create_new(true)  // Fails atomically if file exists
    .open(&validated_path)
{
    Ok(_) => {
        fs::copy(&source_path, &validated_path)?;
        break validated_path;
    }
    Err(e) if e.kind() == ErrorKind::AlreadyExists => {
        counter += 1;
        continue;
    }
}
```

## Result After Initial Fixes

**Bug still persists exactly the same way after fixes.**

This indicated the root cause had NOT been properly identified. The theoretical race conditions addressed were not the actual cause.

## ROOT CAUSE IDENTIFIED (2025-11-07)

### The Real Bug: Tauri Drag-Drop Event Fires Twice

The comprehensive logging revealed the actual issue:

**Evidence from logs:**
- `handleFileSelect` called **twice**, just **3ms apart**
- Call 1: `1762485575450-jawfqozzj` at `03:19:35.450Z`
- Call 2: `1762485575453-ylphwhxro` at `03:19:35.453Z`
- Both calls race to Rust's `copy_file_to_assets_with_override` simultaneously
- First call creates base file successfully
- Second call gets `AlreadyExists` error and creates `-2` version

### Why This Happens

The `tauri://drag-drop` event is fired multiple times by Tauri for a single drag operation. This is either:
1. A Tauri framework behavior/bug
2. Multiple event listeners being registered

The `FileUploadButton` component had no deduplication logic, so both events passed through to `onFileSelect`.

### The Fix (Updated)

**First attempt failed** - per-component deduplication didn't work because timing issues.

**Second attempt** - Added GLOBAL deduplication at module level in `FileUploadButton.tsx:8-14,181-200`:

```typescript
// GLOBAL deduplication tracker for drag-drop events
const globalDragDropTracker = {
  lastFile: null as string | null,
  lastTime: 0,
  THRESHOLD_MS: 100,
}

// In event handler, IMMEDIATELY after getting filePath:
const now = Date.now()
if (
  globalDragDropTracker.lastFile === filePath &&
  now - globalDragDropTracker.lastTime < globalDragDropTracker.THRESHOLD_MS
) {
  console.log(`[FileUploadButton] BLOCKED duplicate drag-drop event`)
  return
}

// Update GLOBAL tracking IMMEDIATELY (before any async work)
globalDragDropTracker.lastFile = filePath
globalDragDropTracker.lastTime = now
```

**Why global?** Tauri's duplicate event firing affects all instances, so deduplication must be at module level, not component level.

**When to expect the log:** If bug persists, you'll see `BLOCKED duplicate drag-drop event` in console.

## Comprehensive Logging Added (2025-11-07)

### Added Logs

**TypeScript Layer (`ImageField.tsx`):**
- Unique call ID generated for each `handleFileSelect` invocation
- Start timestamp and parameters logged
- Context capture (project path, file, collection)
- Before/after processFileToAssets logging
- File switch detection with warnings
- Success/error/finally logging

**TypeScript Layer (`processFileToAssets.ts`):**
- Function entry with all parameters
- isInProject check results
- Copy vs reuse path decisions
- Rust command invocations
- Success with final result

**Rust Layer (`src-tauri/src/commands/files.rs`):**
- Function entry with source path, collection, current file
- Validated paths
- Assets directory determination
- Atomic file creation loop attempts
- File creation success/failure
- Copy completion
- Final path return (relative/absolute)

All logs use prefixes: `[ImageField:{callId}]`, `[processFileToAssets]`, `[COPY_FILE_OVERRIDE]`

### Next Steps: Reproduction with Logs

**Please reproduce the bug** with the logging now in place and provide:

1. **Complete console output** (browser DevTools console)
2. **Complete server output** (terminal where `pnpm run tauri:dev` is running)
3. **Specific reproduction steps:**
   - Which file are you editing?
   - What image are you selecting?
   - How are you selecting it (drag to button, click button then file picker)?
   - Does it happen immediately or after some delay?
   - Are you doing anything else while it processes?

## Potential Alternative Causes to Investigate

1. **React re-renders**: Is `ImageField` mounting/unmounting multiple times, each triggering `handleFileSelect`?
2. **FileUploadButton issues**: Is the button's `onFileSelect` callback being called multiple times?
3. **Store subscription loops**: Could Zustand subscriptions be triggering cascading updates?
4. **Auto-save interference**: Could auto-save be firing during image processing, causing issues?
5. **FrontmatterPanel re-rendering**: Could the entire panel be re-mounting, recreating all fields?

## Files Modified

### Initial Attempts (Failed)
- `src/components/frontmatter/fields/ImageField.tsx` - Added file-switching guard (didn't fix bug)
- `src-tauri/src/commands/files.rs` - Changed to atomic file operations (didn't fix bug)

### Diagnostic Logging
- `src/components/frontmatter/fields/ImageField.tsx` - Added comprehensive call tracing
- `src/lib/files/fileProcessing.ts` - Added processing pipeline logging
- `src-tauri/src/commands/files.rs` - Added Rust function logging

### Actual Fix
- **`src/components/tauri/FileUploadButton.tsx:174-191`** - Added deduplication for Tauri drag-drop events

## Testing Results

**✅ FIX CONFIRMED WORKING (2025-11-07)**

Test performed:
1. Opened demo project
2. Opened `braiding-sweetgrass.mdx`
3. Dragged image to cover field
4. **Result**: Only ONE file created (no `-2` duplicate)

Console logs showed successful deduplication:
```
[FileUploadButton] Drag-drop event received, disabled: false, isProcessing: false
[FileUploadButton] Processing file drop: /Users/danny/Desktop/Brading Sweetgrass Cover.jpg
[FileUploadButton] Drag-drop event received, disabled: false, isProcessing: false
[FileUploadButton] BLOCKED duplicate drag-drop event for: /Users/danny/Desktop/Brading Sweetgrass Cover.jpg (2ms ago) ✅
```

Server logs confirmed only ONE Rust function call (no duplicate file creation).

## Cleanup

Removed diagnostic logging from:
- `ImageField.tsx` - Removed verbose call tracing
- `processFileToAssets.ts` - Removed step-by-step logging
- `src-tauri/src/commands/files.rs` - Removed Rust debug logging

Kept `FileUploadButton` logging in DEV mode for future debugging.

## Notes

- The bug is NOT related to the file-switching race condition (fix #1 didn't help)
- The bug is NOT related to TOCTOU in Rust (fix #2 didn't help)
- The bug is ONLY in frontmatter panel, not drag-and-drop to editor
- The number of duplicates is random (2-20+), suggesting something is calling the function in a loop
- Content wipe suggests something is corrupting the editor state or file save operation
