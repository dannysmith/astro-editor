# Complete File Content TanStack Query Migration + File Watcher

**Priority**: HIGH (blocks file watcher feature)
**Effort**: ~4-5 hours
**Type**: Architecture Completion + Feature Implementation
**Status**: Ready to implement

---

## Executive Summary

This task completes the **originally planned but never finished** migration of file content loading to TanStack Query (from Task 1), then implements file watcher event handling on top of that architecture.

### Discovery

The architecture guide explicitly documents that file content should use `useFileContentQuery`:

```typescript
// From docs/developer/architecture-guide.md
const { data: content } = useFileContentQuery(projectPath, fileId)
```

However, the implementation was never completed:
- ✅ `useFileContentQuery` hook exists (`src/hooks/queries/useFileContentQuery.ts`)
- ✅ `useSaveFileMutation` hook exists (`src/hooks/mutations/useSaveFileMutation.ts`)
- ❌ **No component uses either hook** - orphaned from incomplete migration
- ❌ Editor still uses store's `openFile()` action (direct `invoke`)
- ❌ Save still uses store's `saveFile()` action (bypasses mutation)

**Impact**: The file watcher solution in the original task draft doesn't work because invalidating `queryKeys.fileContent` has no effect when no active query exists.

---

## Current Architecture (Incomplete)

### How File Loading Works Now

```typescript
// LeftSidebar.tsx line 213
const handleFileClick = (file: FileEntry) => {
  void openFile(file)  // ← Store action
}

// editorStore.ts line 235-279
openFile: async (file: FileEntry) => {
  const markdownContent = await invoke('parse_markdown_content', {...})
  set({
    currentFile: file,
    editorContent: markdownContent.content,
    frontmatter: markdownContent.frontmatter,
    // ...
  })
}
```

**Store contains**: Identifiers (currentFile) + Content (editorContent, frontmatter)

### How Save Works Now

```typescript
// editorStore.ts line 301-428
saveFile: async (showToast = true) => {
  await invoke('save_markdown_content', {...})
  set({ isDirty: false })

  // Manual query invalidation
  queryClient.invalidateQueries({
    queryKey: [...queryKeys.all, projectPath, currentFile.collection, 'directory'],
  })
}
```

**Issues**:
1. Bypasses `useSaveFileMutation` (which already exists!)
2. Doesn't invalidate `fileContent` query (not needed since query doesn't exist)
3. Duplicates mutation logic in store

---

## Target Architecture (Documented Pattern)

### Separation of Concerns

**TanStack Query** (server state):
- File content from disk
- Automatic caching and refetching
- Synchronization across components

**Zustand Store** (client state):
- File identifier (currentFile)
- Local editing state (editorContent, frontmatter) - the "working copy"
- Edit status (isDirty)

### The Controlled Input Pattern

This is the standard pattern for editors with server data:

```
┌─────────────────┐
│  Disk (Source)  │ ← TanStack Query manages
└────────┬────────┘
         │ fetch
         ↓
┌─────────────────┐
│ Query Cache     │ ← Immutable, from server
└────────┬────────┘
         │ sync when file changes
         ↓
┌─────────────────┐
│ Store (Working) │ ← Local editing state
│ editorContent   │ ← User types here
│ frontmatter     │
└────────┬────────┘
         │ save (mutation)
         ↓
┌─────────────────┐
│  Disk (Updated) │ ← Mutation updates
└─────────────────┘
         │ invalidate
         ↓ (loop back to Query Cache)
```

**Key Insight**: Store STILL holds `editorContent` and `frontmatter` - they're just synced FROM the query instead of fetched directly.

---

## Detailed Implementation Plan

### Phase 1: Refactor File Opening (~2 hours)

#### 1.1 Simplify Store's `openFile` Action

**Before** (editorStore.ts:235-279):
```typescript
openFile: async (file: FileEntry) => {
  const markdownContent = await invoke('parse_markdown_content', {...})
  set({
    currentFile: file,
    editorContent: markdownContent.content,
    frontmatter: markdownContent.frontmatter,
    // ...
  })
}
```

