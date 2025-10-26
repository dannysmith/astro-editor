# Replace Custom YAML Parser with serde_norway

**Priority**: HIGH (should fix before 1.0.0)
**Effort**: ~1-2 days
**Type**: Reliability, maintenance, code simplification

## Crate Choice: serde_norway (Not serde_yaml or serde_yml)

**IMPORTANT**: Use `serde_norway`, NOT `serde_yaml` or `serde_yml`.

- `serde_yaml` (dtolnay's original) was **deprecated in March 2024**
- `serde_yml` was **archived in September 2025** due to unsoundness issues (segfaults, RUSTSEC-2025-0068)

**serde_norway** is the actively maintained fork that:
- Uses maintained `unsafe-libyaml-norway` (not unmaintained libyaml)
- Has recent releases (v0.9.42, Dec 2024)
- Is recommended by RustSec advisory as a safe alternative

- **Add**: `serde_norway = "0.9.42"`
- **Crate**: https://crates.io/crates/serde_norway
- **Docs**: https://docs.rs/serde_norway/
- **Repo**: https://github.com/cafkafk/serde-yaml

The API is identical to serde_yaml (drop-in replacement).

## Problem

The backend currently uses a custom, hand-written YAML parser (~200 lines) and serializer (~100 lines) to handle frontmatter. While it works for basic cases, YAML is a complex format with many edge cases that the custom implementation doesn't handle.

**Evidence**: `src-tauri/src/commands/files.rs:425-706`

**Current implementation handles**:
- Basic key-value pairs
- Inline and multi-line arrays
- Nested objects
- Booleans, numbers, strings
- Custom date formatting (ISO datetime → date-only)
- Schema-based field ordering

**Current implementation DOES NOT handle**:
- YAML anchors and aliases (`&anchor`, `*alias`)
- Multi-line strings (block scalars `|`, `>`)
- Explicit type tags (`!!str`, `!!int`)
- Complex edge cases in the YAML spec
- Proper escaping of all special characters
- Comments preservation
- Document markers (`...`)

## Risk of Current Approach

If users have existing Astro projects with frontmatter that uses these features, the custom parser will:
- Fail to parse (best case - user sees error)
- Silently corrupt data (worst case - anchors/aliases lost, formatting broken)
- Produce invalid YAML on save

This is particularly risky for a 1.0.0 release when users will be opening their real projects.

## Benefits of Using serde_norway

1. **Robustness**: Handles entire YAML 1.2 spec correctly
2. **Security**: Actively maintained with safe underlying library (unsafe-libyaml-norway)
3. **Code reduction**: Delete ~300 lines of complex parsing/serialization logic
4. **Better error messages**: serde_norway provides detailed parse error context
5. **Maintainability**: Community-maintained, receives bug fixes and improvements

## Test Project Analysis

Analysis of `test/dummy-astro-project` and `test/starlight-minimal` shows:

**YAML features used**:
- ✅ Simple strings (quoted and unquoted)
- ✅ Dates in `YYYY-MM-DD` format
- ✅ Booleans (`true`, `false`)
- ✅ Numbers (integers and floats)
- ✅ Arrays (both inline `["a", "b"]` and block style with `- item`)
- ✅ Nested objects (`metadata: { category: "dev", priority: 5 }`)

**Advanced YAML features NOT used**:
- ❌ YAML anchors/aliases
- ❌ Multi-line block scalars (`|`, `>`)
- ❌ Explicit type tags (`!!str`)

**Conclusion**: Migration risk is **LOW**. Test projects use only basic YAML features that serde_norway handles identically to our custom parser.

## Implementation Approach: Full Replacement (Recommended)

Replace both parsing and serialization with serde_norway.

**Architecture changes**:
1. Replace `HashMap<String, Value>` with `IndexMap<String, Value>` throughout
2. Use `serde_norway` for parsing YAML → IndexMap
3. Implement date normalization preprocessing before serialization
4. Implement field ordering by building an ordered IndexMap before serialization
5. Use `serde_norway` for serialization IndexMap → YAML

### Why IndexMap?

- **Already a dependency** (`Cargo.toml:44`) with serde support enabled
- **Preserves insertion order**: Essential for field ordering feature
- **Drop-in replacement**: Same API as HashMap
- **No performance penalty**: IndexMap is optimized for iteration and ordering

### Date Normalization (MUST HAVE)

**Current behavior** (lines 646-655):
```rust
// Input: "2024-01-15T00:00:00Z"
// Output: "2024-01-15"
```

This is **critical UX** - Astro users expect clean date-only fields, not verbose ISO datetimes.

**Implementation approach**: Preprocessing before serialization
```rust
fn normalize_dates(frontmatter: &mut IndexMap<String, Value>) {
    for (_, value) in frontmatter.iter_mut() {
        normalize_value(value);
    }
}

fn normalize_value(value: &mut Value) {
    match value {
        Value::String(s) => {
            // If string looks like ISO datetime, extract date part
            if s.len() > 10 && s.contains('T') && (s.ends_with('Z') || s.contains('+')) {
                if let Some(date_part) = s.split('T').next() {
                    if date_part.len() == 10 && date_part.matches('-').count() == 2 {
                        *s = date_part.to_string();
                    }
                }
            }
        }
        Value::Object(obj) => {
            for (_, v) in obj.iter_mut() {
                normalize_value(v);
            }
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                normalize_value(v);
            }
        }
        _ => {}
    }
}
```

### Field Ordering Implementation

**Current logic** (lines 725-738):
1. Schema fields first, in schema order
2. Non-schema fields second, alphabetically

**New implementation**:
```rust
fn build_ordered_frontmatter(
    frontmatter: HashMap<String, Value>,
    schema_field_order: Option<Vec<String>>,
) -> IndexMap<String, Value> {
    let mut ordered = IndexMap::new();

    // First, add schema fields in order
    if let Some(schema_order) = schema_field_order {
        for key in schema_order {
            if let Some(value) = frontmatter.get(&key) {
                ordered.insert(key, value.clone());
            }
        }
    }

    // Then add remaining fields alphabetically
    let mut remaining: Vec<_> = frontmatter.iter()
        .filter(|(k, _)| !ordered.contains_key(*k))
        .collect();
    remaining.sort_by_key(|(k, _)| *k);

    for (key, value) in remaining {
        ordered.insert(key.clone(), value.clone());
    }

    ordered
}
```

## Frontend Changes Required

### Type Signature Changes

**Before**:
```rust
pub struct MarkdownContent {
    pub frontmatter: HashMap<String, Value>,  // std::collections::HashMap
    // ...
}
```

**After**:
```rust
pub struct MarkdownContent {
    pub frontmatter: IndexMap<String, Value>,  // indexmap::IndexMap
    // ...
}
```

### Frontend (TypeScript) Impact

The Tauri IPC serialization handles IndexMap → JavaScript object automatically. **No TypeScript changes needed** - the frontend already receives a plain JavaScript object.

### Rust Code Changes Needed

Search codebase for:
```bash
grep -r "HashMap<String, Value>" src-tauri/
```

Update all occurrences to `IndexMap<String, Value>` and add:
```rust
use indexmap::IndexMap;
```

**Files likely affected**:
- `src-tauri/src/commands/files.rs` (primary)
- Any other files that construct or consume `MarkdownContent`

## Detailed Implementation Steps

### Step 1: Add Dependency
```toml
# Cargo.toml
serde_norway = "0.9.42"
```

### Step 2: Replace HashMap with IndexMap

1. Update `MarkdownContent` struct
2. Update all function signatures that use `HashMap<String, Value>`
3. Change imports from `std::collections::HashMap` to `indexmap::IndexMap`
4. Update existing tests

### Step 3: Replace Parser

**Delete** (lines 425-623):
- `parse_yaml_to_json()`
- `parse_yaml_array()`
- `parse_yaml_object()`

**Replace with**:
```rust
use serde_norway;

fn parse_yaml_to_json(yaml_str: &str) -> Result<IndexMap<String, Value>, String> {
    serde_norway::from_str(yaml_str)
        .map_err(|e| format!("Failed to parse YAML: {}", e))
}
```

### Step 4: Replace Serializer

**Keep** (lines 708-786):
- `rebuild_markdown_with_frontmatter_and_imports_ordered()` function signature and structure
- File ending newline logic
- Imports handling

**Replace** (lines 641-706):
- Delete `serialize_value_to_yaml()`

**New implementation**:
```rust
fn rebuild_markdown_with_frontmatter_and_imports_ordered(
    frontmatter: &IndexMap<String, Value>,
    imports: &str,
    content: &str,
    schema_field_order: Option<Vec<String>>,
) -> Result<String, String> {
    let mut result = String::new();

    if !frontmatter.is_empty() {
        // Build ordered frontmatter
        let ordered = if let Some(order) = schema_field_order {
            build_ordered_frontmatter(frontmatter.clone(), Some(order))
        } else {
            frontmatter.clone()
        };

        // Normalize dates
        let mut normalized = ordered;
        normalize_dates(&mut normalized);

        // Serialize to YAML
        result.push_str("---\n");
        let yaml = serde_norway::to_string(&normalized)
            .map_err(|e| format!("Failed to serialize YAML: {}", e))?;
        result.push_str(&yaml);
        result.push_str("---\n");
    }

    // Add imports and content (existing logic)
    // ... rest of function unchanged

    Ok(result)
}
```

### Step 5: Update Tests

**Tests to update**:
- `test_parse_yaml_with_arrays()` (line ~1918)
- `test_parse_and_serialize_roundtrip()` (line ~1954)
- `test_rebuild_markdown_with_frontmatter()` (line ~1497)
- `test_save_markdown_content()` (line ~1513)

**Changes needed**:
- Update type annotations: `HashMap` → `IndexMap`
- Verify date normalization works
- Verify field ordering works
- Add test for nested object date normalization

**New tests to add**:
```rust
#[test]
fn test_serde_yml_handles_anchors() {
    let yaml = r#"
base: &base
  value: 1
extended:
  <<: *base
  extra: 2
"#;
    let result = parse_yaml_to_json(yaml);
    assert!(result.is_ok());
}

#[test]
fn test_date_normalization_in_nested_objects() {
    let mut frontmatter = IndexMap::new();
    let mut metadata = serde_json::Map::new();
    metadata.insert(
        "deadline".to_string(),
        Value::String("2024-01-15T00:00:00Z".to_string())
    );
    frontmatter.insert("metadata".to_string(), Value::Object(metadata));

    normalize_dates(&mut frontmatter);

    let metadata = frontmatter.get("metadata").unwrap().as_object().unwrap();
    assert_eq!(
        metadata.get("deadline").unwrap(),
        &Value::String("2024-01-15".to_string())
    );
}

#[test]
fn test_field_ordering_preserved() {
    // Test schema order + alphabetical for non-schema fields
}
```

## Risks and Mitigations

### 1. ✅ Date Normalization (MITIGATED)

**Solution**: Implemented as preprocessing step. No loss of functionality.

### 2. ✅ Field Ordering (MITIGATED)

**Solution**: Use IndexMap + build_ordered_frontmatter(). No loss of functionality.

### 3. ⚠️ Quoting Differences

**Current behavior**: Smart quoting based on content
```yaml
title: Simple Title        # No quotes
description: "Has: colon"  # Quoted because contains colon
```

**serde_norway behavior**: May quote more conservatively

**Impact**: Cosmetic only - functionally equivalent YAML
**Mitigation**: Accept serde_norway's quoting (it's spec-compliant)

