# Performance Guide

This guide covers performance optimization patterns critical for maintaining optimal application responsiveness.

> **⚠️ CRITICAL: Before continuing, read the [Zustand Subscription Patterns](./state-management.md#️-critical-zustand-subscription-patterns) section in state-management.md. Violating these patterns causes severe performance degradation (15+ re-renders per keystroke). This is the #1 performance issue in the codebase.**

## Table of Contents

- [React Compiler (Automatic Memoization)](#react-compiler-automatic-memoization)
- [Core Principles](#core-principles)
- [The `getState()` Pattern](#the-getstate-pattern)
- [Store Subscription Optimization](#store-subscription-optimization)
- [CSS Visibility vs Conditional Rendering](#css-visibility-vs-conditional-rendering)
- [Strategic React.memo Placement](#strategic-reactmemo-placement)
- [Memoization (Manual)](#memoization-manual)
- [Lazy Loading](#lazy-loading)
- [Debouncing](#debouncing)
- [React Compiler Patterns](#react-compiler-patterns)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [Performance Testing](#performance-testing)

## React Compiler (Automatic Memoization)

**As of October 2025, we use React Compiler v1.0** which automatically optimizes React components and hooks through intelligent memoization. This eliminates the need for manual `useMemo`, `useCallback`, and `React.memo` in most cases.

### What React Compiler Does

The compiler automatically:
- **Memoizes components and hooks** based on their dependencies
- **Optimizes granularly** - can memoize values conditionally (better than manual memoization)
- **Enforces Rules of React** through stricter ESLint rules
- **Prevents unnecessary re-renders** without manual intervention

### What Compiler Does NOT Optimize

**CRITICAL**: React Compiler only memoizes React components and hooks. It does NOT optimize:
- **Zustand store subscriptions** - Selector syntax and `getState()` patterns remain essential
- **Regular JavaScript functions** - Only functions named like components/hooks
- **External state management** - Store patterns unchanged
- **TanStack Query usage** - Query optimization patterns still apply

### When to Use Manual Memoization

Use manual `useMemo`/`useCallback` only when:
- **Profiling shows a need** - Measure first, optimize second
- **Expensive computations** the compiler can't detect (e.g., heavy calculations, large data transformations)
- **Explicit control required** - Third-party library integration or debugging
- **Escape hatch** - Temporary workaround for compiler issues (use `"use no memo"` directive)

```typescript
// ✅ Let compiler handle simple cases
function MyComponent({ data }) {
  // Compiler automatically memoizes this
  const filtered = data.filter(item => item.active)
  return <List items={filtered} />
}

// ✅ Manual memoization for expensive operations (after profiling)
function ComplexComponent({ largeDataset }) {
  // Expensive operation - manual memoization justified
  const processed = useMemo(() => {
    return largeDataset.map(item =>
      expensiveTransformation(item) // Heavy calculation
    ).sort(complexSort)
  }, [largeDataset])

  return <DataGrid data={processed} />
}
```

### React Compiler ESLint Rules

The compiler enforces React's Rules through new ESLint rules:

```typescript
// ❌ set-state-in-effect - Warns about setState in effects
useEffect(() => {
  // Avoid: Can cause cascading renders
  setState(computeValue())
}, [dependency])

// ✅ Prefer derived state
const value = computeValue()

// ❌ preserve-manual-memoization - Requires complete dependencies
const value = useMemo(() => compute(a, b), [a]) // Missing 'b'

// ✅ Complete dependencies
const value = useMemo(() => compute(a, b), [a, b])

// ❌ exhaustive-deps - Stricter dependency checking
useEffect(() => {
  doSomething(prop)
}, []) // Missing 'prop'

// ✅ Include all dependencies
useEffect(() => {
  doSomething(prop)
}, [prop])
```

### Opting Out with "use no memo"

Use the `"use no memo"` directive to prevent compiler optimization:

```typescript
// Opt-out specific component
function ComponentWithSideEffects() {
  "use no memo" // Directive must be first statement

  // Component has side effects compiler might optimize incorrectly
  logToAnalytics('component_rendered')

  return <div>Content</div>
}

// ✅ Always document why
function ProblematicComponent() {
  "use no memo" // TODO: Remove after fixing dynamic height issue (ISSUE-123)
  // Implementation
}

// ❌ Don't use without explanation
function Mystery() {
  "use no memo" // Why? No one knows!
  // ...
}
```

### Key Takeaways

1. **Default to compiler optimization** - Don't add manual memoization unless profiling shows a need
2. **Zustand patterns still critical** - Compiler doesn't optimize store subscriptions
3. **Measure before optimizing** - Use React DevTools Profiler
4. **Document opt-outs** - Always explain `"use no memo"` usage
5. **Effect cleanup required** - Use `cancelled` flags (see [React Compiler Patterns](#react-compiler-patterns))

## Core Principles

**CRITICAL**: Following these patterns is essential to prevent render cascades and maintain optimal performance.

### Key Performance Goals

1. **Minimize Re-renders**: Components should only re-render when their displayed data changes
2. **Stable Dependencies**: useCallback and useEffect dependencies should remain stable
3. **Prevent Cascades**: One state change shouldn't trigger unnecessary re-renders in unrelated components
4. **Optimize Subscriptions**: Subscribe only to data that should trigger re-renders

## The `getState()` Pattern

**Core Principle**: Subscribe only to data that should trigger component re-renders. For callbacks that need current state, use `getState()` to access values without subscribing.

### Why This Matters

When you destructure store values in a component, you create a subscription. Every time those values change, the component re-renders and all its callbacks are recreated, triggering their dependencies and cascading re-renders.

### Pattern Implementation

```typescript
// ❌ BAD: Causes render cascade (destructuring subscribes to entire store)
const { currentFile, isDirty, saveFile } = useEditorStore()

const handleSave = useCallback(() => {
  if (currentFile && isDirty) {
    void saveFile()
  }
}, [currentFile, isDirty, saveFile]) // ← Re-creates on every keystroke!

// ✅ GOOD: No cascade (getState pattern)
const setEditorContent = useEditorStore(state => state.setEditorContent)

const handleSave = useCallback(() => {
  const { currentFile, isDirty, saveFile } = useEditorStore.getState()
  if (currentFile && isDirty) {
    void saveFile()
  }
}, []) // ← Stable dependency array
```

### When to Use `getState()`

- **In useCallback dependencies** when you need current state but don't want re-renders
- **In event handlers** for accessing latest state without subscriptions
- **In useEffect with empty dependencies** when you need current state on mount only
- **In async operations** when state might change during execution

### Real-World Example

```typescript
// Editor component with optimal subscriptions
const Editor = () => {
  // Only subscribe to what triggers UI updates
  const content = useEditorStore(state => state.editorContent)

  // Handler needs current file but shouldn't re-render when it changes
  const handleSave = useCallback(() => {
    const { currentFile, isDirty, saveFile } = useEditorStore.getState()
    if (currentFile && isDirty) {
      void saveFile()
    }
  }, []) // Stable!

  const handleChange = useCallback((newContent: string) => {
    useEditorStore.getState().setEditorContent(newContent)
  }, []) // Stable!

  return <CodeMirror value={content} onChange={handleChange} />
}
```

## Store Subscription Optimization

### Specific Selectors vs Object Destructuring

```typescript
// ❌ BAD: Destructuring subscribes to entire store
const { currentFile } = useEditorStore()

// ✅ BETTER: Selector syntax creates granular subscription
const currentFile = useEditorStore(state => state.currentFile)

// ✅ BEST: Primitive selectors for even finer control
const hasCurrentFile = useEditorStore(state => !!state.currentFile)
const currentFileName = useEditorStore(state => state.currentFile?.name)
const fileCount = useEditorStore(state => state.files.length)
```

### Why Selector Syntax Matters

**CRITICAL**: Destructuring vs selector syntax are NOT equivalent in Zustand:

```typescript
// ❌ Subscribes to ENTIRE store - re-renders on ANY state change
const { currentFile } = useEditorStore()

// ✅ Creates granular subscription - re-renders only when currentFile changes
const currentFile = useEditorStore(state => state.currentFile)
```

**However**, subscribing to objects/arrays can still cause unnecessary re-renders:

```typescript
// ⚠️ PROBLEM: Object reference changes even when values don't
const currentFile = useEditorStore(state => state.currentFile)
// Re-renders whenever currentFile object is recreated, even if properties unchanged

// ✅ SOLUTION: Use useShallow for object/array subscriptions
import { useShallow } from 'zustand/react/shallow'

const currentFile = useEditorStore(useShallow(state => state.currentFile))
// Only re-renders when currentFile properties actually change
```

### Advanced Selectors

```typescript
// Derive complex data without re-renders
const sortedFileNames = useEditorStore(state =>
  state.files
    .filter(f => !f.draft)
    .map(f => f.name)
    .sort()
)

// Use useShallow for stable arrays/objects (Zustand v5)
import { useShallow } from 'zustand/react/shallow'

const fileNames = useEditorStore(
  useShallow(state => state.files.map(f => f.name))
)
// Only re-renders if array contents change, not reference
```

### Function Dependencies in useEffect

```typescript
// ❌ BAD: Destructuring subscribes to entire store
const { loadProject } = useProjectStore()
useEffect(() => {
  void loadProject()
}, [loadProject])

// ✅ GOOD: Direct getState() calls (no subscription)
useEffect(() => {
  void useProjectStore.getState().loadProject()
}, [])

// ✅ ALSO GOOD: Selector for stable reference
const loadProject = useProjectStore(state => state.loadProject)
useEffect(() => {
  void loadProject()
}, [loadProject]) // Store actions are stable
```

## CSS Visibility vs Conditional Rendering

For stateful UI components (like `react-resizable-panels`), use CSS visibility instead of conditional rendering to preserve component state.

### The Problem

```typescript
// ❌ BAD: Conditional rendering breaks stateful components
{frontmatterVisible ? (
  <ResizablePanelGroup>
    <ResizablePanel defaultSize={30}>
      <FrontmatterPanel />
    </ResizablePanel>
    <ResizablePanel>
      <Editor />
    </ResizablePanel>
  </ResizablePanelGroup>
) : (
  <div className="w-full">
    <Editor />
  </div>
)}
```

**Why this is bad:**
- Unmounts and remounts components on every toggle
- Loses panel sizes, scroll positions, internal state
- Triggers expensive initialization on every show/hide

### The Solution

```typescript
// ✅ GOOD: CSS visibility preserves component tree
<ResizablePanelGroup>
  <ResizablePanel
    defaultSize={30}
    className={cn(
      'transition-all duration-200',
      frontmatterVisible ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
    )}
  >
    <FrontmatterPanel />
  </ResizablePanel>
  <ResizablePanel>
    <Editor />
  </ResizablePanel>
</ResizablePanelGroup>
```

### When to Use Each Approach

**Use CSS Visibility (`hidden`, `opacity-0`, etc.) when:**
- Component has internal state (panels, accordions, tabs)
- Component is expensive to initialize
- You need smooth transitions
- Toggling happens frequently

**Use Conditional Rendering (`{condition && <Component />}`) when:**
- Component is lightweight and stateless
- You want to completely avoid rendering cost
- Component has side effects you want to stop
- Memory usage is a concern

## Strategic React.memo Placement

**Note**: React Compiler automatically prevents most unnecessary re-renders. Use `React.memo` only when profiling shows a specific need or for components with expensive render logic.

Use React.memo to break render cascades at component boundaries.

### How It Works

```typescript
// ✅ GOOD: Breaks cascade propagation
const EditorAreaWithFrontmatter = React.memo(({
  frontmatterPanelVisible
}: {
  frontmatterPanelVisible: boolean
}) => {
  // Component only re-renders when frontmatterPanelVisible changes
  // Not affected by parent re-renders from unrelated state
  return (
    <div>
      <Editor />
      {frontmatterPanelVisible && <FrontmatterPanel />}
    </div>
  )
})
```

### Important Limitations

```typescript
// ❌ NOTE: React.memo doesn't help with internal store subscriptions
const Editor = React.memo(() => {
  const content = useEditorStore(state => state.content) // Still triggers re-renders
  // React.memo can't prevent re-renders from internal subscriptions
  return <textarea value={content} />
})
```

### Best Practices

1. **Use at component boundaries** where props change infrequently
2. **Combine with useCallback** to ensure prop stability
3. **Don't overuse** - measure before optimizing
4. **Custom comparison** for complex props

```typescript
const MemoizedComponent = React.memo(
  MyComponent,
  (prevProps, nextProps) => {
    // Return true if props are equal (skip render)
    return prevProps.id === nextProps.id &&
           prevProps.name === nextProps.name
  }
)
```

## Memoization (Manual)

**Note**: React Compiler handles most memoization automatically. Use manual memoization only when profiling shows a specific need.

Use memoization strategically for expensive computations that the compiler cannot optimize.

### useMemo for Expensive Computations

```typescript
// Memoize expensive computations
const sortedFiles = useMemo(
  () => files.sort((a, b) => compareDates(a.date, b.date)),
  [files]
)

// Memoize complex derived state
const filesByCollection = useMemo(() => {
  return collections.reduce((acc, collection) => {
    acc[collection.name] = files.filter(f => f.collection === collection.name)
    return acc
  }, {} as Record<string, FileEntry[]>)
}, [collections, files])
```

### useCallback for Stable Function References

```typescript
// ✅ Stable callbacks for child components (using getState pattern)
const handleChange = useCallback(
  (value: string) => {
    useEditorStore.getState().setEditorContent(value)
  },
  [] // Stable dependency array
)

// ✅ Stable callbacks with external dependencies
const handleSave = useCallback(
  async (fileId: string) => {
    await saveFileToServer(projectPath, fileId)
  },
  [projectPath] // Only recreate if projectPath changes
)
```

### When NOT to Memoize

```typescript
// ❌ Premature optimization - simple computation
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName])
// ✅ Just compute it directly
const fullName = `${firstName} ${lastName}`

// ❌ Memoizing everything
const handleClick = useCallback(() => setCount(count + 1), [count])
// ✅ Use updater function instead
const handleClick = () => setCount(c => c + 1)
```

## Lazy Loading

Defer heavy operations until needed.

### Code Splitting

```typescript
// Lazy load heavy components
const PreferencesDialog = lazy(() => import('./PreferencesDialog'))
const CommandPalette = lazy(() => import('./CommandPalette'))

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {showPreferences && <PreferencesDialog />}
    </Suspense>
  )
}
```

### Dynamic Imports

```typescript
// Load heavy dependencies only when needed
const loadMarkdownParser = async () => {
  const { parseMarkdown } = await import('./heavy-parser')
  return parseMarkdown
}

// Use in handler
const handleExport = async () => {
  const parser = await loadMarkdownParser()
  const parsed = parser(content)
  // ... export logic
}
```

### List Virtualization

For long lists, use virtualization:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const FileList = ({ files }: { files: FileEntry[] }) => {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(item => (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
          >
            <FileItem file={files[item.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Debouncing

Critical for editor performance and preventing excessive operations.

### Auto-Save Debouncing

```typescript
// In store
let timeoutId: ReturnType<typeof setTimeout> | null = null

scheduleAutoSave: () => {
  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    const { currentFile, isDirty } = get()
    if (currentFile && isDirty) {
      void get().saveFile()
    }
  }, 2000)
}
```

### Search Debouncing

```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const SearchInput = () => {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  // Only trigger expensive search when debounced value changes
  const results = useSearchQuery(debouncedSearch)

  return <input value={search} onChange={e => setSearch(e.target.value)} />
}
```

### Custom Debounce Hook

```typescript
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

## React Compiler Patterns

Specific patterns required when using React Compiler.

### Effect Cleanup with Cancelled Flags

**CRITICAL**: Async effects must use `cancelled` flags to prevent stale state updates.

```typescript
// ✅ CORRECT: Cancelled flag prevents stale updates
useEffect(() => {
  let cancelled = false

  const loadData = async () => {
    const data = await fetchData()

    if (!cancelled) {
      setData(data)
    }
  }

  void loadData()

  // Only set cancelled flag - keep state for smooth UX
  return () => {
    cancelled = true
  }
}, [dependency])

// ❌ WRONG: No cancelled flag allows stale updates
useEffect(() => {
  const loadData = async () => {
    const data = await fetchData()
    setData(data) // May update after unmount!
  }

  void loadData()
}, [dependency])
```

### Cleanup Without State Reset

For optimal UX, cleanup should only set the `cancelled` flag, not reset state:

```typescript
// ✅ GOOD: Preserves state for smooth transitions
useEffect(() => {
  const url = hoveredImage?.url
  if (!url) return

  let cancelled = false

  const loadImage = async () => {
    const imageUrl = await resolveImagePath(url)
    if (!cancelled) {
      setImageUrl(imageUrl)
    }
  }

  void loadImage()

  // Only cancel - keep imageUrl cached to prevent flicker
  return () => {
    cancelled = true
  }
}, [hoveredImage?.url])

// ❌ BAD: Resetting state causes flicker
useEffect(() => {
  // ... load logic ...

  return () => {
    cancelled = true
    setImageUrl(null) // ❌ Breaks caching, causes flicker
  }
}, [dependency])
```

### useState for Impure Functions

Use `useState` with initializer function for values from impure functions (e.g., `Math.random()`):

```typescript
// ❌ WRONG: useMemo with impure function
const width = useMemo(() => {
  return `${Math.floor(Math.random() * 40) + 50}%`
}, [])

// ✅ CORRECT: useState with initializer
const [width] = useState(
  () => `${Math.floor(Math.random() * 40) + 50}%`
)
```

### Derived State Over useEffect

Prefer computing values during render instead of `useEffect` + `setState`:

```typescript
// ❌ WRONG: useEffect to derive state
const [preferencesVersion, setPreferencesVersion] = useState('...')

useEffect(() => {
  if (globalSettings?.version) {
    setPreferencesVersion(String(globalSettings.version))
  }
}, [globalSettings?.version])

// ✅ CORRECT: Derive directly
const preferencesVersion = globalSettings?.version
  ? String(globalSettings.version)
  : '...'
```

### Transition-Based State Synchronization

For legitimate transition-based state updates in effects, document why and use proper guards:

```typescript
// ✅ CORRECT: Documented transition-based setState
const previousIsRenamingRef = useRef(isRenaming)

useEffect(() => {
  // Only run on false -> true transition
  if (isRenaming && !previousIsRenamingRef.current) {
    // Safe to setState here: guarded condition ensures this only runs on the
    // false->true transition, preventing cascading renders. This is a standard
    // React pattern for synchronizing derived state on mode transitions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenameValue(fullName)
    renameInitializedRef.current = false
  }
  previousIsRenamingRef.current = isRenaming
}, [isRenaming, fullName])
```

### Moving Logic from Effects to Return

When possible, move conditional logic from effects to return statements:

```typescript
// ❌ LESS OPTIMAL: Clearing state in effect
useEffect(() => {
  if (!isAltPressed) {
    setHoveredImage(null)
  }
}, [isAltPressed])

return hoveredImage

// ✅ BETTER: Conditional logic in return
return isAltPressed ? hoveredImage : null
```

## Anti-Patterns to Avoid

### 1. Subscribing to Frequently-Changing Data

```typescript
// ❌ BAD: Re-renders on every keystroke
const { editorContent } = useEditorStore()

// ✅ GOOD: Only subscribe in the editor itself
const EditorWrapper = () => {
  const content = useEditorStore(state => state.editorContent)
  return <Editor value={content} />
}

const Sidebar = () => {
  // ✅ Doesn't subscribe to content, won't re-render
  return <FileList />
}
```

### 2. Object Dependencies

```typescript
// ❌ BAD: Object reference changes trigger unnecessary re-renders
const file = useEditorStore(state => state.currentFile)
useEffect(() => {
  console.log(file?.name)
}, [file]) // Triggers on every file object change, even if values unchanged

// ✅ BETTER: Use useShallow for objects
import { useShallow } from 'zustand/react/shallow'
const file = useEditorStore(useShallow(state => state.currentFile))
useEffect(() => {
  console.log(file?.name)
}, [file]) // Only triggers when file properties change

// ✅ BEST: Subscribe to specific property
const fileName = useEditorStore(state => state.currentFile?.name)
useEffect(() => {
  console.log(fileName)
}, [fileName]) // Only triggers when name changes
```

### 3. Conditional Rendering of Stateful Components

```typescript
// ❌ BAD: Loses state on every toggle
{visible && <StatefulComponent />}

// ✅ GOOD: Preserve state with CSS
<StatefulComponent className={visible ? '' : 'hidden'} />
```

### 4. Function Dependencies in useEffect

```typescript
// ❌ BAD: Destructuring subscribes to entire store
const { saveFile } = useEditorStore()
useEffect(() => {
  void saveFile()
}, [saveFile])

// ✅ GOOD: Direct getState() call (no subscription)
useEffect(() => {
  void useEditorStore.getState().saveFile()
}, [])

// ✅ ALSO GOOD: Selector for stable reference
const saveFile = useEditorStore(state => state.saveFile)
useEffect(() => {
  void saveFile()
}, [saveFile]) // Store actions are stable
```

### 5. Destructuring Subscribes to Entire Store

```typescript
// ❌ BAD: Destructuring subscribes to ENTIRE store
const { files, currentFile, isDirty } = useEditorStore()
// Component re-renders on ANY editorStore change

// ✅ GOOD: Selector syntax creates granular subscriptions
const files = useEditorStore(state => state.files)
const currentFile = useEditorStore(state => state.currentFile)
const isDirty = useEditorStore(state => state.isDirty)
// Component only re-renders when these specific values change

// ✅ BEST: Add useShallow for objects/arrays
import { useShallow } from 'zustand/react/shallow'
const files = useEditorStore(useShallow(state => state.files))
const currentFile = useEditorStore(useShallow(state => state.currentFile))
const isDirty = useEditorStore(state => state.isDirty) // Primitive, no shallow needed
```

## Performance Testing

### Monitoring Re-renders

Add temporary render tracking during development:

```typescript
// Temporary debugging only - remove before production
const renderCountRef = useRef(0)
renderCountRef.current++

useEffect(() => {
  console.log(`[ComponentName] RENDER #${renderCountRef.current}`)
})
```

**IMPORTANT: Always remove render tracking after debugging.**

### Performance Testing Checklist

Before considering performance work complete:

- [ ] Monitor component render counts during typical interactions
- [ ] Test with sidebars in different states (open/closed)
- [ ] Verify auto-save works under all conditions
- [ ] Use React DevTools Profiler to identify unnecessary re-renders
- [ ] Ensure editor renders only once per actual content change
- [ ] Test typing performance (should feel instant, no lag)
- [ ] Verify panel resizing doesn't cause unnecessary re-renders
- [ ] Check that closing files doesn't leave memory leaks
- [ ] Profile with 100+ files in file list
- [ ] Test with very large markdown files (10,000+ lines)

### Using React DevTools Profiler

1. **Install React DevTools** browser extension
2. **Open Profiler tab** in DevTools
3. **Start recording** before performing action
4. **Perform action** (type, toggle sidebar, etc.)
5. **Stop recording** and analyze
6. **Look for:**
   - Components rendering multiple times
   - Long render times
   - Unexpected cascading renders
   - Components rendering when they shouldn't

### Performance Metrics

Acceptable performance targets:

- **Keystroke to render**: < 16ms (60fps)
- **Auto-save trigger**: 2000ms after last keystroke
- **File open**: < 100ms
- **Sidebar toggle**: < 50ms
- **Panel resize**: 60fps during drag

## Advanced Patterns

### Subscription Middleware

For complex state synchronization:

```typescript
// Subscribe to specific state changes
useEffect(() => {
  const unsubscribe = useEditorStore.subscribe(
    state => state.currentFile,
    (currentFile, prevFile) => {
      if (currentFile?.id !== prevFile?.id) {
        // File changed, do something
        console.log('File changed:', currentFile?.name)
      }
    }
  )
  return unsubscribe
}, [])
```

### Computed Values Pattern

```typescript
// Create computed values in store
const useEditorStore = create<EditorState>((set, get) => ({
  // ... state

  // Computed getter
  get hasUnsavedChanges() {
    return get().isDirty && !!get().currentFile
  },

  // Computed action
  canSave: () => {
    const { currentFile, isDirty } = get()
    return isDirty && !!currentFile
  }
}))
```

### Batch Updates

```typescript
// Batch multiple state updates
const updateMultipleFields = (updates: Partial<EditorState>) => {
  set(state => ({
    ...state,
    ...updates,
    // Single render for all changes
  }))
}
```

---

**Remember**: Performance optimization is about measuring, not guessing. Use React DevTools Profiler to identify actual bottlenecks before optimizing.
