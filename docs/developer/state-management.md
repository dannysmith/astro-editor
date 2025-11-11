# State Management

## Overview

Astro Editor uses a **hybrid state management approach** with three distinct layers, each handling different types of state based on data source, persistence needs, and update frequency. This guide provides comprehensive coverage of when and how to use each layer.

> **React Compiler Note**: While React Compiler (v1.0) automatically handles most component-level memoization, **it does not optimize Zustand store subscriptions**. All patterns in this document remain critical for performance. The compiler optimizes React components and hooks, but external state management like Zustand requires manual optimization through selector syntax and `useShallow`.

## ⚠️ CRITICAL: Zustand Subscription Patterns

**Before reading further, understand these critical rules. Violating them causes severe performance issues.**

### The Two Problems

Zustand subscriptions have two critical performance pitfalls that, when combined, cause render cascades:

#### Problem 1: Destructuring Subscribes to Entire Store

```typescript
// ❌ WRONG: Subscribes to ENTIRE store
const { currentFile, isDirty } = useEditorStore()
// Component re-renders on ANY editorStore change, even unrelated ones

// ✅ CORRECT: Creates granular subscriptions
const currentFile = useEditorStore(state => state.currentFile)
const isDirty = useEditorStore(state => state.isDirty)
// Component only re-renders when these specific values change
```

**Impact**: A single keystroke was causing 15+ component re-renders because destructuring subscribed components to every store update.

#### Problem 2: Object References Change Even When Values Don't

```typescript
// ⚠️ PROBLEM: Object reference changes trigger re-renders
const currentFile = useEditorStore(state => state.currentFile)
// Re-renders whenever currentFile object is recreated, even if properties unchanged

// ✅ SOLUTION: Use useShallow for object/array subscriptions
import { useShallow } from 'zustand/react/shallow'
const currentFile = useEditorStore(useShallow(state => state.currentFile))
// Only re-renders when currentFile properties actually change
```

**Impact**: Even with selector syntax, object subscriptions caused unnecessary re-renders because Zustand creates new state objects on every update.

### The Solution: Selector Syntax + useShallow

**The Pattern Hierarchy** (from best to worst):

```typescript
import { useShallow } from 'zustand/react/shallow'

// 1️⃣ BEST: Primitive selectors (strings, numbers, booleans)
const isDirty = useEditorStore(state => state.isDirty)
const fileName = useEditorStore(state => state.currentFile?.name)
// Only re-renders when the specific primitive value changes

// 2️⃣ BETTER: Object/array selectors with useShallow
const currentFile = useEditorStore(useShallow(state => state.currentFile))
const files = useEditorStore(useShallow(state => state.files))
// Only re-renders when object/array contents change, not references

// 3️⃣ ACCEPTABLE: Functions/actions (always stable)
const updateField = useEditorStore(state => state.updateFrontmatterField)
const saveFile = useEditorStore(state => state.saveFile)
// Store actions are stable references, no useShallow needed

// ❌ NEVER: Destructuring
const { currentFile, isDirty } = useEditorStore()
// Subscribes to entire store - massive performance problem
```

### Quick Reference: When to Use Each Pattern

| What You're Subscribing To | Pattern | Example |
|----------------------------|---------|---------|
| Primitive value (string, number, boolean) | Direct selector | `useStore(state => state.isDirty)` |
| Nested primitive | Direct selector | `useStore(state => state.file?.name)` |
| Object | Selector + `useShallow` | `useStore(useShallow(state => state.currentFile))` |
| Array | Selector + `useShallow` | `useStore(useShallow(state => state.files))` |
| Function/action | Direct selector | `useStore(state => state.saveFile)` |
| Multiple values | Multiple selectors | See "Never destructure" above |

### Code Review Checklist

Before committing code that uses Zustand stores, verify:

- [ ] ✅ **NO destructuring** - No `const { ... } = useStore()` patterns
- [ ] ✅ **Selector syntax** - All subscriptions use `useStore(state => state.value)`
- [ ] ✅ **useShallow for objects/arrays** - Import from `'zustand/react/shallow'`
- [ ] ✅ **Primitive selectors preferred** - Extract specific properties when possible
- [ ] ✅ **getState() in callbacks** - Use for accessing state without subscribing

