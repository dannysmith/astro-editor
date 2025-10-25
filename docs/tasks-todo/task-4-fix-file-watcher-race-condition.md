# Fix File Watcher Race Condition

**Priority**: MEDIUM (fix if time permits before 1.0.0, otherwise post-1.0.0)
**Effort**: ~0.5 day
**Type**: Reliability, edge case handling

## Problem

The current file watcher uses time-based tracking (`recentlySavedFile`) to distinguish between self-initiated saves and external file changes. This creates a race condition when save operations take longer than the timeout period.

**Evidence**: `src/store/editorStore.ts:356-398`

```typescript
// Set before save starts
set({ recentlySavedFile: currentFile.path })

await invoke('save_markdown_content', {
  // ... save operation (could take >1 second on slow disk)
})

// Clear after fixed 1-second delay
setTimeout(() => {
  set({ recentlySavedFile: null })
}, 1000)  // ⚠️ ASSUMES save completes within 1 second
```

## Race Condition Scenario

**Timeline**:
1. **t=0ms**: User triggers save
2. **t=0ms**: `recentlySavedFile` set to file path
3. **t=0ms**: `invoke('save_markdown_content')` starts (async)
4. **t=1000ms**: Timeout fires, clears `recentlySavedFile` to null
5. **t=1500ms**: Save operation completes (slow disk, large file, etc.)
6. **t=1500ms**: File watcher detects change
7. **t=1500ms**: Check `recentlySavedFile` → **null** (already cleared!)
8. **t=1500ms**: Treats as external change, invalidates queries
9. **Potential**: Query refetch triggers reload, potentially triggering another save
10. **Result**: Infinite loop or unnecessary re-renders

## When This Can Happen

**Common triggers**:
- Slow mechanical hard drives
- Network-mounted drives (SMB, NFS)
- Large files with complex frontmatter
- Slow anti-virus scanning
- System under heavy I/O load
- Background backup software interfering

**Frequency**: Rare under normal conditions, but reproducible under stress.

## Current Implementation

**File watcher setup**: `src/store/projectStore.ts:166-180`
```typescript
const unlistenFileChanged = await listen('file-changed', (event) => {
  // Dispatch custom event for editor store to handle recently saved file logic
  window.dispatchEvent(
    new CustomEvent('file-changed', {
      detail: event.payload,
    })
  )
})
```

**Note**: The `recentlySavedFile` tracking exists in editorStore but the actual check logic may be incomplete or in a different location. Investigation needed to find where this check happens.

## Requirements

**Must Have**:
- [ ] Reliably distinguish between self-initiated saves and external changes
- [ ] No infinite loops under any disk speed conditions
- [ ] No false positives (treating our save as external change)
- [ ] No false negatives (treating external change as our save)

**Should Have**:
- [ ] Solution that doesn't rely on timing assumptions
- [ ] Clear debugging visibility (log when ignoring vs processing changes)

**Nice to Have**:
- [ ] Handle multiple rapid saves correctly
- [ ] Handle concurrent saves from multiple app instances (future-proofing)

## Solution: Version-Based Tracking

Replace time-based tracking with version-based tracking.

### Approach

```typescript
interface EditorState {
  currentFile: FileEntry | null
  editorContent: string
  frontmatter: Record<string, unknown>
  isDirty: boolean

  // Replace recentlySavedFile with:
  saveVersion: number         // Increments on each save
  lastWatcherVersion: number  // Last version seen from file watcher
}

const useEditorStore = create<EditorState>((set, get) => ({
  // ... other state
  saveVersion: 0,
  lastWatcherVersion: 0,

  saveFile: async (showToast = true) => {
    const { currentFile, saveVersion } = get()
    const currentSaveVersion = saveVersion + 1

    // Increment version before save
    set({ saveVersion: currentSaveVersion })

    try {
      await invoke('save_markdown_content', {
        // ... file data
        saveVersion: currentSaveVersion,  // Send to Rust
      })

      set({ isDirty: false })

      // Version-based tracking means we don't need timeouts
      // File watcher will check version and ignore

    } catch (error) {
      // On error, don't increment version (save didn't complete)
      set({ saveVersion: saveVersion })  // Rollback
      throw error
    }
  },
}))

// File watcher handler
const handleFileChanged = (event: CustomEvent) => {
  const { saveVersion, lastWatcherVersion } = useEditorStore.getState()

  // If file watcher event version <= our save version, it's our own save
  if (event.detail.version <= saveVersion) {
    console.log('File watcher: ignoring self-save (version', event.detail.version, ')')
    useEditorStore.setState({ lastWatcherVersion: event.detail.version })
    return
  }

  // External change detected
  console.log('File watcher: external change detected (version', event.detail.version, ')')

  // Invalidate queries to reload
  void queryClient.invalidateQueries({
    queryKey: queryKeys.fileContent(projectPath, fileId),
  })
}
```

