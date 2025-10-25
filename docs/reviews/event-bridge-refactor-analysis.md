# Event Bridge Refactor: Deep Analysis & Recommendation

## Current State Analysis

**The Event Bridge Pattern** (lines 308-354 in `editorStore.ts`):
```typescript
// Store dispatches event asking for data
window.dispatchEvent(new CustomEvent('get-schema-field-order', {
  detail: { collectionName: currentFile.collection }
}))

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

**Component listens and responds** (`FrontmatterPanel.tsx`):
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

### Why This Pattern Exists

**The Core Constraint**: Zustand stores cannot use React hooks, but they need data from TanStack Query (which requires hooks).

**The Onion Pattern** (from architecture guide):
1. TanStack Query (outer) - server/filesystem data
2. Zustand (middle) - client state
3. useState (inner) - local UI state

The middle layer (Zustand) is trying to reach outward to the outer layer (TanStack Query), which violates the dependency flow.

### Problems with Current Approach

1. **Polling**: Checking every 10ms is wasteful and fragile
2. **No type safety**: `CustomEvent<any>` - TypeScript can't help
3. **Debugging nightmare**: Trace flow across multiple files via events
4. **Race conditions**: Event listeners might not be registered when events fire
5. **Testing complexity**: Can't easily test event chains
6. **Memory leaks**: Easy to forget event cleanup

---

## Evaluated Solutions

### Option A: Callback Registry ⭐⭐⭐

**Pattern**: Store calls into registered callback, component provides callback with query data.

```typescript
// lib/callbacks/schema-registry.ts
class SchemaRegistry {
  private callback: ((collectionName: string) => string[] | null) | null = null

  register(fn: (collectionName: string) => string[] | null) {
    this.callback = fn
  }

  getFieldOrder(collectionName: string): string[] | null {
    return this.callback?.(collectionName) ?? null
  }
}

export const schemaRegistry = new SchemaRegistry()

// Store uses it synchronously
const schemaFieldOrder = schemaRegistry.getFieldOrder(currentFile.collection)

// Component registers callback
useEffect(() => {
  schemaRegistry.register((collectionName) => {
    const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
    return collections?.find(c => c.name === collectionName)?.schema?.fields.map(f => f.name) ?? null
  })
}, [projectPath])
```

**Pros**: Type-safe, synchronous, no polling, testable
**Cons**: Adds new concept (registry), still indirect coupling, callback can become stale

**Verdict**: Solves technical problems but doesn't feel architecturally elegant.

---

### Option B: Direct QueryClient Access ⭐

**Pattern**: Store imports queryClient directly.

```typescript
import { queryClient } from '@/lib/query-client'

saveFile: async () => {
  const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
  const schema = collections?.find(c => c.name === collection)?.schema
  // use schema
}
```

**Pros**: Simplest possible solution
**Cons**: **Violates architecture** (Zustand shouldn't import TanStack Query), breaks onion pattern, creates tight coupling

**Verdict**: Too much coupling, goes against architecture philosophy.

---

### Option C: Action Hooks ⭐⭐⭐⭐

**Pattern**: Move complex actions out of stores into custom hooks that have natural access to both.

```typescript
// hooks/editor/useEditorActions.ts
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async (showToast = true) => {
    // Direct access to stores via getState()
    const { currentFile, frontmatter, editorContent, imports } = useEditorStore.getState()
    const { projectPath } = useProjectStore.getState()

    if (!currentFile || !projectPath) return

    // Direct access to query data
    const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
    const schema = collections?.find(c => c.name === currentFile.collection)?.schema
    const schemaFieldOrder = schema?.fields.map(f => f.name) || null

    try {
      await invoke('save_markdown_content', {
        filePath: currentFile.path,
        frontmatter,
        content: editorContent,
        imports,
        schemaFieldOrder,
        projectRoot: projectPath,
      })

      // Update store state
      useEditorStore.getState().markAsSaved()

      // Invalidate queries
      await queryClient.invalidateQueries({
        queryKey: queryKeys.collectionFiles(projectPath, currentFile.collection),
      })

      if (showToast) toast.success('File saved')
    } catch (error) {
      toast.error(`Failed to save: ${error}`)
      throw error
    }
  }, [queryClient])

  return { saveFile, createFile, deleteFile }
}

// Store becomes simpler - just state
const useEditorStore = create<EditorState>((set, get) => ({
  currentFile: null,
  editorContent: '',
  frontmatter: {},
  isDirty: false,

  setEditorContent: (content) => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave()
  },

  markAsSaved: () => set({ isDirty: false }),

  // Auto-save still triggers via event (or callback - see below)
  scheduleAutoSave: () => {
    // ...
  },
}))

// Usage in components
const { saveFile } = useEditorActions()
<Button onClick={() => void saveFile()}>Save</Button>

