# Implement File Change Detection

**Priority**: MEDIUM-HIGH (recommended for 1.0.0)
**Effort**: ~2-3 hours
**Type**: Feature Implementation
**Status**: Not Started

---

## Executive Summary

### Current State
The file watcher system is **partially implemented**:
- ✅ Rust backend watches files and emits events (500ms debounce)
- ✅ TypeScript bridge re-dispatches events as DOM CustomEvents
- ❌ **No handler exists** to process file-changed events
- ❌ **recentlySavedFile tracking is unused** (set but never checked)

**Impact**: External file changes (edits in VS Code, file renames, etc.) are only visible after navigating away and back.

### The Core Principle

**The filesystem is the source of truth.** Astro Editor is just a better interface for editing files on disk. Therefore:

1. Changes made in Astro Editor should be written to disk
2. Changes on disk (from any source) should be reflected in Astro Editor
3. User's unsaved work takes priority over external changes
4. All of this should be performant (no unnecessary re-renders)

### The Simple Solution

**Dirty State Check** - no version tracking, no timestamps, no complexity:

```typescript
if (isDirty) {
  // User is editing - their version is authoritative
  return // Ignore external changes
}

// File is saved - safe to reload from disk
invalidateQuery() // TanStack Query handles the rest
```

### Why This Works

1. **During save**: `isDirty=true` until save completes → external changes ignored
2. **After save**: `isDirty=false` → external changes picked up
3. **While typing**: `isDirty=true` → user's work protected
4. **Performance**: TanStack Query only re-renders if data actually changed

**No race condition possible** - isDirty is true throughout the entire save operation.

### Why Version Tracking is Overkill

The original analysis proposed version tracking, but this adds:
- 200+ lines of code (Rust state, IPC, version comparison)
- Extra IPC call before every save
- Edge cases (overflow, multi-instance, cleanup)
- Mental complexity for future maintainers

All to solve a problem that:
- Happens rarely (only on very slow disks)
- Has minimal impact (one extra refetch)
- **Is already solved by isDirty state**

---

## Problem Analysis

### Missing Functionality

**Currently**: External file changes are not detected until user navigates away and back. This includes:
- Edits made in VS Code or other editors
- File renames/moves in Finder
- Files added/deleted in the project
- Git operations (checkout, pull, merge)

**Why**: The file-changed event handler doesn't exist. The infrastructure is there but unused.

### Existing Time-Based Tracking is Flawed

The `recentlySavedFile` approach in `src/store/editorStore.ts:360-402` has issues:

```typescript
// Set before save starts
set({ recentlySavedFile: currentFile.path })

await invoke('save_markdown_content', { /* ... */ })

// Clear after fixed 1-second delay
setTimeout(() => {
  set({ recentlySavedFile: null })
}, 1000)  // ⚠️ ASSUMES save completes within 1 second
```

**Problems**:
1. **Arbitrary timeout** - no way to know what's "safe"
2. **Not actually used** - no handler checks this value
3. **Unnecessary complexity** - we already have `isDirty` state

### Why isDirty is Better

We already track when the file has unsaved changes:
- `isDirty=true` → user is editing, save in progress, or file modified
- `isDirty=false` → file is saved and matches disk

This gives us everything we need:
```typescript
if (isDirty) {
  return // User's work is authoritative
}
// Safe to reload from disk
```

**Benefits**:
- No arbitrary timeouts
- No assumptions about save duration
- Already exists and is maintained
- Simple to understand and debug

## Current Implementation

### What Exists

**Rust Backend** (`src-tauri/src/commands/watcher.rs`):
- ✅ Watches content directories with `notify` crate
- ✅ Debounces events (500ms)
- ✅ Emits `file-changed` events: `{ path: string, kind: string }`

**TypeScript Bridge** (`src/store/projectStore.ts:166-180`):
- ✅ Listens to Tauri events
- ✅ Re-dispatches as DOM CustomEvents

