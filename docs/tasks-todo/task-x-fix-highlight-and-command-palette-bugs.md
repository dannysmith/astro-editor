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

**Theoretical mechanism (NOT YET VERIFIED):**

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

**IMPORTANT CAVEAT:** This theory has a potential flaw. In `Editor.tsx` (lines 269-271), there's a safeguard:
```typescript
if (viewRef.current.state.doc.toString() !== newContent) {
  // Only then dispatch to CodeMirror
}
```

For this theory to hold, the refetched content must actually **differ** from what CodeMirror has. If content is identical after save (which it should be), the dispatch doesn't happen and `docChanged` won't fire.

Possible explanations:
1. The Rust backend normalizes content (trailing whitespace, line endings) causing a mismatch
2. There's a race condition where content differs momentarily
3. This theory is incorrect and something else triggers `docChanged`

The "occasional" nature of the bug (not every auto-save) also suggests something more intermittent than this theory explains. **Debug logging is needed to verify this theory before implementing a fix.**

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

### Step 1: Fix Command Palette (VERIFIED - Implement First)

Remove the "Save File" command from the command palette. This fix is verified and low-risk - implement it first.

See details in "Fix: Remove Save File Command" section below.

### Step 2: Verify Highlights Theory with Debug Logging

Before implementing a fix for the highlights issue, add temporary debug logging to verify the theory:

```typescript
// In useEditorFileContent.ts
useEffect(() => {
  if (!data || !currentFile) return
  const { isDirty, editorContent } = useEditorStore.getState()
  console.log('[useEditorFileContent] Query data received', {
    isDirty,
    contentMatch: data.content === editorContent,
    contentLength: data.content.length,
    storeContentLength: editorContent.length,
  })
  // ... rest of effect
}, [data, currentFile])

// In Editor.tsx subscription
if (newContent !== previousContent) {
  console.log('[Editor] Store content changed', {
    willDispatch: viewRef.current.state.doc.toString() !== newContent,
  })
  // ... rest of subscription
}
```

Test by:
1. Enabling highlights
2. Typing and waiting for auto-save
3. Checking console to see if the store update and CodeMirror dispatch actually occur

### Step 3: Implement Highlights Fix (If Theory Verified)

**Option A: Content comparison in `useEditorFileContent.ts`** (Recommended if theory is correct)

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

The editor already has authoritative content after save. Query invalidation was intended for external file changes, not confirming our own saves. Consider removing lines 111-116 in `useEditorActions.ts`.

### Step 4: If Theory Is Wrong, Investigate Further

If debug logging shows the store update / CodeMirror dispatch is NOT happening when highlights hide, we need to investigate other causes:
- Panel resize/collapse triggering something
- Focus/blur events
- Other sources of `docChanged` in the copyedit mode extension

---

## Fix Details

### Fix: Remove "Save File" Command from Command Palette (VERIFIED)

The `isDirty` dependency exists because the "Save File" command uses it in its `isAvailable` check (lines 43-55 in `app-commands.ts`):

```typescript
{
  id: 'save-file',
  label: 'Save File',
  isAvailable: (context: CommandContext) => {
    return Boolean(context.currentFile && context.isDirty)  // ← This is why isDirty is a dependency
  },
},
```

When `isDirty` changes from `true` to `false` after auto-save:
1. The "Save File" command gets **filtered out of the list entirely** (via `.filter(command => command.isAvailable(context))`)
2. The command list structure changes (one fewer item)
3. cmdk re-renders with a different list
4. Selection jumps because items have shifted

**The fix:** Remove the `save-file` command from `fileCommands` in `app-commands.ts`.

**Verified safe to remove:** All other save triggers (Cmd+S keyboard shortcut, title bar button, menu item, editor blur, auto-save) use `useEditorStore.getState().saveFile` or `useEditorActions().saveFile` directly. None of them go through the command registry. The `save-file` command is only used by the command palette.

**Rationale:** Nobody uses the command palette to save files - Cmd+S is universal and faster. The Save command provides no value while causing a real bug. Removing it:
1. Eliminates the `isDirty` dependency from `baseCommands`
2. Prevents the list structure change that causes selection jumping
3. Simplifies the command palette

After removing the command, also remove `context.isDirty` from the `baseCommands` dependency array in `useCommandPalette.ts` since nothing else uses it.

---

## Testing Plan

### Phase 1: Command Palette Fix Testing

1. Open a file and make changes (ensure `isDirty = true`)
2. Open command palette (Cmd+P)
3. Immediately start holding down arrow key
4. Navigate to bottom of list while holding arrow
5. Verify selection moves smoothly without jumping
6. Repeat while auto-save is firing (within 2s of last edit)
7. Verify "Save File" command no longer appears in palette
8. Verify Cmd+S still saves files correctly

### Phase 2: Highlights Debug Verification

1. Add debug logging as described in Step 2
2. Enable noun highlights (or any POS highlight)
3. Type several sentences in the editor
4. Stop typing and wait for auto-save
5. Check console output to see:
   - Does `useEditorFileContent` receive data after save?
   - Does it update the store (is `isDirty` false, does content differ)?
   - Does `Editor.tsx` dispatch to CodeMirror?
6. Correlate console output with when highlights hide/reappear

### Phase 3: Highlights Fix Testing (After Theory Verified)

1. Implement chosen fix option
2. Enable noun highlights
3. Type several sentences in the editor
4. Stop typing and observe highlights
5. Verify highlights do NOT disappear after auto-save (2s + network latency)
6. Repeat multiple times to catch intermittent occurrences

### Regression Testing

1. Verify auto-save still works correctly
2. Verify external file changes are still detected and loaded
3. Verify command palette commands still execute correctly
4. Verify panel collapse/expand still works via keyboard shortcuts

---

## Implementation Notes

- **Start with the verified fix** (command palette) before tackling the uncertain one (highlights)
- **Debug first, fix second** for the highlights issue - verify the theory before implementing
- The fixes should be minimal and targeted to avoid introducing new timing issues
- Test with React DevTools Profiler to verify re-render counts don't increase
- The copyedit mode extension has its own timeout management; changes there require careful consideration of all code paths
- Remove debug logging before final commit

---

## Files to Modify

**Phase 1 (Command Palette - VERIFIED):**
1. `src/lib/commands/app-commands.ts` - Remove the `save-file` command from `fileCommands` array
2. `src/hooks/useCommandPalette.ts` - Remove `isDirty` from `baseCommands` dependency array

**Phase 2 (Highlights Debug):**
3. `src/hooks/useEditorFileContent.ts` - Add temporary debug logging
4. `src/components/editor/Editor.tsx` - Add temporary debug logging

**Phase 3 (Highlights Fix - If Theory Verified):**
5. `src/hooks/useEditorFileContent.ts` - Add content comparison before updating store
6. Possibly `src/hooks/editor/useEditorActions.ts` - Consider removing file content query invalidation
7. Possibly `src/lib/editor/extensions/copyedit-mode/extension.ts` - If programmatic update awareness is needed

---

## Risk Assessment

**Very low risk:** Removing the "Save File" command from command palette (nobody uses it, Cmd+S exists)
**Low risk:** Removing `isDirty` from command palette dependencies (follows from above)
**Unknown risk:** Highlights fix - theory not yet verified, debug first
**Medium risk:** Adding content comparison in `useEditorFileContent` (need to ensure external changes are still detected)
**Higher risk:** Removing query invalidation entirely (could break external file change detection)

**Process:** Implement verified fix first, then debug to verify theory, then implement highlights fix based on findings.
