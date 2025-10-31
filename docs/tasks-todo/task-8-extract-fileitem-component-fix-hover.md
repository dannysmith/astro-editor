# Task 8: Extract FileItem Component & Fix Draft Hover

## Problem

Draft files in the left sidebar don't show hover effect. The issue is:
1. Conflicting hover classes: `hover:bg-accent` (always applied) vs `hover:bg-[var(--color-warning-bg)]/80` (draft items)
2. Tailwind opacity modifier `/80` doesn't work with CSS custom properties that are already complete `hsl()` values
3. 60+ lines of inline JSX in `.map()` making the code hard to maintain

## Solution

Extract file button into a `FileItem` component and use CSS brightness filters for hover.

## Architecture Compliance

**Extraction Criteria** (from architecture-guide.md):
- ✅ 50+ lines of related logic (60+ lines currently)
- ✅ Contains multiple concerns (rendering, rename logic, state management)
- ✅ Testable in isolation

**Performance Considerations**:
- FileItem will subscribe to `currentFile` from `useEditorStore` - same as current implicit behavior
- Rename state moves to component's local `useState` - properly scoped, no global re-renders
- CSS-only hover (brightness filter) - no JS state needed

## Implementation Plan

### 1. Create FileItem Component

**Location**: `src/components/layout/FileItem.tsx`

**Props Interface**:
```typescript
interface FileItemProps {
  file: FileEntry
  onFileClick: (file: FileEntry) => void
  onContextMenu: (event: React.MouseEvent, file: FileEntry) => void
  onRenameSubmit: (file: FileEntry, newName: string) => Promise<void>
  isRenaming: boolean
  onStartRename: (file: FileEntry) => void
  onCancelRename: () => void
}
```

**Internal State**:
- `renameValue` (local useState) - the edited filename
- Derived: `isSelected`, `isFileDraft`, `isMdx`, `title`, `publishedDate`

**Store/Hook Access**:
- `useEditorStore()` - get `currentFile` to determine selection
- `useEffectiveSettings()` - get `frontmatterMappings` for title/draft/date fields

### 2. Update LeftSidebar

**Keep in parent**:
- `renamingFileId` state (which file is being renamed)
- `handleRename` (sets renamingFileId)
- `handleRenameSubmit` (calls mutation, clears renamingFileId)
- `handleRenameCancel` (clears renamingFileId)

**Pass to FileItem**:
- `isRenaming={renamingFileId === file.id}`
- Callback handlers

### 3. Fix Hover with CSS Brightness

**Replace**:
```tsx
className={cn(
  'hover:bg-accent',  // Always applied - CONFLICT
  isFileDraft && 'bg-[var(--color-warning-bg)] hover:bg-[var(--color-warning-bg)]/80',  // /80 doesn't work
  isSelected && 'bg-primary/15 hover:bg-primary/20'
)}
```

**With**:
```tsx
className={cn(
  'w-full text-left p-3 rounded-md transition-colors',
  !isFileDraft && 'hover:bg-accent',  // Only for non-drafts
  isFileDraft && 'bg-[var(--color-warning-bg)] hover:brightness-95 dark:hover:brightness-110',  // Works with any bg
  isSelected && 'bg-primary/15 hover:bg-primary/20'
)}
```

**Why this works**:
- No class conflicts - `hover:bg-accent` only applies to non-drafts
- `brightness-95` darkens in light mode (95% brightness = 5% darker)
- `brightness-110` lightens in dark mode (110% brightness = 10% lighter)
- Works regardless of the CSS variable value - operates on computed color

### 4. Component Structure

```tsx
export const FileItem: React.FC<FileItemProps> = ({
  file,
  onFileClick,
  onContextMenu,
  onRenameSubmit,
  isRenaming,
  onStartRename,
  onCancelRename,
}) => {
  const [renameValue, setRenameValue] = useState('')
  const { currentFile } = useEditorStore()
  const { frontmatterMappings } = useEffectiveSettings(/* collection if needed */)

  // Derived state
  const isSelected = currentFile?.id === file.id
  const isFileDraft = file.isDraft || file.frontmatter?.[frontmatterMappings.draft] === true
  const isMdx = file.extension === 'mdx'
  const title = getTitle(file, frontmatterMappings.title)
  const publishedDate = getPublishedDate(file.frontmatter || {}, frontmatterMappings.publishedDate)

  // Rename logic
  useEffect(() => {
    if (isRenaming) {
      const fullName = file.extension ? `${file.name}.${file.extension}` : file.name
      setRenameValue(fullName || '')
    }
  }, [isRenaming, file.name, file.extension])

  // Focus and select logic for rename input
  // ... rest of component
}
```

### 5. Helper Functions

Keep `getTitle()` and `formatDate()` in LeftSidebar - they're used by the component but don't need to move.

## Benefits

1. **Fixes the bug**: Proper hover effect on draft items
2. **Cleaner code**: LeftSidebar becomes more readable
3. **Testable**: FileItem can be unit tested in isolation
4. **Maintainable**: Single responsibility - just rendering one file item
5. **Performance**: Same subscriptions as before, properly scoped local state

## Testing

After implementation:
- [ ] Test hover on non-draft files (should use `hover:bg-accent`)
- [ ] Test hover on draft files (should darken in light mode, lighten in dark mode)
- [ ] Test hover on selected draft files (should use primary colors)
- [ ] Test hover on files with MDX badge (no badge interference)
- [ ] Test rename functionality still works
- [ ] Test context menu still works
- [ ] Verify no performance regressions (React DevTools profiler)

## Files to Modify

1. Create: `src/components/layout/FileItem.tsx`
2. Modify: `src/components/layout/LeftSidebar.tsx` (replace inline JSX with `<FileItem>`)
3. Optional: Create `src/components/layout/FileItem.test.tsx` for component tests

## Completion Criteria

- [ ] FileItem component created with proper TypeScript interfaces
- [ ] Hover effect works on all file types in both light and dark mode
- [ ] Rename functionality preserved and working
- [ ] Code follows Direct Store Pattern from architecture guide
- [ ] No performance regressions (check with React DevTools)
- [ ] Manual testing completed in both themes
