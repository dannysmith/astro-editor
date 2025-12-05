# Preferences System Documentation

## Overview

The preferences system manages global user settings, project-specific settings, and collection-scoped settings using a three-tier hierarchy. It uses a project registry to track opened projects and their individual configurations.

## File Storage

- **Location**: `/Users/danny/Library/Application\ Support/is.danny.astroeditor/`

### File Structure

```
preferences/
├── global-settings.json          # Global user preferences (NO project defaults)
├── project-registry.json         # Index of opened projects (metadata only)
└── projects/
    ├── {project-id}.json         # Project settings + collection overrides
    └── {project-id-2}.json       # Another project's settings
```

## Settings Hierarchy (Three-Tier Fallback)

The preferences system uses a three-tier fallback pattern for resolving settings:

```
Collection-specific setting
  ↓ (if not set)
Project-level setting
  ↓ (if not set)
Hard-coded default (in code)
```

**Important**: There are NO global defaults for project/collection settings. Global settings contain only truly global preferences (theme, IDE command, etc.). Project and collection settings fall back to hard-coded constants defined in the code.

## Project Identification

Projects are identified by their `package.json` name:

- **Primary ID**: Clean version of package.json name (e.g., `my-blog`)
- **Conflict Resolution**: If name conflicts exist, adds path hash (e.g., `my-blog-a1b2c3`)
- **Fallback**: If no package.json, uses directory name
- **Migration**: Automatically detects moved projects by matching package.json name

## Data Types (v2)

### Global Settings

```typescript
{
  general: {
    ideCommand: string           // Command for "Open in IDE" (e.g., "code")
    theme: 'light' | 'dark' | 'system'
    highlights: {                // Copyedit mode settings
      nouns: boolean
      verbs: boolean
      adjectives: boolean
      adverbs: boolean
      conjunctions: boolean
    }
    autoSaveDelay: number        // Seconds between auto-saves
  },
  appearance: {
    headingColor: {
      light: string              // Hex color for light mode
      dark: string               // Hex color for dark mode
    }
  },
  version: number                // Current: 2
}
```

**Note**: `defaultProjectSettings` has been REMOVED. There are no global defaults for project settings.

### Project Data (Individual Project File)

```typescript
{
  settings: ProjectSettings,      // Project-level settings
  collections?: CollectionSettings[],  // Collection-specific overrides (sparse)
  version: number                 // Current: 2
}
```

**Note**: `metadata` field has been REMOVED. Project metadata is stored ONLY in the registry, not duplicated in individual project files.

### Project Settings

```typescript
{
  pathOverrides?: {
    contentDirectory?: string     // Default: "src/content/"
    assetsDirectory?: string      // Default: "src/assets/"
    mdxComponentsDirectory?: string // Default: "src/components/mdx/"
  },
  frontmatterMappings?: {
    publishedDate?: string | string[]  // Default: ["pubDate", "date", "publishedDate"]
    title?: string                     // Default: "title"
    description?: string               // Default: "description"
    draft?: string                     // Default: "draft"
  },
  collectionViewSettings?: Record<string, unknown>  // UI state per collection
}
```

### Collection Settings (NEW in v2)

```typescript
{
  name: string,                   // Collection identifier
  settings: {
    pathOverrides?: {
      contentDirectory?: string   // Collection-specific content path (absolute from project root)
      assetsDirectory?: string    // Collection-specific assets path (absolute from project root)
    },
    frontmatterMappings?: {
      publishedDate?: string | string[]
      title?: string
      description?: string
      draft?: string
    }
  }
}
```

**Important Semantics**: Collection path overrides are **absolute paths relative to project root**, not subdirectories of the project's content directory. This allows collections to exist anywhere in the project structure.

Example:
```typescript
{
  name: "blog",
  settings: {
    pathOverrides: {
      // Blog content is in <project_root>/content/blog-posts/
      // NOT in <project_root>/src/content/blog-posts/
      contentDirectory: "content/blog-posts/",

      // Blog assets go to <project_root>/public/blog-images/
      assetsDirectory: "public/blog-images/"
    }
  }
}
```

