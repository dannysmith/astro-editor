# Task: Subdirectories in collections

## Executive Summary

**Goal**: Enable hierarchical file organization within Astro content collections using subdirectories.

**Approach**: Add navigation state to projectStore, create new Rust command for recursive directory scanning, enhance LeftSidebar with breadcrumbs, and update file operations to work with nested paths.

**Scope**: 6 subtasks covering backend (Rust), state management (Zustand), data fetching (TanStack Query), UI (React), file operations, and edge cases.

**Navigation Flow**:
```
Collections List
  → Collection Root (articles/)
    → Subdirectory (2024/)
      → Sub-subdirectory (january/)
        → Files + Subdirectories
```

**Estimated Complexity**: Medium-High
- Backend changes: Straightforward (new Tauri command, fix file IDs)
- State management: Simple (add navigation state to projectStore)
- UI changes: Moderate (breadcrumbs, directory rendering, navigation logic)
- Integration: Complex (ensure all file operations work with nested paths)

## Problem Statement

Currently the application assumes that the content for markdown/mdx content collections will be in `src/content` (or whatever other path override is configured in the settings), with each having its own subdirectory (usually named after the collection). It assumes that the content will be a flat collection of md/mdx files in these directories.

```
src/content
|- notes
  |- file1.md
  |- file2.md
|- articles
  |- article1.mdx
  |-article2.mdx
```

Any Markdown or MDX files in subdirectories underneath these are ignored.

Many Astro sites organize the md/mdx files within a single content collection using subdirectories. In the example above, notes may be split up into different folders within `src/content/notes` to help with file management, despite them all being part of the same content collection with the same schema.

## Requirements

Astro Editor should support this in the left File browser sidebar. It should show any subdirectories at the top of the file browser and when drilling down into one should show the "breadcrumbs" at the top of the sidebar alongside the currently open collection. It should be easy to navigate back up. Basically, as you would expect a file browser sidebar to work. I don't think the UI should include expandable and collapsible file trees here. I think that will clutter the UI too much.

### Specific Requirements

- **Subdirectory Navigation**: Show subdirectories at the top of the file list, allow drilling down into them
- **Breadcrumbs**: Clear visual indication of current location within collection hierarchy
- **Back Navigation**: Easy navigation back up the hierarchy (subdirectory → parent → collection root → collections list)
- **File Creation**: When creating a new file, it should be created in whichever directory is currently open in the left sidebar. If we're in a subdirectory, the file should be created in that. And if we're not in any sort of subdirectory, it should just be created in the root directory for that content collection as it currently is.
- **No File Moving**: There is no need to add any features to allow us to move files between subdirectories for now. That's a job that should be done in an external text editor or in Finder.
- **Clear Context**: The UI should definitely make it clear what content collection we're in at all times. This is currently done in the header of the sidebar, but if we're in a subdirectory of a collection we should be clear what sub-dir we're in and what collection.
- **Collection-Level Feature**: Because the top level of the hierarchy in our left sidebar UI is always going to be content collections, i.e. when we're looking at a whole project we're going to see a list of all the content collections. This kind of new almost file browser-y type thing where we can drill down into sub-directories only needs to apply within those content collections.
- **Draft Filter**: The "Drafts Only" filter should apply to all files across all subdirectories within a collection
- **No Tree View**: NO expandable/collapsible file trees - keep the UI flat and focused

## Implementation Plan

### Subtask 1: Data Layer - Backend Directory Scanning

**Objective**: Create new Rust commands for directory navigation and fix FileEntry ID generation for nested paths.

**Key Changes**:

1. **New Command: `scan_directory`** - Scans ONE level (non-recursive):
   - Input: `directory_path: String, collection_name: String, collection_root: String`
   - Output: `DirectoryScanResult { subdirectories: Vec<DirectoryInfo>, files: Vec<FileEntry> }`
   - Filters: Hide files/dirs starting with `.` (hidden files - per user requirement)
   - Filters: Ignore symbolic links (per user requirement)
   - Includes: Empty subdirectories (user wants to show them for file creation)
   - Sorting: Handled in frontend, not backend

2. **New Command: `count_collection_files_recursive`** - For collection badges:
   - Input: `collection_path: String`
   - Output: `usize` (total count of .md/.mdx files recursively)
   - Needed for "7 items" badges in collections list view
   - More efficient than building FileEntry objects just to count

