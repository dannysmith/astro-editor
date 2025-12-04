# Fix Nullable Schema Types (Arrays, Enums, Objects)

## Context

GitHub Issue #68 revealed that `z.number().nullish()` was being incorrectly typed as `string`, causing number values to be stringified on save. We fixed this by adding `extract_nullable_primitive_type()` to `schema_merger.rs`.

During the investigation, we discovered similar issues with other nullable types that need the same treatment.

## Problem

When Zod schemas use `.nullish()` or `.optional().nullable()` on non-primitive types, Astro generates JSON Schema with `anyOf: [type, null]`. The current `handle_anyof_type()` function only handles:

- Dates (via `is_date_field`)
- References (via `is_reference_field`)
- Nullable primitives (via `extract_nullable_primitive_type` - just fixed)

Everything else falls through to returning `"string"`, which is incorrect.

## Affected Patterns

### 1. Nullable Arrays - HIGH PRIORITY

**Zod:** `z.array(z.string()).nullish()`

**JSON Schema:**

```json
{
  "anyOf": [
    { "type": "array", "items": { "type": "string" } },
    { "type": "null" }
  ]
}
```

**Current:** Field type = `"string"` (user sees text input)
**Expected:** Field type = `"array"` with `sub_type` (user sees tag input)

### 2. Nullable Enums - MEDIUM PRIORITY

**Zod:** `z.enum(['draft', 'published']).nullish()`

**JSON Schema:**

```json
{
  "anyOf": [
    { "type": "string", "enum": ["draft", "published"] },
    { "type": "null" }
  ]
}
```

**Current:** Field type = `"string"` (user sees text input, can enter invalid values)
**Expected:** Field type = `"enum"` with `enum_values` (user sees dropdown)

### 3. Nullable Objects - LOWER PRIORITY

**Zod:** `z.object({ lat: z.number(), lng: z.number() }).nullish()`

**JSON Schema:**

```json
{ "anyOf": [{ "type": "object", "properties": {...} }, { "type": "null" }] }
```

**Current:** Field type = `"string"` (nested fields not rendered)
**Expected:** Nested fields should be flattened and rendered

## Implementation Plan

### Step 1: Add `extract_nullable_array_type()` helper

Location: `src-tauri/src/schema_merger.rs`

```rust
/// Extract array type from a nullable anyOf (e.g., [array, null] → array info)
fn extract_nullable_array_type(any_of: &[JsonSchemaProperty]) -> Option<FieldTypeInfo> {
    if any_of.len() != 2 {
        return None;
    }

    let mut array_schema = None;
    let mut has_null = false;

    for schema in any_of {
        match &schema.type_ {
            Some(StringOrArray::String(t)) if t == "null" => {
                has_null = true;
            }
            Some(StringOrArray::String(t)) if t == "array" => {
                array_schema = Some(schema);
            }
            _ => return None,
        }
    }

    if has_null {
        if let Some(schema) = array_schema {
            // Delegate to existing handle_array_type logic
            return handle_array_type(schema).ok();
        }
    }
    None
}
```

### Step 2: Add `extract_nullable_enum_type()` helper

```rust
/// Extract enum type from a nullable anyOf (e.g., [enum, null] → enum info)
fn extract_nullable_enum_type(any_of: &[JsonSchemaProperty]) -> Option<FieldTypeInfo> {
    if any_of.len() != 2 {
        return None;
    }

    let mut enum_values = None;
    let mut has_null = false;

    for schema in any_of {
        match &schema.type_ {
            Some(StringOrArray::String(t)) if t == "null" => {
                has_null = true;
            }
            Some(StringOrArray::String(t)) if t == "string" => {
                if let Some(values) = &schema.enum_ {
                    enum_values = Some(values.clone());
                }
            }
            _ => {}
        }
    }

    if has_null && enum_values.is_some() {
        return Some(FieldTypeInfo {
            field_type: "enum".to_string(),
            sub_type: None,
            enum_values,
            reference_collection: None,
            array_reference_collection: None,
        });
    }
    None
}
```

### Step 3: Update `handle_anyof_type()`

