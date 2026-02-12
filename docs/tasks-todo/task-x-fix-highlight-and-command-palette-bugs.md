# Fix Highlight Hiding and Command Palette Selection Bugs

## Problem Statement

After commit `551c513eb8a73ffec4d34b882e5e666646dcc049` (Dependency Updates 2026-02-11), two related bugs appeared:

1. **Highlights intermittently hiding**: With POS highlights enabled (e.g., noun highlights), typing in the editor can occasionally cause highlights to disappear for 2-10 seconds before reappearing. The timing suggests correlation with the auto-save cycle.

2. **Command palette selection jumping**: When navigating up/down in the command palette (especially when holding the down arrow key near the bottom of the list), the currently selected item unexpectedly jumps up several rows.

Both bugs point to race conditions or unnecessary re-renders introduced by the dependency updates and resizable panel migration.

---

## Research Findings

### What Changed in Commit 551c513

**Key changes:**
- `react-resizable-panels`: v3.0.6 → v4.6.2 (major version upgrade)
- `react`: v19.2.3 → v19.2.4 (patch)
- `zustand`: v5.0.10 → v5.0.11 (patch)
- `@tanstack/react-query`: v5.90.20 → v5.90.21 (patch)

**Code changes:**
- `Layout.tsx`: Added `useRef` for panel handles, added `useEffect` hooks that call `expand()`/`collapse()` imperatively when `sidebarVisible`/`frontmatterPanelVisible` change
- `resizable.tsx`: Migrated from v3 to v4 API, added localStorage persistence via `onLayoutChange` callback
- `layout-constants.ts`: Changed size values from numbers to strings, removed dynamic sizing function

### Root Cause Analysis

#### Bug 1: Highlights Hiding for 2-10 Seconds

**The mechanism:**

1. User types in editor → `isDirty = true`, auto-save scheduled (2s default)
2. User pauses typing
3. Auto-save fires → writes to disk → sets `isDirty = false`
4. **Query invalidation occurs** (lines 111-128 in `useEditorActions.ts`)
5. `useEditorFileContent.ts` receives refetched data, sees `isDirty = false`, updates the store
6. The subscription in `Editor.tsx` (lines 256-294) detects the change and dispatches to CodeMirror
7. The copyedit mode extension sees `update.docChanged`, sets `isActivelyEditing = true`
8. **Decorations are immediately cleared** (lines 197-202 in `extension.ts`)
9. After 3 seconds of no document changes, decorations are re-analyzed

**The timing (2-10s):** 2s auto-save delay + variable disk/query latency + 3s `isActivelyEditing` timeout = 5-6s typical, with network/disk variability explaining the 2-10s range observed.

**Key code paths:**

```
User stops typing
    ↓ (2s auto-save delay)
useEditorActions.saveFile()
    ↓
commands.saveMarkdownContent() → writes to disk
    ↓
useEditorStore.setState({ isDirty: false, lastSaveTimestamp: Date.now() })
    ↓
queryClient.invalidateQueries({ queryKey: queryKeys.fileContent(...) })
    ↓
TanStack Query refetches file content
    ↓
useEditorFileContent effect runs, sees isDirty=false
    ↓
useEditorStore.setState({ editorContent: data.content, ... })
    ↓
Editor.tsx subscription fires, compares content
    ↓
viewRef.current.dispatch({ changes: {...} }) → CodeMirror update
    ↓
copyedit mode's update() sees docChanged=true
    ↓
isActivelyEditing = true, decorations cleared
    ↓ (3s timeout)
isActivelyEditing = false, decorations re-analyzed
```

#### Bug 2: Command Palette Selection Jumping

**The mechanism:**

In `useCommandPalette.ts` (lines 54-70), `baseCommands` has `context.isDirty` as a dependency:

```typescript
const baseCommands = useMemo(
  () => getAllCommands(context, ''),
  [
    context.currentFile?.id,
    context.selectedCollection,
    context.projectPath,
    context.isDirty,  // ← PROBLEMATIC DEPENDENCY
    context.globalSettings?.general?.ideCommand,
    context.globalSettings?.general?.highlights?.nouns,
    // ... etc
  ]
)
```

**Flow:**
1. User opens command palette while `isDirty = true` (auto-save pending)
2. User navigates with arrow keys
3. Auto-save fires in background → `isDirty` becomes `false`
4. `useCommandContext()` returns new object (subscribed to `isDirty`)
5. `baseCommands` recalculates (new array reference even if content unchanged)
6. `commands` and `commandGroups` get new references
7. `CommandPalette` re-renders
8. cmdk's internal selection state is disrupted
9. Selection appears to "jump"

**Why at the bottom of the list:** cmdk works harder at list boundaries (scroll management, boundary checks). Re-renders during rapid navigation at boundaries are more likely to cause visible disruption.

### Why Did the Commit Expose These Issues?

These are **pre-existing race conditions** that became more apparent due to timing changes:

