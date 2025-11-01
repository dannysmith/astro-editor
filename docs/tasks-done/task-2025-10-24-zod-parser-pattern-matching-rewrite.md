# Task 3: Rewrite Zod Schema Parser to Use Pattern Matching

https://github.com/dannysmith/astro-editor/issues/40

## Status

- **Priority**: 3
- **Status**: ✅ **COMPLETE** - All phases finished
- **Effort**: Medium (4-6 hours) - Actual: ~4 hours
- **Assigned**: Complete

---

## ✅ COMPLETION SUMMARY (2025-01-24)

All phases of the Zod parser rewrite have been successfully completed. The new pattern-matching approach is working perfectly in production.

### Final Achievements

- **Code Reduction**: ~1100 lines → ~610 lines (45% reduction!)
- **Tests**: All 26 tests passing (0 failures)
- **Warnings**: 0 compiler warnings, 0 clippy warnings
- **Functionality**: Nested image fields (like `coverImage.image`) now work correctly
- **Performance**: No performance degradation

### Completed Phases

1. ✅ Phase 0: Test Audit - Removed 7 obsolete tests, wrote 7 new focused tests
2. ✅ Phase 1: Helper Discovery - Pattern matching for `image()` and `reference()`
3. ✅ Phase 2: Path Resolution - Dotted path building for nested fields
4. ✅ Phase 3: Integration - Replaced old line-based parser
5. ✅ Phase 4: Edge Case Testing - All integration tests passing
6. ✅ Phase 5: Cleanup - Removed old code, eliminated all debug logging

---

## 🚧 PREVIOUS PROGRESS & HANDOFF NOTES

### What's Been Completed ✅

**Phase 0: Test Audit (DONE)**
- ✅ Deleted 7 obsolete constraint-parsing tests
- ✅ Wrote 7 new focused tests for helper discovery and path resolution
- ✅ All infrastructure tests (6) still passing

**Phase 1: Helper Discovery (DONE)**
- ✅ Created `HelperType` enum and `HelperMatch` struct (src-tauri/src/parser.rs:65-78)
- ✅ Implemented `find_helper_calls()` function (lines 1048-1101)
  - Uses regex to find `image()` and `reference()` calls
  - Extracts collection names from `reference('collectionName')`
  - Comprehensive logging with context
- ✅ All 3 unit tests passing:
  - `test_find_helper_calls_basic`
  - `test_find_helper_calls_multiline`
  - `test_find_helper_calls_deep_nesting`

**Phase 2: Path Resolution (DONE)**
- ✅ Implemented `find_field_name_backwards()` helper (lines 1103-1138)
- ✅ Implemented `resolve_field_path()` core algorithm (lines 1159-1226)
  - Scans backwards from helper position
  - Tracks brace levels to find parent fields
  - Builds dotted paths (e.g., `coverImage.image`, `metadata.author.avatar`)
- ✅ All 6 unit tests passing:
  - `test_resolve_top_level_field`
  - `test_resolve_nested_field`
  - `test_resolve_deep_nested_field`
  - `test_resolve_multiline_nested`
  - `test_resolve_array_of_references`
  - `test_resolve_multiple_helpers`

**Phase 3: Integration (70% DONE)**
- ✅ Implemented `is_inside_array()` helper (lines 1140-1157)
- ✅ Implemented `extract_zod_special_fields()` main function (lines 1228-1337)
  - Finds helpers, resolves paths, creates JSON output
  - Handles both array and non-array contexts
  - Proper error handling with warnings
- ✅ Replaced `parse_schema_fields()` to call new function (line 437-439)
- ✅ Unit test `test_extract_zod_special_fields_basic` passing
- ✅ Unit test `test_extract_basic_schema_with_arrow_function` passing

### Current Issue 🔍

**Problem**: Integration tests failing with `collections.len() == 0`

**Tests Failing** (7 total):
- `test_find_top_level_image`
- `test_find_nested_image`
- `test_find_deep_nested_image`
- `test_find_reference_helper`
- `test_multiline_nested_object`
- `test_array_of_references`
- `test_helpers_with_comments`

**What Works**:
- ✅ Individual functions all work (helper finding, path resolution, extraction)
- ✅ `extract_collections_block()` finds the collections block correctly
- ✅ Schema extraction works when tested directly
- ✅ Directory creation works

**What Doesn't Work**:
- ❌ `parse_collection_definitions()` returns 0 collections even though it receives the collections block

**Debug Output** (from `test_full_parse_with_image_helper`):
```
Created directory: "/var/.../test-full-parse-image/project/src/content/test"
Directory exists: true
[DEBUG] Found collections block, length: 128
[DEBUG] Full collections block: '{ ... (content exists but gets truncated)
Parse result: Ok([])
Collections found: 0
```

**Root Cause Hypothesis**:
The issue is in `parse_collection_definitions()` (lines 283-350). This function has two code paths:

1. **New format path** (lines 296-322): Tries to match `{ articles, notes }` style exports
2. **Old format path** (lines 323-350): Tries to match `collection_name: defineCollection(...)` style

