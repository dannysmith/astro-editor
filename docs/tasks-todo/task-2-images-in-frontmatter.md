## Task: Support Astro image helper in content collections

We have recently implemented floating image previews in the editor - when holding alt and hovering over any image URL or path, a preview is displayed floating in the bottom right of the editor. See `docs/developer/image-preview-implementation.md` for details on this.

Astro supports images in content collections with a special `image()` helper. It is not possible to know about this from the generated JSON schemas because they show any image fields as a string (the path to the file). So we have to do this by reading `content.config.json` Similar way to how we do it for references. See here for the docs on images in content collections: https://docs.astro.build/en/guides/images/#images-in-content-collections

### Requirements

- I would like to update the parser to recognize when we have an astro image field and correctly pass that to the frontend in the merged schema.
- We should then render a shadcn `<Input type="file" />` in the sidebar instead of a text field. This should natively support drag/drop.
- When a file is dropped, it should be copied and renamed in exactly the same way as we currently do for images dragged into the editor. See `processDroppedFile()` in `src/lib/editor/dragdrop/fileProcessing.ts` and related files. It may be necessary to extract some of the renaming logic and copying logic into library functions which can be shared between these two things. I'll leave that up to you. This should respect any path overrides for the current project and collection, as you would expect. And it should obviously be aware of the current collection, again, in exactly the same way that we do with dragging and dropping.
- Make sure field data itself should be updated with the path to the new file and the preview displayed (see below).
- If the front matter of the document already has the path to the file, i.e. when we open the document there's already an image in the field, we should display a small preview of it just below the picker. We can probably use similar code to the folating image previews we recently implemented.
- We need to think about how we handle it where the front matter is already there because I'm not sure that we can put a string path into a file picker component. So we may need to display the component and maybe we need to have a button that when you press it, it actually uploads the file or copies it or something. We need to think about the best UI for making this simple.
- We want to keep this as clean and robust as possible. Because we did try this before, it got very complicated very quickly.

### Design Decisions

**UI Pattern**: Show current path as read-only text + small preview thumbnail, with file input always visible below (allows manual path editing AND file selection).

**Path Format**: Project-root relative paths (e.g., `/src/assets/articles/2024-01-01-image.png`) - consistent with current drag/drop behavior.

**Type System**: Add new `FieldType.Image` enum value (consistent with existing `Email` and `URL` types, clearer semantics, better long-term maintainability).

## Implementation Plan

### Phase 0: FileUpload Component (Prerequisite) ✓ TESTABLE

**Goal**: Create a reusable file upload component that works in Tauri (supports both dialog picker and drag/drop).

**Why First**:
- Native `<input type="file">` doesn't provide real paths in Tauri (browser security model)
- Need Tauri dialog plugin + drag/drop event handling
- Reusable component for any future file upload needs in the app

**Component Design**:

1. **Create FileUploadButton component** (`src/components/ui/file-upload-button.tsx`)
   - Renders as a shadcn `Button` (customizable via props)
   - Opens Tauri file picker dialog on click
   - Listens for drag/drop events on button element
   - Returns real file path via callback

   ```tsx
   interface FileUploadButtonProps {
     accept: string[]  // File extensions: ['png', 'jpg', 'jpeg']
     onFileSelect: (path: string) => void | Promise<void>
     disabled?: boolean
     children: React.ReactNode  // Button content
     className?: string
     variant?: ButtonProps['variant']
     size?: ButtonProps['size']
   }
   ```

2. **Implementation details**:
   - Use `open()` from `@tauri-apps/plugin-dialog` for file picker
   - Listen to `tauri://drag-drop` event (like existing editor drag/drop)
   - Validate dropped files match accepted extensions
   - Cleanup event listeners on unmount
   - Handle loading state during async operations
   - Error handling for dialog cancellation (user clicks cancel)

3. **Usage pattern**:
   ```tsx
   <FileUploadButton
     accept={['png', 'jpg', 'jpeg', 'gif', 'webp']}
     onFileSelect={async (path) => {
       // Do something with real file path
     }}
     disabled={isLoading}
   >
     Select Image
   </FileUploadButton>
   ```

**Testing Checkpoint**:
- Create test page/component that uses FileUploadButton
- Click button → verify dialog opens with correct file filters
- Select file → verify callback receives real file path
- Drag file onto button → verify callback receives real file path
- Drag wrong file type → verify rejected (no callback)
- Click cancel in dialog → verify no error, no callback