// Auto-save needs hook access - see Hybrid approach below
```

**Pros**:
- Follows React patterns (hooks composition is idiomatic)
- Natural access to both stores and queries
- Type-safe
- Easy to test (can test hook in isolation)
- Clear data flow
- Aligns with architecture guide's "Reusable UI Logic → hooks"

**Cons**:
- Changes mental model (where do I find actions?)
- Store becomes passive state container
- Auto-save scheduling becomes more complex (needs hook access)

**Verdict**: Very clean for user-triggered actions, but awkward for store-triggered actions like auto-save.

---

### Option D: Service Layer / Facade ⭐⭐

**Pattern**: Introduce middle layer that mediates between stores and queries.

```typescript
class EditorService {
  constructor(private queryClient: QueryClient) {}

  async saveFile(params: SaveParams): Promise<void> {
    const collections = this.queryClient.getQueryData(...)
    // orchestration logic
  }
}

export const editorService = new EditorService(queryClient)

// Store calls service
saveFile: async () => {
  await editorService.saveFile({ /* params */ })
}
```

**Pros**: Clean separation, testable service
**Cons**: Adds architectural layer, not very "React-like", service initialization complexity

**Verdict**: Feels like backend architecture in frontend. Over-engineered for this use case.

---

## Recommended Solution: Hybrid Action Hooks ⭐⭐⭐⭐⭐

**Core Insight**: Different types of actions have different architectural needs:

1. **User-triggered actions** (Save button, keyboard shortcuts) → Should live in **hooks**
2. **State-triggered actions** (Auto-save, dirty tracking) → Should live in **stores**

### The Hybrid Architecture

```typescript
// =====================================
// STORES: State + State-Triggered Logic
// =====================================

const useEditorStore = create<EditorState>((set, get) => ({
  // State
  currentFile: null,
  editorContent: '',
  frontmatter: {},
  isDirty: false,
  autoSaveTimeoutId: null,
  autoSaveCallback: null as (() => Promise<void>) | null,

  // Register auto-save handler from hook
  setAutoSaveCallback: (callback: () => Promise<void>) => {
    set({ autoSaveCallback: callback })
  },

  // State mutations
  setEditorContent: (content) => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave()  // State-triggered action
  },

  updateFrontmatterField: (key, value) => {
    set(state => ({
      frontmatter: { ...state.frontmatter, [key]: value },
      isDirty: true,
    }))
    get().scheduleAutoSave()  // State-triggered action
  },

  // Auto-save scheduling (state logic)
  scheduleAutoSave: () => {
    const { autoSaveTimeoutId, autoSaveCallback, isDirty } = get()

    if (!isDirty || !autoSaveCallback) return

    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
    }

    const timeoutId = setTimeout(() => {
      void autoSaveCallback()  // Calls hook-provided function
    }, 2000)

    set({ autoSaveTimeoutId: timeoutId })
  },

  // Simple state update after save completes
  markAsSaved: () => {
    const { autoSaveTimeoutId } = get()
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
    }
    set({ isDirty: false, autoSaveTimeoutId: null })
  },
}))

// =====================================
// HOOKS: User-Triggered Actions
// =====================================

// hooks/editor/useEditorActions.ts
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async (showToast = true) => {
    const { currentFile, frontmatter, editorContent, imports } = useEditorStore.getState()
    const { projectPath } = useProjectStore.getState()

    if (!currentFile || !projectPath) return

    // Access query data directly - no events!
    const collections = queryClient.getQueryData(queryKeys.collections(projectPath))
    const schema = collections?.find(c => c.name === currentFile.collection)?.schema
    const schemaFieldOrder = schema?.fields.map(f => f.name) || null

    try {
      // Track recently saved for file watcher
      useEditorStore.setState({ recentlySavedFile: currentFile.path })

      await invoke('save_markdown_content', {
        filePath: currentFile.path,
        frontmatter,
        content: editorContent,
        imports,
        schemaFieldOrder,
        projectRoot: projectPath,
      })

      // Update state
      useEditorStore.getState().markAsSaved()

      // Invalidate queries
      await queryClient.invalidateQueries({
        queryKey: queryKeys.collectionFiles(projectPath, currentFile.collection),
      })

      if (showToast) {
        toast.success('File saved successfully')
      }

      // Clear recently saved after delay
      setTimeout(() => {
        useEditorStore.setState({ recentlySavedFile: null })
      }, 1000)

    } catch (error) {
      toast.error('Save failed', {
        description: `Could not save file: ${error}`,
      })

      // Save recovery data
      await saveRecoveryData({
        currentFile,
        projectPath,
        editorContent,
        frontmatter,
      })

      throw error
    }
  }, [queryClient])

  return { saveFile }
}

// =====================================
// LAYOUT: Wire Everything Together
// =====================================

// components/layout/Layout.tsx
export function Layout() {
  const { saveFile } = useEditorActions()

  // Register auto-save callback with store
  useEffect(() => {
    const autoSave = async () => {
      await saveFile(false)  // No toast for auto-save
    }

    useEditorStore.getState().setAutoSaveCallback(autoSave)

    return () => {
      useEditorStore.getState().setAutoSaveCallback(null)
    }
  }, [saveFile])

  // ... rest of layout
}

// =====================================
// USAGE: Clean & Simple
// =====================================

// In any component
const { saveFile } = useEditorActions()

// Manual save
<Button onClick={() => void saveFile()}>Save</Button>

// Keyboard shortcut
useHotkeys('mod+s', () => void saveFile())

// Auto-save happens automatically via store
```

---

## Why This Is The Best Solution

### 1. Follows Architecture Guide Philosophy ✅

**Separation of Concerns**:
- **Stores** = State container + state-triggered logic (auto-save scheduling)
- **Hooks** = User-triggered actions (has natural access to both stores and queries)
- **Components** = Wiring layer (registers callbacks)

**Hybrid State Management**:
- TanStack Query = Server state (still outer layer)
- Zustand = Client state (still middle layer)
- Hooks bridge the gap WITHOUT violating onion pattern

**Performance**:
- Uses `getState()` pattern ✅
- No unnecessary re-renders ✅
- Stable callback dependencies ✅

### 2. Solves All Technical Problems ✅

- ❌ **No polling** - Synchronous callback execution
- ✅ **Type-safe** - TypeScript enforces everything
- ✅ **Testable** - Can test hooks independently, can test store independently
- ✅ **No race conditions** - Callback registration in useEffect is reliable
- ✅ **No memory leaks** - Standard React cleanup patterns
- ✅ **Easy debugging** - Clear call path, no events to trace

### 3. Easy to Understand ✅

**Mental Model**:
- "Actions triggered by user interactions" → `useEditorActions()` hook
- "Actions triggered by state changes" → Store methods
- "Wiring between them" → Layout component

**Discovery**:
- Want to save a file? → `const { saveFile } = useEditorActions()`
- Want to schedule auto-save? → Look in store's `scheduleAutoSave()`
- Where's the connection? → Look in Layout

### 4. Maintainable Long-Term ✅

**Evolution**:
- Add new user action → Add to `useEditorActions` hook
- Add new state-triggered action → Add to store
- Change orchestration → Modify Layout wiring

**Testing**:
- Test store in isolation → Mock callback
- Test hook in isolation → Mock stores and queryClient
- Integration test → Render Layout with test providers

### 5. Aligns with React Ecosystem ✅

This pattern is used by successful React apps:
- **React Query examples**: Actions in hooks that access query data
- **Zustand best practices**: Keep stores simple, use hooks for complex operations
- **React philosophy**: Composition of hooks

---

## Migration Path

### Phase 1: Extract `saveFile` to Hook
1. Create `hooks/editor/useEditorActions.ts`
2. Implement `saveFile` in hook
3. Update store to accept callback
4. Wire in Layout
5. Update all call sites
6. Remove old event bridge code

**Effort**: 2-3 hours

### Phase 2: Apply Pattern to Other Actions
1. `createNewFile` → Move to hook
2. `deleteFile` → Move to hook
3. Other orchestration actions

**Effort**: 1-2 hours each

### Phase 3: Clean Up
1. Remove all event bridge infrastructure
2. Update architecture guide
3. Add tests

**Effort**: 1-2 hours

**Total**: ~1 day

---

## Alternative: If We Must Keep Stores Powerful

If the philosophy is that stores SHOULD contain all business logic (not just state), then the **Callback Registry** (Option A) is second-best:

```typescript
// Minimal, focused registry
class QueryDataRegistry {
  private getCollections: ((projectPath: string) => Collection[] | undefined) | null = null

  registerCollectionsGetter(fn: (projectPath: string) => Collection[] | undefined) {
    this.getCollections = fn
  }

  getCollectionsData(projectPath: string): Collection[] | undefined {
    return this.getCollections?.(projectPath)
  }
}

export const queryDataRegistry = new QueryDataRegistry()

// Store uses it
saveFile: async () => {
  const collections = queryDataRegistry.getCollectionsData(projectPath)
  const schema = collections?.find(c => c.name === collection)?.schema
  // ...
}

// Layout registers
useEffect(() => {
  queryDataRegistry.registerCollectionsGetter((projectPath) => {
    return queryClient.getQueryData(queryKeys.collections(projectPath))
  })
}, [])
```

**Why it's second-best**: Still adds indirection, but at least it's type-safe and synchronous.

---

## Recommendation

**Implement the Hybrid Action Hooks pattern** (Option C enhanced).

**Why**:
- Most aligned with architecture philosophy
- Cleanest code
- Best developer experience
- Future-proof
- No new concepts (just uses existing patterns: hooks + stores)

**When to start**: After fixing auto-save data loss (task-1) and YAML parser (task-2). This is an architectural improvement, not a critical bug.

**Create task**: Post-1.0.0 architectural enhancement.
