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
   - Ensure JSON schema path can be enhanced with Image type from Zod (may need to check transform in `enhance_with_zod_references()`)

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

---

### Phase 2: Basic ImageField Component ✓ TESTABLE

**Goal**: Render a basic image field that shows existing images and has file input structure.

**Component Creation**:

1. **Create ImageField component** (`src/components/frontmatter/fields/ImageField.tsx`)
   - Accept standard `FieldProps` interface
   - Use Direct Store Pattern (access `frontmatter` and `updateFrontmatterField` directly)
   - Render `FieldWrapper` with label, required, description, constraints

2. **Basic UI structure** (using existing shadcn components):
   ```tsx
   <FieldWrapper {...props}>
     {value && (
       <div className="mb-2 space-y-2">
         <div className="text-sm text-muted-foreground">{value}</div>
         <ImageThumbnail path={value} /> {/* Reuse preview logic */}
       </div>
     )}
     <Input type="file" accept="image/*" onChange={handleFileChange} />
   </FieldWrapper>
   ```

   **Design notes**:
   - Use existing `Input` component from `@/components/ui/input`
   - Use existing `FieldWrapper` pattern (same as other fields)
   - Match text styling patterns (e.g., `text-muted-foreground` for path display)

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
- Verify file input is visible
- Open article without cover field
- Verify empty state shows only file input (no path/preview)

---

### Phase 3: File Processing Integration ✓ TESTABLE

**Goal**: Selecting a file copies it to assets and updates frontmatter.

**Shared Logic Extraction**:

1. **Create shared file processing utilities** (`src/lib/files/imageProcessing.ts`)
   - Extract `copyImageToAssets(filePath: string, projectPath: string, collection: string)`
   - Calls existing `copy_file_to_assets_with_override` Tauri command
   - Handles path override logic (reuse from `processDroppedFile`)
   - Returns project-root-relative path

2. **Refactor existing drag/drop** (`src/lib/editor/dragdrop/fileProcessing.ts`)
   - Update `processDroppedFile()` to use shared `copyImageToAssets()`
   - Maintain same behavior, reduce duplication

**ImageField File Handling**:

3. **Implement file selection handler** in `ImageField.tsx`:
   ```tsx
   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0]
     if (!file) return

     const projectPath = useProjectStore.getState().currentProjectPath
     const collection = useEditorStore.getState().currentFile?.collection

     try {
       const relativePath = await copyImageToAssets(
         file.path, // Tauri provides real path
         projectPath,
         collection
       )
       updateFrontmatterField(name, `/${relativePath}`)
     } catch (error) {
       // Show error toast
     }
   }
   ```

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
   - When active, show text input instead of file picker
   - Allows users who already have images in place to set path
   - Validate path exists before accepting

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

**Comprehensive Testing**:

1. Test all field configurations:
   - `image()` (required)
   - `image().optional()`
   - `image().default('/some/path.jpg')`

2. Test edge cases:
   - Empty project (no assets directory yet)
   - Collection-specific asset overrides
   - Very long filenames
   - Unicode filenames
   - Images with no extension
   - Switching between files in same collection
   - Switching between collections

3. Test interactions:
   - Image field + editor drag/drop (should both work)
   - Multiple image fields in same schema
   - Nested objects containing image fields (if supported)

**Documentation**:

4. Update architecture docs:
   - Add ImageField to field type documentation
   - Document image processing flow
   - Note shared utilities location

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
