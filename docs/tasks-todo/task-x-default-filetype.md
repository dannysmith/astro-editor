# Task: Default File Type for New Files

## Overview

When creating a new file inside a collection, it's currently always a markdown (`.md`) file. This task adds a configurable default file type setting that allows users to choose between Markdown (`.md`) and MDX (`.mdx`) as the default extension for new files.

## Requirements

- Support both Markdown (`.md`) and MDX (`.mdx`) file types
- Use three-tier settings hierarchy (consistent with other settings):
  - **Global default**: Applies across all projects
  - **Project-level override**: Can override the global default for a specific project
  - **Collection-level override**: Can override the project/global default for a specific collection
- Fallback chain: Collection → Project → Global → Hard-coded default (`'md'`)

## Implementation Plan

### 1. Type Definitions

**File**: `src/lib/project-registry/types.ts`

Add `defaultFileType` to three interfaces:

```typescript
// Global settings
export interface GlobalSettings {
  general: {
    // ... existing fields
    defaultFileType: 'md' | 'mdx'  // Default: 'md'
  }
  // ... rest of interface
}

// Project settings
export interface ProjectSettings {
  // ... existing fields
  defaultFileType?: 'md' | 'mdx'  // Optional override
}

// Collection-specific settings
export interface CollectionSpecificSettings {
  // ... existing fields
  defaultFileType?: 'md' | 'mdx'  // Optional override
}
```

### 2. UI Components

**UI Component Choice**: ShadCN **ToggleGroup** with outline variant

**Rationale**:
- Creates a segmented control appearance (macOS-native feel)
- Perfect for binary choices (Markdown vs MDX)
- More visual and compact than dropdown or radio buttons
- Accessible with proper ARIA labels

**Visual appearance**:
```
┌─────────────┬─────────────┐
│  Markdown   │     MDX     │  ← One option highlighted
└─────────────┴─────────────┘
```

#### 2a. Global UI - GeneralPane

**File**: `src/components/preferences/panes/GeneralPane.tsx`

**Location**: Add to "General" section (SettingsSection titled "General")

**Implementation**:
```tsx
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// In GeneralPane component, in "General" section:
<Field>
  <FieldLabel>Default File Type</FieldLabel>
  <FieldContent>
    <ToggleGroup
      type="single"
      value={globalSettings?.general?.defaultFileType || 'md'}
      onValueChange={(value: 'md' | 'mdx') => {
        void updateGlobal({
          general: {
            // ... spread existing general settings
            defaultFileType: value,
          },
          appearance: globalSettings?.appearance || { /* defaults */ }
        })
      }}
    >
      <ToggleGroupItem value="md" aria-label="Markdown">
        Markdown
      </ToggleGroupItem>
      <ToggleGroupItem value="mdx" aria-label="MDX">
        MDX
      </ToggleGroupItem>
    </ToggleGroup>
    <FieldDescription>
      Default file extension for new files across all projects
    </FieldDescription>
  </FieldContent>
</Field>
```

#### 2b. Project UI - ProjectSettingsPane

**File**: `src/components/preferences/panes/ProjectSettingsPane.tsx`

**Location**: Add new section after "Path Overrides" or add to existing section

**Note**: Need to destructure `globalSettings` from `usePreferences()` hook (currently not destructured but available)

**Implementation**:
```tsx
// Update the usePreferences destructuring to include globalSettings:
const { currentProjectSettings, updateProject, projectName, globalSettings } = usePreferences()

// Add the field:
<Field>
  <FieldLabel>Default File Type</FieldLabel>
  <FieldContent>
    <ToggleGroup
      type="single"
      value={currentProjectSettings?.defaultFileType || 'inherited'}
      onValueChange={(value) => {
        void updateProject({
          ...currentProjectSettings,
          defaultFileType: value === 'inherited' ? undefined : (value as 'md' | 'mdx'),
        })
      }}
    >
      <ToggleGroupItem value="inherited" aria-label="Use global default">
        <span className="text-muted-foreground">
          Inherit ({globalSettings?.general?.defaultFileType || 'md'})
        </span>
      </ToggleGroupItem>
      <ToggleGroupItem value="md" aria-label="Markdown">
        Markdown
      </ToggleGroupItem>
      <ToggleGroupItem value="mdx" aria-label="MDX">
        MDX
      </ToggleGroupItem>
    </ToggleGroup>
    <FieldDescription>
      Override the global default file type for this project
    </FieldDescription>
  </FieldContent>
</Field>
```

#### 2c. Collection UI - CollectionSettingsPane

**File**: `src/components/preferences/panes/CollectionSettingsPane.tsx`

**Location**: Add as new field in each collection's settings (inside the Collapsible)

**Implementation**: Similar to project-level but shows project/global inheritance

**Handler function** (add alongside existing handlers):
```tsx
const handleDefaultFileTypeChange = (
  collectionName: string,
  value: 'md' | 'mdx' | undefined
) => {
  const existing = getCollectionOverride(collectionName)
  const newSettings: CollectionSettings = {
    name: collectionName,
    settings: {
      ...existing?.settings,
      defaultFileType: value,
    },
  }
  void updateCollectionSettings(collectionName, newSettings.settings)
}
```

