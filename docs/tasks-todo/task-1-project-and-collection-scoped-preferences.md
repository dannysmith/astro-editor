# Task: Project and Collection-Scoped Preferences

## Architecture & Code Quality Requirements

**CRITICAL:** This task makes significant architectural changes to the preferences system. All code must be:

- **High quality** - Clean, well-structured, follows established patterns
- **Maintainable** - Easy to understand and modify in the future
- **Extensible** - Designed to accommodate future enhancements
- **Type-safe** - Full TypeScript and Rust type coverage, no `any` types
- **Well-tested** - Comprehensive tests for all new functionality
- **Well-documented** - Clear comments, updated architecture docs

**Step back and review if:**

- Code feels overly complex or hard to understand
- Patterns don't match the rest of the codebase
- Changes create coupling or hidden dependencies
- Tests are missing or inadequate

Refer to `docs/developer/architecture-guide.md` throughout implementation.

## Background

User preferences are currently set in the preferences panel and stored on disk as JSON files. On Mac, that's in `~/Library/Application Support/is.danny.astroeditor/preferences`

### Current File Structure

**global-settings.json** - Contains both truly global settings AND defaultProjectSettings (which shouldn't be here):

```json
{
  "general": {
    "ideCommand": "cursor",
    "theme": "system",
    "highlights": {
      "nouns": false,
      "verbs": false,
      "adjectives": false,
      "adverbs": false,
      "conjunctions": false
    },
    "autoSaveDelay": 2
  },
  "appearance": {
    "headingColor": {
      "light": "#ad1a72",
      "dark": "#e255a1"
    }
  },
  "defaultProjectSettings": {
    "pathOverrides": {
      "contentDirectory": "src/content/",
      "assetsDirectory": "src/assets/",
      "mdxComponentsDirectory": "src/components/mdx/"
    },
    "frontmatterMappings": {
      "publishedDate": "date",
      "title": "title",
      "description": "description",
      "draft": "draft"
    },
    "collectionViewSettings": {}
  },
  "version": 1
}
```

**project-registry.json** - Index of opened projects (has some duplication with individual project files):

```json
{
  "projects": {
    "dummy-astro-project": {
      "id": "dummy-astro-project",
      "name": "dummy-astro-project",
      "path": "/Users/danny/dev/astro-editor/test/dummy-astro-project",
      "lastOpened": "2025-10-10T22:08:40.643Z",
      "created": "2025-10-04T01:44:00.398Z"
    }
  },
  "lastOpenedProject": "dummy-astro-project",
  "version": 1
}
```

**projects/{project-id}.json** - Individual project settings (duplicates metadata from registry):

```json
{
  "metadata": {
    "id": "dummy-astro-project",
    "name": "dummy-astro-project",
    "path": "/Users/danny/dev/astro-editor/temp-dummy-astro-project",
    "lastOpened": "2025-10-04T01:44:00.398Z",
    "created": "2025-10-04T01:44:00.398Z"
  },
  "settings": {
    "pathOverrides": {
      "contentDirectory": "src/content/",
      "assetsDirectory": "src/assets/",
      "mdxComponentsDirectory": "src/components/mdx/"
    },
    "frontmatterMappings": {
      "publishedDate": "date",
      "title": "title",
      "description": "description",
      "draft": "draft"
    },
    "collectionViewSettings": {}
  }
}
```

See `docs/developer/preferences-system.md` for detailed information.

## Goals

1. **Remove duplication** - Single source of truth for each piece of data
2. **Clear separation of concerns** - Global vs Project vs Collection settings
3. **Collection-specific settings** - Support per-collection frontmatter mappings and path overrides
4. **Robust defaults** - App works even if preferences are missing or incomplete
5. **Clear UI** - Users understand what scope they're editing (global/project/collection)
6. **Fix related bug** - Content directory override not respected by config parser

## Implementation Subtasks

### Subtask 1: Fix Content Directory Override Bug

**Goal:** Make config parser respect content directory override, ensuring consistent behavior.

**Current Problem:**

- **src-tauri/src/parser.rs:89** - Hard-codes `src/content`:
  ```rust
  let content_dir = project_path.join("src").join("content");
  ```
- **src-tauri/src/commands/project.rs:270-275** - Correctly respects override:
  ```rust
  let content_dir = if let Some(override_path) = &content_directory_override {
      project_path.join(override_path)
  } else {
      project_path.join("src").join("content")
  };
  ```

**Required Changes:**

1. Modify `parse_collections_from_content()` signature to accept `content_directory_override: Option<&str>`
2. Update function to use override when constructing `content_dir`
3. Pass override through from `scan_project_with_content_dir` command
4. Add tests verifying override works for config-based discovery

**Files to Modify:**

- `src-tauri/src/parser.rs` - Update `parse_collections_from_content()` and `parse_astro_config()`
- `src-tauri/src/commands/project.rs` - Pass override to parser
- Add test case in `src-tauri/src/parser.rs` tests section

**Impact:**

- Content directory override will work consistently whether collections are discovered via config parsing or directory scanning
- Fixes silent failure where override is ignored when config exists

**Why First:** Standalone bug fix, provides immediate value, doesn't depend on other changes.

---

### Subtask 2: Restructure Preferences Files (Data Layer)

**Goal:** Eliminate duplication and establish clear data structure with proper scoping.

**Changes Required:**

1. **global-settings.json** - Remove `defaultProjectSettings`, keep only truly global settings:

   ```json
   {
     "general": {
       "ideCommand": "cursor",
       "theme": "system",
       "highlights": { ... },
       "autoSaveDelay": 2
     },
     "appearance": {
       "headingColor": { ... }
     },
     "version": 1
   }
   ```

2. **project-registry.json** - Keep only project list and last-opened (remove duplicated metadata):

   ```json
   {
     "projects": {
       "project-id": {
         "id": "project-id",
         "name": "project-name",
         "path": "/path/to/project",
         "lastOpened": "2025-10-10T22:08:40.643Z",
         "created": "2025-10-04T01:44:00.398Z"
       }
     },
     "lastOpenedProject": "project-id",
     "version": 1
   }
   ```

3. **projects/{project-id}.json** - Remove duplicated metadata, add collections array:

   ```json
   {
     "settings": {
       "pathOverrides": {
         "contentDirectory": "src/content/",
         "assetsDirectory": "src/assets/"
       },
       "frontmatterMappings": {
         "publishedDate": "date",
         "title": "title",
         "description": "description",
         "draft": "draft"
       }
     },
     "collections": [
       {
         "name": "blog",
         "settings": {
           "pathOverrides": {
             "contentDirectory": "content/blog/",
             "assetsDirectory": "public/blog-images/"
           },
           "frontmatterMappings": {
             "publishedDate": "publishDate",
             "title": "heading"
           }
         }
       }
     ],
     "version": 1
   }
   ```

**Implementation Notes:**

- Migration logic needed to convert existing files to new structure
- Collections array starts empty; populated as collections are discovered
- Collection settings are sparse (only store what's explicitly set, not defaults)

**Decision Point:** Should collections array be source of truth for discovered collections? Or just for collection-specific settings? **Answer:** Store only collection-specific settings. Don't try to track all discovered collections here. (See "Open Questions" section for rationale.)

**Type System Updates:**

Update TypeScript types in `src/lib/project-registry/types.ts`:

```typescript
// Remove from GlobalSettings
export interface GlobalSettings {
  general: { ... }
  appearance: { ... }
  // ❌ REMOVE: defaultProjectSettings: ProjectSettings
  version: number
}

// Update ProjectData
export interface ProjectData {
  // ❌ REMOVE: metadata: ProjectMetadata (redundant with registry)
  settings: ProjectSettings
  collections?: CollectionSettings[] // NEW: Collection-specific overrides
  version: number
}

// NEW: Collection settings type
export interface CollectionSettings {
  name: string // Collection identifier
  settings: {
    pathOverrides?: {
      contentDirectory?: string
      assetsDirectory?: string
    }
    frontmatterMappings?: {
      publishedDate?: string | string[]
      title?: string
      description?: string
      draft?: string
    }
  }
}
```

Update Rust types in `src-tauri/src/` (create new file or update existing):

```rust
// NEW: Subset of settings for individual collections
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionSpecificSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_overrides: Option<PathOverrides>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frontmatter_mappings: Option<FrontmatterMappings>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionSettings {
    pub name: String,
    pub settings: CollectionSpecificSettings,
}

// Update ProjectData to include collections
#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectData {
    pub settings: ProjectSettings,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collections: Option<Vec<CollectionSettings>>,
    pub version: u32,
}
```

**Note:** CollectionSpecificSettings is a subset of ProjectSettings (only pathOverrides and frontmatterMappings), not the full ProjectSettings. We don't want collection settings to include `collectionViewSettings` since that's a project-level map.

**Migration Strategy:**

Create `src/lib/project-registry/migrations.ts` (temporary file, will be deleted in future version):

```typescript
// migrations.ts
// TODO: Remove this entire file after v2.5.0 when most users have upgraded

/**
 * Migrate from v1 preference structure to v2
 * v1: Has defaultProjectSettings in global, metadata in project files
 * v2: No defaultProjectSettings, no metadata, has collections array
 */
export function migratePreferencesV1toV2(
  globalSettings: any,
  projectData: any
): { globalSettings: GlobalSettings; projectData: ProjectData } {
  // Migration logic here
  // 1. Remove defaultProjectSettings from global-settings.json
  // 2. Remove metadata from individual project files (already in registry)
  // 3. Add collections: [] to project files
  // 4. Update version numbers to 2
  return { globalSettings: migrated, projectData: migratedProject }
}
```

**Migration Execution:**

1. When loading preferences, check version number
2. If version === 1 (or missing), run migration
3. Write migrated data to `.bak` files first
4. If successful, rename `.bak` to actual files
5. If rename fails, keep old files and log error
6. Log migration: "Migrated preferences from v1 to v2"

**Backwards Compatibility:**

- If old structure detected, migrate automatically (one-time, on first load)
- If migration fails, fall back to defaults and log error
- Never corrupt existing files - atomic write operation

**Future Cleanup:**

After a few versions (e.g., v2.5.0), when most users have upgraded:
1. Delete `src/lib/project-registry/migrations.ts`
2. Remove migration check from loading code
3. Assume all preferences are v2 format

---

### Subtask 3: Implement Collection-Scoped Settings

**Goal:** Support per-collection frontmatter mappings and path overrides with proper fallback chain.

**Fallback Chain:**

```
Collection-specific setting
  ↓ (if not set)
Project-level setting
  ↓ (if not set)
Hard-coded default (in code, not in global settings)
```

**Collection Settings Schema:**

- `frontmatterMappings` (object, optional)
  - `publishedDate` (string | string[], optional)
  - `title` (string, optional)
  - `description` (string, optional)
  - `draft` (string, optional)
- `pathOverrides` (object, optional)
  - `contentDirectory` (string, optional) - Collection-specific content path
  - `assetsDirectory` (string, optional) - Collection-specific assets path

**Use Cases This Enables:**

- Blog collection uses `publishDate` field while docs collection uses `date`
- Blog posts stored in `content/blog/` with assets in `public/blog-images/`
- Docs stored in `content/docs/` with assets in `src/assets/docs/`
- One collection uses `heading` for title, another uses `title`

**Path Override Semantics:**

Collection path overrides are **absolute paths relative to project root**:

```typescript
// Example: Blog collection with custom paths
{
  name: "blog",
  settings: {
    pathOverrides: {
      // Blog content is in <project_root>/content/blog-posts/
      // NOT in <project_root>/src/content/blog-posts/
      contentDirectory: "content/blog-posts/",

      // Blog assets go to <project_root>/public/blog-images/
      // NOT in <project_root>/src/assets/blog-images/
      assetsDirectory: "public/blog-images/"
    }
  }
}
```

This allows collections to exist anywhere in the project, not just as subdirectories of the project's contentDirectory.

**Implementation:**

Create `src/lib/project-registry/collection-settings.ts`:

```typescript
/**
 * Get settings for a specific collection with three-tier fallback:
 * Collection override → Project settings → Hard-coded defaults
 */
export function getCollectionSettings(
  projectSettings: ProjectSettings,
  collectionName: string
): {
  pathOverrides: Required<PathOverrides>
  frontmatterMappings: Required<FrontmatterMappings>
} {
  // Find collection-specific settings
  const collectionSettings = projectSettings.collections?.find(
    c => c.name === collectionName
  )?.settings

  // Implement three-tier fallback
  return {
    pathOverrides: {
      contentDirectory:
        collectionSettings?.pathOverrides?.contentDirectory ||
        projectSettings.pathOverrides?.contentDirectory ||
        ASTRO_PATHS.CONTENT_DIR,
      assetsDirectory:
        collectionSettings?.pathOverrides?.assetsDirectory ||
        projectSettings.pathOverrides?.assetsDirectory ||
        ASTRO_PATHS.ASSETS_DIR,
      // ... etc
    },
    frontmatterMappings: {
      // Similar fallback chain
    },
  }
}
```

Update `src/lib/project-registry/effective-settings.ts`:

```typescript
// Add optional collection parameter
export const useEffectiveSettings = (collectionName?: string) => {
  const { currentProjectSettings } = useProjectStore()

  if (collectionName && currentProjectSettings) {
    return getCollectionSettings(currentProjectSettings, collectionName)
  }

  // Return project-level settings if no collection specified
  return getEffectivePathOverrides() // existing function
}
```

**Active Collection Tracking:**

Use existing `projectStore.selectedCollection` to determine which collection's settings to apply:

```typescript
// In file operations, use selected collection
const { selectedCollection } = useProjectStore()
const settings = useEffectiveSettings(selectedCollection || undefined)
```

---

### Subtask 4: Update Code to Respect Settings Hierarchy

**Goal:** Audit and update all code that uses paths or frontmatter mappings to respect the new three-tier settings hierarchy.

**Areas to Audit:**

1. **Path Usage Locations:**
   - Collection scanning (`scan_project_with_content_dir`)
   - File watcher (`start_watching_project_with_content_dir`)
   - File creation (`create_new_file`)
   - Asset copying (`copy_file_to_assets_with_override`)
   - Component builder (MDX components directory)
   - File operations (read/write)

2. **Frontmatter Mappings Usage:**
   - File list display (title, date, draft indicators)
   - File sorting (by published date)
   - Frontmatter panel rendering (special styling for title/description)
   - Collection file queries

**Refactoring Opportunity:**

Create centralized path resolution functions:

```typescript
// In lib/project-registry/path-resolution.ts
export function getCollectionContentPath(
  projectPath: string,
  collectionName: string,
  settings: ProjectSettings,
  collectionSettings?: CollectionSettings
): string

export function getCollectionAssetsPath(
  projectPath: string,
  collectionName: string,
  settings: ProjectSettings,
  collectionSettings?: CollectionSettings
): string

export function getCollectionFrontmatterMappings(
  settings: ProjectSettings,
  collectionSettings?: CollectionSettings
): FrontmatterMappings
```

**Implementation Approach:**

1. **Create centralized path resolution module** (`lib/project-registry/path-resolution.ts`)
2. **Update all file operations** to use centralized functions
3. **Ensure TanStack Query hooks** use correct paths with collection context
4. **Update Rust commands** to accept collection-specific overrides where needed
5. **Test with various override combinations**

**Query Cache Invalidation Strategy:**

When settings change, invalidate affected queries:

```typescript
// In updateProjectSettings or updateCollectionSettings
const invalidateQueriesAfterSettingsChange = () => {
  // If path overrides changed, invalidate all collection data
  queryClient.invalidateQueries({
    queryKey: queryKeys.collections(projectPath),
  })

  queryClient.invalidateQueries({
    queryKey: queryKeys.allCollectionFiles(projectPath),
  })

  // If frontmatter mappings changed, refetch current file to update rendering
  if (currentFile) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.collectionFiles(projectPath, currentFile.collection),
    })
  }
}
```

Add to affected areas:

- `usePreferences.ts` - After saving settings
- Project settings pane - After user changes
- Collection settings pane - After user changes

**Rust Command Updates:**

Some commands may need collection-specific context:

```rust
// Example: Asset copying might need collection-specific asset directory
#[tauri::command]
pub async fn copy_file_to_assets_with_collection(
    project_path: String,
    source_path: String,
    collection_name: Option<String>, // NEW
    assets_directory_override: Option<String>,
) -> Result<String, String>
```

**Edge Case: Settings Change While Editing:**

If user changes collection path settings while file is open:

1. **Current file path becomes invalid** - File is at old location
2. **Auto-save fails** - Can't find old path
3. **File watcher loses track** - Watching wrong directory

**Solution:**

- Detect when settings change affect currently open file
- Show warning dialog: "Changing path settings while editing may cause save issues. Please close the file first."
- Or: Auto-save and close file when settings change
- Track in Subtask 5 (Robustness)

---

### Subtask 5: Robustness and Edge Cases

**Goal:** Ensure app is resilient to missing preferences and handles edge cases gracefully.

**Robustness Requirements:**

1. **Missing Preferences Handling:**
   - App should work if entire preferences directory is deleted
   - App should work if specific preference fields are missing
   - Fall back to hard-coded defaults (not from global settings)
   - Recreate preferences files as needed

2. **Default Highlights to False:**
   - When global-settings.json is first created, `highlights` should default to all `false`
   - Update initialization code in `src/lib/project-registry/defaults.ts`:

   ```typescript
   export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
     general: {
       ideCommand: '', // ✓ Empty/unset by default (dropdown: Cursor, Code, vim)
       theme: 'system',
       highlights: {
         nouns: false, // ✓ Changed from true to false
         verbs: false, // ✓ Changed from true to false
         adjectives: false, // ✓ Changed from true to false
         adverbs: false, // ✓ Changed from true to false
         conjunctions: false, // ✓ Changed from true to false
       },
       autoSaveDelay: 2,
     },
     appearance: {
       headingColor: {
         light: '#191919', // Current default (dark gray text)
         dark: '#cccccc', // Current default (light gray text)
       },
     },
     version: 2, // Updated version
   }
   ```

3. **Settings Change While File is Open:**
   - Detect when collection path settings change
   - If current file's collection is affected:
     - Auto-save current file first
     - Show warning toast
     - Clear editor state or prompt user to close file
   - Restart file watcher with new paths

4. **Project/Collection Name Changes:**
   - **Low priority** - Complexity likely not worth it
   - Document expected behavior: If project path changes, automatic migration works (already implemented)
   - If collection name changes in source: Collections array in preferences may have orphaned entries
   - Strategy: Don't try to be too smart. Let users reopen project if major changes occur
   - Future enhancement: Could add "clean up orphaned collections" utility in debug pane

5. **Validation Strategy:**
   - **Path overrides:** Don't validate existence - let users set whatever they want
     - **Rationale:** User might set up paths before creating directories
     - Handle errors gracefully at runtime if paths don't exist
     - Show helpful error messages: "Content directory 'content/blog/' not found. Check your project settings."
   - **Frontmatter field mappings:** Keep current dropdown approach
     - **Draft field:** Dropdown populated with boolean fields from schema
     - **Published date:** Dropdown populated with date fields from schema
     - **Title/Description:** Dropdown populated with string fields from schema
     - This prevents typos and makes configuration easy
     - No free-form text input needed

6. **Preference Structure Migration (v1 → v2):**

   **What's Being Migrated:**
   - v1 (current): `global-settings.json` has `defaultProjectSettings`, project files have `metadata` section
   - v2 (new): No `defaultProjectSettings` in global, no `metadata` in project files, add `collections: []`

   **Migration Code Requirements:**
   - **Self-contained:** Create `src/lib/project-registry/migrations.ts` for all migration logic
   - **Temporary code:** Add clear TODO comments: `// TODO: Remove this migration code after v2.5.0 (when most users have upgraded)`
   - **Automatic:** Runs on first load if version mismatch detected
   - **Safe:** Write to `.bak` file first, then rename - don't corrupt existing files
   - **Fallback:** If migration fails completely, fall back to defaults and log error
   - **Easy to delete:** When removing in future, just delete `migrations.ts` and remove the import

   **Migration Logic:**
   ```typescript
   // migrations.ts - TODO: Remove after v2.5.0
   export function migratePreferencesV1toV2(oldData: any): PreferencesV2 {
     // 1. Remove defaultProjectSettings from global-settings.json
     // 2. Remove metadata from project files (redundant with registry)
     // 3. Add collections: [] to project files
     // 4. Update version number to 2
     // 5. Return migrated data
   }
   ```

**Testing Scenarios:**

- Delete all preferences, open app → should work
- Delete global-settings.json → should recreate with defaults
- Delete project file → should recreate on project open
- Remove specific fields from preferences → should use defaults
- Open old preferences structure → should migrate automatically
- Change collection settings while file is open → should handle gracefully
- Set invalid path overrides → should fail gracefully at runtime

---

### Subtask 6: Update Preferences UI

**Goal:** Make UI crystal clear about what scope is being edited. Show collection settings when available.

**UI Changes Required:**

1. **Clear Scope Indicators:**
   - Add section headers: "Global Settings", "Project Settings", "Collection Settings"
   - Show project name in project settings section
   - Only show project/collection sections when project is open
   - Visual distinction (icons, colors, borders) between scopes

**Global Settings - IDE Command:**
   - **SECURITY CRITICAL:** Dropdown only, no free-form text input
   - Options: (empty/unset), "cursor", "code", "vim"
   - These commands are whitelisted in Rust and execute in terminal
   - Cannot allow arbitrary user input for security reasons
   - Default: Empty/unset (user must explicitly choose)

2. **Collection Settings UI:**
   - Add new "Collections" tab or section in project settings
   - List all discovered collections
   - For each collection, allow overriding:
     - **Frontmatter mappings** - Use existing dropdown pattern:
       - Draft field → dropdown of boolean schema fields
       - Published date → dropdown of date schema fields
       - Title/Description → dropdown of string schema fields
       - Show placeholder: "Using project setting: [field name]" when not overridden
     - **Path overrides** - Text inputs with placeholders:
       - Content directory → "Using project setting: src/content/"
       - Assets directory → "Using project setting: src/assets/"
   - Show inherited values with visual indicator (e.g., grayed out, with "inherited from project" note)
   - Clear affordance to "override" or "use default" (maybe a toggle or "Reset to default" button)

3. **Help Text:**
   - Explain fallback chain: "If not set, uses project setting. If project setting not set, uses default."
   - Warning about path overrides: "Changing this will affect where the app looks for content files"
   - Examples in placeholders showing typical paths

**Component Structure:**

```
PreferencesDialog
├── GlobalSettingsPane (general, appearance)
├── ProjectSettingsPane (path overrides, frontmatter mappings)
│   └── Only shown when project is open
└── CollectionSettingsPane (per-collection overrides)
    └── Only shown when project is open
```

**UX Considerations:**

- Don't overwhelm users - collection settings should be "advanced"
- Most users won't need collection-specific settings
- Consider collapsible sections or separate tab for collection settings
- Visual feedback when setting is overridden vs inherited

**Implementation Notes:**

- Use `useProjectStore(state => state.selectedCollection)` to get active collection
- Use TanStack Query `useCollectionsQuery` to get list of discovered collections for UI
- Collections in preferences but not discovered should show as "orphaned" (grayed out)
- Save collection settings immediately when user changes them (optimistic update)

---

## Subtask 6 Progress & Outstanding Issues

### What Was Completed

1. **Added scope indicators to all preference panes** - Clear headers showing "Global Settings", "Project Settings", etc.
2. **Created CollectionSettingsPane component** - Full UI for collection-specific overrides with collapsible sections
3. **Removed FrontmatterMappingsPane** - Project-level frontmatter mappings removed from UI (backend still supports them for manual JSON editing)
   - **Architectural Decision:** Only expose collection-specific frontmatter mappings in UI because different collections have different schemas. Merging fields from all collections into project-level dropdowns was confusing and semantically incorrect.
   - Path overrides remain at both project and collection level (makes sense - e.g., "all collections in src/content/" at project level, "blog in content/blog/" at collection level)
4. **Fixed FrontmatterField bug** - Now correctly uses collection-specific settings instead of project-level
   - Added `collectionName` prop to FrontmatterField
   - FrontmatterPanel now passes `currentFile.collection` to all field components
   - FrontmatterField calls `useEffectiveSettings(collectionName)` for proper fallback
5. **Updated PreferencesDialog navigation** - Now shows: General, Project Settings, Collections
   - Removed "Frontmatter Mappings" tab entirely
   - Frontmatter configuration only available per-collection in Collections tab

### Critical Bugs Remaining (Not Fixed)

**Symptoms:**
1. **Collection-level path override inputs do not accept text** - Can't type into contentDirectory or assetsDirectory inputs
2. **Frontmatter mapping dropdowns do not allow selection** - Can't select any field from dropdowns
3. **No console errors appear** - Silent failure
4. **Placeholder values show correctly** - The inherited values are computed and displayed properly

**What Was Tried (Unsuccessfully):**
- Updated cleanup filter in `usePreferences.ts:68-81` to check for non-undefined values instead of truthy objects
- Changed placeholder text from "Use project setting" to "Use default"
- All TypeScript checks pass with no errors

**Code Locations to Investigate:**
- `src/hooks/usePreferences.ts` - `updateCollectionSettings()` function (lines 40-81)
- `src/components/preferences/panes/CollectionSettingsPane.tsx`:
  - `handlePathOverrideChange()` (lines 113-131)
  - `handleFrontmatterMappingChange()` (lines 134-152)
  - Input field (lines 191-204)
  - Select dropdown rendering (lines 176-210)

**Possible Root Causes:**
1. **State update not triggering re-render** - Settings might be updating but UI not reflecting
2. **Event handlers not firing** - onChange might be blocked or not attached
3. **projectStore.updateProjectSettings() issue** - The underlying update mechanism might not be working for `collections` array
4. **Controlled input issue** - Value binding might be preventing edits

**Next Steps for Debugging:**
1. Add console.logs to `handlePathOverrideChange` and `handleFrontmatterMappingChange` to verify they're being called
2. Check if `updateCollectionSettings` is actually calling `updateProjectSettings`
3. Verify the `projectStore.updateProjectSettings` handles the `collections` field correctly
4. Check if there's a React state batching issue preventing re-renders
5. Try making the inputs uncontrolled temporarily to see if the issue is with controlled component behavior

**Drag and Drop Image Functionality:**
- Code appears correct - uses `getEffectiveAssetsDirectory(currentProjectSettings, collection)`
- Should work with three-tier fallback, but needs testing after above bugs are fixed

---

### Subtask 7: Debug Tools for Support

**Goal:** Add developer/support tools to help diagnose preference issues.

**Debug Pane Requirements:**

1. **Location:**
   - New "Advanced" or "Debug" tab in preferences dialog
   - Less prominent than other tabs (maybe at bottom of tab list)
   - Or: Collapsible "Advanced" section at bottom of General tab

2. **Features:**
   - **"Open Preferences Folder"** button
     - Uses shell command to open `~/Library/Application Support/is.danny.astroeditor/` in Finder
   - **"Reset All Preferences"** button
     - Shows warning dialog with clear explanation
     - Requires confirmation checkbox: "I understand this will delete all settings"
     - After confirmation, deletes entire preferences directory
     - Closes preferences dialog and resets app to fresh state
   - **Version Information:**
     - Show app version
     - Show preferences version numbers
     - Show migration status if applicable
   - **Future Enhancements:**
     - Toggle verbose logging
     - View logs button
     - Export preferences for bug reports

3. **Warning Copy:**

   ```
   ⚠️ Warning: This will permanently delete:
   - All global preferences
   - All project-specific settings
   - Project registry and recent projects list

   The app will restart with default settings.
   Your actual project files will not be affected.

   □ I understand this cannot be undone
   ```

**Implementation:**

- Create `DebugPane.tsx` component
- Add `open_preferences_folder` Tauri command
- Add `reset_all_preferences` Tauri command with safety checks
- Add to preferences dialog as new tab

---

## Related Bug Details

### Bug: Content Directory Override Not Respected by Config Parser

**How Content Directory Path Resolution Currently Works:**

Astro Editor uses a two-tier path resolution strategy:

1. **Content Directory Base Path:**
   - Default: `src/content` (defined in `src/lib/constants.ts:3`)
   - User override: `ProjectSettings.pathOverrides.contentDirectory`
   - Collections expected to be subdirectories: `{content_dir}/{collection_name}`

2. **Collection Discovery (Two Methods):**

   **Method A:** Config-based discovery (primary, via `parse_astro_config`)
   - Parses `src/content.config.ts` or `src/content/config.ts`
   - Extracts collection names from the config
   - Constructs collection paths
   - **BUG:** Hard-codes `src/content`, ignores override

   **Method B:** Directory-based discovery (fallback, via `scan_content_directories_with_override`)
   - Scans for subdirectories when config parsing fails/returns empty
   - Lists subdirectories under the configured content directory
   - Creates collections from directory names
   - **CORRECT:** Respects content directory override

3. **Subsequent Operations:**
   - All file operations use stored `collection.path` from discovery
   - File watcher respects content directory override

**The Bug:**

The config parser hard-codes `src/content` and ignores the user's content directory override.

**Location:** `src-tauri/src/parser.rs:89`

```rust
let content_dir = project_path.join("src").join("content"); // ❌ Hard-coded
```

**Contrast with directory scanner** (`src-tauri/src/commands/project.rs:270-275`):

```rust
let content_dir = if let Some(override_path) = &content_directory_override {
    project_path.join(override_path) // ✅ Respects override
} else {
    project_path.join("src").join("content")
};
```

**Impact:**

- Content directory override only works when config parsing fails or returns empty
- Override is silently ignored when `content.config.ts` successfully parses
- Inconsistent behavior based on whether TypeScript config can be parsed

**Reproduction:**

1. Set `contentDirectory: "content"` in project settings (not `src/content`)
2. Have a valid `src/content.config.ts` with collections defined
3. Place actual content files in `content/{collection_name}/`
4. **Expected:** App finds collections and files
5. **Actual:** App looks in `src/content/{collection_name}/` and finds nothing

**Fix:** See Subtask 3 above.

---

## Open Questions

**Q: Should collections array be the source of truth for discovered collections?**

**A (Proposed):** No. Collections array should only store collection-specific settings overrides. Don't try to track all discovered collections in preferences. Collections are discovered dynamically each time the project is opened. Preferences only store the _settings_ for collections, not the collections themselves.

**Rationale:**

- Simpler mental model
- No sync issues between discovered collections and preferences
- Sparse storage - only save what's explicitly customized
- Collections that no longer exist won't break anything (their settings are simply unused)

**Alternative considered:** Make preferences the source of truth, sync on every collection discovery. **Rejected** because: Too complex, prone to bugs, unnecessary for the use case.

---

## Implementation Order

**The subtasks above are already ordered for implementation.** Work through them sequentially:

1. **Fix bug** - Standalone, immediate value, no dependencies
2. **Restructure files** - Foundation for everything else, includes migration
3. **Collection-scoped settings** - Build on new structure, add three-tier fallback
4. **Update code** - Make all file operations respect new hierarchy
5. **Robustness** - Handle edge cases, ensure migrations work, validation strategy
6. **UI updates** - User-facing changes, depends on everything else working
7. **Debug tools** - Nice-to-have, can be done anytime

After completing each subtask, update the checklist in "Success Criteria" below.

---

## Testing Strategy

For each subtask:

- [ ] Unit tests for new functions (path resolution, settings hierarchy)
- [ ] Integration tests for preference loading/saving
- [ ] Manual testing with various project structures
- [ ] Test migration from old to new preference structure
- [ ] Test app behavior with missing preferences
- [ ] Test all three levels of override (collection, project, default)

---

## Success Criteria

Track completion of each subtask:

- [x] **Subtask 1: Bug Fix** - Content directory override works in config parser
- [x] **Subtask 2: Restructure** - New preference file structure, migration works
- [x] **Subtask 3: Collection Settings** - Three-tier fallback implemented
- [x] **Subtask 4: Update Code** - All file operations respect hierarchy
- [x] **Subtask 5: Robustness** - Edge cases handled, validation strategy clear
- [ ] **Subtask 6: UI** - Preferences UI shows scope clearly, collection settings work (UI CREATED BUT INPUTS/DROPDOWNS NOT WORKING - SEE "Subtask 6 Progress & Outstanding Issues" SECTION)
- [ ] **Subtask 7: Debug Tools** - Reset and open folder tools functional

**Overall Quality Gates:**

- [ ] No duplication in preference files
- [ ] TypeScript types updated and type-safe (no `any`)
- [ ] Rust types updated to match new structure
- [ ] All file operations respect settings hierarchy
- [ ] App works when preferences are missing/incomplete
- [ ] Migration from old structure works reliably
- [ ] Query invalidation works correctly when settings change
- [ ] Settings changes while file open handled gracefully
- [ ] Documentation updated (`docs/developer/preferences-system.md`)
- [ ] All tests passing (unit, integration, manual scenarios)
- [ ] Code reviewed for quality and maintainability