### Benefits

- **No timing assumptions**: Works regardless of save duration
- **Reliable**: Mathematical comparison, not time-based heuristic
- **Simple**: Version counter is easier to reason about than timeouts
- **Debuggable**: Can log versions to trace save/watcher interactions
- **Future-proof**: Handles concurrent saves if we ever support multi-window

### Rust Backend Changes

The Rust file watcher needs to include version information in events:

```rust
// src-tauri/src/commands/files.rs
#[tauri::command]
pub async fn save_markdown_content(
    // ... existing params
    save_version: Option<u64>,
) -> Result<(), String> {
    // ... save logic

    // Emit file-changed event with version
    app.emit_all("file-changed", FileChangedPayload {
        path: file_path.to_string(),
        version: save_version,
    })?;

    Ok(())
}
```

## Alternative: Content Hash

Instead of version numbers, track content hash:

```typescript
saveFile: async () => {
  const contentHash = hashContent(frontmatter, editorContent)
  set({ lastSavedHash: contentHash })

  await invoke('save_markdown_content', { /* ... */ })
}

// File watcher checks hash
const currentHash = hashContent(frontmatter, editorContent)
if (currentHash === lastSavedHash) {
  // This is our save, ignore
  return
}
```

**Pros**: No Rust changes needed, purely frontend
**Cons**: Less reliable (hash collisions possible), more computation

## Implementation Steps

1. **Add version tracking to editorStore**
   - Add `saveVersion` and `lastWatcherVersion` state
   - Increment `saveVersion` in `saveFile()`
   - Remove `recentlySavedFile` and timeout logic

2. **Update Rust backend**
   - Modify `save_markdown_content` to accept `saveVersion`
   - Include version in `file-changed` event payload
   - Update TypeScript types for event payload

3. **Implement file watcher handler**
   - Find/create handler for `file-changed` event
   - Add version comparison logic
   - Add logging for debugging

4. **Remove old time-based logic**
   - Remove `recentlySavedFile` state
   - Remove timeout that clears it
   - Clean up any references

5. **Test thoroughly**
   - Normal save on fast disk
   - Save on slow disk (simulate with sleep)
   - External file changes (edit in another editor)
   - Rapid saves
   - Save failure scenarios

## Testing Strategy

### Unit Tests
- Version increment logic
- Version comparison logic
- Rollback on save failure

### Integration Tests
- Save completes quickly (< 1 second)
- Save takes long time (> 1 second) - simulate with delay
- External file change during save
- Multiple rapid saves

### Manual Testing
1. Open file, edit, save - verify no reload
2. Edit file externally while app open - verify reload
3. Save large file on slow disk - verify no reload loop
4. Monitor console logs for version tracking

## Success Criteria

- [ ] Version tracking implemented in editorStore
- [ ] Rust backend includes version in file-changed events
- [ ] File watcher correctly ignores self-saves
- [ ] File watcher correctly processes external changes
- [ ] No infinite loops under any conditions
- [ ] Works correctly on slow disks (tested with artificial delay)
- [ ] All tests pass
- [ ] Clear logging for debugging

## Out of Scope

- Handling multiple app instances modifying same file (future enhancement)
- Conflict resolution UI (separate feature)
- Undo/redo integration (separate feature)

## Risk Assessment

**Implementation Risk**: Low
- Well-understood pattern
- Localized changes
- Rust changes are minimal

**Testing Risk**: Medium
- Need to test timing-dependent scenarios
- Requires disk I/O simulation
- Edge cases may be hard to reproduce

**Deployment Risk**: Low
- Backwards compatible (new version field is optional)
- Degrades gracefully if version not present

## References

- Current implementation: `src/store/editorStore.ts:356-398`
- File watcher setup: `src/store/projectStore.ts:166-180`
- Staff Engineering Review: `docs/reviews/2025-staff-engineering-review.md` (Issue #5)
- Staff Engineer Review: `docs/reviews/staff-engineer-review-2025-10-24.md` (mentioned in context)

## Recommendation

**If time permits before 1.0.0**: Fix this to prevent potential support issues with users on slow disks or network drives.

**If time-constrained**: Ship 1.0.0 as-is and fix in 1.0.1 or 1.1.0. The race condition is rare and the worst case is an unnecessary reload, not data loss.

**Estimated effort**: 4 hours (2 hours implementation, 2 hours testing)
