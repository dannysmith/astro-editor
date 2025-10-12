# Task: Support Image fields in Frontmatter Sidebar

## Plan Updates (2025-01-12)

**CRITICAL CHANGES:**
1. **Added Phase 1.0**: Mandatory path format verification before implementation
2. **Fixed duplicate step numbering**: Phase 1 steps now correctly numbered 1.0 through 1.7
3. **Added detailed implementation**: Step 1.2 now includes full `extract_zod_field_data()` implementation
4. **Added path conversion utility**: Step 1.7 expanded with `toRelativePath()` and `convertPathForAstro()`
5. **Updated risk assessment**: Added Risk 0 for path format compatibility (MEDIUM - requires verification)
6. **Clarified Astro path support**: Updated section with warning about verification requirement

**Key Decision**: Path format verification is now MANDATORY before implementing UI components to avoid potential rework.

---

## Executive Summary

Implement support for Astro's `image()` helper function in content collection schemas, rendering an image picker component in the frontmatter panel with drag-and-drop support and automatic file management.

## Background

Astro provides a special `image()` helper function for content collections that validates image paths and provides image metadata (width, height, format). Currently, the editor treats these fields as regular strings. We need to detect these fields and provide a specialized UI for image selection and management.

### Example Schema
```ts
import { defineCollection, z } from 'astro:content'

const blogCollection = defineCollection({
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      cover: image(),
      coverAlt: z.string(),
    }),
})

export const collections = {
  blog: blogCollection,
}
```

### Example Frontmatter (Various Valid Formats)
```yaml
---
title: My Blog Post
cover: ./cover-image.jpg                    # Relative to markdown file
# OR
cover: ../../assets/blog/cover-image.jpg    # Relative path up and over
# OR
cover: src/assets/blog/cover-image.jpg      # Project-relative (what we'll write)
coverAlt: A beautiful sunset
---
```

## Architecture Analysis

### Current System Understanding

**Schema System** (Two-tier merging in Rust):
- **Astro JSON schemas** (`.astro/collections/*.schema.json`) - Comprehensive type information, constraints, defaults
- **Zod schemas** (`src/content/config.ts`) - Reference information, parsed via regex in `parser.rs`
- **Merging** happens in `schema_merger.rs:184-228` via `create_complete_schema()`
- **Result** serialized and sent to frontend as `complete_schema` field

**Existing Image Detection** (IMPORTANT):
- `parser.rs:681-686` **already detects** `image()` helper
- Sets `constraints.transform = Some("astro-image".to_string())`
- This metadata is serialized to JSON and sent to frontend

**Field Rendering System**:
- `FrontmatterField.tsx` - Orchestrator component routing to specific field types
- Uses Direct Store Pattern (no React Hook Form)
- All fields use `FieldWrapper` for consistent layout
- Current types: String, Textarea, Number, Boolean, Date, Enum, Array, Reference, Yaml

**File Handling Infrastructure** (Already exists):
- `copy_file_to_assets` and `copy_file_to_assets_with_override` Tauri commands
- Located in `src-tauri/src/commands/files.rs:134-224`
- Returns path like: `src/assets/blog/2025-01-15-image.png` (no leading slash)
- Handles file copying with date prefixes, conflict resolution, kebab-casing
- Respects collection-specific assets directories
- Validates paths to prevent traversal attacks
- `src/lib/editor/dragdrop/` - Drag-and-drop processing system
- `isImageFile()` validates image extensions (png, jpg, jpeg, gif, webp, svg, bmp, ico)