**After**:
```typescript
openFile: (file: FileEntry) => {
  set({
    currentFile: file,
    isDirty: false
  })
  // Content will be loaded by useFileContentQuery
}
```

**Changes**:
- Remove `invoke` call
- Remove content/frontmatter setting
- Keep it synchronous (just an identifier update)

#### 1.2 Create Layout-Level Query Hook

**New file**: `src/hooks/useEditorFileContent.ts`

```typescript
import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useFileContentQuery } from './queries/useFileContentQuery'

/**
 * Hook that bridges TanStack Query (server state) with Zustand (local editing state)
 *
 * Responsibilities:
 * 1. Fetch file content when currentFile changes
 * 2. Sync query data to store ONLY when appropriate
 * 3. Respect isDirty state (don't overwrite user's edits)
 */
export function useEditorFileContent() {
  const { currentFile, isDirty } = useEditorStore()
  const { projectPath } = useProjectStore()

  // Query fetches content based on current file
  const { data, isLoading, isError, error } = useFileContentQuery(
    projectPath,
    currentFile?.path || null
  )

  // Sync query data to local editing state when appropriate
  useEffect(() => {
    if (!data || !currentFile) return

    // CRITICAL: Don't overwrite user's unsaved edits
    const { isDirty: currentIsDirty } = useEditorStore.getState()
    if (currentIsDirty) {
      return // User is editing - their version is authoritative
    }

    // Safe to update - file is saved and matches disk
    useEditorStore.setState({
      editorContent: data.content,
      frontmatter: data.frontmatter,
      rawFrontmatter: data.raw_frontmatter,
      imports: data.imports,
    })
  }, [data, currentFile?.id]) // Only sync when data or file ID changes

  return { isLoading, isError, error }
}
```

**Usage** in `Layout.tsx`:
```typescript
export const Layout: React.FC = () => {
  const { isLoading, isError, error } = useEditorFileContent()

  // Show loading/error states if needed
  // ...rest of layout
}
```

#### 1.3 Update Components

**No changes needed** for most components! They already subscribe to store state:
- Editor reads `editorContent` from store (line 234)
- FrontmatterPanel reads `frontmatter` from store (line 17)
- StatusBar reads `editorContent` for word count (line 7)

Only change needed is in LeftSidebar (line 213):
```typescript
// Before: async
const handleFileClick = (file: FileEntry) => {
  void openFile(file)
}

// After: synchronous
const handleFileClick = (file: FileEntry) => {
  openFile(file)
}
```

### Phase 2: Refactor File Saving (~1 hour)

#### 2.1 Replace Store's `saveFile` with Mutation

**Current**: Store has its own save implementation
**Target**: Store delegates to mutation

**Update** `editorStore.ts` saveFile action:
```typescript
import { queryClient } from '../lib/query-client'
import { queryKeys } from '../lib/query-keys'

saveFile: async (showToast = true) => {
  const { currentFile, editorContent, frontmatter, imports } = get()
  if (!currentFile) return

  const { projectPath } = useProjectStore.getState()
  if (!projectPath) throw new Error('No project path')

  try {
    // Get schema field order (existing logic kept)
    let schemaFieldOrder: string[] | null = null
    // ... existing schema order logic ...

    // Clear auto-save timeout
    const { autoSaveTimeoutId } = get()
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
      set({ autoSaveTimeoutId: null })
    }

    // Save via Rust
    await invoke('save_markdown_content', {
      filePath: currentFile.path,
      frontmatter,
      content: editorContent,
      imports,
      schemaFieldOrder,
      projectRoot: projectPath,
    })

    // Update state
    set({ isDirty: false, lastSaveTimestamp: Date.now() })

    // Invalidate queries to refresh UI
    await queryClient.invalidateQueries({
      queryKey: queryKeys.fileContent(projectPath, currentFile.path),
    })

    await queryClient.invalidateQueries({
      queryKey: [...queryKeys.all, projectPath, currentFile.collection, 'directory'],
    })

    if (showToast) {
      toast.success('File saved successfully')
    }

  } catch (error) {
    // ... existing error handling ...
  }
}
```