### Real-World Impact

From our November 2024 refactoring:
- **Before**: ~15 component re-renders per keystroke
- **After**: ~2 component re-renders per keystroke
- **Reduction**: 87% fewer wasted CPU cycles

Files fixed: 10 (5 components + 5 hooks)

For complete details, see `docs/tasks-done/task-2025-11-07-fix-zustand-subscription-performance.md`

---

## The "Onion" Pattern

State management in Astro Editor follows a layered "Onion" pattern, from outermost to innermost:

```
┌─────────────────────────────────────────┐
│ TanStack Query (outermost)              │
│ Server/filesystem data                   │
│  ┌─────────────────────────────────┐    │
│  │ Zustand (middle)                │    │
│  │ Client application state        │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │ useState (innermost)      │  │    │
│  │  │ Transient UI state        │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Metaphor**: Like an onion, you peel away layers as you move from external data sources (filesystem) to internal application state (UI flags). Each layer has a specific purpose and should not be bypassed.

## Decision Tree: Where Does This State Go?

Use this decision tree to determine the correct state layer:

```
Is the data from filesystem/server/Tauri backend?
  ↓ YES → TanStack Query
  ↓ NO

Does it need to persist across components?
  ↓ YES → Is it related to:
           - File editing? → editorStore
           - Project-level config? → projectStore
           - UI layout/visibility? → uiStore
  ↓ NO

Is it just UI presentation state?
  ↓ YES → useState (local)
```

## Layer 1: Server State (TanStack Query)

### When to Use TanStack Query

Use TanStack Query for state that:
- Comes from the server/filesystem (collections, files, file content)
- Benefits from caching and automatic refetching
- Needs to be synchronized across components
- Has loading/error states
- May become stale and needs revalidation

### Our Specific Queries

Astro Editor uses these primary queries:

```typescript
// Collections list
const { data: collections } = useCollectionsQuery(projectPath)

// Files in a collection
const { data: files } = useCollectionFilesQuery(projectPath, collectionName)

// Content of a specific file
const { data: content } = useFileContentQuery(projectPath, fileId)
```

### Query Keys Factory Pattern

**CRITICAL**: Always use the centralized query keys factory for consistency:

```typescript
// lib/query-keys.ts
export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), collectionName, 'files'] as const,
  fileContent: (projectPath: string, fileId: string) =>
    [...queryKeys.all, projectPath, 'files', fileId] as const,
}
```

**Why this pattern?**
- **Consistency**: All queries use the same key structure
- **Invalidation**: Easy to invalidate related queries hierarchically
- **Type Safety**: TypeScript ensures correct parameters
- **Maintainability**: Change key structure in one place

### Automatic Cache Invalidation

After mutations, invalidate affected queries to update the UI:

```typescript
export const useSaveFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveFile,
    onSuccess: (_, variables) => {
      // Invalidate file list to show updated "modified" time
      queryClient.invalidateQueries({
        queryKey: queryKeys.collectionFiles(
          variables.projectPath,
          variables.collectionName
        ),
      })

      // Invalidate specific file content
      queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(
          variables.projectPath,
          variables.fileId
        ),
      })
    },
  })
}
```

**Benefits**:
- UI automatically reflects filesystem changes
- No manual state synchronization needed
- Handles race conditions gracefully

### TanStack Query Best Practices

1. **Always use query keys factory** - Never hardcode keys
2. **Invalidate hierarchically** - Use parent keys to invalidate children
3. **Handle loading states** - Show spinners/skeletons during fetches
4. **Handle error states** - Display user-friendly error messages
5. **Use staleTime wisely** - Balance freshness vs performance

## Layer 2: Client State (Zustand)

### Why Decomposed Stores?

Astro Editor uses **three focused stores** instead of one monolithic store:

```typescript
// 1. Editor Store (most volatile - every keystroke)
editorStore: {
  currentFile, editorContent, frontmatter, isDirty, lastSaved
}

// 2. Project Store (rarely changes)
projectStore: {
  projectPath, selectedCollection, currentProjectSettings, globalSettings
}

