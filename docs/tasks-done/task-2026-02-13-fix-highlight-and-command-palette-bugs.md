# Fix Highlight Hiding and Command Palette Selection Bugs

## Problem Statement

NOTE: BOTH THESE BUGS SEEM TO HAVE BEEN FIXED.

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

**Initial theory (DISPROVEN):**

The initial theory was that `context.isDirty` in the `baseCommands` dependency array caused re-renders when auto-save fired, disrupting cmdk's selection state.

**What was tried:**
- Removed the `save-file` command from the command palette (committed 2026-02-12)
- Removed `context.isDirty` from `baseCommands` dependency array

**Result:** The bug persists. The `isDirty` dependency was not the cause.

**The change was kept anyway** because:
1. Nobody uses the command palette to save files (Cmd+S is universal)
2. It simplifies the command palette
3. It removes an unnecessary dependency

**Further investigation needed:**

The actual cause is still unknown. Possible areas to investigate:
1. **cmdk library behavior** - May have internal state management issues with rapid key repeats
2. **Other re-render sources** - Check what else triggers CommandPalette re-renders during navigation
3. **Scroll/virtualization** - cmdk may have issues with scroll position at list boundaries
4. **React 19.2.4 changes** - The patch update may have subtle timing differences
5. **Panel system interaction** - The resizable panels may be triggering layout recalculations

**Reproduction steps:**
1. Open command palette (Cmd+P)
2. Hold down arrow key
3. Navigate to bottom of list
4. Selection jumps unexpectedly (especially near boundaries)

### Why Did the Commit Expose These Issues?

These are **pre-existing race conditions** that became more apparent due to timing changes:

1. **Imperative panel API:** The new `useEffect` hooks call `expand()`/`collapse()` which modify internal react-resizable-panels state. The `onLayoutChange` callback adds synchronous localStorage writes. This affects React's batching/scheduling.

2. **Layout persistence:** On app start, saved layout may differ from Zustand defaults. The correction via `expand()`/`collapse()` triggers layout changes that weren't happening before.

3. **Patch updates:** React 19.2.4, Zustand 5.0.11, and TanStack Query 5.90.21 may have subtle timing differences in effect scheduling, subscription firing, or query invalidation.

The bugs aren't in the new panel code itself, but the timing changes made existing race conditions manifest more frequently.

---

## Recommended Approach

### Step 1: ~~Fix Command Palette~~ (COMPLETED - DID NOT FIX BUG)

**Status:** Implemented and committed 2026-02-12.

Removed the `save-file` command and `isDirty` dependency. The change is kept as a reasonable simplification, but **the command palette jumping bug persists**. The root cause is elsewhere.

**Next steps for command palette:** Need fresh investigation - see "Bug 2" section above for ideas.

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

### Fix: Remove "Save File" Command from Command Palette (IMPLEMENTED - DID NOT FIX BUG)

**Status:** Committed 2026-02-12. Change kept as reasonable cleanup, but did not fix the jumping bug.

The theory was that `isDirty` changes caused list structure changes that disrupted cmdk's selection state. This was incorrect - the bug persists after the fix.

**What was done:**
- Removed `save-file` command from `fileCommands` in `app-commands.ts`
- Removed `context.isDirty` from `baseCommands` dependency array in `useCommandPalette.ts`
- Removed unused `Save` import from lucide-react

**Why we kept the change:**
- Cmd+S is universal and faster than command palette for saving
- Simplifies the command palette
- Removes an unnecessary store subscription

**Conclusion:** The command palette jumping has a different root cause. Fresh investigation needed.

---

## Testing Plan

### Phase 1: Command Palette Fix Testing - ❌ DID NOT FIX

**Tested 2026-02-12:**
- ✅ "Save File" command no longer appears in palette
- ✅ Cmd+S still saves files correctly
- ✅ Auto-save works correctly
- ❌ Selection still jumps when navigating with held arrow key

**Conclusion:** The `isDirty` dependency was not the cause. Need fresh investigation.

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

**Phase 1 (Command Palette):** ✅ DONE (but bug not fixed)
1. ~~`src/lib/commands/app-commands.ts` - Remove the `save-file` command from `fileCommands` array~~
2. ~~`src/hooks/useCommandPalette.ts` - Remove `isDirty` from `baseCommands` dependency array~~

**Phase 1b (Command Palette - NEW INVESTIGATION NEEDED):**
- TBD - need to identify actual root cause

**Phase 2 (Highlights Debug):**
3. `src/hooks/useEditorFileContent.ts` - Add temporary debug logging
4. `src/components/editor/Editor.tsx` - Add temporary debug logging

**Phase 3 (Highlights Fix - If Theory Verified):**
5. `src/hooks/useEditorFileContent.ts` - Add content comparison before updating store
6. Possibly `src/hooks/editor/useEditorActions.ts` - Consider removing file content query invalidation
7. Possibly `src/lib/editor/extensions/copyedit-mode/extension.ts` - If programmatic update awareness is needed

---

## Risk Assessment

**Completed (low risk):** ✅ Removed "Save File" command and `isDirty` dependency - did not fix bug but kept as cleanup
**Unknown risk:** Command palette jumping - root cause unknown, needs fresh investigation
**Unknown risk:** Highlights fix - theory not yet verified, debug first
**Medium risk:** Adding content comparison in `useEditorFileContent` (need to ensure external changes are still detected)
**Higher risk:** Removing query invalidation entirely (could break external file change detection)

**Updated process:**
1. ~~Implement command palette fix~~ (done, didn't work)
2. Investigate command palette jumping with fresh approach
3. Debug to verify highlights theory
4. Implement highlights fix based on findings