Add checks before the fallback to `"string"`:

```rust
fn handle_anyof_type(any_of: &[JsonSchemaProperty]) -> Result<FieldTypeInfo, String> {
    // Existing checks...
    if is_date_field(any_of) { ... }
    if is_reference_field(any_of) { ... }
    if let Some(primitive_type) = extract_nullable_primitive_type(any_of) { ... }

    // NEW: Handle nullable arrays
    if let Some(array_type) = extract_nullable_array_type(any_of) {
        return Ok(array_type);
    }

    // NEW: Handle nullable enums
    if let Some(enum_type) = extract_nullable_enum_type(any_of) {
        return Ok(enum_type);
    }

    // Fallback
    Ok(FieldTypeInfo { field_type: "string".to_string(), ... })
}
```

### Step 4: Add Tests

Add regression tests for each case:

```rust
#[test]
fn test_parse_anyof_nullable_array() {
    // Test z.array(z.string()).nullish()
    let json_schema = r##"{
        "$ref": "#/definitions/posts",
        "definitions": {
            "posts": {
                "type": "object",
                "properties": {
                    "tags": {
                        "anyOf": [
                            { "type": "array", "items": { "type": "string" } },
                            { "type": "null" }
                        ]
                    }
                },
                "required": []
            }
        }
    }"##;

    let result = parse_json_schema("posts", json_schema);
    let schema = result.unwrap();
    let field = schema.fields.iter().find(|f| f.name == "tags").unwrap();
    assert_eq!(field.field_type, "array");
    assert_eq!(field.sub_type, Some("string".to_string()));
}

#[test]
fn test_parse_anyof_nullable_enum() {
    // Test z.enum(['draft', 'published']).nullish()
    let json_schema = r##"{
        "$ref": "#/definitions/posts",
        "definitions": {
            "posts": {
                "type": "object",
                "properties": {
                    "status": {
                        "anyOf": [
                            { "type": "string", "enum": ["draft", "published"] },
                            { "type": "null" }
                        ]
                    }
                },
                "required": []
            }
        }
    }"##;

    let result = parse_json_schema("posts", json_schema);
    let schema = result.unwrap();
    let field = schema.fields.iter().find(|f| f.name == "status").unwrap();
    assert_eq!(field.field_type, "enum");
    assert_eq!(field.enum_values, Some(vec!["draft".to_string(), "published".to_string()]));
}

#[test]
fn test_parse_anyof_nullable_number_array() {
    // Test z.array(z.number()).nullish() - verify sub_type is correct
    let json_schema = r##"{
        "$ref": "#/definitions/data",
        "definitions": {
            "data": {
                "type": "object",
                "properties": {
                    "scores": {
                        "anyOf": [
                            { "type": "array", "items": { "type": "number" } },
                            { "type": "null" }
                        ]
                    }
                },
                "required": []
            }
        }
    }"##;

    let result = parse_json_schema("data", json_schema);
    let schema = result.unwrap();
    let field = schema.fields.iter().find(|f| f.name == "scores").unwrap();
    assert_eq!(field.field_type, "array");
    assert_eq!(field.sub_type, Some("number".to_string()));
}
```

### Step 5: Run Tests and Verify

```bash
cd src-tauri && cargo test schema_merger
pnpm run check:all
```

## Future Consideration: Nullable Objects

Nullable objects are more complex because they require recursive field extraction. This could be addressed in a follow-up task if users report issues with `z.object({...}).nullish()` patterns.

---

## Part 2: Preserve Frontmatter When Only Content Is Edited

### Problem

Currently, when a file is saved, the frontmatter is **always** re-serialized by the Rust backend, even if the user only edited the markdown content and never touched the frontmatter panel. This causes unwanted changes:

1. **Field reordering** - Fields get reordered to match schema order
2. **Date normalization** - `2024-01-15T12:30:00Z` becomes `2024-01-15`
3. **Quote changes** - serde_norway may quote strings differently than the original

This is frustrating for users who carefully format their frontmatter manually and don't want it modified. And because of the autosave feature, this occurs even if a user just has a file open for a few seconds.

### Architecture Conformance