// 3. UI Store (occasional changes)
uiStore: {
  sidebarVisible, frontmatterPanelVisible, focusModeEnabled
}
```

**Why separate stores?**

1. **Performance**: Only relevant components re-render when specific state changes
   - Editor content changes don't cause sidebar re-renders
   - Toggling sidebar doesn't re-render editor

2. **Clarity**: Each store has a single, focused responsibility
   - Easy to understand what each store manages
   - Clear boundaries between concerns

3. **Maintainability**: Easier to reason about and modify
   - Changes to editor logic don't affect project logic
   - Can test stores independently

### Store 1: Editor Store (High Volatility)

**Purpose**: Manages currently open file and its editing state.

**Update Frequency**: Every keystroke, frontmatter change, or save operation.

```typescript
interface EditorState {
  // Current file state
  currentFile: FileInfo | null
  editorContent: string
  frontmatter: Record<string, unknown>

  // Edit tracking
  isDirty: boolean
  lastSaved: Date | null
  autoSaveScheduled: boolean

  // Actions
  openFile: (file: FileInfo) => void
  closeFile: () => void
  setEditorContent: (content: string) => void
  updateFrontmatterField: (field: string, value: unknown) => void
  saveFile: () => Promise<void>
  scheduleAutoSave: () => void
}
```

**Real Example**:
```typescript
// In Editor.tsx
const editorContent = useEditorStore(state => state.editorContent)
const setEditorContent = useEditorStore(state => state.setEditorContent)

// In FrontmatterPanel.tsx (with useShallow for objects)
import { useShallow } from 'zustand/react/shallow'
const frontmatter = useEditorStore(useShallow(state => state.frontmatter))
const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

// Selector syntax creates granular subscriptions - minimal re-renders
```

### Store 2: Project Store (Low Volatility)

**Purpose**: Manages project-level configuration and selected collection.

**Update Frequency**: Only when switching projects/collections or changing settings.

```typescript
interface ProjectState {
  // Project context
  projectPath: string | null
  selectedCollection: string | null

  // Settings
  currentProjectSettings: ProjectSettings | null
  globalSettings: GlobalSettings | null

  // Actions
  setProject: (path: string) => void
  setSelectedCollection: (collection: string) => void
  updateProjectSettings: (settings: ProjectSettings) => void
  loadGlobalSettings: () => Promise<void>
}
```

**Real Example**:
```typescript
// In Sidebar.tsx
const selectedCollection = useProjectStore(state => state.selectedCollection)
const setSelectedCollection = useProjectStore(state => state.setSelectedCollection)

// In FileList.tsx (with useShallow for settings object)
import { useShallow } from 'zustand/react/shallow'
const currentProjectSettings = useProjectStore(useShallow(state => state.currentProjectSettings))
// Only re-renders when project settings values change (rare)
```

### Store 3: UI Store (Medium Volatility)

**Purpose**: Manages UI layout, panel visibility, and view modes.

**Update Frequency**: When user toggles panels or changes view modes.

```typescript
interface UIState {
  // Panel visibility
  sidebarVisible: boolean
  frontmatterPanelVisible: boolean

  // View modes
  focusModeEnabled: boolean

  // Actions
  toggleSidebar: () => void
  toggleFrontmatterPanel: () => void
  toggleFocusMode: () => void

  // Batch actions
  showAllPanels: () => void
  hideAllPanels: () => void
}
```

**Real Example**:
```typescript
// In UnifiedTitleBar.tsx
const sidebarVisible = useUIStore(state => state.sidebarVisible)
const toggleSidebar = useUIStore(state => state.toggleSidebar)

// In Layout.tsx
const frontmatterPanelVisible = useUIStore(state => state.frontmatterPanelVisible)
// Only re-renders when panel visibility changes
```

### The getState() Pattern (CRITICAL)

**Problem**: Subscribing to store values in callbacks creates render cascades and performance issues.

**Solution**: Use `getState()` to access current values without subscribing.

#### ❌ BAD: Causes Render Cascade

```typescript
// WRONG: Destructuring subscribes to entire store
const { currentFile, isDirty, saveFile } = useEditorStore()

const handleSave = useCallback(() => {
  if (currentFile && isDirty) {
    void saveFile()
  }
}, [currentFile, isDirty, saveFile]) // Re-creates on EVERY keystroke!

