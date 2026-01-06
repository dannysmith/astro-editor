# Sidebar Sorting and Filtering UI

## Overview

Add user-facing controls in the sidebar for sorting and filtering content files within a collection, beyond the current draft toggle.

## Problems to Solve

### 1. No Way to Change Sort Order

Currently files are sorted by published date (newest first), with undated files at top. Users cannot:
- Sort alphabetically instead of by date
- Reverse the sort direction (oldest first)
- Sort by last modified date

For reference/encyclopedic content, alphabetical sorting is often more useful than chronological.

### 2. No Search/Filter for Large Collections

For collections with many files, there's no way to quickly find a specific file without scrolling. Users need:
- Text search on title/filename
- Possibly fuzzy matching

---

## Requirements

### Sort Controls

**Must Have:**
- Sort mode selector: Date / Alphabetical
- Sort direction toggle: Ascending / Descending
- Persist selection per-collection (ephemeral, not saved to settings)

**Should Have:**
- Sort by last modified date (uses `last_modified` from FileEntry)
- Remember sort preference across collection switches within session

**Could Have:**
- Persist sort preference to settings (per-collection)
- Additional sort options based on frontmatter fields

### Search/Filter

**Must Have:**
- Text input for filtering files
- Match against title and filename
- Clear button
- Show "no results" state

**Should Have:**
- Keyboard shortcut to focus search (e.g., `Cmd+F` when sidebar focused, or `/`)
- Highlight matching text in results
- Fuzzy matching (typo-tolerant)

**Could Have:**
- Search in description field
- Advanced filters (date range, has/missing fields)

---

## UI Design Considerations

### Placement

Current sidebar header structure:
```
[Back] Collection Name (Drafts) [Draft Toggle]
```

Options for new controls:
1. **Inline with header**: Add sort dropdown next to draft toggle
2. **Collapsible toolbar**: Expandable row below header with all controls
3. **Popover menu**: Single button that opens sort/filter options

**Recommendation**: Collapsible toolbar or popover to avoid cluttering the header. Search input probably needs its own row when active.

### Visual Design

- Keep controls subtle/minimal - the file list is the focus
- Consider hiding search until activated (icon that expands to input)
- Sort controls should be compact (icon buttons or small dropdown)

### Interaction

- Sort changes apply immediately
- Search filters as you type (debounced)
- Clear search with Escape key or clear button
- Keyboard navigation should work through filtered results

---

## Technical Approach

### State Management

Add to `uiStore.ts` (ephemeral state per collection):

```typescript
interface CollectionViewState {
  sortMode: 'date' | 'alphabetical' | 'modified'
  sortDirection: 'asc' | 'desc'
  searchQuery: string
}

// Keyed by collection name
collectionViewState: Record<string, CollectionViewState>
```

### Sorting

Extend `src/lib/files/sorting.ts`:

```typescript
type SortMode = 'date' | 'alphabetical' | 'modified'
type SortDirection = 'asc' | 'desc'

export function sortFiles(
  files: FileEntry[],
  mode: SortMode,
  direction: SortDirection,
  mappings: FieldMappings | null
): FileEntry[]
```

### Filtering

Add `src/lib/files/search.ts`:

```typescript
export function filterFilesBySearch(
  files: FileEntry[],
  query: string,
  mappings: FieldMappings | null
): FileEntry[]
```

Consider using a fuzzy matching library (e.g., `fuse.js`) or simple `includes()` matching.

### LeftSidebar Integration

Update the memoized `filteredAndSortedFiles` to incorporate new state:

```typescript
const filteredAndSortedFiles = React.useMemo(() => {
  let result = files

  // Apply search filter
  if (searchQuery) {
    result = filterFilesBySearch(result, searchQuery, frontmatterMappings)
  }

  // Apply draft filter
  result = filterFilesByDraft(result, showDraftsOnly, frontmatterMappings)

  // Apply sort
  result = sortFiles(result, sortMode, sortDirection, frontmatterMappings)

  return result
}, [files, searchQuery, showDraftsOnly, sortMode, sortDirection, frontmatterMappings])
```

---

## Open Questions

1. **Should sort/filter preferences persist to settings?**
   - Current draft toggle is ephemeral (resets on app restart)
   - Sort preference might be more "sticky" - users expect it to persist
   - Could add to collection settings if desired

2. **How to handle search + draft filter interaction?**
   - Search within drafts only? Or search all, then filter?
   - Probably: Apply search first, then draft filter

3. **Fuzzy matching library?**
   - `fuse.js` is popular but adds bundle size
   - Simple `includes()` might be sufficient for MVP
   - Could start simple and upgrade if needed

4. **Mobile/narrow sidebar behavior?**
   - How do controls adapt when sidebar is narrow?
   - Probably not a concern for desktop app, but worth considering

---

## Implementation Order

1. Sort controls (simpler, no text input state)
2. Search/filter (more complex, needs debouncing)

## Testing Plan

- [ ] Sort by date ascending/descending works correctly
- [ ] Sort by alphabetical ascending/descending works correctly
- [ ] Sort by modified date works (when available)
- [ ] Sort preference persists when switching between subdirectories
- [ ] Sort preference resets when switching collections (or persists - depending on decision)
- [ ] Search filters files by title
- [ ] Search filters files by filename
- [ ] Search shows "no results" when nothing matches
- [ ] Search clears with button and Escape key
- [ ] Search + draft filter work together correctly

---

## Dependencies

- Requires `task-1-collection-sorting-filtering-fixes.md` to be complete first
  - The alphabetical sort fallback provides foundation for sort modes
  - Clean separation of sorting logic enables extension

## Out of Scope

- Persisting preferences to project settings (could be added later)
- Advanced filtering by frontmatter fields
- Saved search queries