This implementation follows established patterns from `docs/developer/architecture-guide.md`:

- **Hybrid Action Hooks Pattern**: Save logic lives in `useEditorActions` hook with `getState()` access to stores
- **State in Zustand Store**: `isFrontmatterDirty` flag belongs in `editorStore` with other file state
- **TanStack Query Bridge**: `useEditorFileContent` hook syncs server state to local editing state
- **Direct Store Pattern**: Components access frontmatter via selectors, no callback props

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        File Load                                 │
├─────────────────────────────────────────────────────────────────┤
│ Rust parses file → returns:                                      │
│   • frontmatter (parsed object)                                  │
│   • raw_frontmatter (original YAML string) ← WE HAVE THIS!       │
│   • content                                                      │
│   • imports                                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Editor Store                                 │
├─────────────────────────────────────────────────────────────────┤
│ Stores:                                                          │
│   • frontmatter: Record<string, unknown> (for editing)           │
│   • rawFrontmatter: string (original from disk) ← WE HAVE THIS!  │
│   • editorContent: string                                        │
│   • isDirty: boolean (single flag for both)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Save                                     │
├─────────────────────────────────────────────────────────────────┤
│ Always sends parsed frontmatter object to Rust                   │
│ Rust always re-serializes → reorders, normalizes dates           │
│ ❌ Original formatting is LOST                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Solution: Track Frontmatter Dirty State Separately

#### Step 1: Add `isFrontmatterDirty` to Editor Store

Location: `src/store/editorStore.ts`

```typescript
// 1. Add to interface
interface EditorState {
  // ... existing fields
  isDirty: boolean // True if ANY changes need to be saved
  isFrontmatterDirty: boolean // NEW: True if frontmatter was modified
  // ...
}

// 2. Add to initial state
export const useEditorStore = create<EditorState>((set, get) => ({
  // ... existing initial state
  isFrontmatterDirty: false, // NEW

// 3. In updateFrontmatter action:
updateFrontmatter: (frontmatter: Record<string, unknown>) => {
  set({ frontmatter, isDirty: true, isFrontmatterDirty: true })
  get().scheduleAutoSave()
},

// 4. In updateFrontmatterField action:
updateFrontmatterField: (key: string, value: unknown) => {
  // ... existing logic ...
  set({
    frontmatter: newFrontmatter,
    isDirty: true,
    isFrontmatterDirty: true, // NEW
  })
  get().scheduleAutoSave()
},

// 5. In setEditorContent (markdown only) - NO CHANGE to isFrontmatterDirty:
setEditorContent: (content: string) => {
  set({ editorContent: content, isDirty: true })
  // NOTE: Do NOT set isFrontmatterDirty here - content-only edit
  get().scheduleAutoSave()
},

// 6. In openFile (reset):
openFile: (file: FileEntry) => {
  // ... existing logic ...
  set({
    // ... existing fields ...
    isDirty: false,
    isFrontmatterDirty: false, // NEW
  })
},

// 7. In closeCurrentFile (reset):
closeCurrentFile: () => {
  // ... existing logic ...
  set({
    // ... existing fields ...
    isDirty: false,
    isFrontmatterDirty: false, // NEW
  })
},
```

**Also update `useEditorFileContent.ts`** to reset `isFrontmatterDirty` when loading content from disk:

```typescript
// src/hooks/useEditorFileContent.ts
useEditorStore.setState({
  editorContent: data.content,
  frontmatter: data.frontmatter,
  rawFrontmatter: data.raw_frontmatter,
  imports: data.imports,
  isFrontmatterDirty: false, // NEW: Reset when loading from disk
})
```

#### Step 2: Modify Save to Pass Raw Frontmatter When Unchanged

Location: `src/hooks/editor/useEditorActions.ts`