3. **Fix FileEntry::new() Signature** - BREAKING CHANGE:
   ```rust
   // OLD signature
   pub fn new(path: PathBuf, collection: String) -> Self

   // NEW signature
   pub fn new(path: PathBuf, collection: String, collection_root: PathBuf) -> Self
   ```

   Inside new():
   ```rust
   // Calculate relative path from collection root
   let relative_path = path
       .strip_prefix(&collection_root)
       .map_err(|_| "Path is not within collection root")
       .unwrap()
       .to_string_lossy()
       .to_string();

   // Remove extension from relative path for the ID
   let id_path = relative_path
       .strip_suffix(&format!(".{}", extension))
       .unwrap_or(&relative_path);

   let id = format!("{}/{}", collection, id_path);
   ```

   Example: File at `articles/2024/january/post.md`
   - id = "articles/2024/january/post"
   - name = "post"
   - path = PathBuf to full file path
   - extension = "md"

4. **New Type: `DirectoryInfo`**:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct DirectoryInfo {
       pub name: String,           // Just the directory name
       pub relative_path: String,  // Path from collection root
       pub full_path: PathBuf,     // Full filesystem path
   }
   ```

**Files to Modify**:
- `src-tauri/src/commands/project.rs` - add `scan_directory` and `count_collection_files_recursive`
- `src-tauri/src/models/file_entry.rs` - fix `FileEntry::new()` signature and ID generation
- `src-tauri/src/models/mod.rs` - add `DirectoryInfo` type (or create `directory_info.rs`)
- `src-tauri/src/lib.rs` - register new commands
- Update ALL call sites of `FileEntry::new()` to pass collection_root

**Gotchas**:
- **CRITICAL**: Changing FileEntry::new() is a breaking change - must update all call sites in Rust code
- Hidden file detection: Starts with `.` (covers .DS_Store, .git, etc.)
- Empty directories: MUST include them (user wants to create files in them)
- Symlinks: IGNORE them (user requirement)
- Path separator consistency: Use `/` in relative paths for cross-platform consistency
- Special characters in directory names (spaces, unicode, emojis)
- Very deep nesting (no artificial limit per user, but test 5+ levels)
- Performance with large directories (100+ files/subdirectories)
- Collection root calculation: Must be passed correctly from all call sites

**Testing Requirements**:
- Unit test FileEntry ID generation with nested paths
- Unit test hidden file filtering (.hidden, .DS_Store)
- Unit test symlink ignoring
- Unit test empty directory inclusion
- Unit test special characters in directory names
- Unit test recursive counting accuracy
- Test with 5+ levels of nesting

### Subtask 2: State Management - Navigation State

**Objective**: Add subdirectory navigation state to projectStore and create TypeScript types matching Rust backend.

**Key Changes**:

1. **Add to ProjectState interface**:
   ```typescript
   interface ProjectState {
     // ... existing fields
     currentSubdirectory: string | null  // Relative path from collection root, e.g., "2024/january"

     // ... existing actions
     setCurrentSubdirectory: (subdirectory: string | null) => void
     navigateUp: () => void        // Go up one level in directory hierarchy
     navigateToRoot: () => void    // Go to collection root (clear subdirectory)
   }
   ```

2. **Update `setSelectedCollection`** to reset subdirectory:
   ```typescript
   setSelectedCollection: (collection: string | null) => {
     set({
       selectedCollection: collection,
       currentSubdirectory: null  // Always reset when switching collections
     })
   }
   ```

3. **Implement `navigateUp`** - Smart navigation up one level:
   ```typescript
   navigateUp: () => {
     const { currentSubdirectory } = get()
     if (!currentSubdirectory) {
       // Already at collection root, go to collections list
       set({ selectedCollection: null })
     } else {
       // Go to parent directory
       const parts = currentSubdirectory.split('/')
       parts.pop()  // Remove last segment
       set({ currentSubdirectory: parts.length > 0 ? parts.join('/') : null })
     }
   }
   ```

4. **Create TypeScript types** matching Rust backend:
   ```typescript
   export interface DirectoryInfo {
     name: string           // Just the directory name
     relative_path: string  // Path from collection root
     full_path: string     // Full filesystem path
   }

   export interface DirectoryScanResult {
     subdirectories: DirectoryInfo[]
     files: FileEntry[]
   }
   ```

**Files to Modify**:
- `src/store/projectStore.ts` - add navigation state and actions
- `src/store/index.ts` - export new types (DirectoryInfo, DirectoryScanResult)

**State Behavior**:
- `currentSubdirectory` is relative path from collection root (e.g., `"2024/january"`)
- Reset to `null` when switching collections (don't persist subdirectory navigation)
- Reset to `null` when closing project
- Not persisted across app restarts (keep it simple)

**Architecture Validation**:
- ✅ Follows projectStore responsibility (project-level navigation state)
- ✅ Maintains separation from editorStore (file editing state)
- ✅ Uses getState() pattern for callbacks to avoid render cascades
- ✅ Simple state reset behavior (no complex persistence)

### Subtask 3: Query Layer - TanStack Query Integration

**Objective**: Create new query hooks for directory scanning and update query invalidation patterns.

**Key Changes**:

1. **Create `useDirectoryScanQuery`** - Replaces `useCollectionFilesQuery`:
   ```typescript
   // src/hooks/queries/useDirectoryScanQuery.ts
   export const useDirectoryScanQuery = (
     projectPath: string | null,
     collectionName: string | null,
     collectionPath: string | null,
     subdirectory: string | null  // Relative path from collection root
   ) => {
     return useQuery({
       queryKey: queryKeys.directoryContents(
         projectPath || '',
         collectionName || '',
         subdirectory || 'root'
       ),
       queryFn: async () => {
         const fullPath = subdirectory
           ? `${collectionPath}/${subdirectory}`
           : collectionPath

         return invoke<DirectoryScanResult>('scan_directory', {
           directoryPath: fullPath,
           collectionName,
           collectionRoot: collectionPath,
         })
       },
       enabled: !!projectPath && !!collectionName && !!collectionPath,
     })
   }
   ```

2. **Update `queryKeys` factory**:
   ```typescript
   // src/lib/query-keys.ts
   export const queryKeys = {
     all: ['project'] as const,
     collections: (projectPath: string) =>
       [...queryKeys.all, projectPath, 'collections'] as const,

     // NEW: For directory contents (replaces collectionFiles)
     directoryContents: (
       projectPath: string,
       collectionName: string,
       subdirectory: string  // 'root' or relative path
     ) => [...queryKeys.all, projectPath, collectionName, 'directory', subdirectory] as const,

     // Keep for file content queries
     fileContent: (projectPath: string, fileId: string) =>
       [...queryKeys.all, projectPath, 'files', fileId] as const,
   }
   ```

3. **Update Query Invalidation** in mutations:
   ```typescript
   // After file create/delete/rename in a subdirectory:
   queryClient.invalidateQueries({
     queryKey: queryKeys.directoryContents(
       projectPath,
       collectionName,
       currentSubdirectory || 'root'
     )
   })

   // Also invalidate parent directories if needed for file counts:
   queryClient.invalidateQueries({
     queryKey: queryKeys.collections(projectPath)  // Refresh collection counts
   })
   ```

4. **Replace `useCollectionFilesQuery`** usage in components:
   ```typescript
   // OLD (LeftSidebar.tsx)
   const { data: files = [] } = useCollectionFilesQuery(...)

   // NEW
   const { data: dirContents } = useDirectoryScanQuery(
     projectPath,
     selectedCollection,
     currentCollection?.path,
     currentSubdirectory
   )
   const files = dirContents?.files || []
   const subdirectories = dirContents?.subdirectories || []
   ```

**Files to Create/Modify**:
- `src/hooks/queries/useDirectoryScanQuery.ts` - **NEW** hook
- `src/lib/query-keys.ts` - update key structure
- `src/hooks/queries/useCollectionFilesQuery.ts` - **DELETE** (replaced by useDirectoryScanQuery)
- All mutation hooks - update invalidation to use new query keys
- `src/components/layout/LeftSidebar.tsx` - replace useCollectionFilesQuery

**Query Invalidation Patterns**:
- File created/deleted/renamed: Invalidate current directory + collections (for counts)
- Settings path changed: Invalidate all directory queries
- External file change detected: Invalidate affected directory

**Edge Cases**:
- Handle query cancellation when navigating between directories quickly
- Loading states during directory navigation
- Error states (directory deleted, permissions issues)

### Subtask 4: UI Components - Breadcrumbs and Navigation

**Objective**: Implement breadcrumb navigation and subdirectory display in LeftSidebar. **CRITICAL**: Nothing about file items should change except the header.

**Key Changes**:

1. **Header with Breadcrumbs** - Replaces simple title:
   ```typescript
   // Current: <span>{headerTitle}</span>
   // New: Breadcrumb component

   // At collection root:
   <span>Articles</span>

   // In subdirectory:
   <Breadcrumbs>
     <BreadcrumbSegment onClick={() => navigateToRoot()}>
       Articles
     </BreadcrumbSegment>
     <BreadcrumbSeparator>/</BreadcrumbSeparator>
     <BreadcrumbSegment onClick={() => navigateToDirectory('2024')}>
       2024
     </BreadcrumbSegment>
     <BreadcrumbSeparator>/</BreadcrumbSeparator>
     <BreadcrumbSegment current>
       January
     </BreadcrumbSegment>
   </Breadcrumbs>
   ```

   - Each segment (except current/last) is clickable
   - Current segment styled differently (not clickable, or just different color)
   - Separator is visual only (chevron or `/`)

2. **Smart Back Button** - Context-aware navigation:
   ```typescript
   const handleBackClick = useCallback(() => {
     const { currentSubdirectory, selectedCollection, navigateUp } =
       useProjectStore.getState()

     if (currentSubdirectory) {
       // In subdirectory: go up one level
       navigateUp()
     } else if (selectedCollection) {
       // At collection root: go to collections list
       setSelectedCollection(null)
     }
     // If no collection selected, back button doesn't show
   }, [])
   ```

3. **Render Subdirectories** - At top of file list, above files:
   ```typescript
   <div className="p-2">
     {/* Subdirectories first (alphabetically sorted) */}
     {subdirectories.sort((a, b) => a.name.localeCompare(b.name)).map(dir => (
       <button
         key={dir.relative_path}
         onClick={() => setCurrentSubdirectory(dir.relative_path)}
         className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors flex items-center gap-2"
       >
         <Folder className="size-4 text-muted-foreground" />
         <span className="font-medium text-foreground">{dir.name}</span>
       </button>
     ))}

     {/* Then files (EXACT same rendering as before) */}
     {filteredAndSortedFiles.map(file => (
       // EXACT SAME CODE as before - no changes to file rendering!
     ))}
   </div>
   ```

4. **Visual Differentiation**:
   - Subdirectories: Folder icon (lucide-react `Folder`), simpler styling than files
   - Files: Keep exact same styling (draft badges, MDX badges, dates, etc.)
   - Subdirectories sorted alphabetically
   - Files sorted by date (EXACT same as current - per user requirement)

**Files to Modify**:
- `src/components/layout/LeftSidebar.tsx` - main implementation
- Consider extracting `<Breadcrumbs>` if over ~30 lines, but keep inline initially

**UI Requirements** (Per User):
- **NOTHING changes about file items** (same sorting, same display, same badges, same colors)
- **ONLY header changes** (breadcrumbs replace simple title)
- Subdirectories shown at top (alphabetically)
- Back button is smart (goes up one level)
- Collection name always visible in breadcrumbs

**Implementation Notes**:
- Use existing `cn()` utility for classNames
- Use lucide-react `Folder` icon for subdirectories
- Maintain exact same hover/active states for files
- Keep exact same draft filter behavior (works across all subdirectories)
- Keep exact same context menu for files
- Keep exact same rename functionality for files
- Loading state: Show skeleton or existing file list while navigating

**Breadcrumb Styling Guidance**:
- Clickable segments: `text-foreground hover:underline cursor-pointer`
- Current segment: `text-muted-foreground` (no hover, no cursor)
- Separator: `text-muted-foreground mx-1` (could be `/` or `<ChevronRight className="size-3" />`)
- Truncate long directory names if needed: `truncate max-w-[120px]`

**Performance**:
- Use `useCallback` for click handlers (getState() pattern)
- Memoize sorted subdirectories/files if needed
- No performance changes expected (subdirectories add minimal overhead)

### Subtask 5: File Operations - Create/Save in Subdirectories

**Objective**: Update file creation to use current subdirectory context. Save/rename/delete already work via full paths.

**Key Changes**:

1. **File Creation** - Bridge pattern to pass subdirectory context:
   ```typescript
   // In Layout.tsx (has hook access)
   const handleCreateNewFile = useCallback(() => {
     const { projectPath, selectedCollection, currentSubdirectory } =
       useProjectStore.getState()
     const collections = queryClient.getQueryData(queryKeys.collections(projectPath))

     const targetCollection = collections.find(c => c.name === selectedCollection)
     if (!targetCollection) return

     // Calculate target directory for new file
     const targetPath = currentSubdirectory
       ? `${targetCollection.path}/${currentSubdirectory}`
       : targetCollection.path

     // Call create mutation with target directory
     createFileMutation.mutate({
       projectPath,
       collectionName: selectedCollection,
       targetDirectory: targetPath,  // NEW: Full path to target directory
       // ... other params
     })
   }, [])
   ```

2. **Update Create Mutation** - Pass target directory:
   ```typescript
   // useCreateFileMutation.ts
   export const useCreateFileMutation = () => {
     return useMutation({
       mutationFn: ({ targetDirectory, ...params }) => {
         return invoke('create_file', {
           directory: targetDirectory,  // Use full target path
           ...params
         })
       },
       onSuccess: (_, variables) => {
         const { currentSubdirectory } = useProjectStore.getState()

         // Invalidate current directory view
         queryClient.invalidateQueries({
           queryKey: queryKeys.directoryContents(
             variables.projectPath,
             variables.collectionName,
             currentSubdirectory || 'root'
           )
         })

         // Also invalidate collection counts
         queryClient.invalidateQueries({
           queryKey: queryKeys.collections(variables.projectPath)
         })
       }
     })
   }
   ```

3. **File Watcher** - Already watches collection root recursively:
   - Current: `start_watching_project` watches project root
   - Verify: File changes in subdirectories trigger events correctly
   - No changes needed if watcher is already recursive
   - If not recursive, update Rust watcher implementation

4. **Save/Rename/Delete Operations**:
   - **Already work correctly!** They use full file paths from FileEntry
   - FileEntry.path contains full filesystem path
   - No changes needed to save/rename/delete logic
   - ONLY update query invalidation to use currentSubdirectory

**Files to Modify**:
- `src/components/layout/Layout.tsx` - update handleCreateNewFile to pass subdirectory
- `src/hooks/mutations/useCreateFileMutation.ts` - accept targetDirectory parameter
- `src/hooks/mutations/useDeleteFileMutation.ts` - update query invalidation
- `src/hooks/mutations/useRenameFileMutation.ts` - update query invalidation
- `src-tauri/src/commands/files.rs` - verify create command accepts directory parameter
- `src-tauri/src/watcher.rs` (or wherever file watcher is) - verify recursive watching

**Query Invalidation Updates**:
All mutation onSuccess callbacks need to invalidate the correct directory:
```typescript
onSuccess: (_, variables) => {
  const { currentSubdirectory } = useProjectStore.getState()

  queryClient.invalidateQueries({
    queryKey: queryKeys.directoryContents(
      variables.projectPath,
      variables.collectionName,
      currentSubdirectory || 'root'
    )
  })
}
```

**Testing Requirements**:
- Create file in collection root → appears in root directory view
- Create file in subdirectory `2024/` → appears in `2024/` directory view
- Create file in nested subdirectory `2024/january/` → appears in correct location
- Save file in subdirectory → no issues, uses full path
- Rename file in subdirectory → updates correctly, query invalidates
- Delete file from subdirectory → removes from view, query invalidates
- File watcher detects changes in subdirectories → refreshes view automatically

**Edge Cases**:
- User creates file in subdirectory, then navigates away before file appears
- User is in subdirectory, file gets deleted externally → handle gracefully
- User creates file with name that already exists in subdirectory → Rust command should error

### Subtask 6: Polish and Edge Cases

**Objective**: Handle edge cases, optimize performance, ensure robust behavior, and add final touches.

**Key Changes**:

1. **Error Handling**:
   ```typescript
   // Handle directory deleted while user is in it
   const { data, error } = useDirectoryScanQuery(...)

   if (error) {
     // Directory no longer exists - navigate back to collection root
     toast.error('Directory no longer exists', {
       description: 'Returning to collection root'
     })
     setCurrentSubdirectory(null)
   }
   ```

2. **File Count Badges** - Use recursive count:
   ```typescript
   // LeftSidebar.tsx - collections list view
   useEffect(() => {
     const loadFileCounts = async () => {
       const counts: Record<string, number> = {}
       for (const collection of collections) {
         const count = await invoke<number>('count_collection_files_recursive', {
           collectionPath: collection.path,
         })
         counts[collection.name] = count
       }
       setFileCounts(counts)
     }
     if (collections.length > 0) {
       void loadFileCounts()
     }
   }, [collections])
   ```

3. **Loading States**:
   ```typescript
   const { data, isLoading } = useDirectoryScanQuery(...)

   if (isLoading) {
     return <div className="p-4 text-center text-muted-foreground">Loading...</div>
   }
   ```

4. **Draft Filter Across Subdirectories**:
   - Current filter already works! It filters `files` array from query
   - Query only returns files in current directory
   - No changes needed - works automatically

5. **External File Changes**:
   - File watcher should detect changes in subdirectories
   - On 'file-changed' event, invalidate current directory query
   - Test: Create/delete file in subdirectory via Finder while app is open

6. **State Reset on Project Switch**:
   ```typescript
   // In projectStore.setProject
   setProject: (path: string) => {
     // ... existing code
     set({
       projectPath: path,
       selectedCollection: null,      // Reset collection
       currentSubdirectory: null,     // Reset subdirectory
       // ... other fields
     })
   }
   ```

7. **Accessibility**:
   - Ensure breadcrumb segments have proper aria-labels
   - Subdirectory buttons have semantic HTML (already using `<button>`)
   - Keyboard navigation works (Tab through subdirectories, Enter to open)
   - Screen reader announces current location

8. **Performance Optimizations**:
   - Memoize sorted subdirectories:
     ```typescript
     const sortedSubdirectories = useMemo(() =>
       [...subdirectories].sort((a, b) => a.name.localeCompare(b.name)),
       [subdirectories]
     )
     ```
   - Use getState() pattern for all callbacks to avoid render cascades
   - Consider React.memo for subdirectory items if performance issues arise

**Files to Review**:
- All files from previous subtasks
- `src/components/layout/LeftSidebar.tsx` - comprehensive review
- Query invalidation in all mutations
- File watcher implementation in Rust

**Testing Scenarios**:

**Basic Functionality**:
- ✅ Navigate into subdirectory, see only files in that directory
- ✅ Navigate into nested subdirectory (2-3 levels deep)
- ✅ Back button goes up one level
- ✅ Click breadcrumb segment to jump to that level
- ✅ Create file in subdirectory, appears in correct location
- ✅ Open file from subdirectory, edit, save → works correctly
- ✅ Rename file in subdirectory → updates in view
- ✅ Delete file from subdirectory → removes from view

**Edge Cases**:
- ✅ Empty subdirectory → shows in list, can navigate into it, shows "No files"
- ✅ Very deep nesting (5-7 levels) → all operations work
- ✅ Special characters in dir names (spaces, unicode, emojis) → handles correctly
- ✅ Large directory (100+ files/subdirs) → performance acceptable
- ✅ Navigate into subdirectory, then switch collections → resets to new collection root
- ✅ Navigate into subdirectory, then switch projects → resets completely
- ✅ Directory deleted externally while user is in it → error handling, navigate to root
- ✅ File created externally in subdirectory → file watcher updates view
- ✅ Draft filter enabled in subdirectory → filters correctly
- ✅ Draft filter enabled, navigate between subdirectories → filter persists

**Stress Testing**:
- ✅ 100+ files in a single directory → loads and renders quickly
- ✅ 50+ subdirectories in collection root → renders smoothly
- ✅ Rapid navigation between subdirectories → no UI jank, queries cancel properly
- ✅ Open file in deep subdirectory, auto-save every 2s → no issues

**Cross-Platform**:
- ✅ Path separators consistent on Windows/macOS/Linux
- ✅ Hidden file filtering works on all platforms
- ✅ Special characters handled on all platforms

**Regression Testing**:
- ✅ Flat collections (no subdirectories) still work exactly as before
- ✅ All existing keyboard shortcuts still work
- ✅ Command palette still works
- ✅ Context menus still work
- ✅ File operations still work
- ✅ Draft detection still works
- ✅ MDX badge still shows
- ✅ Date sorting still works

**Final Checklist**:
- [ ] All Rust tests pass
- [ ] All TypeScript tests pass
- [ ] No TypeScript errors (`pnpm run check:ts`)
- [ ] No Rust errors (`cargo check`)
- [ ] No linter errors (`pnpm run fix:all`)
- [ ] Manual testing completed for all scenarios above
- [ ] Performance is acceptable (no noticeable slowdown)
- [ ] Architecture patterns followed (TanStack Query, Zustand, Direct Store Pattern)
- [ ] Documentation updated if needed

## Technical Considerations

### Architecture Alignment
- ✅ Uses TanStack Query for server state (directory contents)
- ✅ Uses Zustand projectStore for navigation state
- ✅ Follows Direct Store Pattern in UI components
- ✅ Maintains separation of concerns
- ✅ Uses query invalidation for cache management

### Performance Patterns
- Use `getState()` pattern to avoid render cascades when accessing navigation state
- Memoize sorted/filtered file lists
- Consider virtualization if subdirectories can have 100+ files
- Optimize Rust directory scanning with iterators

### Breaking Changes
- None expected - this is purely additive functionality
- Existing flat collections will work as before (just show no subdirectories)

## Implementation Order and Dependencies

**Recommended Order**:
1. **Subtask 1** (Backend) → Independent, foundational
2. **Subtask 2** (State) → Depends on Subtask 1 types
3. **Subtask 3** (Queries) → Depends on Subtasks 1 & 2
4. **Subtask 4** (UI) → Depends on Subtasks 1, 2 & 3
5. **Subtask 5** (File Ops) → Depends on Subtasks 1-4
6. **Subtask 6** (Polish) → Depends on all previous

**Can Work in Parallel**:
- Subtasks 1 & 2 (Backend and State are independent)
- Once Subtask 3 is done, Subtasks 4 & 5 can be worked in parallel

**Testing After Each Subtask**:
1. After Subtask 1: Unit test Rust directory scanning
2. After Subtask 2: Test state updates in isolation
3. After Subtask 3: Test query hooks with mock data
4. After Subtask 4: Test UI navigation (may not save files yet)
5. After Subtask 5: Integration test - full workflow
6. After Subtask 6: Comprehensive edge case testing

## Success Criteria

- ✅ User can navigate into subdirectories within collections
- ✅ Breadcrumbs clearly show current location
- ✅ Back button navigates up hierarchy intuitively
- ✅ Files created in correct subdirectory based on current location
- ✅ Draft filter works across all subdirectories
- ✅ File IDs are unique across entire collection (including subdirs)
- ✅ Performance is acceptable with large directory structures
- ✅ External file operations are handled gracefully
- ✅ All existing functionality continues to work for flat collections

## Design Decisions (User-Confirmed)

1. **Empty Directories**: ✅ SHOW them - users need to drill in to create files
2. **Symbolic Links**: ✅ IGNORE them completely
3. **Hidden Files**: ✅ DO NOT show files/dirs starting with `.` on any platform
4. **Depth Limit**: ✅ NO artificial limit (realistic depth is ~5 levels)
5. **Sorting**: ✅ Subdirectories alphabetically at top, files by date (exact same as current)
6. **File Item Display**: ✅ NOTHING changes about file items except the header (breadcrumbs)

---

## Summary

This plan enables hierarchical file organization within Astro content collections through a clean, focused implementation that:

**Preserves Existing UX**: Nothing changes about file display, sorting, or interactions - only the header gets breadcrumbs and the back button becomes smarter.

**Follows Architecture**: Uses TanStack Query for server state, Zustand for navigation state, Direct Store Pattern in components, and proper query invalidation.

**Handles Edge Cases**: Empty directories, deep nesting, external file changes, special characters, and error states are all addressed.

**Maintains Performance**: Uses getState() pattern, memoization, and efficient Rust commands to avoid render cascades and slowdowns.

**Enables Growth**: No artificial limits, works with any directory structure, scales to hundreds of files/subdirectories.

**Key Implementation Insight**: The critical breakthrough is fixing FileEntry ID generation to use relative paths instead of just filenames. This single change (Subtask 1) enables everything else to work cleanly. The rest is straightforward state management, query hooks, and UI rendering.

**Ready to implement!** 🚀