**Note**: We keep the save logic in the store for now (architecture guide allows actions to trigger side effects). The key change is adding `fileContent` query invalidation.

**Alternative** (cleaner but more changes): Create `hooks/useEditorSave.ts` that uses the mutation hook and updates store state. This would be more aligned with the architecture but requires more refactoring.

#### 2.2 Remove Dead Code

Remove from `editorStore.ts`:
- `recentlySavedFile` field and all its usages (lines 207, 230, 361, 401, 427)
- Related timeout logic

Update test mocks to remove `recentlySavedFile`.

### Phase 3: Implement File Watcher Handler (~1 hour)

Now that query infrastructure is in place, the file watcher handler works as originally designed.

**Create** `src/hooks/useFileChangeHandler.ts`:

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

/**
 * Handles file-changed events from the Rust watcher
 *
 * Responsibilities:
 * 1. Listen for file-changed events from watcher
 * 2. Invalidate queries to trigger refetch
 * 3. Respect isDirty state (don't reload user's unsaved work)
 */
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
          queryKey: queryKeys.fileContent(projectPath, currentFile.path),
        })
      }
    }

    window.addEventListener('file-changed', handleFileChanged)
    return () => window.removeEventListener('file-changed', handleFileChanged)
  }, [])
}
```

**Add to** `Layout.tsx`:
```typescript
import { useFileChangeHandler } from '../hooks/useFileChangeHandler'

export const Layout: React.FC = () => {
  useFileChangeHandler() // Enable file change detection
  useEditorFileContent() // Enable query-based file loading
  // ... rest of layout
}
```

### Phase 4: Testing (~1 hour)

#### 4.1 Unit Tests

**Create** `src/hooks/__tests__/useEditorFileContent.test.ts`:
- Query fetches content on file change
- Sync respects isDirty state
- Error handling

**Create** `src/hooks/__tests__/useFileChangeHandler.test.ts`:
- Ignores changes when isDirty=true
- Invalidates query when isDirty=false
- Only handles current file

#### 4.2 Integration Tests

Update `src/store/__tests__/storeQueryIntegration.test.ts`:
- openFile sets identifier only
- Save invalidates fileContent query

#### 4.3 Manual Testing

1. **Basic file opening**: Open file → content loads → verify no regressions
2. **File watcher - while typing**: Type → edit in VS Code → content NOT reloaded ✅
3. **File watcher - after save**: Save → edit in VS Code → content reloaded ✅
4. **Auto-save scenario**: Type continuously → verify no cursor jumps
5. **Performance**: Check React DevTools for render cascades

---

## Critical Edge Cases Handled

### 1. Race Condition: Save + Watcher

**Scenario**: Save completes → watcher fires before `isDirty=false`

**Why it can't happen**:
```typescript
// editorStore.ts saveFile sequence:
await invoke('save_markdown_content', {...})  // Blocks until write completes
set({ isDirty: false })                        // Updates synchronously

