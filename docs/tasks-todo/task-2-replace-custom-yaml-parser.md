# Replace Custom YAML Parser with serde_yaml

**Priority**: HIGH (should fix before 1.0.0)
**Effort**: ~1-2 days
**Type**: Reliability, maintenance, code simplification

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

## Benefits of Using serde_yaml

1. **Robustness**: Handles entire YAML 1.2 spec correctly
2. **Security**: Battle-tested, security-audited implementation
3. **Code reduction**: Delete ~300 lines of complex parsing/serialization logic
4. **Better error messages**: serde_yaml provides detailed parse error context
5. **Maintainability**: Community-maintained, receives bug fixes and improvements

## Risks and Downsides

### 1. Loss of Custom Date Formatting ⚠️

**Current behavior**: Automatically converts ISO datetime strings to date-only format
```yaml
# Input from editor: 2024-01-15T00:00:00Z
# Output to file: 2024-01-15
```

**With serde_yaml**: May preserve full ISO format or require explicit handling

**Mitigation**:
- Implement date normalization in a preprocessing step before serialization
- Or accept that dates are stored in full ISO format (not necessarily bad)

### 2. Loss of Schema-Based Field Ordering ⚠️

**Current behavior**: Frontmatter fields are written in schema order, then alphabetically
```yaml
# Schema order: title, description, date, tags
title: My Post
description: About stuff
date: 2024-01-15
author: Danny  # Not in schema, added alphabetically
tags: [rust, yaml]
```

**With serde_yaml**: Default is insertion order or hash map order (unpredictable)

**Mitigation**:
- Use `serde_yaml::Mapping` which preserves insertion order
- Pre-sort keys before serialization (same logic, just different API)
- This feature can be preserved with serde_yaml

### 3. Different Quoting Decisions

**Current behavior**: Smart quoting based on content
```yaml
title: Simple Title        # No quotes
description: "Has: colon"  # Quoted because contains colon
```

**With serde_yaml**: May quote more conservatively or differently

**Impact**: Cosmetic only - functionally equivalent YAML, just different style

**Mitigation**: Accept serde_yaml's quoting decisions (they're correct by spec)

### 4. Whitespace/Formatting Changes

**Current behavior**: Custom indentation (2 spaces), specific array formatting

**With serde_yaml**: May format differently

**Impact**: Git diffs will show formatting changes on first save after migration

**Mitigation**:
- This is a one-time migration impact
- Document in release notes that formatting may change
- Users opening files for first time will see formatting diff

### 5. Migration Risk for Existing Users

If any users are already using the app (pre-1.0), their files may have been saved with custom parser quirks. Switching parsers might reveal inconsistencies.

**Mitigation**: This is pre-1.0.0 - no production users yet. Perfect time to make this change.

## Implementation Approach

### Option A: Full Replacement (Recommended)

Replace both parsing and serialization with serde_yaml.

**Pros**:
- Simplest, most robust
- Deletes most custom code
- Standard YAML everywhere

**Cons**:
- Need to reimplement date normalization if desired
- Need to reimplement field ordering (but can use same logic)

### Option B: Hybrid (Use serde for parsing only)

Use serde_yaml for parsing, keep custom serializer for exact format control.

**Pros**:
- Preserves exact current output format
- Reduces risk of formatting changes

**Cons**:
- Still maintains ~100 lines of custom serialization code
- Doesn't fully solve the maintenance burden
- Asymmetric (different parser and serializer)

### Option C: Enhance Custom Parser

Add more edge case handling to custom parser instead of replacing.

**Pros**:
- No migration risk
- Keeps exact current behavior

**Cons**:
- **This is reinventing the wheel poorly**
- Would need to implement complex YAML spec features
- Testing burden is enormous
- Not recommended

## Requirements

**Must Have**:
- [ ] Parse all valid YAML frontmatter without data loss
- [ ] Handle existing Astro project frontmatter correctly
- [ ] Preserve field ordering capability (schema order → alphabetical)
- [ ] No data corruption on save/reload cycle

**Should Have**:
- [ ] Maintain reasonable formatting (readable YAML output)
- [ ] Preserve or improve date formatting (date-only for date fields)
- [ ] Good error messages when frontmatter is invalid

**Nice to Have**:
- [ ] Preserve exact current formatting style
- [ ] Migration guide for formatting changes

## Success Criteria

- [ ] `serde_yaml` added to dependencies
- [ ] Custom parser functions removed (`parse_yaml_to_json`, helper functions)
- [ ] Custom serializer replaced or simplified
- [ ] All existing tests pass
- [ ] New tests for edge cases (anchors, multi-line strings, complex nesting)
- [ ] Manual testing: Open real Astro project, verify frontmatter loads correctly
- [ ] Manual testing: Edit and save, verify no data corruption
- [ ] Git diff shows reasonable formatting (not wildly different)

## Testing Strategy

1. **Unit tests**: Parse various YAML edge cases
2. **Integration tests**: Full save/load cycle with complex frontmatter
3. **Real-world test**: Test with actual Astro projects containing:
   - Arrays of objects
   - Nested frontmatter
   - Special characters in strings
   - Dates in various formats
   - Boolean and numeric values

## Out of Scope

- Preserving comments in frontmatter (YAML comments are not part of data model)
- Preserving exact whitespace from original files
- Supporting YAML 1.1 vs 1.2 differences (use 1.2)

## References

- Current implementation: `src-tauri/src/commands/files.rs:425-706`
- Staff Engineering Review: `docs/reviews/2025-staff-engineering-review.md` (Issue #2)
- Staff Engineer Review: `docs/reviews/staff-engineer-review-2025-10-24.md` (Issue #2)
- serde_yaml crate: https://docs.rs/serde_yaml/latest/serde_yaml/

## Recommendation

**Do this before 1.0.0.** The risk of shipping with a custom YAML parser outweighs the minor formatting changes from switching to serde_yaml. The downsides are mostly cosmetic (formatting differences), while the upsides are substantial (correctness, maintenance, robustness).

The field ordering and date formatting features can be preserved with some glue code - they don't require a full custom parser.

**Estimated effort**:
- Parsing migration: 2-3 hours
- Serialization migration: 3-4 hours
- Testing and edge case handling: 2-3 hours
- Total: 1 full day (maybe 2 if field ordering preservation is tricky)