```typescript
const saveFile = useCallback(
  async (showToast = true) => {
    const {
      currentFile,
      editorContent,
      frontmatter,
      rawFrontmatter, // Get original
      isFrontmatterDirty, // Check if modified
      imports,
    } = useEditorStore.getState()

    // ...

    await invoke('save_markdown_content', {
      filePath: currentFile.path,
      frontmatter: isFrontmatterDirty ? frontmatter : null, // Only if changed
      rawFrontmatter: isFrontmatterDirty ? null : rawFrontmatter, // Pass original if unchanged
      content: editorContent,
      imports,
      schemaFieldOrder: isFrontmatterDirty ? schemaFieldOrder : null, // Only reorder if changed
      projectRoot: projectPath,
    })

    // Reset dirty flags after save
    // Clear auto-save timeout since we just saved (existing pattern)
    const { autoSaveTimeoutId } = useEditorStore.getState()
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId)
    }

    useEditorStore.setState({
      isDirty: false,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
      lastSaveTimestamp: Date.now(),
    })
  },
  [queryClient]
)
```

#### Step 3: Update Rust Command to Accept Either Format

Location: `src-tauri/src/commands/files.rs`

```rust
#[tauri::command]
pub async fn save_markdown_content(
    file_path: String,
    frontmatter: Option<IndexMap<String, Value>>,  // Parsed (if edited)
    raw_frontmatter: Option<String>,                // Raw string (if unchanged)
    content: String,
    imports: String,
    schema_field_order: Option<Vec<String>>,
    project_root: String,
) -> Result<(), String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;

    let new_content = match (frontmatter, raw_frontmatter) {
        // Frontmatter was edited - reorder and normalize
        (Some(fm), _) => {
            rebuild_markdown_with_frontmatter_and_imports_ordered(
                &fm,
                &imports,
                &content,
                schema_field_order,
            )?
        }
        // Frontmatter unchanged - preserve original (non-empty)
        (None, Some(ref raw)) if !raw.trim().is_empty() => {
            rebuild_markdown_with_raw_frontmatter(
                raw,
                &imports,
                &content,
            )?
        }
        // No frontmatter at all (None, None, or empty string)
        _ => {
            rebuild_markdown_content_only(&imports, &content)?
        }
    };

    std::fs::write(&validated_path, new_content)
        .map_err(|e| format!("Failed to write file: {e}"))
}
```

#### Step 4: Add Helper for Raw Frontmatter Rebuild

```rust
/// Rebuild markdown using raw frontmatter string (no modifications)
fn rebuild_markdown_with_raw_frontmatter(
    raw_frontmatter: &str,
    imports: &str,
    content: &str,
) -> Result<String, String> {
    let mut result = String::new();

    // Add frontmatter exactly as-is
    if !raw_frontmatter.is_empty() {
        result.push_str("---\n");
        result.push_str(raw_frontmatter);
        if !raw_frontmatter.ends_with('\n') {
            result.push('\n');
        }
        result.push_str("---\n");
    }

    // Add imports if present
    if !imports.trim().is_empty() {
        if !raw_frontmatter.is_empty() {
            result.push('\n');
        }
        result.push_str(imports);
        if !imports.ends_with('\n') {
            result.push('\n');
        }
    }

    // Add content
    if !content.is_empty() {
        if !raw_frontmatter.is_empty() || !imports.trim().is_empty() {
            result.push('\n');
        }
        result.push_str(content);
    }

    // Ensure trailing newline
    if !result.is_empty() && !result.ends_with('\n') {
        result.push('\n');
    }

    Ok(result)
}
```

#### Step 5: Add Tests

```rust
#[test]
fn test_save_with_raw_frontmatter_preserves_formatting() {
    let raw_frontmatter = r#"title: "My Post"
date: 2024-01-15T12:30:00Z
tags:
  - rust
  - tauri"#;

    let result = rebuild_markdown_with_raw_frontmatter(
        raw_frontmatter,
        "",
        "Hello world",
    ).unwrap();

    // Verify original frontmatter is preserved exactly
    assert!(result.contains("date: 2024-01-15T12:30:00Z"));  // Time NOT stripped
    assert!(result.contains("title: \"My Post\""));          // Quotes preserved
}
```