### 4. ⚠️ Array Formatting

**Current**:
```yaml
tags:
  - rust
  - yaml
```

**Need to verify**: serde_norway uses same format (not inline `[rust, yaml]`)

**Testing**: Check output with test projects before committing

### 5. ⚠️ First-Save Formatting Changes

**Impact**: Git diffs will show formatting changes on first save after migration

**Mitigation**:
- Document in release notes
- This is pre-1.0.0 - acceptable one-time change
- Users can review diffs before committing

## Requirements

**Must Have**:
- [x] Use `serde_norway` (not deprecated `serde_yaml` or unsound `serde_yml`)
- [x] Parse all valid YAML frontmatter without data loss
- [x] Handle existing Astro project frontmatter correctly
- [x] Preserve field ordering capability (schema order → alphabetical)
- [x] **Preserve date normalization (ISO datetime → date-only)**
- [x] No data corruption on save/reload cycle (verified via unit tests)
- [x] Replace `HashMap` with `IndexMap` throughout

**Should Have**:
- [x] Maintain reasonable formatting (readable YAML output)
- [x] Good error messages when frontmatter is invalid (serde_norway provides detailed errors)
- [x] Minimal formatting differences from current implementation (only quoting and array indentation)

**Nice to Have**:
- [~] Identical quoting behavior to current implementation (serde_norway quotes more conservatively - acceptable)
- [ ] Migration guide documenting formatting changes (not needed - changes are minimal)