The test schemas use `export const collections = { test: defineCollection({ ... }) }` format, which should match the OLD format path, but it's not finding them.

**Likely Issue**: The regex `r"(\w+)\s*:\s*defineCollection\s*\("` on line 325 needs to be checked. The collections block being passed might not contain `defineCollection` in the expected position.

**Next Steps to Debug**:
1. Add debug prints in `parse_collection_definitions()` to see which code path executes
2. Print the regex captures to see if it's matching
3. Check if the collections_block content is what we expect
4. Verify the directory existence check on line 336 is working

### Files Modified

- `src-tauri/src/parser.rs` - Main implementation file
  - Added new structs/enums (lines 65-78)
  - Added new pattern-matching functions (lines 1048-1337)
  - Replaced `parse_schema_fields()` body (line 437-439)
  - Added debug logging throughout
  - Added 10 new unit tests
  - Deleted 7 obsolete tests

### What Needs to Be Done Next

**Immediate** (to complete Phase 3):
1. Debug `parse_collection_definitions()` to find why collections aren't being detected
   - Add more debug output to see regex matching
   - Verify collections_block content
   - Check both code paths (new format vs old format)
2. Fix the collection detection logic
3. Remove debug prints once working
4. Verify all 7 failing integration tests pass

**Then** (Phases 4-5):
- Phase 4: Add edge case tests if needed
- Phase 5: Clean up old code and documentation

### Test Summary

**Passing** (15):
- All infrastructure tests
- All helper discovery unit tests
- All path resolution unit tests
- Integration tests for schemas without helpers

**Failing** (7):
- All integration tests that expect to find image/reference helpers

### Important Context

- The pattern-matching approach is **fundamentally working** - all unit tests prove this
- The issue is in the **collection discovery** layer, not the parsing layer
- The failing tests all use `export const collections = { ... }` format
- These tests create temp directories and call `parse_collections_from_content()`
- The old code being replaced is ~500 lines of complex constraint parsing that we're removing

---

## Quick Start for Implementation

**READ THIS FIRST!** This is a complete rewrite of the Zod parser with a simplified, focused approach.

### What You Need to Know

1. **The Goal**: Fix nested image fields (e.g., `coverImage.image`) which currently don't work due to multi-line formatting
2. **The Approach**: Pattern matching instead of line-by-line parsing
3. **Massive Simplification**: Remove ~500 lines of constraint parsing code (JSON schemas have all that!)
4. **Start with Phase 0**: Delete obsolete tests, write new focused tests (TDD approach)

### Key Decisions Already Made

✅ **JSON schemas contain ALL constraints** - verified by examining actual generated schemas
✅ **Arrays of objects NOT supported** - intentionally skipping `z.array(z.object({ src: image() }))`
✅ **Arrays of helpers ARE supported** - `z.array(reference('tags'))` works fine
✅ **Only parse image() and reference()** - everything else comes from JSON schemas

### Expected Outcome

- **Code**: 1100 lines → 600-700 lines (40% reduction!)
- **Tests**: 14 tests → 13 tests (but testing the RIGHT things)
- **Functionality**: Nested image fields work, everything else still works

**⚠️ CRITICAL**: Read the "CRITICAL GOTCHAS" section below before starting!

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

---

## FINAL PLAN AFTER CRITICAL REVIEW ✅

### What Changed After Deep Code Review

**Before Review**: Simple path resolution - just scan backwards and build dotted paths.

**After Review - CRITICAL DISCOVERY**: Arrays are NOT flattened in JSON schema!

**What This Means**:
1. **Array Detection Is Mandatory**: Path resolution MUST detect `z.array(...)`
2. **Different Output for Arrays**: `{ name: "gallery", type: "Array", arrayType: "Image" }`
3. **Not Optional**: Without this, arrays of objects with images won't work at all

**Key Technical Findings**:
- JSON schema has `gallery` (array field), NOT `gallery.src` (nested fields)
- The merger looks for array field names and changes their `sub_type`
- Current parser likely has bugs with arrays of objects (explains why UI doesn't support them)
- We ONLY output Image/Reference fields (JSON schema handles everything else)
- Comments are pre-removed by `remove_comments()` before we run
- Field names MUST match JSON schema exactly (dotted paths for nested objects)

**Plan Updates**:
- Phase 0: Added array tests (critical!)
- Phase 2: Path resolution returns `PathInfo { field_path, is_in_array }`
- Phase 3: Different output logic for array vs non-array fields
- Added "CRITICAL GOTCHAS" section with 6 important discoveries

---

## UPDATED PLAN (Based on Feedback)

**Key Change**: Start with Phase 0 - Test Audit!

### Why This Matters

The current parser has **7 tests testing constraint parsing** (string min/max, number constraints, optional syntax, etc.). These test features we're REMOVING because JSON schema handles them.

If we implement the new parser first, we'll waste time trying to fix these tests. Instead:

1. **Delete the 7 obsolete tests** (they test wrong behavior)
2. **Write 7 new focused tests** (image/reference discovery only)
3. **Then implement** (guided by the new tests)

This prevents us from chasing test failures for features we're deliberately not implementing!

### Code Impact

- **Before**: ~1100 lines, complex line-based parsing
- **After**: ~600-700 lines, simple pattern matching
- **Tests Before**: ~14 tests (7 testing wrong things)
- **Tests After**: ~13 tests (6 infrastructure + 7 focused new tests)

---

## Phased Implementation Plan

### Overview

This rewrite will be completed in 6 phases (0-5), starting with test cleanup. The key insight is that the Zod parser's ONLY job is to find `image()` and `reference()` helper calls and resolve their field paths. The JSON schema parser handles the actual structure.

**🎯 CRITICAL: Start with Phase 0 (Test Audit)**

Why? Because many existing tests validate the WRONG behavior (constraint parsing, optional detection, etc.). If we implement first, we'll waste time trying to make old tests pass that test features we're deliberately removing. Instead:

1. **Phase 0**: Delete obsolete tests, write focused new tests (TDD approach)
2. **Phase 1-3**: Implement (guided by the new test suite)
3. **Phase 4**: Add edge case tests discovered during implementation
4. **Phase 5**: Cleanup and documentation

**Expected Code Reduction**: ~1100 lines → ~600-700 lines (40% reduction!)

**Core Philosophy**:
- **We're ENHANCING, not parsing**: JSON schema is the source of truth for structure
- **Keep it simple**: No special cases, no complex logic, no performance tuning
- **Arrays are free**: Resolve `gallery.src` the same as `cover.image` - no special handling
- **Failures are OK**: If we can't resolve a path, skip it and log a warning
- **No optional detection**: JSON schema already knows what's required/optional

**Output Format to Maintain**:
```json
{
  "type": "zod",
  "fields": [
    {
      "name": "coverImage.image",  // ← Dotted path for nested fields
      "type": "Image",              // ← Type from helper
      "optional": true,
      "default": null,
      "constraints": {},
      "referencedCollection": "collectionName"  // ← For reference() helpers
    }
  ]
}
```

### Phase 0: Test Audit & Focused Test Suite (START HERE)

**Goal**: Review existing tests, remove those testing wrong behavior, write focused tests for the NEW approach.

**Current Test Situation**:
Looking at `src-tauri/src/parser.rs`, there are ~14 tests. Many test things we're NO LONGER DOING:

**Tests to DELETE** (testing constraint parsing - not our job anymore):
1. `test_enhanced_schema_parsing` - Tests parsing string/number constraints
2. `test_literal_field_parsing` - Tests parsing literal types
3. `test_union_field_parsing` - Tests parsing union types
4. `test_optional_syntax_parsing` - Tests parsing optional syntax
5. `test_string_constraints_parsing` - Tests regex, email, min/max length
6. `test_number_constraints_parsing` - Tests min/max, positive/negative
7. `test_multiline_field_normalization` - Tests constraint parsing from multi-line

**Tests to KEEP** (infrastructure, still needed):
1. `test_parse_simple_config` - Collection discovery
2. `test_empty_config` - Empty collections handling
3. `test_extract_collections_block` - Finding collections export
4. `test_remove_comments` - Comment removal (still needed)
5. `test_improved_comment_stripping` - Advanced comment removal
6. `test_content_directory_override` - Custom content directory

**New Focused Tests to WRITE** (before implementing):

1. **Test finding top-level image helper**:
```rust
#[test]
fn test_find_top_level_image() {
    let schema_text = r#"
    z.object({
      hero: image(),
      title: z.string(),
    })
    "#;

    // Should find: [{ name: "hero", type: "Image" }]
}
```

2. **Test finding nested image helper**:
```rust
#[test]
fn test_find_nested_image() {
    let schema_text = r#"
    z.object({
      coverImage: z.object({
        image: image().optional(),
        alt: z.string(),
      }),
    })
    "#;

    // Should find: [{ name: "coverImage.image", type: "Image" }]
}
```

3. **Test finding deeply nested image (3+ levels)**:
```rust
#[test]
fn test_find_deep_nested_image() {
    let schema_text = r#"
    z.object({
      metadata: z.object({
        author: z.object({
          avatar: image(),
        }),
      }),
    })
    "#;

    // Should find: [{ name: "metadata.author.avatar", type: "Image" }]
}
```

4. **Test finding reference with collection name**:
```rust
#[test]
fn test_find_reference_helper() {
    let schema_text = r#"
    z.object({
      author: reference('authors'),
      tags: z.array(reference('tags')),
    })
    "#;

    // Should find:
    // [
    //   { name: "author", type: "Reference", referencedCollection: "authors" },
    //   { name: "tags", type: "Reference", referencedCollection: "tags" }
    // ]
}
```

5. **Test multi-line formatting** (the bug we're fixing!):
```rust
#[test]
fn test_multiline_nested_object() {
    let schema_text = r#"
    z.object({
      coverImage: z
        .object({
          image: image().optional(),
          alt: z.string().optional(),
        })
        .optional(),
    })
    "#;

    // Should find: [{ name: "coverImage.image", type: "Image" }]
}
```

6. **Test array of references** (arrays of helpers - SUPPORTED):
```rust
#[test]
fn test_array_of_references() {
    let schema_text = r#"
    z.object({
      relatedArticles: z.array(reference('articles')),
    })
    "#;

    // Should find:
    // [{
    //   name: "relatedArticles",
    //   type: "Array",
    //   arrayType: "Reference",
    //   arrayReferenceCollection: "articles"
    // }]
}
```

**Note**: We're NOT testing `z.array(z.object({ src: image() }))` because we're intentionally not supporting that case (too complex, UI doesn't support it, extremely rare).

7. **Test comments don't break parsing**:
```rust
#[test]
fn test_helpers_with_comments() {
    let schema_text = r#"
    z.object({
      // Profile image
      avatar: image().optional(),
      /* Cover image */
      cover: z.object({
        image: image(), // The actual image
      }),
    })
    "#;

    // Should find:
    // [
    //   { name: "avatar", type: "Image" },
    //   { name: "cover.image", type: "Image" }
    // ]
}
```

**Action Items**:

1. **Delete the 7 constraint-parsing tests** - they test the wrong thing (JSON schemas have all constraints)
2. **Keep the 6 infrastructure tests** - they test collection discovery
3. **Write the 6-7 new focused tests** - these define what we're building
4. **Run tests** - they should fail (we haven't implemented yet)
5. **Use test failures to guide implementation**

**Why Delete Constraint Tests**:
✅ **VERIFIED** by examining actual JSON schemas from `test/dummy-astro-project/.astro/collections/`:
- String constraints (minLength, maxLength) ✅ In JSON schemas
- Number constraints (minimum, maximum) ✅ In JSON schemas
- Format validation (email, uri) ✅ In JSON schemas
- Descriptions ✅ In JSON schemas
- Defaults ✅ In JSON schemas
- Enums ✅ In JSON schemas
- Required fields ✅ In JSON schemas

The Zod parser does NOT need to parse any of this!

---

## 🔧 DEBUGGING INFO FOR NEXT SESSION

**DEBUG LOGGING IS IN PLACE** - The code now has comprehensive debug output in `parse_collection_definitions()` (lines 283-380).

### To Debug the Issue:

Run this command and examine the output:
```bash
cd src-tauri
cargo test parser::tests::test_full_parse_with_image_helper -- --exact --nocapture
```

**What to look for in the debug output:**
1. `[DEBUG] collections_block content:` - Shows the EXACT content being parsed
2. `[DEBUG] Trying NEW format regex match...` - Did it match the new format?
3. `[DEBUG] Trying OLD format regex match...` - Did it match the old format?
4. `[DEBUG] OLD format found X matches` - How many collection definitions found?
5. `[DEBUG]   exists: true/false` - Does the directory exist?
6. `[DEBUG]   is_dir: true/false` - Is it a directory?
7. `[DEBUG] Returning X collections` - Final count

**Hypothesis**: The regex is matching `test: defineCollection(...)` correctly (old format), but one of these is failing:
- Directory doesn't exist at the expected path
- Directory check is failing for some reason
- Schema extraction is failing

**Quick Fix Once You Identify the Issue:**
- If directory path is wrong: Check `content_dir` in the debug output
- If regex isn't matching: The collections_block content will show why
- If schema extraction fails: Add debug to `extract_basic_schema()`

**Success Criteria**:
- Removed ~50% of tests (the constraint parsing ones)
- Have clear, focused test suite that defines new behavior
- Tests fail initially (expected - we haven't implemented yet)
- Tests are simple and focused on helper discovery + path resolution

**Manual Validation**:
After writing tests, review them:
- Do they test ONLY image()/reference() discovery?
- Do they test path resolution correctly?
- Are they simple and readable?
- Do they cover edge cases (multi-line, deep nesting, arrays)?

---

### Phase 1: Foundation - Helper Discovery

**Goal**: Create the infrastructure to find all `image()` and `reference()` calls in schema text.

**Deliverables**:

1. **New struct for tracking helper locations**:
```rust
#[derive(Debug, Clone)]
struct HelperMatch {
    helper_type: HelperType,      // Image or Reference
    position: usize,              // Byte position in schema text
    collection_name: Option<String>, // For reference('authors')
}

#[derive(Debug, Clone, PartialEq)]
enum HelperType {
    Image,
    Reference,
}
```

2. **Pattern matching function**:
```rust
/// Find all image() and reference() helper calls in schema text
/// Returns positions and metadata for each helper found
fn find_helper_calls(schema_text: &str) -> Vec<HelperMatch> {
    let mut matches = Vec::new();

    // Find image() calls - regex: r"image\s*\(\s*\)"
    // Find reference() calls - regex: r"reference\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"

    // Log each match found with position and context

    matches
}
```

3. **Add comprehensive logging**:
   - Log the total number of helpers found
   - Log each helper's position and surrounding context (±20 chars)
   - Log the collection name for reference() helpers

**Testing**:
- Unit test: Find single top-level `image()` call
- Unit test: Find multiple `image()` calls
- Unit test: Find `reference('authors')` with collection name
- Unit test: Find helpers in multi-line formatted code
- Unit test: Handle edge cases (comments, strings containing "image()")

**Success Criteria**:
- Can find all `image()` calls in test/dummy-astro-project/src/content.config.ts
- Can extract collection names from `reference()` calls
- Handles multi-line formatting correctly
- Ignores `image()` in comments

**Manual Testing**:
After Phase 1, you can manually test by adding console logs to see which helpers are found in the dummy project.

---

### Phase 2: Path Resolution

**Goal**: For each helper found, trace backwards through the schema text to build the dotted field path.

**Algorithm**:

```
Given: helper position in schema text
Find: dotted path like "coverImage.image"

1. Start at helper position
2. Scan backwards to find the nearest field name (word before ':')
3. Track brace levels { } to know when we're inside nested objects
4. When we exit a brace level, scan backwards to find parent field name
5. Build path from innermost to outermost: ["image", "coverImage"] → "coverImage.image"
```

**Deliverables**:

1. **Path resolution function**:
```rust
/// Trace backwards from helper position to build dotted field path
///
/// Examples:
/// - Top-level: "heroImage: image()" → "heroImage"
/// - Nested: "coverImage: z.object({ image: image() })" → "coverImage.image"
/// - Deep: "meta: { author: { avatar: image() } }" → "meta.author.avatar"
fn resolve_field_path(schema_text: &str, helper_position: usize) -> Result<String, String> {
    let mut path_components = Vec::new();
    let mut current_pos = helper_position;
    let mut brace_level = 0;

    loop {
        // 1. Scan backwards to find field name (word before ':')
        let field_name = find_field_name_before(schema_text, current_pos)?;
        path_components.push(field_name);

        // 2. Continue scanning backwards through the text
        // Track brace levels to know when we exit to parent object
        while current_pos > 0 {
            let ch = schema_text.chars().nth(current_pos)?;

            if ch == '}' {
                brace_level += 1;
            } else if ch == '{' {
                brace_level -= 1;

                if brace_level < 0 {
                    // We've exited the current object level
                    // Check if there's a parent field
                    if let Some(parent_name) = find_parent_field_name(schema_text, current_pos)? {
                        current_pos = find_field_start_position(schema_text, current_pos)?;
                        break; // Continue outer loop to add parent
                    } else {
                        // Top level reached
                        path_components.reverse();
                        return Ok(path_components.join("."));
                    }
                }
            }

            current_pos -= 1;
        }

        if current_pos == 0 {
            break; // Reached start of text
        }
    }

    path_components.reverse();
    Ok(path_components.join("."))
}
```

2. **Add detailed logging**:
   - Log the path resolution process for each helper
   - Log brace levels as we trace backwards
   - Log each field name component found
   - Log the final resolved path

**Edge Cases to Handle**:
- Top-level fields (no nesting): `heroImage: image()` → `heroImage`
- Single nesting: `cover: z.object({ image: image() })` → `cover.image`
- Deep nesting (3+ levels): `meta: { author: { avatar: image() } }` → `meta.author.avatar`
- **Arrays of helpers**: `tags: z.array(reference('tags'))` → `tags` with arrayType
- Multi-line formatting: field name on different line than helper
- Comments between field name and helper
- Whitespace variations

**Error Handling**:
- If path resolution fails, log warning with context and skip that field
- Don't fail the entire parse - Zod parser is enhancing, not source of truth
- Arrays of objects with helpers will likely fail path resolution - this is fine, we skip them

**Path Resolution Algorithm** (SIMPLIFIED):
1. Start at helper position
2. Scan backwards to find nearest field name (word before `:`)
3. Track brace levels `{}` to know when we exit to parent object
4. When we exit a brace level, find parent field name
5. Build dotted path from innermost to outermost
6. For arrays of helpers like `z.array(reference('tags'))`, the field name is `tags` (no nesting to resolve)

**Testing**:
- Unit test: Top-level field path
- Unit test: Single-level nested path
- Unit test: Deep nested path (3+ levels)
- Unit test: Array of references (simple case)
- Unit test: Multi-line formatted nested object
- Unit test: Field with comments between name and helper
- **NOT testing**: Arrays of objects with helpers (intentionally not supported)

**Success Criteria**:
- Correctly resolves `coverImage.image` from notes collection schema
- Handles arbitrary nesting depth
- Works with all formatting variations
- Returns clear error messages for malformed schemas

**Manual Testing**:
Test path resolution by adding logs showing resolved paths for all helpers in dummy project.

---

### Phase 3: Integration - Replace Line-Based Parser

**Goal**: Replace `parse_schema_fields()` with new pattern-matching approach while maintaining exact same output format.

**Strategy**:
- Keep all existing helper functions (`extract_reference_collection`, etc.)
- Keep the ZodField struct and JSON serialization unchanged
- Only replace the core field extraction logic

**Deliverables**:

1. **New main extraction function**:
```rust
/// Extract special fields (image and reference helpers) using pattern matching
///
/// This is the main entry point that replaces the old line-based parsing.
/// Returns the same JSON format for backwards compatibility.
fn extract_zod_special_fields(schema_text: &str) -> Option<String> {
    // 1. Find all helper calls
    let helpers = find_helper_calls(schema_text);

    if helpers.is_empty() {
        return None;
    }

    // 2. Resolve field path for each helper
    let mut schema_fields = Vec::new();

    for helper in helpers {
        match resolve_field_path(schema_text, helper.position) {
            Ok(field_path) => {
                // Create ZodField with minimal info (just name and type)
                let field = ZodField {
                    name: field_path,
                    field_type: match helper.helper_type {
                        HelperType::Image => ZodFieldType::Image,
                        HelperType::Reference =>
                            ZodFieldType::Reference(helper.collection_name.unwrap_or_default()),
                    },
                    optional: true,  // JSON schema determines actual required/optional status
                    default_value: None,
                    constraints: ZodFieldConstraints::default(),
                };
                schema_fields.push(field);
            }
            Err(e) => {
                log::warn!("Failed to resolve field path at position {}: {}", helper.position, e);
                // Skip this field - it will be treated as whatever JSON schema says
                // This includes arrays of objects with helpers (not supported)
            }
        }
    }

    // 3. Serialize to JSON (same format as before)
    if !schema_fields.is_empty() {
        let schema_json = serde_json::json!({
            "type": "zod",
            "fields": schema_fields.iter().map(|f| {
                // Same serialization logic as before...
            }).collect::<Vec<_>>()
        });

        return Some(schema_json.to_string());
    }

    None
}
```

2. **Update `parse_schema_fields()` to call new function**:
```rust
fn parse_schema_fields(schema_text: &str) -> Option<String> {
    // Replace entire function body with:
    extract_zod_special_fields(schema_text)
}
```

3. **Preserve all helper functions**:
   - Keep `extract_reference_collection()` for reference name extraction
   - Keep `serialize_constraints()` for JSON output
   - Keep `remove_comments()` for preprocessing

**Testing**:
- Run ALL existing parser tests - they should all pass
- Test with enhanced_config.ts fixture
- Test with dummy project's content.config.ts
- Verify output JSON format matches exactly

**Success Criteria**:
- All existing tests pass without modification
- Output JSON format is identical to before
- No regressions in existing functionality
- Nested image fields now work correctly

**Manual Testing**:
1. Run the app with dummy project
2. Open a note with `coverImage` field
3. Verify that `coverImage.image` renders as ImageField (not text input)
4. Test file upload on nested image field
5. Verify top-level image fields still work (articles collection `cover` field)

---

### Phase 4: Additional Edge Case Testing

**Goal**: Add any additional edge case tests discovered during implementation.

**Note**: The core test suite was written in Phase 0. This phase is for any edge cases found during implementation.

**Potential Additional Tests**:

1. **Test multi-line nested object with image**:
```rust
#[test]
fn test_multiline_nested_image_field() {
    let content = r#"
export const notes = defineCollection({
  schema: ({ image }) => z.object({
    coverImage: z
      .object({
        image: image().optional(),
        alt: z.string().optional(),
      })
      .optional(),
  }),
});
"#;
    // Test that coverImage.image is found with type Image
}
```

2. **Test deeply nested image fields (3+ levels)**:
```rust
#[test]
fn test_deep_nested_image_field() {
    let content = r#"
const blog = defineCollection({
  schema: ({ image }) => z.object({
    metadata: z.object({
      author: z.object({
        avatar: image().optional(),
      }),
    }),
  }),
});
"#;
    // Test that metadata.author.avatar is found
}
```

3. **Test array with object containing image**:
```rust
#[test]
fn test_array_with_image_field() {
    let content = r#"
const gallery = defineCollection({
  schema: ({ image }) => z.object({
    images: z.array(z.object({
      src: image(),
      caption: z.string(),
    })),
  }),
});
"#;
    // Test that images.src is found (or appropriate path)
}
```

4. **Test mixed formatting**:
```rust
#[test]
fn test_mixed_formatting() {
    let content = r#"
const mixed = defineCollection({
  schema: ({ image }) => z.object({
    hero: image(),  // Inline
    cover: z.object({
      image: image().optional(),  // Nested inline
    }),
    gallery: z
      .object({
        thumbnail: image(),  // Nested multi-line
      })
      .optional(),
  }),
});
"#;
    // Test that all three are found
}
```

5. **Test comments in definitions**:
```rust
#[test]
fn test_comments_in_definitions() {
    let content = r#"
const blog = defineCollection({
  schema: ({ image }) => z.object({
    // Profile image
    avatar: image().optional(),
    /* Cover image
       with multi-line comment */
    cover: z.object({
      image: image(), // The actual image
    }),
  }),
});
"#;
    // Test that both avatar and cover.image are found
}
```

**Integration Testing**:
- Test with real dummy project: `test/dummy-astro-project/src/content.config.ts`
- Verify both `articles` and `notes` collections parse correctly
- Check that `articles.cover` is found (top-level)
- Check that `notes.coverImage.image` is found (nested)
- Verify `articles.author` and `articles.relatedArticles` references work

**Success Criteria**:
- All new tests pass
- All existing tests still pass
- Dummy project parses correctly
- No obvious performance issues (Rust is fast, schemas are small)

**Manual Testing Script**:
```
1. Open dummy project in app
2. Navigate to notes collection
3. Create new note
4. Verify coverImage section renders:
   - Image upload field for coverImage.image
   - Text field for coverImage.alt
5. Upload an image to coverImage.image
6. Save note
7. Verify image path is saved correctly in frontmatter
8. Test articles collection:
   - Verify cover field renders as image upload
   - Verify author renders as dropdown (reference)
   - Verify relatedArticles renders as multi-select
```

---

### Phase 5: Cleanup & Documentation

**Goal**: Remove old code, add documentation, and prepare for production.

**Note**: We already deleted obsolete tests in Phase 0, so this is about code cleanup.

**Cleanup Tasks**:

1. **Remove old line-based parsing code**:
   - Remove the old `parse_schema_fields()` implementation (lines 416-492)
   - Remove `process_field()` and other line-based helpers if only used by old approach
   - Remove old helper functions that are no longer needed:
     - `parse_field_type_and_constraints()` - we don't parse constraints anymore
     - `extract_string_constraints()` - not our job
     - `extract_number_constraints()` - not our job
     - `normalize_field_definition()` - not needed
     - `extract_optional_inner_type()` - not our job
     - `extract_array_inner_type()` - not needed (path resolution handles this)
     - `extract_union_types()` - not our job
     - `extract_literal_value()` - not our job
     - `extract_enum_values()` - not our job
     - `extract_default_value()` - not our job
     - `serialize_constraints()` - not our job anymore
   - Keep only what's needed:
     - `extract_reference_collection()` - still needed for reference() collection names
     - `remove_comments()` - still needed for preprocessing
     - Collection discovery functions - still needed

2. **Code organization**:
   - Group helper discovery functions together
   - Group path resolution functions together
   - Add module-level documentation explaining the approach

3. **Add inline documentation**:
```rust
/// # Zod Schema Parser - Pattern Matching Approach
///
/// This module extracts special Zod helpers (image() and reference()) from
/// Astro content.config.ts files. It uses pattern matching rather than
/// line-by-line parsing to be robust against formatting variations.
///
/// ## Architecture
///
/// 1. **Helper Discovery**: Find all image() and reference() calls
/// 2. **Path Resolution**: Trace backwards to build dotted field paths
/// 3. **JSON Output**: Serialize to format expected by schema_merger.rs
///
/// ## Why Pattern Matching?
///
/// The Zod parser's ONLY job is to find image() and reference() helpers.
/// The JSON schema parser handles all other field information. Pattern
/// matching is more robust than line-based parsing for this task.
///
/// ## Example
///
/// Input:
/// ```typescript
/// coverImage: z.object({
///   image: image().optional(),
///   alt: z.string(),
/// })
/// ```
///
/// Output:
/// ```json
/// {
///   "type": "zod",
///   "fields": [{
///     "name": "coverImage.image",
///     "type": "Image",
///     "optional": true
///   }]
/// }
/// ```
```

4. **Add function-level documentation**:
   - Document each public function with examples
   - Document edge cases handled
   - Document error conditions

**Documentation Updates**:

1. Update `docs/developer/schema-system.md`:
   - Add section on new pattern-matching approach
   - Explain why it's better than line-based parsing
   - Add examples of supported nesting patterns

2. Add code comments for non-obvious logic:
   - Explain brace-level tracking algorithm
   - Explain why we scan backwards vs forwards
   - Document regex patterns used

**Final Validation**:

1. **Code Review Checklist**:
   - [ ] All tests pass (existing + new)
   - [ ] No compiler warnings
   - [ ] No clippy warnings
   - [ ] Code is well-documented
   - [ ] No TODO comments left
   - [ ] Logging is appropriate (not too verbose)

2. **Integration Checklist**:
   - [ ] Dummy project works correctly
   - [ ] Nested image fields render properly
   - [ ] Top-level fields still work
   - [ ] Reference fields work
   - [ ] Performance is acceptable

3. **Documentation Checklist**:
   - [ ] Architecture guide updated
   - [ ] Inline docs complete
   - [ ] Examples provided
   - [ ] Edge cases documented

**Code Size Reduction**:
Before: ~1100 lines of parser.rs
After: Should be ~600-700 lines (significant simplification!)

**Success Criteria**:
- Code is clean and well-documented
- Old line-based approach is completely removed (~400-500 lines deleted)
- All obsolete helper functions removed
- New approach is easy to understand and extend
- Documentation explains the pattern-matching approach
- Ready for production use

---

## Phase Transition Checkpoints

After each phase, verify:

1. **Code compiles without warnings**
2. **All tests pass**
3. **Manual testing confirms expected behavior**
4. **Logging provides useful debugging information**

If any checkpoint fails, fix issues before moving to next phase.

---

## CRITICAL GOTCHAS DISCOVERED (Read This First!)

**TL;DR - Arrays of Objects with Images/References NOT Supported**:
We're intentionally NOT supporting `z.array(z.object({ src: image() }))` in this rewrite. It's rare, the UI doesn't support it anyway, and it would add significant complexity. We ONLY support:
- Top-level helpers: `cover: image()`
- Nested object helpers: `coverImage: z.object({ image: image() })`
- Arrays of helpers: `tags: z.array(reference('tags'))` ✅ (this works fine!)

---

### Gotcha #1: JSON Schemas Contain ALL Constraints ✅ VERIFIED

**CONFIRMED** by checking actual generated JSON schemas from `test/dummy-astro-project`:

The JSON schemas generated by `astro sync` contain:
- ✅ String constraints: `minLength`, `maxLength`
- ✅ Number constraints: `minimum`, `maximum`
- ✅ Format validation: `format: "uri"`, `format: "email"`
- ✅ Descriptions: `description` field
- ✅ Defaults: `default` field
- ✅ Enums: `enum` array
- ✅ Required fields: `required` array
- ✅ Array constraints: `maxItems`

**What This Means**: The Zod parser does NOT need to parse ANY of these! JSON schema is the complete source of truth for constraints, descriptions, defaults, enums, literals, unions, and optional detection.

**Zod Parser's ONLY Job**: Find `image()` and `reference()` helpers, resolve their field paths. That's it!

### Gotcha #2: Field Names MUST Match JSON Schema Exactly

JSON schema flattens nested objects with dotted paths:
- `coverImage.image` ← JSON schema has this exact field name
- `coverImage.alt` ← JSON schema has this exact field name
- NOT `coverImage` → `image` separately

Our Zod parser MUST output the same dotted paths or the merger won't find them!

### Gotcha #3: We ONLY Output Image and Reference Fields

Looking at `extract_zod_enhancements()` in schema_merger.rs:
- It only looks for `type_ == "Image"` or `type_ == "Reference"`
- It ignores String, Number, Boolean, etc.
- JSON schema already has all that info

**So we skip ALL fields except image() and reference() helpers!**

### Gotcha #4: Arrays of Helpers ARE Supported (But Not Arrays of Objects!)

**Supported** ✅:
```typescript
tags: z.array(reference('tags'))
```
Output:
```json
{
  "name": "tags",
  "type": "Array",
  "arrayType": "Reference",
  "arrayReferenceCollection": "tags"
}
```

**NOT Supported** ❌ (intentionally - too complex, UI doesn't support anyway):
```typescript
gallery: z.array(z.object({ src: image() }))
```

### Gotcha #5: Comments Are Already Removed

Looking at the code flow, `remove_comments()` is called BEFORE our parser runs. So we don't need to handle comments in helper finding. But testing with comments is still good for robustness.

### Gotcha #6: Strings Containing "image()" Might Match

```typescript
description: z.string().describe("Use image() helper")
```

Our regex will match `image()` inside the string! The current parser has this same bug, so it's not a regression. Low priority to fix.

**Mitigation**: Accept this limitation for now. Real-world schemas rarely have "image()" in strings.

## Implementation Decisions (Clarified)

1. **Array Handling** ⚠️ SIMPLIFIED AFTER REVIEW:
   - **Arrays of helpers (SUPPORTED)**: `tags: z.array(reference('tags'))`
     - These already work with current parser
     - Path resolution: just find the array field name
     - Output: `{ name: "tags", type: "Array", arrayType: "Reference", arrayReferenceCollection: "tags" }`

   - **Arrays of objects with helpers (NOT SUPPORTED)**: `gallery: z.array(z.object({ src: image() }))`
     - Intentionally skipping this case
     - Too complex, UI doesn't support it anyway, extremely rare in practice
     - If found, we'll just skip it (path resolution will likely fail, we log warning)

   - **Implementation**: Simple path resolution without array detection
     - For `tags: z.array(reference('tags'))`: resolve to `tags`
     - For `gallery: z.array(z.object({ src: image() }))`: path resolution will fail when it tries to build `gallery.src`, we skip with warning

2. **Error Handling**: When path resolution fails:
   - Log a warning with the helper position and context
   - Skip that field (don't include it in Zod output)
   - Field will be treated as whatever JSON schema says (probably string)
   - This is fine - Zod parser is just ENHANCING, not the source of truth

3. **Optional Detection**:
   - **Don't implement it** - JSON schema handles required/optional via the "required" array
   - Remove `.optional()` detection from the plan
   - Simplifies the code significantly

4. **Performance**:
   - Don't worry about it - Rust is fast, schemas are small (typically <20 fields)
   - No need for optimization unless we write obviously inefficient code