```typescript
// Frontend test
describe('isFrontmatterDirty tracking', () => {
  it('should not mark frontmatter dirty when only content changes', () => {
    useEditorStore.getState().openFile(mockFile)
    useEditorStore.setState({
      frontmatter: { title: 'Test' },
      isFrontmatterDirty: false,
    })

    useEditorStore.getState().setEditorContent('New content')

    expect(useEditorStore.getState().isDirty).toBe(true)
    expect(useEditorStore.getState().isFrontmatterDirty).toBe(false)
  })

  it('should mark frontmatter dirty when frontmatter field changes', () => {
    useEditorStore.getState().updateFrontmatterField('title', 'New Title')

    expect(useEditorStore.getState().isDirty).toBe(true)
    expect(useEditorStore.getState().isFrontmatterDirty).toBe(true)
  })
})
```

### Success Criteria (Part 2)

- [ ] `isFrontmatterDirty` flag added to editor store
- [ ] Content-only edits don't set `isFrontmatterDirty`
- [ ] Frontmatter edits set `isFrontmatterDirty`
- [ ] Save uses raw frontmatter when `!isFrontmatterDirty`
- [ ] Rust command accepts both parsed and raw frontmatter
- [ ] Date/time values preserved when frontmatter unchanged
- [ ] Field order preserved when frontmatter unchanged
- [ ] Quote style preserved when frontmatter unchanged
- [ ] Tests added for both frontend and backend

---

## Overall Success Criteria

**Part 1 - Nullable Schema Types:**

- [ ] `z.array(z.string()).nullish()` renders as tag input
- [ ] `z.array(z.number()).nullish()` renders as number tag input
- [ ] `z.enum([...]).nullish()` renders as dropdown
- [ ] All schema parsing tests pass

**Part 2 - Preserve Frontmatter:**

- [ ] Editing only markdown content preserves original frontmatter exactly
- [ ] Editing frontmatter triggers reordering/normalization as before
- [ ] All save/load tests pass

**Integration:**

- [ ] `pnpm run check:all` passes
- [ ] Manual testing with real Astro project confirms both fixes

---

## Gotchas and Edge Cases

### Edge Case 1: File With No Initial Frontmatter

If a file has no frontmatter initially (`rawFrontmatter` is empty) and the user adds frontmatter via the panel, this is handled correctly because:
- Adding frontmatter via the panel sets `isFrontmatterDirty: true`
- The save will use the parsed `frontmatter` object (not raw)
- The Rust match handles empty `raw_frontmatter` via the `!raw.trim().is_empty()` guard

### Edge Case 2: Undo All Frontmatter Changes

If a user edits frontmatter then undoes all changes back to the original state, `isFrontmatterDirty` will still be `true`. We track "was modified during this session" not "is different from original".

**This is acceptable behavior** because:
1. The save will just normalize frontmatter (no data loss)
2. Tracking deep equality would add complexity for minimal benefit
3. Users rarely undo all frontmatter changes

### Edge Case 3: Recovery Data

The recovery system (`src/lib/recovery.ts`) saves editor state when save fails. Currently it saves `frontmatter` but not `isFrontmatterDirty` or `rawFrontmatter`.

**For now, leave recovery as-is**. When recovering from a crash:
- The recovered `frontmatter` will be re-serialized on next save
- This is acceptable because recovery is rare and data integrity matters more than formatting

If this becomes an issue, a future task could enhance recovery to preserve `rawFrontmatter`.

### Edge Case 4: Opening Same File Twice

If a user opens a file, makes content-only edits, saves (preserving raw frontmatter), then closes and reopens:
- `rawFrontmatter` is re-loaded from disk
- `isFrontmatterDirty` is reset to `false`
- Everything works correctly

### Testing Notes

Follow existing test patterns in:
- `src/store/__tests__/storeQueryIntegration.test.ts` for store integration tests
- `src/hooks/editor/useEditorHandlers.test.ts` for hook tests

Test all dirty state transitions:
1. Content edit → `isDirty: true`, `isFrontmatterDirty: false`
2. Frontmatter edit → `isDirty: true`, `isFrontmatterDirty: true`
3. Both edited → `isDirty: true`, `isFrontmatterDirty: true`
4. Save → both reset to `false`
5. Load from disk → both reset to `false`
