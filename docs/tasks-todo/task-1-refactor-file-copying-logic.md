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

## Critical Review & Analysis

### Approach Validation

After reviewing the actual implementations, the proposed approach is **sound and well-architected**. Key observations:

1. ✅ **Duplication confirmed**: Both paths have identical file copying logic (80+ lines)
2. ✅ **Behavioral difference is legitimate**: Editor needs "always copy" for article-specific assets, ImageField needs "conditional" for reusable assets
3. ✅ **Separation of concerns preserved**: Markdown formatting stays in editor, UI logic stays in component
4. ✅ **No Rust changes needed**: All Tauri commands (`copy_file_to_assets`, `is_path_in_project`, etc.) already exist

### Additional Considerations

**Error Handling Strategy:**
- Current code has different error behaviors:
  - Editor: Silent fallback to original path
  - ImageField: Toast notification
- **Recommendation**: Shared utility should throw errors; let callers handle UI feedback (follows architecture guide's separation of concerns)

**File Type Handling:**
- Both implementations handle images, but the code architecture supports any file type
- Shared utility should remain file-type agnostic
- Image-specific logic (validation, markdown image syntax) stays in callers

**Constants Consolidation:**
- `IMAGE_EXTENSIONS` format differs:
  - Editor: `['.png', '.jpg', ...]` (with dots)
  - ImageField: `['png', 'jpg', ...]` (without dots)
- **Recommendation**: Export both formats from shared module to avoid breaking changes

**Type Safety:**
- Need clear return types that preserve all necessary information
- Result should include: `relativePath`, `wasCopied`, original `filename`
- Consider whether to return errors or throw them (throwing is simpler and more idiomatic)

## Implementation Plan

### Phase 1: Create Shared Infrastructure (Low Risk)

**Goal:** Build new modules without touching existing code

#### Step 1.1: Create constants module

**File:** `src/lib/files/constants.ts`

```typescript
/**
 * Image file extensions supported by the editor
 * Exported in two formats for different use cases
 */
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

/** Image extensions with dot prefix for file extension matching */
export const IMAGE_EXTENSIONS_WITH_DOTS = IMAGE_EXTENSIONS.map(
  ext => `.${ext}`
) as readonly string[]

/** Type for image extension strings */
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number]
```

**Acceptance Criteria:**
- [ ] File created with both constant formats
- [ ] TypeScript types exported
- [ ] No breaking changes to existing code

#### Step 1.2: Create types module

**File:** `src/lib/files/types.ts`

```typescript
/**
 * Options for processing files to assets directory
 */
export interface ProcessFileToAssetsOptions {
  /** Path to the source file to process */
  sourcePath: string
  /** Path to the project root */
  projectPath: string
  /** Name of the collection (for collection-specific asset directory resolution) */
  collection: string
  /** Current project settings (for path overrides) */
  projectSettings?: ProjectSettings | null
  /**
   * Strategy for copying files:
   * - 'always': Always copy and rename (editor drag-and-drop)
   * - 'only-if-outside-project': Only copy if file is outside project (frontmatter fields)
   */
  copyStrategy: 'always' | 'only-if-outside-project'
}

/**
 * Result of processing a file to assets
 */
export interface ProcessFileToAssetsResult {
  /** Project-root-relative path with leading slash (e.g., '/src/assets/2024-01-15-image.png') */
  relativePath: string
  /** Whether the file was copied (true) or existing path was reused (false) */
  wasCopied: boolean
  /** Original filename (useful for markdown formatting) */
  filename: string
}
```

**Acceptance Criteria:**
- [ ] Types defined with comprehensive JSDoc
- [ ] Import `ProjectSettings` from correct location
- [ ] All fields documented with examples

#### Step 1.3: Create core processing function

**File:** `src/lib/files/fileProcessing.ts`

```typescript
import { invoke } from '@tauri-apps/api/core'
import { getEffectiveAssetsDirectory } from '../project-registry'
import { ASTRO_PATHS } from '../constants'
import type {
  ProcessFileToAssetsOptions,
  ProcessFileToAssetsResult,
} from './types'

/**
 * Process a file for use in Astro content
 *
 * Handles file copying with two strategies:
 * 1. 'always': Always copy to assets directory (for article-specific images)
 * 2. 'only-if-outside-project': Only copy if outside project (for reusable assets)
 *
 * @param options - Processing options
 * @returns Processing result with relative path and metadata
 * @throws Error if file processing fails
 */
export async function processFileToAssets(
  options: ProcessFileToAssetsOptions
): Promise<ProcessFileToAssetsResult> {
  const {
    sourcePath,
    projectPath,
    collection,
    projectSettings,
    copyStrategy,
  } = options

  // Extract filename for result
  const filename = extractFilename(sourcePath)

  // Determine if we need to copy the file
  let shouldCopy = copyStrategy === 'always'

  if (copyStrategy === 'only-if-outside-project') {
    const isInProject = await invoke<boolean>('is_path_in_project', {
      filePath: sourcePath,
      projectPath: projectPath,
    })
    shouldCopy = !isInProject
  }

  let relativePath: string
  let wasCopied: boolean

  if (shouldCopy) {
    // Copy file to assets directory
    const assetsDirectory = getEffectiveAssetsDirectory(
      projectSettings,
      collection
    )

    if (assetsDirectory !== ASTRO_PATHS.ASSETS_DIR) {
      // Use collection-specific or project-level override
      relativePath = await invoke<string>('copy_file_to_assets_with_override', {
        sourcePath: sourcePath,
        projectPath: projectPath,
        collection: collection,
        assetsDirectory: assetsDirectory,
      })
    } else {
      // Use default assets directory
      relativePath = await invoke<string>('copy_file_to_assets', {
        sourcePath: sourcePath,
        projectPath: projectPath,
        collection: collection,
      })
    }

    wasCopied = true
  } else {
    // File is already in project - reuse existing path
    relativePath = await invoke<string>('get_relative_path', {
      filePath: sourcePath,
      projectPath: projectPath,
    })
    wasCopied = false
  }

  // Normalize path to have leading slash
  const normalizedPath = relativePath.startsWith('/')
    ? relativePath
    : `/${relativePath}`

  return {
    relativePath: normalizedPath,
    wasCopied,
    filename,
  }
}

/**
 * Extract filename from a file path
 * @param filePath - Full file path
 * @returns Just the filename portion
 */
function extractFilename(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  return filename || filePath
}
```

**Acceptance Criteria:**
- [ ] Function implements both copy strategies
- [ ] Uses existing `getEffectiveAssetsDirectory` utility
- [ ] Calls correct Tauri commands
- [ ] Normalizes paths with leading `/`
- [ ] Throws errors on failure (no silent fallbacks)
- [ ] Includes `extractFilename` helper (private to module)

#### Step 1.4: Create barrel export

**File:** `src/lib/files/index.ts`

```typescript
export { processFileToAssets } from './fileProcessing'
export { IMAGE_EXTENSIONS, IMAGE_EXTENSIONS_WITH_DOTS } from './constants'
export type {
  ProcessFileToAssetsOptions,
  ProcessFileToAssetsResult,
  ImageExtension,
} from './types'
```

**Acceptance Criteria:**
- [ ] All public APIs exported
- [ ] Types exported for consumers
- [ ] Module is self-contained and testable

#### Step 1.5: Write comprehensive tests

**File:** `src/lib/files/fileProcessing.test.ts`

**Test Cases:**
1. ✅ **Always-copy strategy**: Copies file even if in project
2. ✅ **Only-if-outside-project strategy**: Copies file when outside project
3. ✅ **Only-if-outside-project strategy**: Reuses path when in project
4. ✅ **Path override handling**: Uses collection-specific override
5. ✅ **Path override handling**: Uses project-level override
6. ✅ **Path override handling**: Falls back to default
7. ✅ **Path normalization**: Adds leading slash when missing
8. ✅ **Path normalization**: Preserves leading slash when present
9. ✅ **Error handling**: Throws error when `is_path_in_project` fails
10. ✅ **Error handling**: Throws error when `copy_file_to_assets` fails
11. ✅ **Filename extraction**: Handles Unix paths
12. ✅ **Filename extraction**: Handles Windows paths

**Acceptance Criteria:**
- [ ] All test cases pass
- [ ] Mock Tauri `invoke` calls
- [ ] Test both copy strategies
- [ ] Test all path override scenarios
- [ ] Test error conditions
- [ ] Achieve >90% code coverage

**Validation Checkpoint:**
- [ ] Run `pnpm run test` - all new tests pass
- [ ] Run `pnpm run check:all` - no errors
- [ ] All Phase 1 files created and tested
- [ ] No changes to existing code yet

---

### Phase 2: Refactor Editor Drag-and-Drop (Medium Risk)

**Goal:** Replace editor's inline file processing with shared utility

#### Step 2.1: Update imports and remove duplicated code

**File:** `src/lib/editor/dragdrop/fileProcessing.ts`

**Changes:**
1. Remove `IMAGE_EXTENSIONS` constant (lines 10-19)
2. Import from shared module:
   ```typescript
   import {
     processFileToAssets,
     IMAGE_EXTENSIONS_WITH_DOTS,
   } from '../../files'
   ```
3. Update `isImageFile` to use `IMAGE_EXTENSIONS_WITH_DOTS`

**Acceptance Criteria:**
- [ ] Old constant removed
- [ ] New imports added
- [ ] `isImageFile` function updated
- [ ] No functionality changes yet

#### Step 2.2: Refactor `processDroppedFile` function

**Before (lines 77-131):**
```typescript
export const processDroppedFile = async (
  filePath: string,
  projectPath: string,
  collection: string
): Promise<ProcessedFile> => {
  // 50+ lines of inline file processing
}
```

**After:**
```typescript
export const processDroppedFile = async (
  filePath: string,
  projectPath: string,
  collection: string
): Promise<ProcessedFile> => {
  const filename = extractFilename(filePath)
  const isImage = isImageFile(filename)

  try {
    // Get current settings for asset directory resolution
    const { currentProjectSettings } = useProjectStore.getState()

    // Use shared utility with 'always' strategy
    const result = await processFileToAssets({
      sourcePath: filePath,
      projectPath,
      collection,
      projectSettings: currentProjectSettings,
      copyStrategy: 'always',
    })

    // Format as markdown (editor-specific concern)
    const markdownText = formatAsMarkdown(
      result.filename,
      result.relativePath,
      isImage
    )

    return {
      originalPath: filePath,
      filename,
      isImage,
      markdownText,
    }
  } catch {
    // Fallback to original path if processing fails (preserve existing behavior)
    const markdownText = formatAsMarkdown(filename, filePath, isImage)

    return {
      originalPath: filePath,
      filename,
      isImage,
      markdownText,
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Function uses `processFileToAssets` with `'always'` strategy
- [ ] Markdown formatting preserved (editor-specific)
- [ ] Error handling preserved (silent fallback)
- [ ] Return type unchanged (`ProcessedFile`)
- [ ] No breaking changes to callers

#### Step 2.3: Test editor drag-and-drop

**Manual Testing:**
1. Open a collection file
2. Drag an image from desktop into editor
3. Verify image is copied to assets directory with date prefix
4. Verify markdown is inserted correctly
5. Drag a file from within the project into editor
6. Verify file is copied (not reused) - this is the "always" strategy
7. Test with collection-specific asset directory override
8. Test error case: drag invalid file path

**Acceptance Criteria:**
- [ ] All manual tests pass
- [ ] Behavior unchanged from before refactor
- [ ] Files copied to correct asset directory
- [ ] Markdown formatted correctly
- [ ] Error handling works (fallback to original path)

**Validation Checkpoint:**
- [ ] Run `pnpm run test` - all tests pass
- [ ] Run `pnpm run check:all` - no errors
- [ ] Manual testing complete
- [ ] No regressions in editor drag-and-drop

---

### Phase 3: Refactor Frontmatter ImageField (Medium Risk)

**Goal:** Replace ImageField's inline file processing with shared utility

#### Step 3.1: Update imports and remove duplicated code

**File:** `src/components/frontmatter/fields/ImageField.tsx`

**Changes:**
1. Remove `IMAGE_EXTENSIONS` constant (lines 25-34)
2. Import from shared module:
   ```typescript
   import { IMAGE_EXTENSIONS, processFileToAssets } from '../../../lib/files'
   ```
3. Update `FileUploadButton` to use imported constant (line 237)

**Acceptance Criteria:**
- [ ] Old constant removed
- [ ] New imports added
- [ ] `FileUploadButton` uses imported constant
- [ ] No functionality changes yet

#### Step 3.2: Refactor `handleFileSelect` function

**Before (lines 52-129):**
```typescript
const handleFileSelect = async (filePath: string) => {
  // 75+ lines of inline file processing
}
```

**After:**
```typescript
const handleFileSelect = async (filePath: string) => {
  setIsLoading(true)

  const { projectPath, currentProjectSettings } = useProjectStore.getState()
  const { currentFile } = useEditorStore.getState()
  const collection = currentFile?.collection

  try {
    // Validate context
    if (!projectPath || !currentFile || !collection) {
      throw new Error('No project or collection context available')
    }

    // Use shared utility with 'only-if-outside-project' strategy
    const result = await processFileToAssets({
      sourcePath: filePath,
      projectPath,
      collection,
      projectSettings: currentProjectSettings,
      copyStrategy: 'only-if-outside-project',
    })

    // Update frontmatter with normalized path
    updateFrontmatterField(name, result.relativePath)
  } catch (error) {
    // Show error toast (component-specific UI concern)
    window.dispatchEvent(
      new CustomEvent('toast', {
        detail: {
          title: 'Failed to add image',
          description:
            error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        },
      })
    )
  } finally {
    setIsLoading(false)
  }
}
```

**Acceptance Criteria:**
- [ ] Function uses `processFileToAssets` with `'only-if-outside-project'` strategy
- [ ] Toast notification preserved (component-specific)
- [ ] Error handling preserved
- [ ] Loading state preserved
- [ ] No breaking changes to UI

#### Step 3.3: Test ImageField

**Manual Testing:**
1. Open a collection file with image field in schema
2. Upload an image from desktop (outside project)
3. Verify image is copied to assets directory
4. Verify frontmatter updated with correct path
5. Verify image preview loads
6. Upload an image from within project (e.g., existing asset)
7. Verify image is NOT copied (path reused) - this is the "conditional" strategy
8. Verify preview still loads
9. Test error case: upload invalid file
10. Verify error toast shows

**Acceptance Criteria:**
- [ ] All manual tests pass
- [ ] Files outside project are copied
- [ ] Files inside project reuse existing path
- [ ] Frontmatter updated correctly
- [ ] Image preview works
- [ ] Error toast displays on failure

**Validation Checkpoint:**
- [ ] Run `pnpm run test` - all tests pass
- [ ] Run `pnpm run check:all` - no errors
- [ ] Manual testing complete
- [ ] No regressions in ImageField

---

### Phase 4: Cleanup and Documentation (Low Risk)

**Goal:** Remove unused code, update documentation, validate everything

#### Step 4.1: Verify no unused code remains

**Check:**
- [ ] `IMAGE_EXTENSIONS` only exists in `src/lib/files/constants.ts`
- [ ] No duplicated file copying logic remains
- [ ] Both implementations use shared utility
- [ ] Helper functions (`extractFilename`) removed from original locations if now unused

**Acceptance Criteria:**
- [ ] Grep for `IMAGE_EXTENSIONS` - only in shared module and tests
- [ ] Grep for `copy_file_to_assets` - only in shared utility
- [ ] Grep for `is_path_in_project` - only in shared utility
- [ ] No dead code remains

#### Step 4.2: Run full test suite

```bash
pnpm run test:run
pnpm run check:all
```

**Acceptance Criteria:**
- [ ] All tests pass (unit + integration)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] No Clippy warnings (Rust)

#### Step 4.3: Update documentation

**Files to update:**

1. **This task file** (`docs/tasks-todo/task-1-refactor-file-copying-logic.md`)
   - Mark success criteria as complete
   - Add "Completed" date
   - Move to `docs/tasks-done/` if fully complete

2. **Architecture guide** (`docs/developer/architecture-guide.md`)
   - Add section on shared file processing utilities
   - Document `src/lib/files/` module structure
   - Add example of when to use `processFileToAssets`

**Acceptance Criteria:**
- [ ] Task file updated with completion status
- [ ] Architecture guide documents new pattern
- [ ] Code examples added to guide

#### Step 4.4: Final validation

**Full System Test:**
1. ✅ Editor drag-and-drop: Images from desktop
2. ✅ Editor drag-and-drop: Images from project
3. ✅ Editor drag-and-drop: Non-image files
4. ✅ Editor drag-and-drop: Collection with asset override
5. ✅ ImageField: Upload from desktop
6. ✅ ImageField: Upload from project
7. ✅ ImageField: Collection with asset override
8. ✅ Error cases: Invalid paths, no permissions

**Acceptance Criteria:**
- [ ] All behaviors match pre-refactor functionality
- [ ] No performance regressions
- [ ] Error handling works correctly
- [ ] Asset directories respected (default + overrides)

---

## Success Criteria (Updated)

After refactoring:

1. ✓ Both editor drag-and-drop and ImageField use shared `processFileToAssets` utility
2. ✓ Existing behavior preserved:
   - Editor: Always copies and renames (date-prefixed kebab-case)
   - ImageField: Only copies if outside project
3. ✓ All existing tests pass
4. ✓ New tests cover shared utility (>90% coverage)
5. ✓ Constants consolidated in `src/lib/files/constants.ts`
6. ✓ Documentation updated in architecture guide
7. ✓ No Rust backend changes required
8. ✓ Full quality gate passes: `pnpm run check:all`

## Risk Mitigation

**Risks identified:**
1. **Breaking drag-and-drop**: Mitigated by Phase 2 testing before Phase 3
2. **Breaking ImageField**: Mitigated by preserving exact behavior with `'only-if-outside-project'`
3. **Error handling changes**: Mitigated by preserving UI-specific error handling in callers
4. **Performance regression**: Mitigated by using same Tauri commands, no new overhead

**Rollback plan:**
- Each phase is independent and can be rolled back via git
- If Phase 2 fails validation, Phase 1 changes are harmless (unused code)
- If Phase 3 fails validation, Phase 2 can remain (partial improvement)

## Implementation Notes

**Estimated effort:** 3-4 hours
- Phase 1: 1.5 hours (infrastructure + tests)
- Phase 2: 0.5 hours (refactor editor)
- Phase 3: 0.5 hours (refactor ImageField)
- Phase 4: 1 hour (cleanup + docs + validation)

**Key principles to follow:**
- ✅ Read all files before editing (architecture guide)
- ✅ Test each phase before proceeding
- ✅ Preserve exact existing behavior
- ✅ Extract reusable logic, keep UI concerns separate
- ✅ Run `pnpm run check:all` after each phase
