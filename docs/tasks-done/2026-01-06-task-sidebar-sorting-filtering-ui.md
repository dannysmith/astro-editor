# Sidebar Sorting and Filtering UI

## Overview

Add user-facing controls in the sidebar for sorting and filtering content files within a collection. Replace the current draft toggle button with a collapsible filter bar containing sort options, search, and the drafts filter.

## Problems to Solve

### 1. No Way to Change Sort Order

Currently files are sorted by published date (newest first), with undated files at top. Users cannot:
- Sort alphabetically instead of by date
- Reverse the sort direction
- Sort by other frontmatter fields
- Sort by last modified date

For reference/encyclopedic content, alphabetical sorting is often more useful than chronological.

### 2. No Search/Filter for Large Collections

For collections with many files, there's no way to quickly find a specific file without scrolling. Users need text search on title/filename.

### 3. Command Palette Search is Broken

**Note**: The existing command palette file search is broken - it uses `queryKeys.collectionFiles()` which is a legacy key that nothing populates. Data is now stored under `queryKeys.directoryContents()`. This should be fixed as part of this task or as a prerequisite.

---

## UI Design

### Collapsible Filter Bar

**Header (collapsed state):**
```
[Back] Collection Name [Filter Toggle ▼]
```

**Header (expanded state):**
```
[Back] Collection Name [Filter Toggle ▲]
┌─────────────────────────────────────────┐
│ [🔍 Search files...                ][×] │
│ Sort: [Default ▼] [↓↑]    ☐ Drafts only │
└─────────────────────────────────────────┘
```

**Key behaviors:**
- Filter bar collapsed by default
- Toggle button replaces current drafts-only button
- Visual indicator on toggle when filters are active (search has text, non-default sort, or drafts enabled)

---

## Requirements

### Sort Options (Dynamic)

The sort dropdown should offer **schema-aware options**:

| Option | Source | Sort Type | Notes |
|--------|--------|-----------|-------|
| Default | - | Date with undated at top | Current behavior (task 1) |
| Title | `title` field | Alphabetical | From frontmatter |
| Filename | `file.name` | Alphabetical | Always available |
| *[Date fields]* | Schema | Chronological | All fields of type `date` from schema |
| Order | `order` field | Numeric | Only if field exists and is integer type |
| Last Modified | `file.last_modified` | Chronological | From filesystem |

**Direction toggle**: Ascending / Descending (applies to all except Default)

**Missing field behavior**: Files without the sort field go to **BOTTOM** (not top). This is the opposite of "Default" mode where undated files go to top.

### Search/Filter

**Must Have:**
- Text input for filtering files
- Match against title AND filename (substring matching like command palette)
- Clear button (×) and Escape key to clear
- Show "no results" state
- Debounced input (~150ms)

**Interaction with drafts filter:**
- Search + Drafts = Search within drafts only (AND logic)

**No fuzzy matching for MVP** - simple `includes()` matching is sufficient. Can upgrade later if needed.

### State Management

**Ephemeral state** - resets on app restart:
- Sort mode
- Sort direction
- Search query
- Filter bar expanded/collapsed
- Drafts filter (already ephemeral)

State is per-collection (switching collections can reset or preserve - TBD during implementation).

---

## Technical Approach

### Dynamic Sort Options from Schema

The sort dropdown needs to be built from the collection's schema:

```typescript
function getSortOptionsForCollection(schema: CompleteSchema | null): SortOption[] {
  const options: SortOption[] = [
    { id: 'default', label: 'Default', type: 'default' },
    { id: 'title', label: 'Title', type: 'alpha', field: 'title' },
    { id: 'filename', label: 'Filename', type: 'alpha', field: null },
  ]

  if (schema) {
    // Add date fields from schema
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.type === 'date') {
        options.push({
          id: `date-${fieldName}`,
          label: fieldName, // or capitalize
          type: 'date',
          field: fieldName
        })
      }
    }

    // Add order field if present and integer
    if (schema.fields.order?.type === 'number') {
      options.push({ id: 'order', label: 'Order', type: 'numeric', field: 'order' })
    }
  }

  // Always add last modified
  options.push({ id: 'modified', label: 'Last Modified', type: 'date', field: null })

  return options
}
```

### State Management

Add to `uiStore.ts`:

```typescript
interface CollectionViewState {
  sortMode: string  // 'default' | 'title' | 'filename' | 'date-{field}' | 'order' | 'modified'
  sortDirection: 'asc' | 'desc'
  searchQuery: string
  filterBarExpanded: boolean
}

// Keyed by collection name
collectionViewState: Record<string, CollectionViewState>
```

### Sorting Logic

Extend `src/lib/files/sorting.ts`:

