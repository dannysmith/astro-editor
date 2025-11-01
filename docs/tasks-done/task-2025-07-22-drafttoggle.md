# Task: File List Drafts Toggle

- Add a simple toggle switch which only shows drafts in the file list sidebar.
- Whether this is toggled on or off should be remembered in the project settings and should be specific to each collection. I.e., this state should persist on disc in the usual way (see `/docs/developer/preferences-system.md`) And use TanStack Query.
- We need to decide on the best and least obtrusive UI. I feel like the toggle should be in the top right Of the sidebar header. And I'm not sure it should be a toggle switch in the usual way. I feel like maybe we should do it the same way we do in the Unified title bar for toggling on and off focus mode. But we do need to make it very clear - perhaps to the use of colour when that is only showing drafts. Users will get confused when this is toggled on and they're not seeing posts which aren't drafts.
- This feature should affect nothing outside of the sidebar. It's just a simple filter.

## Implementation Plan

### 1. Extend Project Settings Type Structure

**File**: `src/lib/project-registry/types.ts`

Add a new field to `ProjectSettings` interface:

```typescript
export interface ProjectSettings {
  // ... existing fields
  collectionViewSettings?: {
    [collectionName: string]: {
      showDraftsOnly?: boolean
    }
  }
}
```

This allows per-collection draft toggle state that persists to disk via the existing project registry system.

### 2. Use Existing Project Store Pattern

**Architecture Compliance**: The project store already has `updateProjectSettings()` action for this exact use case. No new mutation hook needed.

The collection view settings will be accessed directly from project store:

```typescript
// In Sidebar component
const { currentProjectSettings } = useProjectStore()
const collectionViewSettings = currentProjectSettings?.collectionViewSettings?.[selectedCollection || '']
const showDraftsOnly = collectionViewSettings?.showDraftsOnly || false
```

### 3. Add Toggle UI to Sidebar Header

**File**: `src/components/sidebar/Sidebar.tsx`

**Location**: In the header div (around line 294-322), add the toggle to the right side of the header title.

**Design Pattern**: Follow the focus mode toggle pattern from `UnifiedTitleBar.tsx`:
- Use `Button` with `variant="ghost"` and `size="sm"` 
- Use `FileText` and `Filter` icons (or `Eye`/`EyeOff` pattern)
- Add conditional styling when drafts-only mode is active

**Visual Indicators**:
- When drafts-only mode is active:
  - Button should have accent color (primary or orange/yellow theme)
  - Header background could have subtle color tint
  - Show "(Drafts Only)" text or indicator

### 4. Implement Filtering Logic

**File**: `src/components/sidebar/Sidebar.tsx`

**Location**: Modify the `sortedFiles` useMemo (around line 266-285)

Add filtering step before sorting:

```typescript
const filteredAndSortedFiles = React.useMemo((): FileEntry[] => {
  // Get current collection's view settings
  const collectionViewSettings = currentProjectSettings?.collectionViewSettings?.[selectedCollection || '']
  const showDraftsOnly = collectionViewSettings?.showDraftsOnly || false
  
  // Filter files if drafts-only mode is enabled
  let filesToSort = files
  if (showDraftsOnly) {
    filesToSort = files.filter(file => {
      return file.is_draft || file.frontmatter?.[frontmatterMappings.draft] === true
    })
  }
  
  // Apply existing sorting logic
  return [...filesToSort].sort((a, b) => {
    // ... existing sorting logic
  })
}, [files, frontmatterMappings.publishedDate, frontmatterMappings.draft, currentProjectSettings, selectedCollection])
```

### 5. Add Toggle Button Component

**Location**: In sidebar header, positioned to the right of the title

```typescript
{selectedCollection && (
  <Button
    onClick={handleToggleDraftsOnly}
    variant="ghost"
    size="sm"
    className={cn(
      "size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100",
      showDraftsOnly && "text-orange-600 bg-orange-50 hover:bg-orange-100"
    )}
    title={showDraftsOnly ? 'Show All Files' : 'Show Drafts Only'}
  >
    {showDraftsOnly ? <Filter className="size-4" /> : <FileText className="size-4" />}
  </Button>
)}
```

### 6. Handle Toggle State

Add state and handlers in the Sidebar component using the `getState()` pattern for performance:

```typescript
// Subscribe only to what needs re-renders
const { currentProjectSettings } = useProjectStore()
const collectionViewSettings = currentProjectSettings?.collectionViewSettings?.[selectedCollection || '']
const showDraftsOnly = collectionViewSettings?.showDraftsOnly || false

// Use getState() pattern for callbacks to avoid render cascades
const handleToggleDraftsOnly = useCallback(() => {
  if (selectedCollection) {
    const { updateProjectSettings } = useProjectStore.getState()
    const currentSettings = useProjectStore.getState().currentProjectSettings
    
    const newSettings = {
      ...currentSettings,
      collectionViewSettings: {
        ...currentSettings?.collectionViewSettings,
        [selectedCollection]: { showDraftsOnly: !showDraftsOnly }
      }
    }
    
    void updateProjectSettings(newSettings)
  }
}, [selectedCollection, showDraftsOnly]) // Stable dependencies
```

### 7. Visual Clarity Enhancements

**When drafts-only mode is active**:
- Add subtle orange/yellow tint to header background
- Show visual indicator: "(Drafts Only)" text or badge
- Toggle button should be visually distinct (colored)
- Consider adding count indicator: "3 drafts" instead of "3 items"

### 8. Empty State Handling

Update empty state message when no drafts are found:

```typescript
{filteredAndSortedFiles.length === 0 && (
  <div className="p-4 text-center text-muted-foreground text-sm">
    {showDraftsOnly 
      ? "No draft files found in this collection."
      : "No files found in this collection."
    }
  </div>
)}
```

## Architecture Compliance

- **No TanStack Query Mutations**: Uses existing project store actions (TanStack Query for server state only)
- **Project Settings**: Persists per-collection via existing project registry system
- **State Management**: Follows decomposed store architecture (project store for settings)
- **Performance**: Uses `getState()` pattern for callbacks, memoized filtering
- **UI Patterns**: Follows UnifiedTitleBar focus mode toggle design
- **Store Subscription**: Only subscribes to data that triggers re-renders

## Benefits

1. **Focused Writing**: Writers can easily see only draft content
2. **Per-Collection**: Different collections can have different view states
3. **Persistent**: State survives app restarts and project switches
4. **Visual Clarity**: Clear indicators when filtering is active
5. **Simple**: Minimal UI that doesn't clutter the interface

## Testing Considerations

- Test with collections that have no drafts
- Test with collections that have only drafts  
- Test persistence across app restarts
- Test switching between collections with different toggle states
- Test that non-draft files are properly hidden/shown