1. **Imperative panel API:** The new `useEffect` hooks call `expand()`/`collapse()` which modify internal react-resizable-panels state. The `onLayoutChange` callback adds synchronous localStorage writes. This affects React's batching/scheduling.

2. **Layout persistence:** On app start, saved layout may differ from Zustand defaults. The correction via `expand()`/`collapse()` triggers layout changes that weren't happening before.

3. **Patch updates:** React 19.2.4, Zustand 5.0.11, and TanStack Query 5.90.21 may have subtle timing differences in effect scheduling, subscription firing, or query invalidation.

The bugs aren't in the new panel code itself, but the timing changes made existing race conditions manifest more frequently.

---

## Recommended Approach

### Fix 1: Prevent Query Invalidation from Triggering CodeMirror Updates

**Option A: Content comparison in `useEditorFileContent.ts`**

Add a check to skip the store update if content hasn't actually changed:

```typescript
useEffect(() => {
  if (!data || !currentFile) return

  const { isDirty: currentIsDirty, editorContent: currentContent } = useEditorStore.getState()
  if (currentIsDirty) {
    return // User is editing - their version is authoritative
  }

  // NEW: Skip update if content is identical
  if (data.content === currentContent) {
    return // Content unchanged, no need to trigger CodeMirror update
  }

  useEditorStore.setState({
    editorContent: data.content,
    // ...
  })
}, [data, currentFile])
```

**Option B: Make copyedit mode aware of programmatic updates**

The `isProgrammaticUpdate` ref already exists in `Editor.tsx`. Could expose this to the copyedit mode extension so it doesn't set `isActivelyEditing` for programmatic changes.

**Option C: Don't invalidate file content query after save**

The editor already has authoritative content after save. Query invalidation was intended for external file changes, not confirming our own saves. Consider removing lines 111-116 in `useEditorActions.ts`:

```typescript
// After successful save, we already have the correct content
// Only invalidate directory queries for file list updates, not file content
```

**Recommended:** Option A is the safest and most targeted fix.

### Fix 2: Remove `isDirty` from Command Palette Dependencies

In `useCommandPalette.ts`, remove `context.isDirty` from the `baseCommands` dependency array:

```typescript
const baseCommands = useMemo(
  () => getAllCommands(context, ''),
  [
    context.currentFile?.id,
    context.selectedCollection,
    context.projectPath,
    // REMOVED: context.isDirty - commands don't depend on dirty state
    context.globalSettings?.general?.ideCommand,
    context.globalSettings?.general?.highlights?.nouns,
    // ... etc
  ]
)
```

**Rationale:** Commands are derived from file/collection/project state, not from whether the file has unsaved changes. The `isDirty` value is only used to display UI indicators, not to determine command availability or content.

### Fix 3: (Optional) Stabilize Command Array References

If removing `isDirty` isn't sufficient, consider using a deep comparison for command memoization:

```typescript
const baseCommands = useMemo(() => {
  const commands = getAllCommands(context, '')
  // Return same reference if commands are deeply equal
  return commands
}, [/* stable deps */])
```

Or use a library like `use-deep-compare-memoize`.

---

## Testing Plan

### Highlight Bug Testing

1. Enable noun highlights (or any POS highlight)
2. Type several sentences in the editor
3. Stop typing and observe highlights
4. Verify highlights do NOT disappear after auto-save (2s + network latency)
5. Repeat multiple times to catch intermittent occurrences

### Command Palette Bug Testing

1. Open a file and make changes (ensure `isDirty = true`)
2. Open command palette (Cmd+P)
3. Immediately start holding down arrow key
4. Navigate to bottom of list while holding arrow
5. Verify selection moves smoothly without jumping
6. Repeat while auto-save is firing (within 2s of last edit)

### Regression Testing

1. Verify auto-save still works correctly
2. Verify external file changes are still detected and loaded
3. Verify command palette commands still execute correctly
4. Verify panel collapse/expand still works via keyboard shortcuts

---

## Implementation Notes

- The fixes should be minimal and targeted to avoid introducing new timing issues
- Test with React DevTools Profiler to verify re-render counts don't increase
- Consider adding debug logging during development to trace the exact timing of events
- The copyedit mode extension has its own timeout management; changes there require careful consideration of all code paths

---

## Files to Modify

1. `src/hooks/useEditorFileContent.ts` - Add content comparison
2. `src/hooks/useCommandPalette.ts` - Remove `isDirty` dependency
3. Possibly `src/hooks/editor/useEditorActions.ts` - Consider removing file content query invalidation
4. Possibly `src/lib/editor/extensions/copyedit-mode/extension.ts` - If programmatic update awareness is needed

---

## Risk Assessment

**Low risk:** Removing `isDirty` from command palette dependencies
**Medium risk:** Adding content comparison in `useEditorFileContent` (need to ensure external changes are still detected)
**Higher risk:** Removing query invalidation entirely (could break external file change detection)

Recommend implementing in order of risk, testing thoroughly at each step.
