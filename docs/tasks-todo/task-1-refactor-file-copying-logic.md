# Task: Refactor Duplicated File Copying and Processing Logic

https://github.com/dannysmith/astro-editor/issues/41

## Context

During implementation of image fields in frontmatter (see `docs/tasks-done/task-images-in-frontmatter.md`), we intentionally duplicated file processing logic to avoid complicating that branch. This has created **two separate code paths** for handling images/files that are dragged or selected, with different business rules and no shared abstractions.

## The Problem

### Current State: Two Divergent Implementations

**Location 1: Editor Drag-and-Drop** (`src/lib/editor/dragdrop/fileProcessing.ts`)

- **Always copies and renames files** to assets directory
- Uses date-prefixed kebab-case naming: `YYYY-MM-DD-filename.ext`
- Respects collection-specific and project-level asset directory overrides
- Handles filename conflicts with `-1`, `-2` suffixes
- Returns markdown-formatted strings for insertion into editor

**Location 2: Frontmatter Image Fields** (`src/components/frontmatter/fields/ImageField.tsx`)

- **Conditionally copies files** - only if outside project directory
- If file is already in project, uses existing path without copying/renaming
- Same date-prefixed kebab-case naming for copied files
- Same conflict resolution strategy
- Updates frontmatter field with project-root-relative path

### Business Logic Discrepancy

The key difference is **when to copy**:

- **Editor drag-and-drop**: Always copies, always renames (one-off images specific to article)
- **Frontmatter uploads**: Only copies if outside project (standard reusable assets like cover images)

This behavioral difference makes sense:

- Images dragged into content are typically article-specific and should be standardized
- Images uploaded to frontmatter fields (e.g., `cover`) are often reusable assets already in the project

### Code Duplication Analysis

**Shared logic across both paths:**

1. **Asset directory resolution** - `getEffectiveAssetsDirectory()` (already shared ✓)
2. **File copying to assets** - calls to `copy_file_to_assets` and `copy_file_to_assets_with_override` Tauri commands
3. **Path override handling** - same conditional logic for default vs. override paths
4. **Relative path formatting** - converting to project-root-relative format with leading `/`
5. **Error handling** - toast notifications for failures

**Duplicated constants:**

- `IMAGE_EXTENSIONS` array exists in both:
  - `src/lib/editor/dragdrop/fileProcessing.ts` (as const array with dots: `['.png', '.jpg', ...]`)
  - `src/components/frontmatter/fields/ImageField.tsx` (as plain array: `['png', 'jpg', ...]`)

**Not duplicated (unique to each path):**

- Markdown formatting (`formatAsMarkdown`) - editor-specific
- Position-based drop detection (`isDropWithinElement`) - editor-specific
- "Already in project" check - frontmatter-specific
- Preview thumbnail logic - frontmatter-specific

## Why This Matters

### Risks of Current Duplication

1. **Consistency Issues**: Changes to file processing logic (e.g., naming strategy, validation) must be made in two places
2. **Bug Risk**: Already one behavioral difference has emerged. More divergence likely if not refactored
3. **Testing Burden**: Same business logic must be tested twice
4. **Maintenance Overhead**: Understanding the system requires reading two implementations

### Evidence of Fragility

The task description in `task-images-in-frontmatter.md` explicitly noted this as technical debt:

> **Technical Debt Tracking**: File Processing Logic (Priority: Medium)
>
> - **Duplication**: Asset directory resolution, file copying, path formatting
> - **Risk if not refactored**: Changes to file processing logic must be made in two places

## Proposed Refactor

### High-Level Approach

Create a **shared file processing utility** that:

1. Encapsulates the core file copying and path resolution logic
2. Provides **configuration options** to handle both use cases (always-copy vs. conditional-copy)
3. Maintains separation of concerns (markdown formatting stays in editor, UI logic stays in components)

### Suggested Architecture

**New module**: `src/lib/files/imageProcessing.ts` (or `src/lib/files/assetProcessing.ts`)

**Core function signature:**

```typescript
interface ProcessImageOptions {
  sourcePath: string
  projectPath: string
  collection: string
  projectSettings?: ProjectSettings | null

  // Control copying behavior
  copyStrategy: 'always' | 'only-if-outside-project'
}

interface ProcessImageResult {
  relativePath: string // Project-root-relative path (with leading /)
  wasCopied: boolean // Whether file was copied or path reused
}

async function processImageToAssets(
  options: ProcessImageOptions
): Promise<ProcessImageResult>
```