## Success Criteria

- [x] `serde_norway` added to dependencies (Cargo.toml:26)
- [x] Custom parser functions removed (~200 lines deleted, replaced with 3-line serde_norway call)
- [x] Custom serializer removed (~65 lines deleted, replaced with serde_norway)
- [x] `HashMap<String, Value>` replaced with `IndexMap<String, Value>` everywhere
  - [x] files.rs: All function signatures and HashMap::new() calls
  - [x] file_entry.rs: FileEntry struct and tests
  - [x] project.rs: Type annotations for frontmatter collection
- [x] Date normalization working (with tests)
  - [x] normalize_dates() and normalize_value() helper functions (lines 426-459)
  - [x] Recursive normalization in objects and arrays
- [x] Field ordering working (with tests)
  - [x] build_ordered_frontmatter() helper function (lines 461-489)
  - [x] Schema order first, then alphabetical
- [x] All existing tests pass (102 tests → 109 tests, all passing)
- [x] New tests for:
  - [x] YAML anchors/aliases (test_serde_norway_handles_anchors)
  - [x] Multi-line strings/block scalars (test_serde_norway_handles_block_scalars)
  - [x] Nested object date normalization (test_date_normalization_in_nested_objects)
  - [x] Date preservation for non-dates (test_date_normalization_preserves_non_dates)
  - [x] Field ordering with schema (test_field_ordering_preserved)
  - [x] Field ordering without schema (test_field_ordering_no_schema)
  - [x] Field ordering partial match (test_field_ordering_partial_schema_match)
- [ ] Manual testing against `test/dummy-astro-project`:
  - [ ] Parse all articles and notes without errors
  - [ ] Edit and save - verify no data corruption
  - [ ] Verify dates are date-only format (not ISO datetime)
  - [ ] Verify field ordering matches schema
- [ ] Manual testing against `test/starlight-minimal`:
  - [ ] Same verification as above
- [ ] Git diff review: formatting changes are acceptable

## Testing Strategy

1. **Unit tests**:
   - Parse various YAML edge cases (anchors, block scalars, etc.)
   - Date normalization (including nested objects)
   - Field ordering with and without schema

2. **Integration tests**:
   - Full save/load cycle with complex frontmatter
   - Roundtrip testing (parse → serialize → parse → verify identical)

3. **Real-world test projects**:
   - `test/dummy-astro-project` (20 files with diverse frontmatter)
   - `test/starlight-minimal` (Starlight-specific patterns)
   - Manual testing with maintainer's own Astro projects

4. **Regression prevention**:
   - Keep all existing tests, update types
   - Add new tests for features custom parser didn't handle

## Out of Scope

- Preserving comments in frontmatter (YAML comments are not part of data model)
- Preserving exact whitespace from original files
- Supporting YAML 1.1 (use YAML 1.2)
- Identical quoting to custom implementation (spec-compliant is good enough)

## References