### Project Registry

```typescript
{
  projects: {
    [projectId]: {
      id: string
      name: string
      path: string
      lastOpened: string        // ISO date
      created: string           // ISO date
    }
  },
  lastOpenedProject: string | null,
  version: number               // Current: 1
}
```

**Note**: Metadata lives ONLY in the registry. Individual project files contain ONLY settings and collections data.

## Usage in Store

### Accessing Settings

```typescript
// In components - access project settings
const { globalSettings, currentProjectSettings } = useProjectStore()

// Get effective settings with three-tier fallback
// Without collection: returns project settings (with defaults)
const projectSettings = useEffectiveSettings()

// With collection: returns collection → project → default
const collectionSettings = useEffectiveSettings('blog')

// Direct store access
const effectiveSettings =
  projectRegistryManager.getEffectiveSettings(projectId)
```

### Updating Settings

```typescript
// Update global settings
await updateGlobalSettings({
  general: { ideCommand: 'code' },
})

// Update project settings
await updateProjectSettings({
  pathOverrides: { contentDirectory: 'content/' },
})

// Update collection-specific settings (NEW in v2)
await updateProjectSettings({
  collections: [
    {
      name: 'blog',
      settings: {
        pathOverrides: { contentDirectory: 'content/blog/' },
        frontmatterMappings: { publishedDate: 'publishDate' }
      }
    }
  ]
})
```

### Deep Merge Behavior for Global Settings

The `updateGlobalSettings` method performs **two-level deep merging**. You only need to pass the fields you're changing:

**Merge Levels:**
- **Level 1**: `general`, `appearance` - spreads existing + updates
- **Level 2**: `highlights`, `headingColor` - spreads existing + updates

**Examples:**

```typescript
// ✅ CORRECT: Just pass the field you're changing
void updateGlobal({ general: { theme: 'dark' } })
// Result: theme updated, all other general fields preserved

// ✅ CORRECT: Nested objects are also merged
void updateGlobal({ general: { highlights: { nouns: false } } })
// Result: nouns=false, other highlights (verbs, adjectives, etc.) preserved

void updateGlobal({ appearance: { headingColor: { light: '#ff0000' } } })
// Result: light color updated, dark color preserved

// ✅ CORRECT: Multiple fields at once
void updateGlobal({
  general: { theme: 'dark', autoSaveDelay: 5 },
  appearance: { editorBaseFontSize: 16 }
})
```

**Note:** The `DeepPartial<GlobalSettings>` type allows partial nested objects. This eliminates the need to manually spread existing values when updating settings.

### Settings Resolution Pattern

The `useEffectiveSettings` hook implements the three-tier fallback:

```typescript
export const useEffectiveSettings = (collectionName?: string) => {
  const { currentProjectSettings } = useProjectStore()

  if (collectionName && currentProjectSettings) {
    // Find collection-specific settings
    const collectionSettings = currentProjectSettings.collections?.find(
      c => c.name === collectionName
    )?.settings

    // Three-tier fallback for each setting
    return {
      pathOverrides: {
        contentDirectory:
          collectionSettings?.pathOverrides?.contentDirectory ||
          currentProjectSettings.pathOverrides?.contentDirectory ||
          ASTRO_PATHS.CONTENT_DIR,
        assetsDirectory:
          collectionSettings?.pathOverrides?.assetsDirectory ||
          currentProjectSettings.pathOverrides?.assetsDirectory ||
          ASTRO_PATHS.ASSETS_DIR,
      },
      frontmatterMappings: {
        // Similar fallback chain...
      },
    }
  }

  // Return project-level settings with defaults
  return getEffectivePathOverrides()
}
```

## API Reference

### ProjectRegistryManager