**Existing Drag-and-Drop Behavior** (We'll follow the same pattern):
- Editor drag-and-drop copies files to assets directory
- Returns paths like `src/assets/blog/2025-01-15-image.png` (no leading slash)
- For markdown content: wraps in `![alt](/src/assets/blog/...)` (adds leading slash)
- For frontmatter: we'll store the raw path without leading slash

## Astro Image Path Verification

**How Astro's `image()` Helper Works:**
- According to Astro docs, `image()` accepts **relative paths** like `./cover-image.jpg`
- Paths are resolved **relative to the markdown file location**
- Example: `cover: "./cover.jpg"` in `src/content/blog/post.md` resolves to `src/content/blog/cover.jpg`
- The `image()` helper validates paths at build time and provides image metadata

**⚠️ CRITICAL - PATH FORMAT VERIFICATION REQUIRED:**
- Astro documentation **primarily shows relative paths** with `./` prefix
- **Project-relative path support needs verification** (e.g., `src/assets/blog/cover.jpg`)
- This will be tested in **Phase 1.0** before implementing UI components
- If project-relative paths are not supported, we'll need to convert paths to relative format

**Our Strategy:**
- **Reading/Preview**: Display whatever path is in frontmatter
  - Relative paths (`./ ../`): Resolve relative to markdown file
  - Project-relative paths: Resolve from project root
  - Use Tauri's `convertFileSrc()` to load images in webview
- **Writing**: When user selects new image:
  - Use `copy_file_to_assets_with_override` (same as editor drag-and-drop)
  - Store returned path with format determined by verification results:
    - If Astro accepts project-relative: `src/assets/blog/2025-01-15-image.png` (no leading slash)
    - If only relative paths work: convert to `../../assets/blog/2025-01-15-image.png`
  - Consistent with what Astro actually accepts

**Path conversion utility** - Will implement in Phase 1 for safety:
1. Display whatever is there (flexible preview)
2. Write format that Astro accepts (determined by testing)
3. Convert between formats if needed

## Requirements

### Functional Requirements

1. **Image Field Detection**
   - Detect `image()` fields via `constraints?.transform === "astro-image"` (already done in parser.rs)
   - Add `Image` to `FieldType` enum in TypeScript
   - Map fields with astro-image transform to Image type

2. **Image Field Component**
   - Display current image path if set (as text)
   - Show preview thumbnail (100x100px max) if image exists and can be loaded
   - "Choose Image" button to open native file picker
   - Drag-and-drop support for image files
   - Clear/remove button for selected images
   - Show validation state (valid, missing, broken)
   - Loading state during file operations
   - Handle broken/missing images gracefully (show path, no preview)

3. **File Handling Logic**
   - When user selects new image (picker or drag-and-drop):
     - Call `copy_file_to_assets_with_override` with project path and collection
     - Store returned path in frontmatter exactly as returned
     - Same behavior as editor drag-and-drop
   - For preview:
     - Resolve path (relative to markdown file OR project root)
     - Load image from disk at resolved absolute path

4. **Validation**
   - Accept only valid image extensions (use existing `IMAGE_EXTENSIONS`)
   - Show error toast for invalid file types
   - Validate file exists before showing preview (graceful fallback if missing)
   - No schema validation needed (Astro validates at build time)

5. **User Experience**
   - Small image preview (100x100px max, maintain aspect ratio, rounded corners)
   - Loading state during file copy operations
   - Clear feedback on file selection and copying
   - Error handling with user-friendly messages
   - Show file size if large (>5MB)
   - Handle multiple dropped files (use first, show warning toast)
   - Full accessibility (keyboard navigation, ARIA, screen reader)

### Non-Functional Requirements

1. **Performance**: File operations async, don't block UI
2. **Consistency**: Follow existing Direct Store Pattern
3. **Accessibility**: Proper ARIA labels, keyboard navigation, focus management
4. **Error Handling**: Graceful degradation on failures
5. **Compatibility**: Match editor drag-and-drop behavior exactly

## Implementation Plan

### Phase 1: Schema & Type System Updates

**CRITICAL DISCOVERY FROM DEBUGGING SESSION (2025-01-12):**

The schema system has a **two-tier architecture**:
1. **JSON Schema** (from `.astro/collections/*.schema.json`) - provides structure, types, constraints
2. **Zod Schema** (from `parser.rs`) - provides additional metadata like:
   - `referencedCollection` / `arrayReferenceCollection` (for reference fields)
   - `transform: "astro-image"` (for image fields)
   - Other Zod-specific metadata

**The Problem:** When both exist, `schema_merger.rs` uses JSON schema as the base and ONLY merges reference collection names from Zod via `enhance_with_zod_references()`. Other Zod metadata like `transform` is silently dropped!

**The Solution:** Rename and expand `enhance_with_zod_references()` to `enhance_with_zod_metadata()` to merge ALL Zod-specific metadata (references AND transforms) from Zod schema into JSON schema fields.

---

**1.0 Verify Astro Path Format Support** ⚠️ CRITICAL - DO THIS FIRST
- Test both path formats in the dummy Astro project at `test/dummy-astro-project/`
- Test 1: Add `cover: "src/assets/blog/test.jpg"` (project-relative, no leading slash)
- Test 2: Add `cover: "./test.jpg"` (relative with ./ prefix)
- Run `npm run build` in the Astro project
- **Expected**: At least one format should work without errors
- **If both work**: Proceed with project-relative paths (simpler)
- **If only relative works**: Update `image-path.ts` to include path conversion utility
- **Success Criteria**: Determine which path format(s) Astro's `image()` helper accepts
- Files: Test in `test/dummy-astro-project/`
- **Do not proceed to Phase 1.1+ until this is verified**

**1.1 Update Rust FieldConstraints in schema_merger.rs
- **CRITICAL**: Add `transform: Option<String>` to `FieldConstraints` struct in `src-tauri/src/schema_merger.rs` (around lines 54-69)
  - This is the struct that gets serialized to JSON and sent to frontend
  - Without this field, the `transform` data is silently dropped during deserialization
  - Add with `#[serde(skip_serializing_if = "Option::is_none")]` annotation
- Update `extract_constraints()` function to initialize `transform: None`
- Update the constraint check at the end of `extract_constraints()` to include `|| constraints.transform.is_some()`
- Files: `src-tauri/src/schema_merger.rs`

**1.2 Fix Schema Merging to Include Transform
- **CRITICAL**: Modify `enhance_with_zod_references()` in `schema_merger.rs` to merge `transform` constraints, not just references
- Create new struct `ZodFieldData` with both `reference_collection` and `transform` fields:
  ```rust
  struct ZodFieldData {
      reference_collection: Option<String>,
      transform: Option<String>,
  }
  ```
- Rename/refactor `extract_zod_references()` → `extract_zod_field_data()` to extract BOTH:
  - Reference collection names (existing logic from `referencedCollection` and `arrayReferenceCollection`)
  - Transform constraints (NEW: extract from `constraints.transform` in Zod JSON)
  - Return `IndexMap<String, ZodFieldData>` instead of `IndexMap<String, String>`
- Implementation for `extract_zod_field_data()`:
  ```rust
  fn extract_zod_field_data(zod_schema: &str) -> Result<IndexMap<String, ZodFieldData>, String> {
      // Parse Zod schema JSON
      let schema: ZodSchema = serde_json::from_str(zod_schema)?;
      let mut field_data_map = IndexMap::new();

      for field in schema.fields {
          let mut zod_data = ZodFieldData {
              reference_collection: None,
              transform: None,
          };

          // Extract reference collection (existing logic)
          if let Some(collection) = field.referenced_collection {
              zod_data.reference_collection = Some(collection);
          } else if let Some(collection) = field.array_reference_collection {
              zod_data.reference_collection = Some(collection);
          }

          // Extract transform from constraints (NEW)
          if let Some(constraints_value) = &field.constraints {
              if let Some(obj) = constraints_value.as_object() {
                  if let Some(transform_value) = obj.get("transform") {
                      if let Some(transform_str) = transform_value.as_str() {
                          zod_data.transform = Some(transform_str.to_string());
                      }
                  }
              }
          }

          // Only add if we have data
          if zod_data.reference_collection.is_some() || zod_data.transform.is_some() {
              field_data_map.insert(field.name.clone(), zod_data);
          }
      }

      Ok(field_data_map)
  }
  ```
- Update `enhance_with_zod_references()` to:
  1. Call `extract_zod_field_data()` instead of `extract_zod_references()`
  2. For each field, merge both reference collection AND transform
  3. If field has no constraints but Zod has transform, create new `FieldConstraints` with transform
  4. If field has constraints, set `constraints.transform = Some(transform)`
- Files: `src-tauri/src/schema_merger.rs`

**1.3 Update Zod-Only Path
- Locate `parse_zod_constraints()` function in `schema_merger.rs` (around line 860)
- Add transform extraction after other constraint extractions:
  ```rust
  transform: obj.get("transform").and_then(|v| v.as_str()).map(String::from),
  ```
- Update the constraint check at the end of the function to include `|| result.transform.is_some()`
- Files: `src-tauri/src/schema_merger.rs`

**1.4 Update TypeScript Schema Types
- Add `transform?: string` to `FieldConstraints` interface in `src/lib/schema.ts` (around line 44)
- Add `Image = 'image'` to `FieldType` enum (around line 58)
- Add `'image'` mapping to `fieldTypeFromString()` function (around line 123):
  ```typescript
  image: FieldType.Image,
  ```
- Files: `src/lib/schema.ts`

**1.5 Verify Parser Detection
- Confirm `parser.rs:681-686` still sets `constraints.transform = "astro-image"`
- This should already be working (confirmed in debugging session and code review)
- No changes needed - read-only verification
- Files: `src-tauri/src/parser.rs` (read-only verification)

**1.6 Update Field Type Mapping
- Modify `FrontmatterField.tsx` to check for `constraints?.transform === 'astro-image'`
- Add new condition before the default string field case:
  ```typescript
  // Handle image fields (detected via transform constraint)
  if (field?.constraints?.transform === 'astro-image') {
    return (
      <ImageField
        name={name}
        label={label}
        required={required}
        field={field}
      />
    )
  }
  ```
- Ensure backward compatibility (if no ImageField, fall back to StringField)
- Files: `src/components/frontmatter/fields/FrontmatterField.tsx`

**1.7 Create Path Resolution and Conversion Utility
- Create `src/lib/image-path.ts` module
- `resolveImagePath(imagePath: string, markdownFilePath: string, projectPath: string): string`
  - If path starts with `.` or `..`: resolve relative to markdown file using Node path.resolve()
  - Otherwise: resolve relative to project root
  - Return absolute path for use with Tauri's `convertFileSrc()`
- `getImageSrc(imagePath: string, markdownFilePath: string, projectPath: string): string`
  - Calls resolveImagePath() to get absolute path
  - Calls convertFileSrc() to get asset:// URL for img src
  - Returns URL string ready for <img src={...}>
- `toRelativePath(imagePath: string, markdownFilePath: string): string` (NEW - based on Phase 1.0 results)
  - Convert project-relative path to markdown-relative path if needed
  - Example: "src/assets/blog/image.jpg" → "../../assets/blog/image.jpg"
  - Only implement if Phase 1.0 testing shows relative paths are required
  - Uses Node path.relative() to compute the relative path
- `convertPathForAstro(imagePath: string, markdownFilePath: string): string`
  - Wrapper that applies path conversion based on Phase 1.0 verification results
  - If project-relative works: return path as-is
  - If only relative works: call toRelativePath()
- Import `convertFileSrc` from `@tauri-apps/api/core`
- Handle edge cases (missing files, spaces in filenames)
- Files: `src/lib/image-path.ts`

**Testing for Phase 1** (CRITICAL):
- **Must use the dummy Astro project** at `test/dummy-astro-project/` which has BOTH:
  - Zod schema in `src/content.config.ts` with `image()` helper
  - JSON schema in `.astro/collections/articles.schema.json`
- This combination triggers the bug if schema merger isn't fixed
- Open an article, check browser console for schema data
- **Success criteria**: `field.constraints.transform === "astro-image"` for cover field
- Add debug logging temporarily to `FrontmatterField.tsx`:
  ```typescript
  if (name === 'cover') {
    console.log('Cover field:', { constraints: field?.constraints })
  }
  ```
- If `constraints` is `undefined` or doesn't have `transform`, Phase 1.1-1.3 are incomplete

### Phase 2: ImageField Component

**2.1 Create ImageField Component Structure
- Location: `src/components/frontmatter/fields/ImageField.tsx`
- Props: `name`, `label`, `required`, `field` (schema metadata)
- Use Direct Store Pattern (`useEditorStore`)
- Use `FieldWrapper` for consistent layout
- Component structure:
  - Hidden native file input (triggered by button)
  - "Choose Image" button
  - Current path display (small text)
  - Clear button (X icon) when image is set
  - Preview area (100x100px, rounded) with loading/error states
  - Drag-and-drop zone overlay on hover

**2.2 Implement File Selection & Copy Logic
- Handle file input change event
- Validate file type using `isImageFile()`
- Check file size, warn if >5MB (toast notification)
- Get project path and collection from stores
- Call `copy_file_to_assets_with_override` Tauri command
- On success: update frontmatter with returned path (exactly as returned)
- Error handling with toast notifications
- Loading state during async operation
- Files: `ImageField.tsx`

**2.3 Add Drag-and-Drop Support**
- Add dragover/dragleave/drop event handlers
- Highlight drop zone on dragover (border or background change)
- Handle dropped files (validate type, use first if multiple)
- Show warning toast if multiple files dropped
- Use same copy logic as file picker (call same function)
- Prevent event propagation to avoid conflict with editor drag-and-drop
- Files: `ImageField.tsx`

**2.4 Implement Image Preview
- Read current image path from frontmatter
- Use `getImageSrc()` utility to convert path to asset:// URL
  - Handles both relative and project-relative paths
  - Uses Tauri's `convertFileSrc()` to create proper asset:// URL
- Check if file exists (Tauri filesystem check or handle img onerror)
- If exists and valid:
  - Load image via asset:// URL in <img src={assetUrl}>
  - Show 100x100px thumbnail (object-fit: cover, rounded corners)
  - Loading state while image loads
- If missing or broken:
  - Handle <img> onerror event
  - Show filename/path as text
  - Show "missing" indicator or icon
  - No error state, just graceful fallback
- Files: `ImageField.tsx`, `src/lib/image-path.ts`

**2.5 Accessibility Implementation
- ARIA labels for button ("Choose image for [field name]")
- Hidden file input properly associated with button
- Keyboard navigation (Tab to button, Enter/Space to activate)
- Focus management (return focus after file dialog)
- Screen reader announcements for state changes ("Image selected", "Image removed")
- Alt text for preview images
- Clear button keyboard accessible (Tab + Enter)
- Files: `ImageField.tsx`

**Testing for Phase 2**:
- Test file picker with various image types (png, jpg, webp, svg)
- Test drag-and-drop from Finder/Explorer
- Test with images already in project (existing paths)
- Test clear functionality
- Test loading states
- Test with missing/broken image paths (graceful fallback)
- Test error scenarios (invalid files, permission errors)
- Test keyboard navigation (no mouse)
- Test screen reader experience
- Test with large files (>5MB warning)
- Test with multiple dropped files (warning, use first)

### Phase 3: Integration & Edge Cases

**3.1 Update FrontmatterField Orchestrator
- Add case for `constraints?.transform === 'astro-image'` in `FrontmatterField.tsx`
- Render `<ImageField>` component
- Import and export from fields index
- Files: `src/components/frontmatter/fields/FrontmatterField.tsx`, `src/components/frontmatter/fields/index.ts`

**3.2 Handle Edge Cases**
- Image field in nested objects (use dotted path name like other fields)
- Missing assets directory (created by Tauri command)
- Very large images (warn but allow)
- Network paths or symlinks (path resolution)
- Spaces and special characters in filenames (already handled by copy command)
- Array of images field (show YAML fallback or helpful message - out of scope)
- Empty/null values (show empty state with "Choose Image" button)
- Files: `ImageField.tsx`, `FrontmatterField.tsx`

**3.3 Prevent Drag-and-Drop Conflicts
- Use `event.stopPropagation()` on ImageField drag events
- Ensure editor drag-and-drop not triggered when dropping on image field
- Test both systems work independently
- Clear visual feedback (which drop zone is active)
- Files: `ImageField.tsx`

**Testing for Phase 3**:
- Test with various collection configurations
- Test with different assets directory settings (collection-specific, project override)
- Test with subdirectory collections
- Test end-to-end: select image → save → reload → preview still shows
- Test that editor drag-and-drop still works (no conflicts)
- Test nested field paths (rare but should work)
- Test with relative paths already in frontmatter (preview works)
- Test with project-relative paths (preview works)

### Phase 4: Polish & Documentation

**4.1 UI Polish**
- Refine button and preview styles (match other fields)
- Proper spacing and alignment with FieldWrapper
- Smooth transitions (fade in for preview, highlight for drop zone)
- Hover states for button and clear button
- Test in both light and dark modes
- Ensure macOS native feel (system fonts, colors)
- Drop zone visual feedback (border highlight, background tint)
- Files: `ImageField.tsx`

**4.2 Error Handling & User Feedback
- Meaningful error messages with toast notifications:
  - "Invalid file type. Please select an image (PNG, JPG, WebP, etc.)"
  - "File is large ([X]MB). Astro will optimize it during build."
  - "Permission denied. Please check file access."
  - "Failed to copy image. Please try again."
  - "Multiple files dropped. Using first image only."
- Loading states: "Copying image..." (subtle spinner or progress)
- Graceful degradation: if preview fails, show path as text
- Success feedback: brief "Image updated" confirmation (optional)
- Files: `ImageField.tsx`

**4.3 Update Documentation
- Document ImageField in `docs/developer/architecture-guide.md`
- Add to Field Components section
- Note Direct Store Pattern usage
- Document path handling strategy (read any format, write project-relative)
- Note that behavior matches editor drag-and-drop
- Files: `docs/developer/architecture-guide.md`

**Testing for Phase 4**:
- Final manual testing of all scenarios
- Verify error messages are helpful and actionable
- Test visual polish in both themes
- Check documentation accuracy and completeness
- User acceptance testing (if possible)

## Acceptance Criteria

### Must Have
- [ ] Image fields detected from Astro schemas (`constraints.transform === "astro-image"`)
- [ ] ImageField component renders in frontmatter panel
- [ ] File picker works, accepts only valid image files
- [ ] Images copied to correct assets directory (same as editor drag-and-drop)
- [ ] Paths stored as returned from copy command (project-relative, no leading slash)
- [ ] Preview shows valid images (resolves any path format)
- [ ] Preview gracefully handles missing/broken images (shows path, no crash)
- [ ] Clear button removes image reference
- [ ] Drag-and-drop works for external images
- [ ] Loading states during file copy
- [ ] Error handling with helpful toast messages
- [ ] Keyboard navigation fully functional
- [ ] Screen reader accessible
- [ ] No conflicts with editor drag-and-drop

### Nice to Have
- [ ] Smooth transitions and animations
- [ ] Visual feedback for drag-over state
- [ ] File size display for large images
- [ ] Warning toast for >5MB files
- [ ] Success confirmation when image updated

### Out of Scope
- Image editing or cropping
- Image optimization (Astro handles this)
- Multiple image selection (single field = single image)
- Array of images support (use YAML field)
- Image galleries or carousels
- URL-based remote images
- Custom preview sizes or configurations
- Validation of path format (accept any format for preview)

## Technical Risks & Mitigations

### Risk 0: Astro Path Format Compatibility (MEDIUM - REQUIRES VERIFICATION)
**Risk**: Astro's `image()` helper may not accept project-relative paths without `./` prefix
**Impact**: Images won't work in Astro builds, even though editor shows them correctly
**Mitigation**:
- **Phase 1.0 verification step is MANDATORY** - test actual path formats before implementing UI
- If project-relative paths don't work, implement `toRelativePath()` conversion utility
- Path conversion is straightforward: compute relative path from markdown file to image
- Low implementation risk, but critical to verify early to avoid rework
- **Detection**: Run `npm run build` in dummy Astro project with test images
- **Fix time**: ~30 minutes to add path conversion if needed

### Risk 1: Asset Protocol Configuration (LOW)
**Risk**: Tauri's asset protocol might not be enabled or properly configured
**Impact**: Images won't load in preview (security restriction)
**Mitigation**:
- Check `tauri.conf.json` for `assetProtocol` configuration
- If images don't load, add to `app.security`:
  ```json
  "assetProtocol": {
    "enable": true,
    "scope": ["$HOME/**"]
  }
  ```
- May also need to add `"asset:"` to CSP in `app.security.csp`
- Easy to fix if encountered during testing

### Risk 2: Image Preview Path Resolution (LOW)
**Risk**: Complex path formats might not resolve correctly for preview
**Impact**: Preview doesn't show even though path is valid
**Mitigation**:
- Simple logic: starts with `.` = relative, otherwise = project-relative
- Test with various actual Astro project structures
- Graceful fallback: show path as text if preview fails
- Not critical for functionality (just UX)

### Risk 3: Drag-and-Drop Conflict (LOW)
**Risk**: Dropping images might trigger both editor and frontmatter handlers
**Impact**: Duplicate file copies or unexpected behavior
**Mitigation**:
- Use event.stopPropagation() in ImageField handlers
- Test both systems independently and together
- Clear visual feedback for which zone is active
- Easy to fix if issues arise

### Risk 4: Large File Copy Performance (LOW)
**Risk**: Copying very large images might feel slow
**Impact**: Poor UX during file operations
**Mitigation**:
- Show clear loading state with spinner
- Tauri commands are async (non-blocking)
- Warn for files >5MB
- Not a blocker (still works, just slower)

### Risk 5: Missing File Handling (LOW)
**Risk**: User edits frontmatter manually with broken path
**Impact**: Preview shows error or breaks component
**Mitigation**:
- Check file existence before preview
- Graceful fallback to showing path as text
- No component crashes
- Low risk (purely defensive)

### Risk 6: Schema Detection Edge Cases (LOW)
**Risk**: Some image() usage patterns might not be detected
**Impact**: Image field renders as string field
**Mitigation**:
- Parser detection is already implemented and working
- Test with common schema patterns
- Fallback to string field is acceptable (still works, less UX)
- Can improve detection iteratively if needed

### Risk 7: Schema Merger Data Loss (CRITICAL - DISCOVERED IN DEBUGGING - WILL BE FIXED)
**Risk**: The `transform` field from Zod schema is silently dropped when JSON schema exists
**Impact**: Image field detection fails completely, always shows text field
**Root Cause**: `enhance_with_zod_references()` only merges references, not transform constraints
**Mitigation**:
- **MUST follow Phase 1.1-1.3 exactly** - this is the core fix
- Test with actual dummy project that has `.astro/collections/*.schema.json` files
- Verify transform field appears in browser console when logging schema
- DO NOT skip the schema merger updates - this is not optional

## Testing Strategy

### Unit Tests (Optional but Recommended)
- Path resolution utility (various formats)
- File validation logic
- Component props and rendering

### Integration Tests
- Full workflow: select → copy → save → reload → preview
- Drag-and-drop flow
- Schema detection end-to-end
- Path resolution with real files

### Manual Testing Checklist

**Phase 1.0 - Path Format Verification (MANDATORY FIRST STEP)**
- [ ] Create test image files in dummy Astro project
- [ ] Test project-relative path: `cover: "src/assets/blog/test.jpg"`
- [ ] Test relative path: `cover: "./test.jpg"`
- [ ] Run `npm run build` and check for errors
- [ ] Document which path formats work

**Phase 1+ - Component Testing**
- [ ] Test with actual Astro project (schema detection)
- [ ] Test file picker with various image formats (png, jpg, webp, svg, gif, bmp)
- [ ] Test drag-and-drop from Finder/Explorer
- [ ] Test with existing relative paths in frontmatter (`./image.jpg`)
- [ ] Test with existing project-relative paths (`src/assets/blog/image.jpg`)
- [ ] Test with new project (no assets dir yet - should be created)
- [ ] Test with collection-specific assets directory
- [ ] Test with project-level assets override
- [ ] Test clear functionality (removes path from frontmatter)
- [ ] Test with broken/missing image paths (graceful fallback)
- [ ] Test with large files (>5MB - shows warning)
- [ ] Test with multiple dropped files (uses first, shows warning)
- [ ] Test keyboard navigation (no mouse, tab through, enter to select)
- [ ] Test screen reader experience (NVDA/VoiceOver)
- [ ] Test in light and dark mode
- [ ] Test that editor drag-and-drop still works independently
- [ ] Test nested field paths (if schema has nested objects with images)
- [ ] Verify stored paths match editor drag-and-drop format exactly

## Dependencies

### Existing Code (No changes needed)
- `copy_file_to_assets_with_override` Tauri command ✅
- `getEffectiveAssetsDirectory()` settings helper ✅
- `isImageFile()` validation function ✅
- `FieldWrapper` component ✅
- Direct Store Pattern in editorStore ✅
- Toast notification system ✅
- Tauri filesystem APIs for path resolution ✅
- `convertFileSrc` from `@tauri-apps/api/core` ✅

### Modified Code
- `src/lib/schema.ts` - Add `transform` to FieldConstraints, add `Image` to FieldType enum

### New Code Created
- `src/lib/image-path.ts` - Path resolution and asset URL utility
- `src/components/frontmatter/fields/ImageField.tsx` - Main component

### No New Dependencies
- All required functionality exists in the codebase or Tauri

### ShadCN UI Components
The project already includes ShadCN components that we'll use for the ImageField:
- **Button** (`src/components/ui/button.tsx`) - For "Choose Image" button and clear button
- **Input** (`src/components/ui/input.tsx`) - Hidden file input element
- **Label** (`src/components/ui/label.tsx`) - For field labels (via FieldWrapper)
- **Spinner** (`src/components/ui/spinner.tsx`) - For loading states during file copy
- **Toast** (via Sonner in `src/components/ui/sonner.tsx`) - For error messages and notifications
- All components are already styled with Tailwind v4 and follow macOS-native design patterns

## Open Questions & Decisions

### Decided ✅

2. **Path Format for Reading**: Accept and resolve any format (relative or project-relative) - just show it
3. **Preview Size**: Fixed at 100x100px for consistency
4. **Preview Requirement**: Always attempt to show, graceful fallback if fails
5. **Multiple Images**: Out of scope (defer to YAML field)
6. **External URLs**: No (Astro's image() is for local files)
7. **File Size Limits**: Warn for >5MB but don't block
8. **Array of Images**: Out of scope (show YAML field or helpful message)

### Requires Verification (Phase 1.0) ⚠️

1. **Path Format for Writing**:
   - **Default assumption**: Use what `copy_file_to_assets_with_override` returns (project-relative, no leading slash)
   - **Needs verification**: Test if Astro's `image()` helper accepts project-relative paths
   - **If not**: Implement path conversion utility to convert to relative paths with `./` prefix
   - **Phase 1.0 is MANDATORY** to determine the correct format before implementing UI components

Implementation can begin with Phase 1.0 verification!

## Related Documentation

- Astro Content Collections: https://docs.astro.build/en/guides/content-collections/
- Astro image() helper: https://docs.astro.build/en/guides/images/#images-in-content-collections
- Astro Assets Guide: https://docs.astro.build/en/guides/images/
- Project Architecture Guide: `docs/developer/architecture-guide.md`
- Field Components: `src/components/frontmatter/fields/`
- Drag-and-Drop System: `src/lib/editor/dragdrop/`

## Success Metrics

- Image fields are intuitive and easy to use
- Users can add images without manually managing paths
- File copying behaves identically to editor drag-and-drop
- Previews work for various path formats (user-written and editor-written)
- No regressions in existing field types
- Code follows established patterns
- Fully accessible to keyboard and screen reader users
- No conflicts with editor drag-and-drop

## Implementation Notes

### Critical First Steps (Phase 1.1-1.3) - DO NOT SKIP

**DEBUGGING SESSION LEARNINGS**: The schema system has a complex data flow:
1. `parser.rs` detects `image()` and sets `constraints.transform = "astro-image"` ✅ (working)
2. Zod schema JSON is created with this transform ✅ (working)
3. ❌ **BROKEN**: `schema_merger.rs` drops the transform when merging with JSON schema
4. Frontend never receives the transform field ❌

**ROOT CAUSE**: The `FieldConstraints` struct in `schema_merger.rs` is missing the `transform` field, AND the `enhance_with_zod_references()` function only merges references, not transforms.

**Step 1: Update Rust FieldConstraints** (src-tauri/src/schema_merger.rs):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldConstraints {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>, // ADD THIS LINE
}
```

**Step 2: Fix Schema Merging** (src-tauri/src/schema_merger.rs):
Create new struct before `enhance_with_zod_references()`:
```rust
struct ZodFieldData {
    reference_collection: Option<String>,
    transform: Option<String>,
}
```

Update `enhance_with_zod_references()` to merge transform:
```rust
fn enhance_with_zod_references(
    schema: &mut SchemaDefinition,
    zod_schema: &str,
) -> Result<(), String> {
    let zod_field_data = extract_zod_field_data(zod_schema)?;

    for field in &mut schema.fields {
        if let Some(zod_data) = zod_field_data.get(&field.name) {
            // Merge references (existing)
            if let Some(collection_name) = &zod_data.reference_collection {
                // ... existing reference logic ...
            }

            // Merge transform constraint (NEW)
            if let Some(transform) = &zod_data.transform {
                if field.constraints.is_none() {
                    field.constraints = Some(FieldConstraints {
                        // ... all None except:
                        transform: Some(transform.clone()),
                    });
                } else if let Some(constraints) = &mut field.constraints {
                    constraints.transform = Some(transform.clone());
                }
            }
        }
    }
    Ok(())
}
```

**Step 3: Update TypeScript** (src/lib/schema.ts):
```typescript
export interface FieldConstraints {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'email' | 'uri' | 'date-time' | 'date'
  transform?: string // ADD THIS LINE - enables image() detection
}
```

And update `FieldType` enum:
```typescript
export enum FieldType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Date = 'date',
  Email = 'email',
  URL = 'url',
  Array = 'array',
  Enum = 'enum',
  Reference = 'reference',
  Object = 'object',
  Image = 'image', // ADD THIS LINE
  Unknown = 'unknown',
}
```

And add to `fieldTypeFromString()`:
```typescript
const typeMap: Record<string, FieldType> = {
  string: FieldType.String,
  number: FieldType.Number,
  integer: FieldType.Integer,
  boolean: FieldType.Boolean,
  date: FieldType.Date,
  email: FieldType.Email,
  url: FieldType.URL,
  array: FieldType.Array,
  enum: FieldType.Enum,
  reference: FieldType.Reference,
  object: FieldType.Object,
  image: FieldType.Image, // ADD THIS LINE
  unknown: FieldType.Unknown,
}
```

**Without these changes, image field detection will not work.**

### Key Principles
1. **Match editor behavior** - use same copy logic, same path format
2. **Accept any path format** - for preview, be flexible
3. **Write one path format** - project-relative (what copy returns)
4. **Use Tauri's convertFileSrc** - for loading images safely
5. **Graceful degradation** - if preview fails, show path as text
6. **No crashes** - handle all edge cases defensively

### Code Quality
- Follow Direct Store Pattern strictly
- Reuse existing utilities (don't reinvent)
- Comprehensive error handling with helpful messages
- Accessibility from the start
- Unit tests for path resolution utility

### User Experience
- Clear loading states for async operations
- Helpful error messages with actionable guidance
- Visual feedback for all interactions
- Consistent with existing field components
- Fast and responsive (async file operations)

---

**Status**: Ready for Implementation (with Phase 1.0 verification) ✅
**Priority**: P1 (High) - Core content authoring feature
**Complexity**: Medium - Clear scope, follows existing patterns
**Blockers**: None - start with Phase 1.0 path format verification
**Updated**: 2025-01-12 - Plan reviewed and enhanced with verification step, detailed implementations, and path conversion safety measures