**UI component** (add in collection's settings section):
```tsx
<Field>
  <FieldLabel>Default File Type</FieldLabel>
  <FieldContent>
    <ToggleGroup
      type="single"
      value={collectionOverride?.settings?.defaultFileType || 'inherited'}
      onValueChange={(value) => {
        handleDefaultFileTypeChange(
          collection.name,
          value === 'inherited' ? undefined : (value as 'md' | 'mdx')
        )
      }}
    >
      <ToggleGroupItem value="inherited" aria-label="Use project/global default">
        <span className="text-muted-foreground">
          Inherit ({effectiveSettings.defaultFileType || 'md'})
        </span>
      </ToggleGroupItem>
      <ToggleGroupItem value="md" aria-label="Markdown">
        Markdown
      </ToggleGroupItem>
      <ToggleGroupItem value="mdx" aria-label="MDX">
        MDX
      </ToggleGroupItem>
    </ToggleGroup>
    <FieldDescription>
      Override the default file type for this collection
    </FieldDescription>
  </FieldContent>
</Field>
```

### 3. Settings Resolution Logic

**File**: `src/lib/project-registry/default-file-type.ts` (new file)

**Function**: `getDefaultFileType()`

```typescript
/**
 * Resolves the default file type using three-tier fallback
 * Collection → Project → Global → Hard-coded default ('md')
 */
export const getDefaultFileType = (
  globalSettings: GlobalSettings | null,
  projectSettings: ProjectSettings | null,
  collectionName?: string
): 'md' | 'mdx' => {
  // Collection-level override
  if (collectionName && projectSettings?.collections) {
    const collectionSettings = projectSettings.collections.find(
      c => c.name === collectionName
    )
    if (collectionSettings?.settings?.defaultFileType) {
      return collectionSettings.settings.defaultFileType
    }
  }

  // Project-level override
  if (projectSettings?.defaultFileType) {
    return projectSettings.defaultFileType
  }

  // Global setting
  if (globalSettings?.general?.defaultFileType) {
    return globalSettings.general.defaultFileType
  }

  // Hard-coded default
  return 'md'
}
```

### 4. File Creation Logic

**File**: `src/hooks/useCreateFile.ts`

**Line 96**: Currently hardcodes `.md` extension

**Changes**:
```typescript
// Import the helper
import { getDefaultFileType } from '@/lib/project-registry/default-file-type'

// In createNewFile function, before line 96:
const { globalSettings, currentProjectSettings } = useProjectStore.getState()
const fileExtension = getDefaultFileType(
  globalSettings,
  currentProjectSettings,
  selectedCollection
)

// Replace line 96:
// OLD: let filename = `${today}.md`
// NEW:
let filename = `${today}.${fileExtension}`

// Line 116 also needs updating:
// OLD: filename = `${today}-${counter}.md`
// NEW:
filename = `${today}-${counter}.${fileExtension}`
```

### 5. User Guide Update

**File**: `docs/user-guide.md` (or appropriate user documentation)

**Section**: Add to preferences/settings section

**Content**:
```markdown
### Default File Type

Configure whether new files are created as Markdown (`.md`) or MDX (`.mdx`) files.

**Settings hierarchy**:
- **Global**: Default for all projects (Preferences → General)
- **Project**: Override for specific project (Preferences → Project Settings)
- **Collection**: Override for specific collection (Preferences → Collections)

Each level can override the level above it, giving you fine-grained control over file types.
```

## Testing Considerations

### Manual Testing Checklist

1. **Global default**:
   - Set global default to MDX
   - Create new file in any collection
   - Verify file has `.mdx` extension

2. **Project override**:
   - Set global to MD, project to MDX
   - Create file in project
   - Verify project setting takes precedence

3. **Collection override**:
   - Set global to MD, collection to MDX
   - Create file in that collection
   - Verify collection setting takes precedence

4. **Inheritance display**:
   - Verify "Inherit" option shows correct parent value
   - Verify changes to parent update child's inheritance display

5. **Backwards compatibility**:
   - Open project without defaultFileType setting
   - Verify defaults to 'md' (current behavior)

### Automated Testing

**Conclusion**: Minimal test changes needed

- `useCreateFile.ts` is a React hook with Tauri dependencies (hard to unit test)
- File creation is integration-level (Tauri command → filesystem)
- Existing tests likely don't assert on file extension specifically
- **Action**: Manual testing should be sufficient

If tests fail during implementation, update assertions to check for both `.md` and `.mdx` extensions, or parameterize tests based on settings.

## Implementation Checklist

- [ ] Update type definitions in `types.ts`
- [ ] Add ToggleGroup UI to GeneralPane
- [ ] Add ToggleGroup UI to ProjectSettingsPane
- [ ] Add ToggleGroup UI to CollectionSettingsPane
- [ ] Create `getDefaultFileType()` helper function
- [ ] Update `useCreateFile.ts` to use helper
- [ ] Update user guide documentation
- [ ] Manual testing (all scenarios above)
- [ ] Run `/check` to verify code quality

## Notes

- **Migration**: Not needed - missing settings will fall back to 'md' (current behavior)
- **Default value**: `'md'` at all levels maintains backwards compatibility
- **File type support**: Only MD and MDX (as specified in requirements)
- **UI consistency**: Follows established patterns (Direct Store Pattern, three-tier fallback)