// Problem:
// - Destructuring subscribes component to ENTIRE editorStore
// - Every character typed triggers re-render (isDirty changes)
// - Callback recreates, causing all consumers to re-render
// - Cascade effect throughout component tree
```

#### ✅ GOOD: No Cascade

```typescript
const handleSave = useCallback(() => {
  const { currentFile, isDirty, saveFile } = useEditorStore.getState()
  if (currentFile && isDirty) {
    void saveFile()
  }
}, []) // Stable dependency array - NEVER recreates

// Benefits:
// - Callback stable across all renders
// - No re-renders from state changes
// - Gets latest state at execution time
```

### When to Use getState()

Use `getState()` when:

1. **In useCallback dependencies** - Need current state without re-renders
2. **In event handlers** - One-time access to latest state
3. **In useEffect with empty deps** - Access state without subscription
4. **In async operations** - State might change during execution
5. **In lib/ modules** - Can't use hooks but need store access

**Example: Commands in lib/**
```typescript
// lib/commands/app-commands.ts
export const saveCommand: Command = {
  id: 'save-file',
  execute: async () => {
    // Can't use hooks here, use getState() instead
    const { currentFile, isDirty, saveFile } = useEditorStore.getState()

    if (currentFile && isDirty) {
      await saveFile()
    }
  }
}
```

### When NOT to Use getState()

**Don't use getState() when:**
- Component should re-render on state changes
- You're in a component body (use regular hook)
- State is needed for rendering UI

```typescript
// ❌ WRONG: Component won't re-render on changes
const MyComponent = () => {
  const state = useEditorStore.getState() // Static snapshot!
  return <div>{state.editorContent}</div> // Never updates
}

// ✅ CORRECT: Component re-renders on changes
const MyComponent = () => {
  const editorContent = useEditorStore(state => state.editorContent) // Subscribes to updates
  return <div>{editorContent}</div> // Updates on every change
}
```

## Layer 3: Local State (useState)

### When to Use Local State

Keep state local when it:
- Only affects UI presentation (hover states, tooltip visibility)
- Is derived from props or global state
- Doesn't need persistence across components
- Is tightly coupled to component lifecycle
- Changes frequently but doesn't affect other components

### Examples of Local State

```typescript
// UI-only state
const [isHovered, setIsHovered] = useState(false)
const [showTooltip, setShowTooltip] = useState(false)

// Derived/computed state
const [filteredFiles, setFilteredFiles] = useState<FileInfo[]>([])

// Transient input state
const [searchQuery, setSearchQuery] = useState('')

// Component-specific flags
const [isLoading, setIsLoading] = useState(false)
```

### Common Pitfalls with Local State

#### 1. Don't Sync Local State with Global State

```typescript
// ❌ BAD: Creates sync issues
const [localContent, setLocalContent] = useState(editorContent)

useEffect(() => {
  setLocalContent(editorContent) // Causes infinite loops
}, [editorContent])

// ✅ GOOD: Use global state directly
const editorContent = useEditorStore(state => state.editorContent)
```

#### 2. Don't Lift State Too Early

```typescript
// ❌ BAD: Premature optimization
// Lifting hover state to parent when only one child needs it
const Parent = () => {
  const [isHovered, setIsHovered] = useState(false)
  return <Child isHovered={isHovered} setIsHovered={setIsHovered} />
}

// ✅ GOOD: Keep it local
const Child = () => {
  const [isHovered, setIsHovered] = useState(false)
  // Only this component cares about hover state
}
```

#### 3. Don't Use Local State for Persistence

```typescript
// ❌ BAD: Lost on unmount
const [userPreference, setUserPreference] = useState('light')