**Editor Store** (`src/store/editorStore.ts`):
- ✅ Tracks `isDirty` state (true when user has unsaved changes)
- ⚠️ Has unused `recentlySavedFile` field (set but never checked)

### What's Missing

**No Event Handler**:
- ❌ No `addEventListener('file-changed', ...)` anywhere
- ❌ No query invalidation on external changes
- ❌ No logic to distinguish our saves from external edits

**Result**: External changes only visible after navigating away and back.

## Requirements

**Must Have**:
- [ ] Detect external file changes and update UI
- [ ] Protect user's unsaved work (don't reload while editing)
- [ ] No infinite loops or unnecessary re-renders
- [ ] Work correctly regardless of disk speed

**Should Have**:
- [ ] Clear logging for debugging
- [ ] Update sidebar when files added/removed/renamed

**Nice to Have**:
- [ ] User notification when external change detected
- [ ] Prompt user if external change conflicts with unsaved edits

## Solution: Dirty State Check

Use the existing `isDirty` state to determine when to reload from disk.

### Complete Handler Implementation

Create `src/hooks/useFileChangeHandler.ts`:

```typescript
import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'
import { debug, info } from '@tauri-apps/plugin-log'

interface FileChangeEvent {
  path: string
  kind: string
}

export function useFileChangeHandler() {
  useEffect(() => {
    const handleFileChanged = async (event: Event) => {
      const customEvent = event as CustomEvent<FileChangeEvent>
      const { path } = customEvent.detail

      const { currentFile, isDirty } = useEditorStore.getState()
      const { projectPath } = useProjectStore.getState()

      // Only care about currently open file
      if (!currentFile || currentFile.path !== path) {
        return
      }

      // User is editing - their version is authoritative
      if (isDirty) {
        await debug(`Ignoring external change to ${path} - file has unsaved edits`)
        return
      }

      // File is saved - safe to reload from disk
      await info(`External change detected on ${path} - reloading`)

      if (projectPath) {
        // Invalidate query - TanStack Query will refetch
        await queryClient.invalidateQueries({
          queryKey: queryKeys.fileContent(projectPath, currentFile.id),
        })
      }
    }

    window.addEventListener('file-changed', handleFileChanged)
    return () => window.removeEventListener('file-changed', handleFileChanged)
  }, [])
}
```

Add to `src/components/layout/Layout.tsx`:

```typescript
import { useFileChangeHandler } from '../../hooks/useFileChangeHandler'

export const Layout: React.FC = () => {
  useFileChangeHandler() // Enable file change detection
  // ... rest of component
}
```

### Why This Works

**No Rust changes needed** - the watcher already works perfectly.

**Scenarios**:

1. **Normal save (fast disk)**:
   - Save completes in 50ms → `isDirty=false`
   - Watcher fires at 550ms (500ms debounce)
   - Handler: `isDirty=false` → invalidate query
   - Query refetches → data identical → no re-render ✅

2. **Slow save (potential race)**:
   - Save in progress → `isDirty=true`
   - Watcher fires → handler checks `isDirty=true` → IGNORE ✅
   - Save completes → `isDirty=false`

3. **External edit while typing**:
   - User typing → `isDirty=true`
   - VS Code saves file → watcher fires
   - Handler: `isDirty=true` → IGNORE ✅
   - User's work protected

4. **External edit after save**:
   - File saved → `isDirty=false`
   - VS Code edits → watcher fires
   - Handler: `isDirty=false` → reload ✅
   - User sees external changes

### Performance Impact

**Auto-save every 2 seconds**:
- Save → watcher → query invalidates → refetch
- **But data is identical** → TanStack Query prevents re-render
- Zero UI impact ✅

**TanStack Query handles everything**:
- Caches previous data
- Shallow comparison on refetch
- Only triggers re-render if data changed
- Batches multiple invalidations

## Alternatives Considered

### Time-Based Tracking (Current Approach)

Keep `recentlySavedFile` with longer timeout:
- ❌ Still has race condition on slow disks
- ❌ Arbitrary timeout (1s, 2s, 5s?)
- ❌ Already implemented but unused