**Usage in editor drag-and-drop:**

```typescript
const result = await processImageToAssets({
  sourcePath: filePath,
  projectPath,
  collection,
  projectSettings,
  copyStrategy: 'always', // Always copy and rename
})
// Then format as markdown: formatAsMarkdown(filename, result.relativePath, isImage)
```

**Usage in ImageField:**

```typescript
const result = await processImageToAssets({
  sourcePath: filePath,
  projectPath,
  collection,
  projectSettings,
  copyStrategy: 'only-if-outside-project', // Conditional copy
})
updateFrontmatterField(name, result.relativePath)
```

### Shared Constants

**New module**: `src/lib/files/constants.ts`

```typescript
export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
] as const

export const IMAGE_EXTENSIONS_WITH_DOTS = IMAGE_EXTENSIONS.map(ext => `.${ext}`)
```

### Implementation Steps (High-Level)

1. **Create shared module** with `processImageToAssets()` function
2. **Extract common logic**:
   - Asset directory resolution (already shared via `getEffectiveAssetsDirectory`)
   - "Is path in project" check (use `is_path_in_project` Tauri command)
   - "Get relative path" (use `get_relative_path` Tauri command)
   - File copying logic (call appropriate Tauri commands)
   - Path formatting (ensure leading `/`)
3. **Refactor editor drag-and-drop**:
   - Replace inline file processing with call to shared function
   - Keep markdown formatting separate (`formatAsMarkdown` remains in editor code)
4. **Refactor ImageField**:
   - Replace inline file processing with call to shared function
   - Keep UI-specific logic (state, toasts) in component
5. **Consolidate constants**:
   - Move `IMAGE_EXTENSIONS` to shared location
   - Update both locations to import from shared module
6. **Update tests**:
   - Test shared utility function comprehensively
   - Verify both use cases (always-copy vs. conditional-copy)
   - Keep existing integration tests for editor and ImageField

### Benefits of This Approach

1. **Single Source of Truth**: File copying logic lives in one place
2. **Configurable Behavior**: `copyStrategy` option preserves different behaviors for different contexts
3. **Easier Testing**: Core logic can be unit tested independently
4. **Maintainability**: Changes to file processing only need to happen once
5. **Discoverability**: Clear API makes it obvious what options are available

### Alternative Approaches Considered

**Option B: Separate functions for each use case**

```typescript
// Two separate functions with different behaviors
async function copyImageToAssetsForEditor(...)
async function copyImageToAssetsForFrontmatter(...)
```

**Rejected because**: Doesn't reduce duplication, just makes it explicit

**Option C: Single function with boolean flag**

```typescript
async function processImage(..., alwaysCopy: boolean)
```

**Rejected because**: Less clear than named strategy, harder to extend later

## Success Criteria

After refactoring:

1. ✓ Both editor drag-and-drop and ImageField use shared utility
2. ✓ Existing behavior is preserved (no regressions)
3. ✓ All existing tests pass
4. ✓ New tests cover shared utility function
5. ✓ Constants are consolidated and imported from single location
6. ✓ Documentation updated to reflect new architecture

## Related Files

**Files to modify:**

- `src/lib/editor/dragdrop/fileProcessing.ts` - refactor to use shared utility
- `src/components/frontmatter/fields/ImageField.tsx` - refactor to use shared utility
- `src/lib/files/` (new directory) - create shared modules

**Files to reference:**

- `src-tauri/src/commands/files.rs` - Tauri commands used by both paths
- `src/lib/project-registry/path-resolution.ts` - shared path resolution utilities

**Backend commands used:**

- `copy_file_to_assets` - basic file copy with date-prefixed naming
- `copy_file_to_assets_with_override` - file copy with custom assets directory
- `is_path_in_project` - check if file is already in project
- `get_relative_path` - get relative path from project root

## Notes

- This refactor should be done in a **separate branch** after the current image-fields work is merged
- The refactor does **not** require changes to Rust backend - all Tauri commands already exist
- The behavioral difference (always-copy vs. conditional-copy) should be **preserved**, not eliminated
- Consider this a **medium priority** improvement - not blocking, but valuable for maintainability
