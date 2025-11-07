# Performance Issue: Excessive Re-renders on Every Keystroke

## Summary

During investigation of a status bar hiding bug, we discovered a significant performance issue: the `Layout` component and its children (`UnifiedTitleBar` and `StatusBar`) are re-rendering on **every single keystroke** in the editor. This represents a fundamental architectural problem with our Zustand store subscription patterns and hook composition.

## Evidence

Console logging revealed the following re-render cascade on every keystroke:

```
[Log] [UnifiedTitleBar] RENDER
[Log] [StatusBar] RENDER
[Log] [Layout] RENDER
[Log] [Layout] createNewFileWithQuery changed
```

This pattern repeats for every character typed, indicating that:
1. Layout re-renders on every keystroke
2. All Layout children (UnifiedTitleBar, StatusBar) re-render as a consequence
3. The `createNewFileWithQuery` callback changes on every render

## Root Causes Identified

### 1. Store Subscription Anti-Pattern: Destructuring from Zustand Stores

**Problem**: Components destructuring directly from Zustand stores subscribe to the **entire store**, not just the values they use.

**Example from Layout.tsx (BEFORE fix attempts)**:
```typescript
// ❌ WRONG: Subscribes to entire UI store
const { sidebarVisible, frontmatterPanelVisible } = useUIStore()

// ❌ WRONG: Subscribes to entire project store
const { projectPath, currentProjectSettings } = useProjectStore()
```

**What happens**: When ANY property in the store changes (e.g., `distractionFreeBarsHidden` changes on every keystroke), the component re-renders even though the specific values it uses haven't changed.

**Correct pattern**:
```typescript
// ✅ CORRECT: Selective subscriptions
const sidebarVisible = useUIStore(state => state.sidebarVisible)
const frontmatterPanelVisible = useUIStore(state => state.frontmatterPanelVisible)
```

### 2. Hook Composition Problem: Unstable Return Values

**Problem**: Custom hooks (`useCreateFile`, `useEditorActions`) are called in Layout, but these hooks have dependencies on frequently-changing data, causing them to return new object references on every render.

**Example from useCreateFile.ts**:
```typescript
export const useCreateFile = () => {
  // This destructures from store - subscribes to ENTIRE store
  const { projectPath, currentProjectSettings } = useProjectStore()

  // This query refetches after saves, returning new array references
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  const createFileMutation = useCreateFileMutation()

  const createNewFile = useCallback(async () => {
    // ... implementation
  }, [collections, createFileMutation]) // ⚠️ These dependencies change frequently!

  return { createNewFile } // ⚠️ Returns new object on every render!
}
```

**The cascade**:
1. Every keystroke updates `editorContent` in `editorStore`
2. `useCreateFile` subscribes to entire `projectStore` (via destructuring)
3. Even though `projectPath` and `currentProjectSettings` don't change, Zustand notifies ALL subscribers when any store property changes
4. `useCreateFile` re-renders, `collections` gets a new array reference from TanStack Query
5. `createNewFile` callback is recreated (new reference)
6. Layout receives new `{ createNewFile }` object
7. Layout re-renders
8. All Layout children re-render

### 3. TanStack Query Data Instability

**Problem**: TanStack Query returns new data references even when the actual data hasn't changed. This is standard behavior, but when combined with `useCallback` dependencies, it causes cascading re-renders.

**Example**:
```typescript
const { data: collections = [] } = useCollectionsQuery(projectPath, currentProjectSettings)

const createNewFile = useCallback(async () => {
  const collection = collections.find(c => c.name === selectedCollection)
  // ...
}, [collections]) // ⚠️ collections is a new array reference on every query update
```

### 4. Missing Shallow Equality Checks

**Problem**: Even with selective subscriptions, subscribing to object references from stores can cause unnecessary re-renders if Zustand uses strict equality (`Object.is()`) by default.

**Example from StatusBar.tsx**:
```typescript
// Without shallow comparison, this re-renders when editorStore changes
// even though currentFile object reference is stable
const currentFile = useEditorStore(state => state.currentFile)

// ✅ CORRECT: Use shallow comparison
import { shallow } from 'zustand/shallow'
const currentFile = useEditorStore(state => state.currentFile, shallow)
```

## Scope of the Problem

This issue affects multiple components throughout the codebase:

1. **Layout.tsx** - Re-renders on every keystroke, cascading to all children
2. **StatusBar.tsx** - Re-renders unnecessarily (should only re-render when `currentFile` changes or panels toggle)
3. **UnifiedTitleBar.tsx** - Re-renders on `isDirty` changes (this is somewhat expected, but still part of cascade)
4. **useCreateFile hook** - Returns new object references on every render
5. **Potentially other custom hooks** - Any hook using similar patterns likely has the same issues

## Expected Behavior

**What SHOULD trigger re-renders**:
- `UnifiedTitleBar`: When `isDirty` changes (for save button), when panels toggle, when `distractionFreeBarsHidden` changes
- `StatusBar`: When `currentFile` changes, when panels toggle, when `distractionFreeBarsHidden` changes
- `Layout`: When `sidebarVisible` or `frontmatterPanelVisible` changes, when `globalSettings` changes

**What SHOULD NOT trigger re-renders**:
- Every keystroke in the editor
- Changes to unrelated store properties
- TanStack Query refetches that return the same data

## Performance Impact

While the impact may not be immediately visible to users due to React's efficient reconciliation, this represents:

1. **Wasted CPU cycles**: Running component logic, hooks, and reconciliation on every keystroke
2. **Potential lag on slower devices**: Especially with complex components
3. **Difficult-to-debug issues**: Like the status bar hiding bug we were investigating
4. **Architectural debt**: Indicates fundamental misunderstanding of React/Zustand patterns

## Recommended Investigation Scope

A comprehensive review should examine:

1. **All Zustand store subscriptions**: Find instances of destructuring from stores instead of selective subscriptions
2. **All custom hooks**: Identify hooks with unstable return values or problematic dependencies
3. **Hook composition in Layout and other parent components**: Verify that parent components aren't calling hooks unnecessarily
4. **TanStack Query usage patterns**: Ensure query data isn't being used directly as useCallback/useMemo dependencies
5. **Object reference patterns**: Look for places where `shallow` equality comparison should be used

## Search Patterns

To find problematic code:

```bash
# Find destructuring from Zustand stores
grep -r "const { .* } = use.*Store()" src/

# Find useCallback with query data dependencies
grep -A 10 "useCallback" src/ | grep -B 5 "data:"

# Find components calling multiple custom hooks
grep -r "use.*File\|use.*Actions\|use.*Handler" src/components/
```

## Success Criteria

After fixing these issues:

1. Layout should only render when its direct dependencies change (panel visibility, settings)
2. StatusBar should only render when `currentFile`, panel visibility, or `distractionFreeBarsHidden` changes
3. UnifiedTitleBar should only render when its subscribed values change
4. Console logging should show minimal re-renders during typing (only components that actually need to update)

## Related Files

Key files to review:
- `src/components/layout/Layout.tsx`
- `src/components/layout/StatusBar.tsx`
- `src/components/layout/UnifiedTitleBar.tsx`
- `src/hooks/useCreateFile.ts`
- `src/hooks/editor/useEditorActions.ts`
- All files with custom hooks that compose other hooks
- All files that destructure from Zustand stores

## References

- Zustand documentation: https://docs.pmnd.rs/zustand/guides/prevent-rerenders-with-use-shallow
- React useCallback: https://react.dev/reference/react/useCallback
- TanStack Query data stability: https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations
