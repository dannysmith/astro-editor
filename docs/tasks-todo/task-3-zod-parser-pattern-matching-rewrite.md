# Task 3: Rewrite Zod Schema Parser to Use Pattern Matching

## Status
- **Priority**: 3
- **Status**: Todo
- **Effort**: Medium (4-6 hours)
- **Assigned**: Unassigned

## Context

The current Zod schema parser uses line-by-line parsing with brace counting to extract field definitions from `src/content.config.ts`. This approach is fragile and breaks with common formatting patterns like:

```typescript
coverImage: z
  .object({
    image: image().optional(),
    alt: z.string().optional(),
  })
  .optional(),
```

### Why This Matters

Image fields and reference fields in nested objects don't work correctly. When a field like `coverImage.image` uses the `image()` helper, it should render as an ImageField component with upload functionality. Instead, it renders as a plain text input because the parser can't properly identify the `image()` helper when the definition spans multiple lines.

### Root Cause

The Zod parser's job is NOT to parse the entire schema structure (the JSON schema parser handles that). It has exactly two responsibilities:

1. Find fields using `image()` helper → mark them as Image type
2. Find fields using `reference()` helper → mark them as Reference type

The current line-based parsing approach tries to do too much and is too sensitive to formatting variations.

## Proposed Solution

Rewrite the Zod parser to use a two-pass pattern-matching approach:

### Pass 1: Find Special Helper Calls
- Scan entire schema text for `image()` and `reference()` occurrences
- Extract surrounding context (field name and containing structure)
- Don't try to parse the entire schema - just find the helpers

### Pass 2: Resolve Field Paths
- For each helper found, trace backwards through the schema text
- Use brace-level counting to find parent object names
- Build dotted paths (e.g., `coverImage.image`, `metadata.author.avatar`)

### Benefits
- **More robust**: Works with any formatting (multi-line, inline, etc.)
- **Simpler**: Focused on actual purpose (find helpers, resolve paths)
- **Maintainable**: Easier to understand and extend
- **Aligned with architecture**: JSON schema parser handles structure, Zod parser just augments it

## Implementation Details

### Current Code Location
- File: `src-tauri/src/parser.rs`
- Function: `parse_schema_fields()` (lines ~420-492)
- Related: `process_field_with_parent()`, `parse_nested_object()`, `parse_object_field()`

### Suggested Approach

1. **Create new pattern matching functions**:
   ```rust
   fn find_helper_calls(schema_text: &str, helper_name: &str) -> Vec<HelperMatch> {
       // Find all occurrences of helper_name() with position info
   }

   fn resolve_field_path(schema_text: &str, helper_position: usize) -> String {
       // Trace backwards from helper position through brace levels
       // Return dotted path like "coverImage.image"
   }

   fn extract_zod_special_fields(schema_text: &str) -> Vec<ZodField> {
       // Main function: find image() and reference() calls, resolve paths
   }
   ```

2. **Replace line-based parsing**:
   - Remove `parse_schema_fields()` complexity
   - Keep the regex-based schema extraction (finding the schema object itself)
   - Replace field parsing with pattern matching

3. **Handle edge cases**:
   - Deeply nested fields (3+ levels)
   - Arrays of objects: `gallery: z.array(z.object({ src: image() }))`
   - Comments between field names and definitions
   - Inline vs. multi-line formatting

4. **Maintain backwards compatibility**:
   - Top-level image fields must continue working: `heroImage: image()`
   - Reference fields must work the same way
   - All existing tests must pass

## Testing Strategy

### Unit Tests to Update
- `test_image_helper_detection` - should still pass
- `test_reference_helper_detection` - should still pass
- `test_nested_object_with_image_fields` - should pass with new approach

### New Tests to Add
- Multi-line image field definitions
- Deeply nested image fields (3+ levels)
- Arrays with image fields
- Mixed formatting (some inline, some multi-line)
- Comments in field definitions

### Integration Testing
- Test with `test/dummy-astro-project/src/content.config.ts`
- Verify nested image fields render as ImageField components
- Verify existing non-nested fields still work
- Check both notes collection (has nested coverImage) and articles collection

## Risks and Mitigations

### Risk 1: Breaking Existing Functionality
- **Impact**: High
- **Mitigation**: Comprehensive test suite, test with real project schemas
- **Validation**: All existing tests must pass before merging

### Risk 2: Complex Nested Structures
- **Impact**: Medium
- **Mitigation**: Design path resolution to handle arbitrary nesting depth
- **Validation**: Test with 3+ level nesting

### Risk 3: Formatting Edge Cases
- **Impact**: Low
- **Mitigation**: Document supported formatting patterns, focus on common Prettier output
- **Validation**: Test with various formatting styles

### Risk 4: Future Extensibility
- **Impact**: Low
- **Mitigation**: Make helper detection parameterized (pass in list of helpers to find)
- **Validation**: Easy to add new helpers in the future

## Success Criteria

1. ✅ Nested image fields render as ImageField components (not text inputs)
2. ✅ All existing Zod parser tests pass
3. ✅ Multi-line field definitions work correctly
4. ✅ Reference fields continue working
5. ✅ Top-level image fields continue working
6. ✅ Code is cleaner and easier to understand than before
7. ✅ Performance is comparable or better (pattern matching is O(n), line parsing was also O(n))

## Dependencies
- None (self-contained refactor)

## Related Files
- `src-tauri/src/parser.rs` - Main implementation
- `src-tauri/src/schema_merger.rs` - Uses Zod parser output
- `test/dummy-astro-project/src/content.config.ts` - Test schema
- `docs/tasks-done/task-2-images-in-frontmatter.md` - Previous related work

## Notes

This task was created after attempting to fix nested image field support by improving the line-based parser. The approach became increasingly complex and fragile. The pattern-matching rewrite is a better architectural fit because:

1. It aligns with the actual purpose of the Zod parser (find special cases, not parse everything)
2. It leverages the JSON schema parser for structure (single source of truth)
3. It's more robust to formatting variations
4. It's easier to maintain and extend

The immediate benefit is nested image fields working correctly. The longer-term benefit is a more maintainable codebase that's easier to extend when new Astro/Zod helpers need special handling.