### Version Tracking

Increment counter on each save, compare versions:
- ✅ No timing assumptions
- ❌ 200+ lines of code (Rust state, IPC, handlers)
- ❌ Extra IPC call before every save
- ❌ Unnecessary complexity

### Content Hash

Hash content, compare on file change:
- ✅ No timing assumptions
- ❌ Computation overhead on every change
- ❌ Still needs handler implementation
- ❌ Timing issues (content changes during hash)

### Dirty State Check (Chosen Solution)

Use existing `isDirty` state:
- ✅ Already exists and maintained
- ✅ Zero extra code in stores/Rust
- ✅ Simple to understand
- ✅ No timing assumptions
- ✅ Protects user's work
- ✅ 30 lines of code total

## Implementation Plan

### Step 1: Create File Change Handler (~1 hour)

**File**: Create `src/hooks/useFileChangeHandler.ts`

Implementation provided in Solution section above. Key points:
- Check `isDirty` state before invalidating queries
- Use `getState()` pattern (no subscriptions)
- Log debug/info messages for visibility

**File**: `src/components/layout/Layout.tsx`

Add one line:
```typescript
useFileChangeHandler() // Enable file change detection
```

### Step 2: Remove Unused Code (~30 min)

**File**: `src/store/editorStore.ts`

Remove:
- `recentlySavedFile: string | null` field (line ~207)
- Initial value `recentlySavedFile: null` (line ~230)
- `set({ recentlySavedFile: currentFile.path })` (line ~361)
- Timeout logic (lines ~400-402):
  ```typescript
  setTimeout(() => {
    set({ recentlySavedFile: null })
  }, 1000)
  ```

**Test Files**: Update mocks
- `src/store/__tests__/editorStore.integration.test.ts`
- `src/store/__tests__/storeQueryIntegration.test.ts`
- `src/hooks/editor/useEditorHandlers.test.ts`

Remove `recentlySavedFile: null` from mock objects.

### Step 3: Testing (~1 hour)

**Integration Test**: Create `src/hooks/__tests__/useFileChangeHandler.test.ts`

Test cases:
- File change while `isDirty=true` → ignored
- File change while `isDirty=false` → query invalidated
- File change for different file → ignored
- Handler cleans up on unmount

**Manual Testing**:
1. Open file, edit, see `isDirty=true` → edit in VS Code → no reload ✅
2. Save file, `isDirty=false` → edit in VS Code → file reloads ✅
3. Auto-save scenario → no unnecessary re-renders ✅
4. Check console logs for debug messages

**Performance Check**:
- Verify no render cascade (React DevTools Profiler)
- Confirm TanStack Query prevents re-render when data unchanged
- Test with rapid auto-saves (type continuously)

## Success Criteria

### Must Have (Definition of Done)
- [ ] `useFileChangeHandler` hook created and integrated
- [ ] Handler checks `isDirty` before invalidating queries
- [ ] `recentlySavedFile` field removed completely
- [ ] All test mocks updated (removed recentlySavedFile)
- [ ] Integration test created for handler
- [ ] Manual testing completed (all scenarios pass)

### Verification Tests
- [ ] Type in editor → edit in VS Code → no reload (isDirty protects work)
- [ ] Save file → edit in VS Code → file reloads (external change detected)
- [ ] Auto-save scenario → no performance impact
- [ ] React DevTools shows no render cascade
- [ ] Console logs show debug messages

### Nice to Have (Future Enhancements)
- [ ] Toast notification when external change detected
- [ ] Prompt user if external change while dirty
- [ ] Sidebar updates when files added/removed externally

## Edge Cases

### 1. External Edit While Typing
**Scenario**: User typing in Astro Editor → VS Code saves file