// ✅ GOOD: Use Zustand for persistence
const theme = useUIStore(state => state.theme)
const setTheme = useUIStore(state => state.setTheme)
```

## Integration Patterns Between Layers

### Hybrid Action Hooks Pattern (RECOMMENDED)

**Problem**: Zustand stores can't use React hooks, but user-triggered actions need query data.

**Solution**: Split responsibilities:
- **User-triggered actions** (save button, keyboard shortcuts) → Live in **hooks** with direct query access
- **State-triggered actions** (auto-save, dirty tracking) → Live in **stores** with registered callbacks

#### Implementation Example

```typescript
// 1. Hook with direct query access (user-triggered actions)
// In src/hooks/editor/useEditorActions.ts
export function useEditorActions() {
  const queryClient = useQueryClient()

  const saveFile = useCallback(async (showToast = true) => {
    // Direct access to stores via getState() - no subscription, no re-renders
    const { currentFile, editorContent, frontmatter, imports } = useEditorStore.getState()
    const { projectPath } = useProjectStore.getState()

    // Direct synchronous access to query data - NO EVENTS, NO POLLING!
    const collections = queryClient.getQueryData<Collection[]>(
      queryKeys.collections(projectPath)
    )
    const collection = collections?.find(c => c.name === currentFile.collection)
    const schema = collection?.complete_schema
      ? deserializeCompleteSchema(collection.complete_schema)
      : null
    const schemaFieldOrder = schema ? schema.fields.map(f => f.name) : null

    await invoke('save_markdown_content', {
      filePath: currentFile.path,
      frontmatter,
      content: editorContent,
      imports,
      schemaFieldOrder,
      projectRoot: projectPath,
    })

    useEditorStore.getState().markAsSaved()
    if (showToast) toast.success('File saved')
  }, [queryClient])

  return { saveFile }
}
```

```typescript
// 2. Store with state-triggered logic and callback registration
// In src/store/editorStore.ts
export const useEditorStore = create<EditorState>((set, get) => ({
  // State
  editorContent: '',
  isDirty: false,
  autoSaveCallback: null,

  // Register callback from hook
  setAutoSaveCallback: callback => set({ autoSaveCallback: callback }),

  // State mutations trigger auto-save via callback
  setEditorContent: content => {
    set({ editorContent: content, isDirty: true })
    get().scheduleAutoSave() // State-triggered
  },

  // Auto-save scheduling (state logic only, delegates to callback)
  scheduleAutoSave: () => {
    const { autoSaveCallback, autoSaveTimeoutId } = get()

    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
    }

    const timeoutId = setTimeout(() => {
      if (autoSaveCallback) {
        void autoSaveCallback() // Calls hook-provided saveFile
      }
    }, 2000)

    set({ autoSaveTimeoutId: timeoutId })
  },

  markAsSaved: () => set({ isDirty: false }),
}))
```

```typescript
// 3. Layout wires them together
// In src/components/layout/Layout.tsx
export function Layout() {
  const { saveFile } = useEditorActions()

  // Register auto-save callback with store (runs once)
  useEffect(() => {
    useEditorStore.getState().setAutoSaveCallback(() => saveFile(false))
  }, [saveFile]) // saveFile is stable (queryClient never changes)

  // Rest of layout...
}
```

**Why This Works**:
- ✅ **No polling** - Synchronous data access via `queryClient.getQueryData()`
- ✅ **Type-safe** - Full TypeScript inference through the entire chain
- ✅ **No race conditions** - Standard React lifecycle, no event timing issues
- ✅ **Easy to test** - Test hooks and stores independently, integration tests for wiring
- ✅ **Easy to debug** - Clear call paths, stack traces work, explicit imports
- ✅ **Follows React patterns** - Hook composition is idiomatic React
- ✅ **Performance** - Stable callbacks (`queryClient` singleton), no subscriptions via `getState()`

**When to Use**:
- User-triggered actions that need query data → **Use hooks**
- State-triggered actions (auto-save, derived updates) → **Use stores with callbacks**
- Pure state mutations (no external data) → **Use stores directly**

### Store → Store Communication

**Pattern**: Direct function calls between stores.

```typescript
// In uiStore.ts
toggleFocusMode: () => {
  set(state => ({ focusModeEnabled: !state.focusModeEnabled }))

  // Can call other store actions directly
  if (get().focusModeEnabled) {
    useUIStore.getState().hideAllPanels()
  }
}
```

### Query → Store Updates

**Pattern**: Update store after successful mutations.

```typescript
const { mutate: saveFile } = useSaveFileMutation()