---

### Phase 1: Type Detection & Schema Flow ✓ TESTABLE

**Goal**: Get `image()` fields properly detected and typed through the entire schema pipeline.

**Backend Changes**:

1. **Update Rust FieldType enum** (`src-tauri/src/parser.rs:43-55`)
   - Add `Image` variant to `ZodFieldType` enum
   - Update `serialize_constraints()` to NOT serialize the transform hack for images

2. **Update Zod parser to detect image fields** (`src-tauri/src/parser.rs:634-690`)
   - In `parse_field_type_and_constraints()`, check for `image()` earlier (before treating as string)
   - When `normalized.contains("image()")`, return `ZodFieldType::Image` directly
   - Remove the transform constraint hack (lines 681-684)

3. **Update schema merger** (`src-tauri/src/schema_merger.rs`)
   - Add "image" case to `zod_type_to_field_type()` function (line 844)
   - **Refactor/extend `enhance_with_zod_references()`**:
     - Rename to `enhance_schema_from_zod()` (more general, handles references AND images AND future enhancements)
     - Parse Zod schema to extract BOTH reference collections AND image field types
     - Apply image types to schema fields (change field_type from "string" to "image" when Zod shows Image)
     - Keep existing reference enhancement logic
     - Update `extract_zod_references()` to also return image field names (or create parallel extraction)
   - Update function call site (line 206) to use new name

**Frontend Changes**:

4. **Update TypeScript FieldType enum** (`src/lib/schema.ts:47-60`)
   - Add `Image = 'image'` to the enum

5. **Update `fieldTypeFromString()`** (`src/lib/schema.ts:122-138`)
   - Add `image: FieldType.Image` mapping

**Testing Checkpoint**:
- Add temporary console logging in `FrontmatterPanel.tsx` to log schema fields: `console.log('Schema fields:', completeSchema?.fields)`
- Open test project with `cover: image().optional()` field in schema
- Check browser Console → verify `cover` field has `fieldType: 'image'` (not 'string')
- Verify constraints don't contain the transform hack
- Remove console logging after verification
- **Run Rust tests**: `cargo test` in `src-tauri/` - all existing tests should pass
- **Add test coverage** (details TBD in Phase 5):
  - Parser tests for `image()` detection
  - Schema merger tests for image type enhancement

---

### Phase 2: Basic ImageField Component ✓ TESTABLE

**Goal**: Render a basic image field that shows existing images and has file input structure.

**Component Creation**:

1. **Create ImageField component** (`src/components/frontmatter/fields/ImageField.tsx`)
   - Accept standard `FieldProps` interface
   - Use Direct Store Pattern (access `frontmatter` and `updateFrontmatterField` directly)
   - Render `FieldWrapper` with label, required, description, constraints

2. **Basic UI structure** (using FileUploadButton from Phase 0):
   ```tsx
   <FieldWrapper {...props}>
     {value && (
       <div className="mb-2 space-y-2">
         <div className="text-sm text-muted-foreground">{value}</div>
         <ImageThumbnail path={value} /> {/* Reuse preview logic */}
       </div>
     )}
     <FileUploadButton
       accept={['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']}
       onFileSelect={handleFileSelect}
       disabled={isLoading}
     >
       {value ? 'Change Image' : 'Select Image'}
     </FileUploadButton>
   </FieldWrapper>
   ```

   **Design notes**:
   - Use `FileUploadButton` from Phase 0 (handles dialog + drag/drop)
   - Use existing `FieldWrapper` pattern (same as other fields)
   - Match text styling patterns (e.g., `text-muted-foreground` for path display)
   - Button text changes based on whether image exists

3. **Create ImageThumbnail helper component** (`src/components/frontmatter/fields/ImageThumbnail.tsx`)
   - Reuse path resolution logic from `ImagePreview.tsx`
   - Show small fixed-size preview (e.g., 200px wide, max 150px high)
   - Handle loading/error states silently (like floating preview)

4. **Wire up to FrontmatterField router** (`src/components/frontmatter/fields/FrontmatterField.tsx:22-224`)
   - Add check for `FieldType.Image` before string field fallback
   - Render `<ImageField />` component

**Testing Checkpoint**:
- Open article with `cover` field already populated
- Verify path displays as text
- Verify thumbnail preview renders correctly below
- Verify "Change Image" button is visible
- Click button → verify dialog opens
- Open article without cover field
- Verify empty state shows "Select Image" button (no path/preview)
- Verify drag/drop onto button works (from Phase 0)