**Behavior**:
- `isDirty=true` (user has unsaved changes)
- Watcher fires → handler ignores (protects user's work)
- ✅ User's edits preserved

### 2. Multiple App Instances
**Scenario**: Two Astro Editor instances open same file

**Behavior**:
- Instance A saves → watcher fires in both
- Instance A: `isDirty=false` → ignores (just saved)
- Instance B: `isDirty=false` → reloads (external change)
- ⚠️ Instance B sees Instance A's changes
- ⚠️ If Instance B is dirty, changes protected

**Mitigation**: Works correctly - each instance protects its own dirty state

### 3. Rapid Auto-Saves
**Scenario**: User types continuously → auto-save every 2 seconds

**Behavior**:
- Each save: `isDirty=false` → watcher fires → query invalidates
- TanStack Query refetches → data identical → **no re-render**
- ✅ Zero performance impact

### 4. Save Failure
**Scenario**: Save fails (disk full, permissions error)

**Behavior**:
- `isDirty` remains `true` (save didn't complete)
- File watcher never fires (no file change on disk)
- ✅ Correct - file wasn't actually saved

### 5. Git Operations
**Scenario**: User runs `git checkout other-branch` while file open

**Behavior**:
- Watcher fires for file change
- If `isDirty=true`: change ignored (user's work protected)
- If `isDirty=false`: file reloads with branch's version
- ⚠️ User may be confused if dirty (file didn't reload)

**Future Enhancement**: Show notification about external change while dirty

## Performance Analysis

**Handler Overhead**: Negligible
- Event listener: passive, no subscriptions
- `getState()` calls: O(1) lookup, no re-renders
- Query invalidation: TanStack Query's job

**Auto-Save Impact**: Zero
- Save → watcher → invalidate → refetch → data same → no re-render
- TanStack Query shallow comparison prevents unnecessary updates

**Memory**: Minimal
- One event listener (cleanup on unmount)
- No additional state tracked

## Out of Scope (Future Enhancements)

1. **User Notification**: Toast when external change detected
2. **Conflict Dialog**: Prompt user if external change while dirty
3. **Sidebar Updates**: Reflect file additions/deletions/renames in file list
4. **Multi-Instance Coordination**: Sync dirty state across instances

## Recommendation

### Priority: MEDIUM-HIGH for v1.0.0

**Why Implement This**:
1. **Completes existing infrastructure** - watcher exists but unused
2. **Enables external edit detection** - users can use VS Code alongside
3. **Simple solution** - 30 lines of code, no Rust changes
4. **Protects user work** - dirty state prevents data loss
5. **Low effort** - 2-3 hours total

**Why This Approach**:
1. **Uses existing state** - `isDirty` already tracks unsaved changes
2. **No timing assumptions** - not based on timeouts or delays
3. **Leverages TanStack Query** - automatic caching and re-render prevention
4. **Follows architecture patterns** - `getState()` pattern, event-driven communication
5. **Future-proof** - easy to add notifications/prompts later

### Implementation Timeline

**Recommended for v1.0.0**:
- Low risk, high value feature
- Completes file watcher system
- Better UX for users who switch between editors
- Prevents confusion ("why didn't my VS Code edit show up?")

**If time-constrained**:
- Ship 1.0.0 as-is (no external change detection)
- Fix in 1.0.1
- Note: Not a bug, just missing feature

### Effort Estimate

**Step 1: Create Handler** - 1 hour
- Write useFileChangeHandler hook: 30 min
- Add to Layout: 5 min
- Initial testing: 25 min

**Step 2: Remove Unused Code** - 30 min
- Remove recentlySavedFile from editorStore: 10 min
- Update test mocks: 20 min

**Step 3: Testing** - 1 hour
- Integration test: 30 min
- Manual testing: 30 min

**Total: 2.5 hours**

### Risk Assessment

**Implementation Risk**: ✅ VERY LOW
- Simple logic (~30 lines)
- No Rust changes
- Uses existing patterns (`getState()`, event listeners)
- Clear requirements

**Testing Risk**: ✅ LOW
- Easy to test manually (just edit in VS Code)
- Integration test straightforward
- No timing assumptions to test

**Deployment Risk**: ✅ VERY LOW
- No breaking changes
- New functionality only (handler didn't exist before)
- Easy to revert if issues found