// Watcher has 500ms debounce AFTER file write
// By the time watcher fires, isDirty is already false
```

### 2. Cursor Position After Reload

**Scenario**: External change → query refetch → content update → cursor jumps

**Already handled**: Editor checks if content changed before updating (Editor.tsx:236):
```typescript
if (viewRef.current.state.doc.toString() !== editorContent) {
  // Only update if different
}
```

Plus `isProgrammaticUpdate` flag prevents triggering onChange (line 238).

### 3. Auto-Save Every 2 Seconds

**Scenario**: Type → auto-save → watcher → query refetch → overwrite?

**Why it's safe**:
```typescript
// While typing: isDirty=true
// Save starts: isDirty=true (still)
// Save completes: isDirty=false
// Watcher fires: isDirty=false → refetch
// Query returns: data === local state (we just saved it!)
// TanStack Query: shallow comparison → no re-render ✅
```

### 4. Multiple Instances

**Scenario**: Two Astro Editor windows, same file

**Behavior**:
- Instance A saves → watcher fires in both
- Instance A: just saved, data matches → no visible change
- Instance B: if isDirty=true, ignores change (user protected)
- Instance B: if isDirty=false, reloads (sees A's changes)

**This is correct behavior** - each instance protects its own dirty state.

### 5. Git Operations

**Scenario**: `git checkout other-branch` changes file

**Behavior**:
- Watcher fires
- If isDirty=true: change ignored (user's work protected)
- If isDirty=false: file reloads with branch's version

**Future enhancement**: Toast notification about external change while dirty.

---

## Benefits of This Approach

### 1. Architectural Consistency

Completes the documented TanStack Query migration pattern. All server state (collections, files, file content) now uses the same pattern.

### 2. Automatic Caching

File content is cached. If user opens file A, then B, then back to A - instant load from cache.

### 3. Optimistic Updates (Future)

Once using mutations properly, can implement optimistic updates for instant UI feedback.

### 4. Simplified Store

Store becomes simpler - just identifiers and editing state. No fetch logic.

### 5. File Watcher Works

The original task's solution now works as designed because queries exist to invalidate.

---

## Risk Assessment

**Implementation Risk**: ✅ LOW
- Well-defined pattern (documented in architecture guide)
- Existing hooks already exist (just unused)
- Small, incremental changes
- Clear rollback path

**Testing Risk**: ✅ LOW
- Easy to test manually (edit in VS Code)
- Clear success criteria
- No timing assumptions

**Performance Risk**: ✅ VERY LOW
- TanStack Query prevents unnecessary re-renders
- Editor already optimized with memoization
- No change to auto-save timing

**Breaking Change Risk**: ✅ VERY LOW
- Internal implementation detail
- User-facing behavior unchanged
- All data flows preserved

---

## Migration Checklist

### Phase 1: File Opening
- [ ] Simplify `openFile` to identifier-only update
- [ ] Create `useEditorFileContent` hook
- [ ] Add hook to Layout
- [ ] Update LeftSidebar handleFileClick
- [ ] Test: File opens correctly

### Phase 2: File Saving
- [ ] Add `fileContent` query invalidation to saveFile
- [ ] Remove `recentlySavedFile` field
- [ ] Remove timeout logic
- [ ] Update test mocks
- [ ] Test: Save works, queries invalidate

### Phase 3: File Watcher
- [ ] Create `useFileChangeHandler` hook
- [ ] Add hook to Layout
- [ ] Test: External changes detected

### Phase 4: Testing
- [ ] Unit tests for new hooks
- [ ] Integration tests for store/query flow
- [ ] Manual testing all scenarios
- [ ] Performance profiling (React DevTools)

### Phase 5: Cleanup
- [ ] Run `pnpm run check:all`
- [ ] Update documentation if needed
- [ ] Mark Task 1 checklist items as complete

---

## Why Now?

**Blocks file watcher feature**: Can't implement external change detection without query infrastructure.

**Technical debt**: Incomplete migration creates confusion about architecture.

**Low risk, high value**: Small changes with big architectural benefits.

**v1.0.0 timeline**: 4-5 hours total. Can be done in single session.

---

## Success Criteria

### Must Have
- [ ] File opening uses TanStack Query
- [ ] File saving invalidates fileContent query
- [ ] External changes detected and reloaded
- [ ] User's unsaved work protected (isDirty check)
- [ ] No performance regressions
- [ ] All tests pass

### Verification Tests
- [ ] Type in editor → edit in VS Code → no reload (isDirty protects)
- [ ] Save file → edit in VS Code → file reloads (change detected)
- [ ] Auto-save every 2s → no cursor jumps
- [ ] React DevTools shows no render cascade
- [ ] Console logs show watcher events

### Nice to Have (Future)
- [ ] Toast notification for external changes while dirty
- [ ] Use `useSaveFileMutation` instead of store action
- [ ] Sidebar updates when files added/removed externally

---

## Recommendation

**Priority**: HIGH - Required to complete file watcher feature

**Timeline**: Implement for v1.0.0 (4-5 hours is manageable)

**Approach**: Follow phases sequentially, test at each step

**Rollback Plan**: If issues found, can temporarily revert to direct `openFile` call in watcher handler (1-hour quick fix) while refactoring separately.