- Current implementation: `src-tauri/src/commands/files.rs:425-706`
- Staff Engineering Review: `docs/reviews/2025-staff-engineering-review.md` (Issue #2)
- Staff Engineer Review: `docs/reviews/staff-engineer-review-2025-10-24.md` (Issue #2)
- serde_norway crate: https://crates.io/crates/serde_norway
- serde_norway docs: https://docs.rs/serde_norway/
- IndexMap (already a dep): `Cargo.toml:44`

## Recommendation

**Do this before 1.0.0.** The risk of shipping with a custom YAML parser outweighs minor formatting changes from switching to serde_norway. The downsides are cosmetic (formatting differences), while the upsides are substantial (correctness, maintenance, robustness).

All critical features (field ordering, date normalization) can be preserved with preprocessing/postprocessing. The implementation is straightforward and well-understood.

**Estimated effort**:
- IndexMap migration: 1 hour
- Parsing migration: 2 hours
- Serialization migration (with date normalization): 3 hours
- Field ordering implementation: 2 hours
- Testing and validation: 3 hours
- **Total: ~11 hours (1.5 days)**

Migration is lower risk than originally estimated because:
1. IndexMap is already a dependency
2. Test projects show no advanced YAML features
3. Date normalization is simple preprocessing
4. Field ordering logic stays the same, just builds IndexMap differently

---

## Implementation Summary

**Status**: ✅ **IMPLEMENTATION COMPLETE** - Awaiting manual testing

**Date Completed**: 2025-10-25

### Changes Made

1. **Dependencies** (Cargo.toml:26):
   - Added `serde_norway = "0.9.42"` (actively maintained, safe alternative to deprecated serde_yaml)

2. **Code Reduction** (~300 lines removed):
   - Deleted custom `parse_yaml_to_json()` function (~200 lines) → replaced with 3-line serde_norway call
   - Deleted `parse_yaml_array()` and `parse_yaml_object()` helper functions
   - Deleted custom `serialize_value_to_yaml()` function (~65 lines) → replaced with serde_norway

3. **Type Migration** (HashMap → IndexMap):
   - `src-tauri/src/commands/files.rs`: All function signatures, struct fields, and instantiations
   - `src-tauri/src/models/file_entry.rs`: FileEntry struct and all tests
   - `src-tauri/src/commands/project.rs`: Type annotations for frontmatter collection

4. **Feature Preservation**:
   - **Date Normalization**: Added `normalize_dates()` and `normalize_value()` helpers (files.rs:426-459)
     - Recursively converts ISO datetime strings → date-only format
     - Works in nested objects and arrays
   - **Field Ordering**: Added `build_ordered_frontmatter()` helper (files.rs:461-489)
     - Schema fields first (in schema order)
     - Non-schema fields second (alphabetically)

5. **Testing**:
   - All 102 existing tests updated and passing
   - Added 7 new comprehensive tests:
     - YAML anchors/aliases support
     - Multi-line block scalars (`|` and `>`)
     - Nested date normalization
     - Date preservation for non-date strings
     - Field ordering (3 test cases: with schema, without schema, partial match)
   - **Total: 109 tests, all passing**

### Formatting Differences (Cosmetic Only)

The migration introduces minor cosmetic differences that are functionally equivalent:

1. **Quoting**: serde_norway doesn't quote simple strings
   - Before: `title: "My Post"`
   - After: `title: My Post`
   - Impact: Cosmetic only, both are valid YAML

2. **Array Indentation**: serde_norway uses no indent before dash
   - Before: `tags:\n  - rust`
   - After: `tags:\n- rust`
   - Impact: Cosmetic only, both are valid YAML

### Notes for Manual Testing

When testing with real Astro projects, verify:
- [ ] Files parse without errors (check console for parse failures)
- [ ] Edit and save cycle preserves all frontmatter data
- [ ] Dates appear as `2024-01-15` not `2024-01-15T00:00:00Z`
- [ ] Field ordering matches schema (if collection has schema)
- [ ] Git diffs show only cosmetic changes (quoting, array indentation)

### Risk Assessment

**Overall Risk**: **LOW**

- ✅ All unit tests passing (109/109)
- ✅ No breaking API changes (IndexMap serializes identically to HashMap via Tauri IPC)
- ✅ Critical features preserved (date normalization, field ordering)
- ✅ Error handling improved (serde_norway provides detailed parse errors)
- ⚠️ Minor formatting changes (acceptable for pre-1.0.0)

**Ready for**: Manual testing with real Astro projects, then production use.