const handleSave = async () => {
  await saveFile(fileData)

  // Update store after mutation succeeds
  useEditorStore.getState().setIsDirty(false)
  useEditorStore.getState().setLastSaved(new Date())
}
```

## Performance Implications by Layer

| Layer | Update Frequency | Re-render Scope | Performance Impact |
|-------|-----------------|-----------------|-------------------|
| TanStack Query | Network-bound | All subscribers | Medium (cached) |
| Zustand | Variable | Selected subscribers | Low (decomposed) |
| useState | High | Single component | Minimal |

**Key Takeaway**: Choose the right layer based on:
1. **Data source** (external → TanStack Query)
2. **Sharing needs** (cross-component → Zustand)
3. **Update frequency** (high → local, low → global)
4. **Persistence** (needs to survive unmount → Zustand)

## Real-World Example: File Save Flow

This example shows all three layers working together:

```typescript
// 1. User types in editor (Local State - High Frequency)
const Editor = () => {
  const { editorContent, setEditorContent } = useEditorStore()

  const handleChange = (value: string) => {
    // Update Zustand immediately
    setEditorContent(value)
    // Schedule auto-save (debounced)
    scheduleAutoSave()
  }

  return <CodeMirrorEditor value={editorContent} onChange={handleChange} />
}

// 2. Auto-save triggers after 2s (Zustand → TanStack Query)
const autoSave = async () => {
  const { currentFile, editorContent, frontmatter } = useEditorStore.getState()

  if (currentFile) {
    // Trigger mutation (TanStack Query)
    await saveMutation.mutateAsync({
      projectPath,
      fileId: currentFile.id,
      content: editorContent,
      frontmatter,
    })
  }
}

// 3. Mutation invalidates cache (TanStack Query updates)
const useSaveFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveFile,
    onSuccess: (_, variables) => {
      // Filesystem updated, invalidate cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.collectionFiles(
          variables.projectPath,
          variables.collection
        ),
      })

      // Update store state
      useEditorStore.getState().setIsDirty(false)
      useEditorStore.getState().setLastSaved(new Date())
    },
  })
}

// 4. UI reflects changes (All layers synchronized)
// - Editor shows updated content (Zustand)
// - File list shows new "modified" time (TanStack Query)
// - Save indicator shows "Saved" (Zustand)
```

## Testing State Management

### Testing TanStack Query

```typescript
// Test query hooks with QueryClient
const queryClient = new QueryClient()

test('fetches collections', async () => {
  const { result } = renderHook(
    () => useCollectionsQuery('/project/path'),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    }
  )

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toHaveLength(3)
})
```

### Testing Zustand Stores

```typescript
// Test stores directly (no React needed)
test('updates editor content', () => {
  const { setEditorContent, editorContent } = useEditorStore.getState()

  setEditorContent('new content')

  expect(useEditorStore.getState().editorContent).toBe('new content')
})
```

### Testing Integration

```typescript
// Test bridge pattern
test('store event triggers query update', async () => {
  const handleEvent = jest.fn()
  window.addEventListener('create-new-file', handleEvent)

  useEditorStore.getState().createNewFile()

  expect(handleEvent).toHaveBeenCalled()
})
```

## Best Practices Summary

### Do ✅

1. **Use the decision tree** - Let data source determine state layer
2. **Use getState() in callbacks** - Prevent render cascades
3. **Decompose stores** - Keep stores focused and small
4. **Use query keys factory** - Centralize all query keys
5. **Invalidate after mutations** - Keep UI synchronized
6. **Use bridge pattern** - When stores need query data
7. **Test each layer independently** - Unit test stores, integration test flows

### Don't ❌

1. **Don't bypass layers** - Follow the onion pattern
2. **Don't subscribe in callbacks** - Use getState() instead
3. **Don't create monolithic stores** - Decompose by domain
4. **Don't hardcode query keys** - Use the factory
5. **Don't sync local → global** - Use global state directly
6. **Don't lift state prematurely** - Keep it local when possible
7. **Don't use hooks in lib/** - Use getState() for store access

## Related Documentation

- [architecture-guide.md](./architecture-guide.md) - Overview of state management in context
- [performance-patterns.md](./performance-patterns.md) - Performance optimization with state
- [form-patterns.md](./form-patterns.md) - Direct Store Pattern for forms
- [testing.md](./testing.md) - Testing strategies for state management

---

**Remember**: The "Onion" pattern ensures clear data flow, predictable performance, and maintainable state management. When in doubt, follow the decision tree and consult existing patterns in the codebase.
