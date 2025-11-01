# Task: Event Bridge Refactor

## Overview

The application currently uses a "Bridge Pattern" where Zustand stores dispatch global `window` custom events to trigger actions in React components that have access to TanStack Query data. This pattern exists to solve a real constraint: Zustand stores cannot use React hooks, but they need data from TanStack Query (which requires hooks).

**Current Status**: Active in production code. Not causing bugs, but creates technical debt.

**Priority**: Post-1.0.0 architectural improvement (not a critical bug)

## Current Implementation

### Pattern 1: Schema Field Order (Save File Flow)

**Location**: `src/store/editorStore.ts` (lines 264-309) ↔ `src/components/frontmatter/FrontmatterPanel.tsx` (lines 42-77)

When saving a file, the store needs schema field order from TanStack Query:

```typescript
// Store dispatches request event
const schemaEvent = new CustomEvent('get-schema-field-order', {
  detail: { collectionName: currentFile.collection },
})
window.dispatchEvent(schemaEvent)

// Polls every 10ms for response
await new Promise(resolve => {
  const checkResponse = () => {
    if (responseReceived) {
      resolve(null)
    } else {
      setTimeout(checkResponse, 10)  // 🔥 POLLING ANTI-PATTERN
    }
  }
  checkResponse()
})
```

FrontmatterPanel listens and responds:

```typescript
useEffect(() => {
  const handleSchemaFieldOrderRequest = (event: Event) => {
    const collections = /* from TanStack Query */
    const fieldOrder = /* extract from schema */

    window.dispatchEvent(new CustomEvent('schema-field-order-response', {
      detail: { fieldOrder }
    }))
  }

  window.addEventListener('get-schema-field-order', handleSchemaFieldOrderRequest)
  return () => window.removeEventListener(...)
}, [collections])
```

### Pattern 2: Create New File

**Location**: `src/lib/commands/command-context.ts`, `src/hooks/useLayoutEventListeners.ts` (lines 104, 176-178)

Commands and shortcuts dispatch `create-new-file` event, which is handled by useLayoutEventListeners that has access to TanStack Query data.

## Technical Problems

1. **Polling**: Checking every 10ms is wasteful and fragile
2. **No type safety**: `CustomEvent<any>` - TypeScript can't help
3. **Debugging nightmare**: Must trace flow across multiple files via global events
4. **Race conditions**: Event listeners might not be registered when events fire
5. **Testing complexity**: Can't easily test event chains
6. **Memory leaks**: Easy to forget event cleanup
7. **Invisible coupling**: No clear dependency relationship in code

## Why This Pattern Exists

**The Core Constraint**: The architecture follows an "onion pattern":
1. TanStack Query (outer) - server/filesystem data
2. Zustand (middle) - client state
3. useState (inner) - local UI state

The middle layer (Zustand) is trying to reach outward to the outer layer (TanStack Query), which violates the dependency flow. The event bridge is a workaround.

## Recommended Solution: Hybrid Action Hooks

**Source**: `docs/reviews/event-bridge-refactor-analysis.md` (comprehensive 572-line analysis)

### Core Insight

Different types of actions have different architectural needs:
- **User-triggered actions** (Save button, keyboard shortcuts) → Should live in **hooks**
- **State-triggered actions** (Auto-save, dirty tracking) → Should live in **stores**

### Architecture

**Stores**: State + state-triggered logic only
```typescript
const useEditorStore = create<EditorState>((set, get) => ({
  // State
  editorContent: '',
  isDirty: false,
  autoSaveCallback: null as (() => Promise<void>) | null,

  // Register callback from hook
  setAutoSaveCallback: (callback) => set({ autoSaveCallback: callback }),

  // State mutations trigger auto-save
  setEditorContent: (content) => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave()  // State-triggered
  },

  // Auto-save scheduling (state logic only)
  scheduleAutoSave: () => {
    const { autoSaveCallback } = get()
    if (autoSaveCallback) {
      setTimeout(() => void autoSaveCallback(), 2000)
    }
  },

  markAsSaved: () => set({ isDirty: false }),
}))
```