- `initialize()` - Initialize the system (called on app start)
- `registerProject(path)` - Register/update a project, returns projectId
- `getProjectData(projectId)` - Get full project data (settings + collections)
- `getEffectiveSettings(projectId)` - Get project settings with defaults applied
- `updateGlobalSettings(settings)` - Update global settings
- `updateProjectSettings(projectId, settings)` - Update project settings (including collections array)

**Note**: `getEffectiveSettings()` does NOT merge global defaults anymore since they don't exist. It only applies hard-coded defaults for missing project settings.

### Store Actions

- `initializeProjectRegistry()` - Initialize on app start
- `updateGlobalSettings(settings)` - Update global settings with toast feedback
- `updateProjectSettings(settings)` - Update current project settings (including collections)

### Hooks

- `useEffectiveSettings(collectionName?: string)` - Get effective settings with three-tier fallback
  - No collection: Returns project settings with defaults
  - With collection: Returns collection → project → default chain
- `usePreferences()` - Access global and project settings, update functions

## How It Works

1. **App Startup**:
   - `initializeProjectRegistry()` called from `loadPersistedProject()`
   - Loads global settings and project registry
   - Logs app data directory to console
   - Applies migration if v1 preferences detected

2. **Opening a Project**:
   - `setProject(path)` registers the project in registry
   - Discovers project info from package.json
   - Loads project settings (NOT merged with global - no global defaults exist)
   - Updates `currentProjectId` and `currentProjectSettings` in store
   - Collections array loaded but not validated against discovered collections

3. **Project Migration**:
   - If project path changes, system detects it's the same project via package.json name
   - Updates path in registry automatically
   - Preserves all project-specific settings and collection overrides

4. **Settings Precedence (Three-Tier)**:
   - **Global Settings**: Only for truly global preferences (theme, IDE, etc.)
   - **Project Settings**: Apply to entire project, fall back to hard-coded defaults
   - **Collection Settings**: Override project settings for specific collections
   - `useEffectiveSettings(collectionName)` implements the fallback chain

5. **Collection Settings Resolution**:
   - Collections array stores ONLY explicit overrides (sparse storage)
   - When collection settings are requested, system:
     1. Looks for collection in `collections` array
     2. Falls back to project settings if not found
     3. Falls back to hard-coded defaults if project setting not set
   - Discovered collections not in array use project/default settings

## Implementation Notes

- Settings are auto-saved when updated
- All operations include error handling with toast notifications
- Project data is cached in memory for performance
- Falls back to localStorage for backward compatibility
- Works with both development and production builds

## Testing

- Check browser console for app data directory path
- Open a project to trigger registry creation
- Navigate to preferences directory to see created files
- Move a project and reopen to test migration
- Check `window.__TAURI__.core.invoke('get_app_data_dir')` in console

## How Settings Work in the Application

### Path Overrides (Project and Collection Level)

Path overrides can be configured at both project and collection level:

**Project-Level Content Directory Override:**

- **Collection Scanning**: Uses `scan_project_with_content_dir` Tauri command
- **File Watching**: Uses `start_watching_project_with_content_dir` to watch custom directory
- **Applies to**: All collections unless collection has its own override
- **Default**: `src/content/` → **Override Example**: `content/` or `docs/`

**Collection-Level Content Directory Override:**

- **Semantics**: Absolute path from project root (NOT subdirectory of project content dir)
- **Allows**: Collections to exist anywhere in project structure
- **Example**: `"content/blog/"` means `<project_root>/content/blog/`, not `<project_root>/src/content/blog/`
- **Use Case**: Blog in `content/blog/`, docs in `src/content/docs/`

**Assets Directory Override:**

- **Drag & Drop**: Uses `copy_file_to_assets_with_override` when files are dropped
- **Collection-Specific**: Each collection can have different assets directory
- **Default**: `src/assets/` → **Project Override**: `public/images/` → **Collection Override**: `public/blog-images/`

**MDX Components Directory Override:**

- **Reserved for Future**: Structure in place but not currently used
- **Default**: `src/components/mdx/`

### Frontmatter Field Mappings (Collection-Scoped)

**Important**: Frontmatter mappings are primarily collection-scoped in the UI. Project-level mappings exist in the backend for manual JSON editing but are not exposed in the preferences UI.

**Why Collection-Scoped?**: Different collections have different schemas. Merging fields from all collections into project-level dropdowns was confusing and semantically incorrect.

**Published Date Field:**

- **File Sorting**: Sidebar sorts files by configured date field(s)
- **Supports Multiple Fields**: Array like `["pubDate", "date", "publishedDate"]`
- **File List Display**: Shows formatted date under file titles
- **Collection-Specific**: Blog uses `publishDate`, docs use `date`

**Title Field:**

- **File List Display**: Uses configured field for file titles
- **Frontmatter Panel**: Renders with large, bold textarea
- **Fallback**: Uses filename if field empty
- **Collection-Specific**: Blog uses `title`, docs might use `heading`

**Description Field:**

- **Frontmatter Panel**: Renders with larger textarea
- **Collection-Specific**: Can differ between collections

**Draft Field:**

- **File List Indicators**: Shows "Draft" badge when field is `true`
- **Visual Styling**: Yellow background for drafts
- **Collection-Specific**: Some collections might use `published` (inverted logic)

### Implementation Details

**Settings Resolution with Collection Context:**

```typescript
// Get settings for specific collection (three-tier fallback)
const settings = useEffectiveSettings('blog')

// In file operations, use selected collection
const { selectedCollection } = useProjectStore()
const effectiveSettings = useEffectiveSettings(selectedCollection || undefined)

// Path override example with collection
const contentPath = getCollectionContentPath(
  projectPath,
  collectionName,
  projectSettings,
  collectionSettings
)
```

**Query Cache Invalidation:**

When settings change, affected queries are invalidated:

```typescript
// In settings update handlers
const invalidateQueriesAfterSettingsChange = () => {
  // Path changes: invalidate collection data
  queryClient.invalidateQueries({
    queryKey: queryKeys.collections(projectPath),
  })

  // Frontmatter changes: refetch current file
  if (currentFile) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.collectionFiles(projectPath, currentFile.collection),
    })
  }
}
```

**Backwards Compatibility:**

- If no overrides configured, uses default behavior
- Three-tier fallback: collection → project → hard-coded default
- All existing projects work without configuration
- No global defaults exist (removed in v2)

## Preferences Migration (v1 → v2)

The system includes automatic migration from v1 to v2 format:

### What Changed

**v1 Format Issues:**
- `global-settings.json` contained `defaultProjectSettings` (shouldn't be global)
- Individual project files had `metadata` section (duplicated from registry)
- No support for collection-specific settings

**v2 Format:**
- `global-settings.json` has NO project defaults (only truly global settings)
- Individual project files have NO metadata (single source of truth in registry)
- Project files include optional `collections` array for collection overrides

### Migration Process

**Automatic Detection:**
```typescript
// System checks version field in preferences files
if (globalSettings.version === 1 || !globalSettings.version) {
  // Trigger migration
  await migratePreferencesV1toV2(oldData)
}
```

**Migration Steps:**
1. **Global Settings**: Remove `defaultProjectSettings` field, update version to 2
2. **Project Files**: Remove `metadata` field, add empty `collections: []`, update version to 2
3. **Safety**: Write to `.bak` files first, then rename atomically
4. **Logging**: Log migration success/failure for debugging

**Fallback Behavior:**
- If migration fails, app falls back to hard-coded defaults
- User sees toast notification about migration
- Old files preserved as `.bak` for recovery

**Future Cleanup:**
After v2.5.0 when most users have upgraded, migration code will be removed entirely.

## Future Extensions

The system is designed to easily support:

- Project-specific themes/UI preferences
- Recent files per project
- Custom keybindings per project
- Project templates and defaults
- Workspace management
- Per-collection UI preferences (sorting, filtering, view modes)