```typescript
interface SortConfig {
  mode: string
  direction: 'asc' | 'desc'
  field?: string  // frontmatter field name, if applicable
}

export function sortFiles(
  files: FileEntry[],
  config: SortConfig,
  mappings: FieldMappings | null
): FileEntry[] {
  if (config.mode === 'default') {
    // Use existing sortFilesByPublishedDate (from task 1)
    return sortFilesByPublishedDate(files, mappings)
  }

  return [...files].sort((a, b) => {
    let valueA, valueB

    // Extract values based on mode
    switch (config.mode) {
      case 'filename':
        valueA = a.name
        valueB = b.name
        break
      case 'title':
        valueA = a.frontmatter?.[mappings?.title || 'title'] as string
        valueB = b.frontmatter?.[mappings?.title || 'title'] as string
        break
      case 'modified':
        valueA = a.last_modified
        valueB = b.last_modified
        break
      case 'order':
        valueA = a.frontmatter?.order as number
        valueB = b.frontmatter?.order as number
        break
      default:
        // Date field from frontmatter
        if (config.mode.startsWith('date-')) {
          const field = config.mode.replace('date-', '')
          valueA = a.frontmatter?.[field]
          valueB = b.frontmatter?.[field]
        }
    }

    // Handle missing values - go to BOTTOM
    if (valueA == null && valueB == null) return 0
    if (valueA == null) return 1  // a goes to bottom
    if (valueB == null) return -1 // b goes to bottom

    // Compare based on type
    let comparison: number
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      comparison = valueA - valueB
    } else if (valueA instanceof Date || config.mode.startsWith('date-') || config.mode === 'modified') {
      comparison = new Date(valueA).getTime() - new Date(valueB).getTime()
    } else {
      comparison = String(valueA).localeCompare(String(valueB))
    }

    return config.direction === 'desc' ? -comparison : comparison
  })
}
```

### Search/Filter

Add `src/lib/files/search.ts`:

```typescript
export function filterFilesBySearch(
  files: FileEntry[],
  query: string,
  mappings: FieldMappings | null
): FileEntry[] {
  if (!query.trim()) return files

  const lowerQuery = query.toLowerCase()

  return files.filter(file => {
    const title = file.frontmatter?.[mappings?.title || 'title'] as string | undefined
    const searchableText = title ? `${file.name} ${title}` : file.name
    return searchableText.toLowerCase().includes(lowerQuery)
  })
}
```

### LeftSidebar Integration

```typescript
const filteredAndSortedFiles = React.useMemo(() => {
  let result = files

  // 1. Apply search filter
  if (searchQuery) {
    result = filterFilesBySearch(result, searchQuery, frontmatterMappings)
  }

  // 2. Apply draft filter (search within drafts)
  result = filterFilesByDraft(result, showDraftsOnly, frontmatterMappings)

  // 3. Apply sort
  result = sortFiles(result, { mode: sortMode, direction: sortDirection }, frontmatterMappings)

  return result
}, [files, searchQuery, showDraftsOnly, sortMode, sortDirection, frontmatterMappings])
```

---

## Fix: Command Palette Search

The command palette search (`generateSearchCommands` in `app-commands.ts`) uses the legacy `queryKeys.collectionFiles()` which nothing populates. It needs to be updated to iterate over `queryKeys.directoryContents()` cache entries.

**Options:**
1. Aggregate all `directoryContents` cache entries per collection
2. Create a separate "all files" cache that gets populated as directories are visited
3. Accept that search only works for visited directories

Recommend option 1 for correctness, with option 3 as documented limitation.

---

## Implementation Order

1. Fix command palette search (prerequisite or parallel)
2. Add filter bar UI (collapsed/expanded toggle)
3. Implement search input with debouncing
4. Implement dynamic sort dropdown
5. Wire up state management and filtering logic

## Testing Plan

- [ ] Filter bar expands/collapses correctly
- [ ] Visual indicator shows when filters are active
- [ ] Search filters files by title
- [ ] Search filters files by filename
- [ ] Search + drafts filter works together (AND logic)
- [ ] Search clears with button and Escape key
- [ ] "No results" state displays correctly
- [ ] Sort by Default works (current behavior)
- [ ] Sort by Title works (alphabetical)
- [ ] Sort by Filename works (alphabetical)
- [ ] Sort by date fields from schema works
- [ ] Sort by Order works (when field exists)
- [ ] Sort by Last Modified works
- [ ] Sort direction toggle works for all modes
- [ ] Files missing sort field appear at bottom
- [ ] State resets on app restart
- [ ] Command palette search works again

---

## Dependencies

- Requires `task-1-collection-sorting-filtering-fixes.md` to be complete first
  - The "Default" sort mode uses the improved sorting from task 1
  - Clean separation of sorting logic enables extension

## Out of Scope

- Persisting sort/filter preferences to settings
- Fuzzy matching (simple includes() is sufficient for MVP)
- Advanced filtering by frontmatter field values
- Saved search queries
- Keyboard shortcut to focus search (could add later)
