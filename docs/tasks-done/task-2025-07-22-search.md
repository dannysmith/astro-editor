# Task: Search

- Fuzzy search functionality (by filename and title [if present] only).
- Probably best to have this via the command palette somehow.
- Main goal is to make it quicker to find and edit documents in the current projects.
- Unlikeley to be used heavily by users, since most editing will be on recent articles.
- The UI needs to be fast and snappy, and intuative.

## Implementation Plan

### Overview
Implement a simple, performant search feature integrated into the existing command palette infrastructure. The search will fuzzy-match against filenames and frontmatter titles across all collections in the current project.

### Technical Approach

1. **Create a new command group "search"** in the command palette
   - Add to the command types in `src/lib/commands/types.ts`
   - Update group order in `src/hooks/useCommandPalette.ts`

2. **Implement search data aggregation**
   - Create a new hook `useSearchableFiles` that:
     - Uses existing TanStack Query data from all collections
     - Combines all files into a single searchable array
     - Extracts title from frontmatter (if present) for each file
     - Returns format: `{ file: FileEntry, searchableText: string }`

3. **Add search commands dynamically**
   - In `app-commands.ts`, create a dynamic command generator that:
     - Only shows when user has typed 2+ characters
     - Creates a command for each matching file
     - Uses the existing cmdk fuzzy search (already built-in)
     - Limits results to top 10 matches for performance

4. **Integrate with existing command execution**
   - Reuse the existing file opening logic from the editor store
   - Each search result command will simply open the selected file

### Implementation Details

1. **Search Command Structure**:
   ```typescript
   {
     id: `search-file-${file.id}`,
     label: file.frontmatter?.title || file.name,
     description: `${file.collection}/${file.name}`,
     group: 'search',
     icon: FileTextIcon,
     execute: () => openFile(file),
     isAvailable: () => true
   }
   ```

2. **Performance Optimizations**:
   - Leverage existing cached query data (no new API calls)
   - Use cmdk's built-in fuzzy search algorithm
   - Limit search results to 10 items
   - Only show search results when 2+ chars typed
   - Memoize searchable data transformation

3. **UI Flow**:
   - User opens command palette (Cmd+P)
   - Types filename or title fragment
   - Search results appear in new "Search Results" group
   - Selecting a result opens the file immediately
   - Command palette closes automatically

### Benefits of This Approach
- **Minimal code**: Reuses existing command palette and query infrastructure
- **Fast**: No new API calls, uses cached data
- **Intuitive**: Integrated into familiar command palette
- **Performant**: Built-in fuzzy search, limited results
- **Simple**: No new UI components needed