---

### Phase 3: File Processing Integration ✓ TESTABLE

**Goal**: Selecting a file copies it to assets and updates frontmatter.

**Logic Duplication** (to be refactored later):

1. **Duplicate file processing logic** in `ImageField.tsx`
   - Copy relevant logic from `processDroppedFile()`
   - Inline calls to `copy_file_to_assets_with_override` Tauri command
   - Handle path override logic (same as drag/drop)
   - Returns project-root-relative path
   - **⚠️ TECHNICAL DEBT**: Track for future refactoring (see Architecture Notes)

2. **DO NOT refactor drag/drop** at this stage
   - Keep existing working code unchanged
   - Reduces risk of breaking existing functionality

**ImageField File Handling**:

3. **Implement file selection handler** in `ImageField.tsx`:
   ```tsx
   const handleFileSelect = async (filePath: string) => {
     setIsLoading(true)

     const { currentProjectPath } = useProjectStore.getState()
     const { currentFile } = useEditorStore.getState()
     const collection = currentFile?.collection

     try {
       // Get effective assets directory (respects overrides)
       const { currentProjectSettings } = useProjectStore.getState()
       const assetsDirectory = getEffectiveAssetsDirectory(
         currentProjectSettings,
         collection
       )

       // Copy file to assets
       let relativePath: string
       if (assetsDirectory !== ASTRO_PATHS.ASSETS_DIR) {
         relativePath = await invoke('copy_file_to_assets_with_override', {
           sourcePath: filePath,
           projectPath: currentProjectPath,
           collection,
           assetsDirectory,
         })
       } else {
         relativePath = await invoke('copy_file_to_assets', {
           sourcePath: filePath,
           projectPath: currentProjectPath,
           collection,
         })
       }

       // Update frontmatter with project-root-relative path
       updateFrontmatterField(name, `/${relativePath}`)
     } catch (error) {
       // Show error toast
       window.dispatchEvent(new CustomEvent('toast', {
         detail: {
           title: 'Failed to add image',
           description: error.message,
           variant: 'error'
         }
       }))
     } finally {
       setIsLoading(false)
     }
   }
   ```

   **Note**: This duplicates logic from `processDroppedFile()` - tracked as technical debt.

4. **Add loading state**:
   - Show spinner/disable input during copy
   - Update preview immediately when complete

**Testing Checkpoint**:
- Select an image file via file picker
- Verify file appears in `/src/assets/{collection}/` with correct naming (YYYY-MM-DD-kebab-name.ext)
- Verify frontmatter updates with correct path
- Verify preview updates immediately
- Verify respects collection-specific asset directory overrides
- Test with file name conflicts (should add -1, -2, etc.)
- Test drag-and-drop onto editor still works correctly

---

### Phase 4: Polish & Edge Cases ✓ TESTABLE

**Goal**: Handle all edge cases and provide excellent UX.

**Clear Functionality**:

1. **Add Clear button** in ImageField:
   - Use `Button` component with `variant="ghost"` and `size="icon-sm"`
   - Use `X` icon from `lucide-react` (already used in project)
   - Position inline next to path text when value exists
   - Sets field to empty string or removes from frontmatter
   - Clears file input state

   **Design pattern** (following ReferenceField pattern):
   ```tsx
   <Button
     variant="ghost"
     size="icon-sm"
     onClick={handleClear}
     type="button"
   >
     <X className="size-3" />
   </Button>
   ```

**Manual Path Editing**:

2. **Add manual path input option**:
   - Small "Edit path manually" toggle/link
   - When active, show text input instead of file button
   - Allows users who already have images in place to set path
   - **Validate path exists**: Use existing `validate_project_path` (via read_file or similar command)
   - If path invalid or outside project → show error, don't update frontmatter

**Error Handling**:

3. **Comprehensive error handling**:
   - Invalid file type → Toast error
   - File copy failure → Toast error, revert frontmatter
   - Path resolution failure → Toast error
   - Use existing toast system (`window.dispatchEvent(new CustomEvent('toast', ...))`)

**Loading States**:

4. **Better loading UX**:
   - Disable input during processing
   - Use `Loader2Icon` from `lucide-react` for spinner (already used in project)
   - Show spinner inline near file input
   - Prevent multiple simultaneous uploads

   **Design pattern**:
   ```tsx
   {isLoading && <Loader2Icon className="size-4 animate-spin" />}
   ```

**Input Reset**:

