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

## Result

**Bug still persists exactly the same way after fixes.**

This indicates the root cause has NOT been properly identified. The theoretical race conditions addressed may not be the actual cause.

## What We Need

To properly diagnose this, we need logs showing the bug actually happening:

### Required TypeScript Logging
Add to `ImageField.tsx handleFileSelect`:
```typescript
console.log('[ImageField] handleFileSelect called with:', filePath, 'for field:', name)
console.log('[ImageField] Current file:', currentFile?.path)
console.log('[ImageField] Starting file ID:', startingFileId)
// ... after async operation
console.log('[ImageField] File ID after operation:', currentFileNow?.id)
console.log('[ImageField] Updating field:', name, 'with path:', result.relativePath)
```

### Required Rust Logging
Add to `copy_file_to_assets_with_override`:
```rust
log::info!("[COPY_FILE] Starting copy for source: {}", source_path);
log::info!("[COPY_FILE] Collection: {}, current_file: {}", collection, current_file_path);
log::info!("[COPY_FILE] Attempting to create: {}", final_path_str);
log::info!("[COPY_FILE] Successfully created: {}", final_path_str);
```

### Reproduction Steps Needed
1. Which file are you editing?
2. What image are you selecting?
3. How are you selecting it (file picker dialog? drag-drop onto button)?
4. Does it happen immediately or after some delay?
5. Are you doing anything else while it processes (clicking, typing, switching files)?

## Potential Alternative Causes to Investigate

1. **React re-renders**: Is `ImageField` mounting/unmounting multiple times, each triggering `handleFileSelect`?
2. **FileUploadButton issues**: Is the button's `onFileSelect` callback being called multiple times?
3. **Store subscription loops**: Could Zustand subscriptions be triggering cascading updates?
4. **Auto-save interference**: Could auto-save be firing during image processing, causing issues?
5. **FrontmatterPanel re-rendering**: Could the entire panel be re-mounting, recreating all fields?

## Files Modified (Current Attempt)

- `src/components/frontmatter/fields/ImageField.tsx` - Added file-switching guard
- `src-tauri/src/commands/files.rs` - Changed to atomic file operations

## Next Steps

1. Add comprehensive logging as specified above
2. Reproduce the bug with logs active
3. Analyze the actual call sequence
4. Identify the real root cause (not theoretical race conditions)
5. Implement proper fix based on actual evidence

## Notes

- The bug is NOT related to the file-switching race condition (fix #1 didn't help)
- The bug is NOT related to TOCTOU in Rust (fix #2 didn't help)
- The bug is ONLY in frontmatter panel, not drag-and-drop to editor
- The number of duplicates is random (2-20+), suggesting something is calling the function in a loop
- Content wipe suggests something is corrupting the editor state or file save operation