**Hooks**: User-triggered actions with natural access to both stores and queries
```typescript
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async (showToast = true) => {
    // Direct access to stores via getState()
    const { currentFile, frontmatter, editorContent } = useEditorStore.getState()
    const { projectPath } = useProjectStore.getState()

    // Direct access to query data - NO EVENTS!
    const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
    const schema = collections?.find(c => c.name === currentFile.collection)?.schema
    const schemaFieldOrder = schema?.fields.map(f => f.name) || null

    await invoke('save_markdown_content', {
      filePath: currentFile.path,
      frontmatter,
      content: editorContent,
      schemaFieldOrder,
      projectRoot: projectPath,
    })

    useEditorStore.getState().markAsSaved()
    await queryClient.invalidateQueries({ ... })
    if (showToast) toast.success('File saved')
  }, [queryClient])

  return { saveFile }
}
```

**Layout**: Wire everything together
```typescript
export function Layout() {
  const { saveFile } = useEditorActions()

  // Register auto-save callback with store
  useEffect(() => {
    useEditorStore.getState().setAutoSaveCallback(() => saveFile(false))
  }, [saveFile])
}
```

### Benefits

✅ **No polling** - Synchronous data access
✅ **Type-safe** - TypeScript enforces everything
✅ **Testable** - Can test hooks and stores independently
✅ **No race conditions** - Standard React lifecycle
✅ **No memory leaks** - Standard cleanup patterns
✅ **Easy debugging** - Clear call paths
✅ **Follows React patterns** - Hook composition is idiomatic
✅ **Aligns with architecture guide** - "Reusable UI Logic → hooks"

## Alternative: Callback Registry

If stores MUST contain all business logic (not just state), second-best option:

```typescript
class QueryDataRegistry {
  private getCollections: ((projectPath: string) => Collection[]) | null = null

  registerCollectionsGetter(fn) { this.getCollections = fn }
  getCollectionsData(projectPath) { return this.getCollections?.(projectPath) }
}

// Store uses it synchronously
const collections = queryDataRegistry.getCollectionsData(projectPath)

// Layout registers
useEffect(() => {
  queryDataRegistry.registerCollectionsGetter((path) =>
    queryClient.getQueryData(queryKeys.collections(path))
  )
}, [])
```

Still adds indirection, but at least it's type-safe and synchronous (no polling).

## Migration Path

### Phase 1: Extract `saveFile` to Hook
1. Create `hooks/editor/useEditorActions.ts`
2. Implement `saveFile` in hook with direct queryClient access
3. Update store to accept auto-save callback
4. Wire in Layout component
5. Update all call sites (keyboard shortcuts, buttons)
6. Remove event bridge code for schema-field-order

**Effort**: 2-3 hours

### Phase 2: Apply Pattern to Other Actions
1. `createNewFile` → Move to hook
2. `deleteFile` → Move to hook
3. Other orchestration actions

**Effort**: 1-2 hours each

### Phase 3: Clean Up
1. Remove all event bridge infrastructure
2. Update architecture guide with new pattern
3. Add tests for hooks and store interactions

**Effort**: 1-2 hours

**Total**: ~1 day

## Assessment

**My Take**: The review correctly identifies this as architecturally inelegant. The Hybrid Action Hooks pattern is genuinely better and more maintainable. However, the current implementation works and isn't causing bugs. This is architectural aesthetics, not reliability.

**When to do this**: After critical bugs are fixed (auto-save data loss, YAML parser). This is a post-1.0.0 architectural enhancement that improves developer experience and maintainability but doesn't fix any user-facing issues.

## References

- Full analysis: `docs/reviews/event-bridge-refactor-analysis.md` (572 lines)
- Original review: `docs/reviews/staff-engineer-review-2025-10-24.md` (section 1)
- Current implementation:
  - `src/store/editorStore.ts:264-309` (save file + event bridge)
  - `src/components/frontmatter/FrontmatterPanel.tsx:42-77` (event listener)
  - `src/hooks/useLayoutEventListeners.ts:104,176-178` (create-new-file event)