5. **File input state management**:
   - Reset file input after successful copy (prevents re-triggering)
   - Clear input if user cancels selection

**Testing Checkpoint**:
- Test Clear button removes image and clears frontmatter
- Test manual path editing with valid path
- Test manual path editing with invalid path (should show error)
- Test file type validation (try uploading .txt → should error)
- Test error recovery (simulate copy failure)
- Test loading state appears during slow operations
- Test multiple rapid file selections (should handle gracefully)
- Test with optional vs required image fields
- Test with default values in schema

---

### Phase 5: Testing & Documentation

**Rust Test Coverage**:

1. **Add parser tests** (`src-tauri/src/parser.rs`):
   - Test parsing `image()` returns `ZodFieldType::Image`
   - Test parsing `image().optional()` marks as optional
   - Test serialization doesn't include transform hack
   - Follow existing test patterns in file

2. **Add schema merger tests** (`src-tauri/src/schema_merger.rs`):
   - Test `enhance_schema_from_zod()` applies image types correctly
   - Test both reference AND image enhancement in one pass
   - Test Zod-only parsing with image fields
   - Add tests following existing patterns

**Comprehensive Manual Testing**:

3. Test all field configurations:
   - `image()` (required)
   - `image().optional()`
   - `image().default('/some/path.jpg')`

4. Test edge cases:
   - Empty project (no assets directory yet)
   - Collection-specific asset overrides
   - Very long filenames
   - Unicode filenames
   - Images with no extension
   - Switching between files in same collection
   - Switching between collections

5. Test interactions:
   - Image field + editor drag/drop (should both work)
   - Multiple image fields in same schema
   - Nested objects containing image fields (if supported)
   - FileUploadButton used in other contexts (verify reusability)

**Documentation**:

6. Update architecture docs:
   - Add ImageField to field type documentation
   - Document image processing flow
   - Document FileUploadButton component and usage
   - Note technical debt in Architecture Notes (see below)

---

## Architecture Notes

**Why New FieldType.Image?**
- Consistent with existing `Email` and `URL` types (semantic clarity)
- Type-safe on both frontend and backend
- Cleaner than checking constraint hacks
- Better for future enhancements (different image types, validation, etc.)

**Simplicity Principles**:
- Direct Store Pattern (no form state layer)
- Immediate operations (no deferred/batched file operations)
- Reuse existing code (file copy, path resolution, image preview)
- Use existing shadcn components (`Input`, `Button`, `FieldWrapper`)
- Use existing lucide-react icons (`X`, `Loader2Icon`)
- Follow established design patterns (see ReferenceField for button patterns)
- Minimal custom styling (use shadcn defaults and existing utility classes)
- Silent failure for preview rendering (like floating preview)

**Shared Code**:
- `copyImageToAssets()` - Used by both ImageField and drag/drop
- `resolveImagePath()` - Already shared via Tauri command
- `ImageThumbnail` - Reusable preview component
- Asset protocol conversion - Already centralized

**Performance Considerations**:
- Use specific store selectors (only re-render on value change)
- Debounce preview rendering if needed
- Conditional preview loading (only when value exists)
- Clear refs/state on unmount

**Technical Debt Tracking**:

The following code duplications exist and should be refactored after Phase 4 is complete:

1. **File Processing Logic** (Priority: Medium)
   - **Location 1**: `src/lib/editor/dragdrop/fileProcessing.ts` - `processDroppedFile()`
   - **Location 2**: `src/components/frontmatter/fields/ImageField.tsx` - `handleFileSelect()`
   - **Duplication**: Asset directory resolution, file copying, path formatting
   - **Refactor Plan**: Extract to `src/lib/files/imageProcessing.ts` with:
     - `copyImageToAssets(filePath, projectPath, collection)` → returns relative path
     - Both locations consume this shared utility
   - **Risk if not refactored**: Changes to file processing logic must be made in two places

2. **Image Path Resolution** (Already shared ✓)
   - `resolve_image_path` Tauri command (Rust)
   - Used by both ImagePreview and ImageThumbnail
   - No action needed

3. **Image Extensions List** (Priority: Low)
   - **Location 1**: `src/lib/editor/dragdrop/fileProcessing.ts` - `IMAGE_EXTENSIONS`
   - **Location 2**: `ImageField.tsx` - hardcoded in `accept` prop
   - **Refactor Plan**: Export from shared constant file
   - **Risk if not refactored**: Adding new image format requires two updates
