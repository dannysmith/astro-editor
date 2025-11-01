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
- FileItem is a **pure presentational component** - NO store subscriptions
- Parent subscribes ONCE and passes `isSelected` and `frontmatterMappings` as props
- Avoids N subscriptions (one per file) which would be a performance regression
- Rename state moves to component's local `useState` - properly scoped, no global re-renders
- CSS-only hover (brightness filter) - no JS state needed

**Future Optimization** (if performance testing reveals issues):
- Handlers passed to FileItem could be wrapped in `useCallback` with `getState()` pattern
- FileItem could be wrapped in `React.memo` to prevent unnecessary re-renders
- Current implementation maintains existing behavior (no regression)

## Implementation Plan

### 1. Create FileItem Component

**Location**: `src/components/layout/FileItem.tsx`

**Props Interface**:
```typescript
interface FileItemProps {
  file: FileEntry
  isSelected: boolean  // Computed by parent
  frontmatterMappings: FrontmatterMappings  // From parent's useEffectiveSettings
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
- `renameInitializedRef` (local useRef) - tracks if focus/select logic has run
- Derived: `isFileDraft`, `isMdx`, `title`, `publishedDate`

**NO Store Subscriptions**: FileItem is purely presentational

### 2. Update LeftSidebar

**Keep in parent**:
- `renamingFileId` state (which file is being renamed)
- `handleRename` (sets renamingFileId)
- `handleRenameSubmit` (calls mutation, clears renamingFileId)
- `handleRenameCancel` (clears renamingFileId)

**Compute in parent and pass to FileItem**:
- `isSelected={currentFile?.id === file.id}`
- `frontmatterMappings` from `useEffectiveSettings(selectedCollection)`
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

**With (mutually exclusive conditions)**:
```tsx
className={cn(
  'w-full text-left p-3 rounded-md transition-colors',
  // Background: mutually exclusive
  isSelected && 'bg-primary/15',
  !isSelected && isFileDraft && 'bg-[var(--color-warning-bg)]',
  // Hover: mutually exclusive
  isSelected && 'hover:bg-primary/20',
  !isSelected && isFileDraft && 'hover:brightness-95 dark:hover:brightness-110',
  !isSelected && !isFileDraft && 'hover:bg-accent',
)}
```

**Why this works**:
- **Mutually exclusive conditions** prevent filter/color conflicts
- Selected items: Always get primary colors (no brightness filter interference)
- Draft items: Get warning background + brightness filter hover
- Normal items: Get standard accent hover
- `brightness-95` darkens in light mode (95% brightness = 5% darker)
- `brightness-110` lightens in dark mode (110% brightness = 10% lighter)
- Works regardless of the CSS variable value - operates on computed color

### 4. Component Structure

```tsx
// Helper functions - exported for reuse
function getTitle(file: FileEntry, titleField: string): string {
  if (file.frontmatter?.[titleField] && typeof file.frontmatter[titleField] === 'string') {
    return file.frontmatter[titleField]
  }
  const filename = file.name || file.path.split('/').pop() || 'Untitled'
  return filename.replace(/\.(md|mdx)$/, '')
}

function formatDate(dateValue: unknown): string {
  // ... same implementation as current
}

function getPublishedDate(
  frontmatter: Record<string, unknown>,
  publishedDateField: string | string[]
): Date | null {
  // ... same implementation as current
}

export const FileItem: React.FC<FileItemProps> = ({
  file,
  isSelected,
  frontmatterMappings,
  onFileClick,
  onContextMenu,
  onRenameSubmit,
  isRenaming,
  onStartRename,
  onCancelRename,
}) => {
  const [renameValue, setRenameValue] = useState('')
  const renameInitializedRef = useRef(false)

  // Derived state (NO store subscriptions)
  const isFileDraft = file.isDraft || file.frontmatter?.[frontmatterMappings.draft] === true
  const isMdx = file.extension === 'mdx'
  const title = getTitle(file, frontmatterMappings.title)
  const publishedDate = getPublishedDate(file.frontmatter || {}, frontmatterMappings.publishedDate)

  // Initialize rename value when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      const fullName = file.extension ? `${file.name}.${file.extension}` : file.name
      setRenameValue(fullName || '')
      renameInitializedRef.current = false  // Reset for new rename session
    }
  }, [isRenaming, file.name, file.extension])

  // Focus and select filename without extension
  useEffect(() => {
    if (isRenaming && !renameInitializedRef.current) {
      renameInitializedRef.current = true
      const timeoutId = setTimeout(() => {
        const input = document.querySelector('input[type="text"]') as HTMLInputElement
        if (input && renameValue) {
          input.focus()
          const lastDotIndex = renameValue.lastIndexOf('.')
          if (lastDotIndex > 0) {
            input.setSelectionRange(0, lastDotIndex)
          } else {
            input.select()
          }
        }
      }, 10)
      return () => clearTimeout(timeoutId)
    }
  }, [isRenaming, renameValue])

  // ... rest of component
}
```

### 5. Helper Functions

Helper functions (`getTitle`, `formatDate`, `getPublishedDate`) are **exported from FileItem.tsx** so they can be:
- Used by FileItem internally
- Imported by LeftSidebar if needed for other purposes
- Tested independently

## Key Gotchas Addressed

1. **Store Subscriptions**: FileItem must NOT subscribe to stores to avoid N subscriptions (one per file). Parent subscribes once and passes props.

2. **Hover Class Conflicts**: Brightness filters and background colors must use mutually exclusive conditions to prevent both applying simultaneously.

3. **Helper Function Access**: Helpers are exported from FileItem.tsx so they're accessible to both FileItem and LeftSidebar.

4. **Rename Focus Logic**: The ref-based focus/select logic moves to FileItem along with rename state to keep it self-contained.

5. **Performance Testing**: Must explicitly test with React DevTools Profiler to ensure no regressions from component extraction.

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
