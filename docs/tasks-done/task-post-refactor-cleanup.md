# Task: Post-Refactor Cleanup & Test Improvements

**Status:** 📋 Ready to Start
**Priority:** Medium
**Prerequisites:** Task 2 (Schema Architecture Refactor) - Phase 4 Complete

---

## Overview

After completing the schema architecture refactor (Task 2), several cleanup items remain:

1. **Deprecated Tests**: 7 ignored tests in `parser.rs` testing old Zod parsing
2. **Failing Tests**: 5 TypeScript tests with incorrect mock data
3. **Test Coverage Gaps**: Comprehensive test coverage for `schema_merger.rs`
4. **Code Cleanup**: Remove or properly document deprecated parser code

This task consolidates all post-refactor cleanup work.

---

## 1. Fix Failing TypeScript Tests

**Location:** `src/components/frontmatter/FrontmatterPanel.test.tsx`

**Issue:** 5 tests failing because they expect the wrong UI rendering behavior for schema fields.

### Tests Needing Fixes

All test mocks have been updated to use `complete_schema` instead of `schema`, but some tests have expectations that don't match the actual component behavior:

1. **"should show frontmatter fields when file is selected"** (line 64)
   - Expects `screen.getByRole('switch')` but component might render differently
   - Needs investigation of actual BooleanField rendering

2. **"should use schema information when available"** (line 226)
   - Expects `screen.getByRole('switch')` and `screen.getByPlaceholderText('Enter tags...')`
   - Verify these match actual component rendering

3. **"should show all schema fields even when not in frontmatter"** (line 268)
   - Expects `screen.getByPlaceholderText('Enter description...')`
   - Verify StringField placeholder text

4. **"should use TagInput for array fields defined in schema"** (line 338)
   - Expects individual tag elements with text content
   - Currently renders as `value="react,typescript"` instead
   - Investigate if TagInput is rendering correctly or if test expectations are wrong

5. **"should use TagInput for array fields not in schema but present in frontmatter"** (line 375)
   - Similar issue with tag rendering expectations

### Action Items

- [ ] Debug test failures by rendering components and inspecting actual DOM
- [ ] Update test expectations to match actual component behavior
- [ ] Ensure tests verify business logic, not implementation details
- [ ] Consider using `screen.debug()` to understand actual rendering

**Estimated Effort:** 2-3 hours

---

## 2. Handle Deprecated Parser.rs Tests

**Location:** `src-tauri/src/parser.rs`

**Current State:** 7 tests marked as `#[ignore]` with comment: "Deprecated: Tests old Zod parsing - schema now generated in project.rs"

### Ignored Tests

1. `test_enhanced_schema_parsing` (line 1113)
2. `test_literal_field_parsing` (line 1161)
3. `test_union_field_parsing` (line 1198)
4. `test_optional_syntax_parsing` (line 1236)
5. `test_string_constraints_parsing` (line 1292)
6. `test_number_constraints_parsing` (line 1339)
7. `test_multiline_field_normalization` (line 1426)

### Options

**Option A: Delete Tests Entirely**
- These test old Zod parsing which is completely removed
- Parser now only discovers collections, doesn't parse schemas
- Tests are no longer relevant to current functionality

**Option B: Convert to schema_merger.rs Tests**
- Port test patterns to `src-tauri/src/schema_merger.rs` tests
- Use same test cases but test the new parsing implementation
- Maintains test coverage for parsing edge cases

**Option C: Keep as Reference**
- Leave ignored tests in place as reference documentation
- Add comprehensive comment explaining their historical purpose
- Useful for understanding what used to be tested

### Recommendation

**Option A (Delete)** for tests 1-7, **BUT** extract valuable test cases and add them to `schema_merger.rs` test suite.

**Action Items:**

- [ ] Review each ignored test to identify unique test cases
- [ ] Port valuable test cases to `src-tauri/src/schema_merger.rs` tests
- [ ] Delete ignored tests from `parser.rs`
- [ ] Update `parser.rs` test documentation

**Estimated Effort:** 3-4 hours

---

## 3. Comprehensive schema_merger.rs Test Coverage

**Location:** `src-tauri/src/schema_merger.rs`

**Current State:** Module has basic functionality working but lacks comprehensive test coverage.

### Test Coverage Needed

From Task 2 specification, the following test areas need coverage:

#### Primitives & Constraints
- [ ] String with minLength/maxLength
- [ ] String with format: email, uri
- [ ] Number with min/max, exclusiveMinimum/exclusiveMaximum
- [ ] Integer detection
- [ ] Boolean fields
- [ ] Date (anyOf with date-time, date, unix-time)

#### Complex Types
- [ ] Enum (type: string, enum: [...])
- [ ] Literal (type: string, const: "value")
- [ ] Arrays (simple, with items schema, with minItems/maxItems)
- [ ] Tuples (array with items as array)
- [ ] Nested objects (flatten with dot notation)
- [ ] Records (additionalProperties)
- [ ] Unions (anyOf array - non-reference, non-date)

#### References
- [ ] Single reference detection (anyOf pattern)
- [ ] Array of references detection
- [ ] Self-references (articles → articles)

#### Zod Reference Extraction
- [ ] Extract from `reference('collectionName')`
- [ ] Extract from `z.array(reference('collectionName'))`
- [ ] Handle single and double quotes
- [ ] Build correct map of field_name → collection_name

#### Schema Merging
- [ ] JSON schema alone (no references)
- [ ] JSON + Zod merge (references populated)
- [ ] Single references get `reference_collection`
- [ ] Array references get `array_reference_collection`
- [ ] Fallback to Zod-only when JSON schema missing/malformed

#### File-based Collections
- [ ] Detect additionalProperties structure
- [ ] Use additionalProperties as entry schema
- [ ] Parse correctly (authors.json example)

#### TypeScript Integration
- [ ] `deserializeCompleteSchema()` correctly maps all fields
- [ ] Field type enum mapping works
- [ ] snake_case to camelCase conversion works
- [ ] Handles missing optional fields gracefully
- [ ] Preserves all metadata (constraints, description, default, etc.)

### Test Organization

Create comprehensive test files:
```
src-tauri/src/
├── schema_merger.rs
└── schema_merger/
    ├── tests/
    │   ├── test_json_schema_primitives.rs
    │   ├── test_json_schema_complex_types.rs
    │   ├── test_json_schema_references.rs
    │   ├── test_zod_parsing.rs
    │   ├── test_schema_merging.rs
    │   └── test_edge_cases.rs
    └── mod.rs
```

**Action Items:**

- [ ] Create test directory structure
- [ ] Write test fixtures (example schemas)
- [ ] Implement comprehensive test suite covering all areas
- [ ] Achieve >90% code coverage for schema_merger.rs
- [ ] Document test patterns for future maintainers

**Estimated Effort:** 8-12 hours

---

## 4. Deprecate or Remove Old Parser Code

**Location:** `src-tauri/src/parser.rs`

**Current State:**
- Old Zod parsing functions marked with `#[allow(dead_code)]`
- Large comment at top: "NOTE: The following structs and functions are deprecated..."
- Functions kept for reference but not used

### Deprecated Code (lines 5-1017)

**Structs:**
- `ZodField`
- `ZodFieldConstraints`
- `ZodFieldType` enum
- `ParsedSchema`

**Functions (~20 functions):**
- `extract_basic_schema()`
- `extract_schema_from_collection_block()`
- `parse_schema_fields()`
- `process_field()`
- `extract_enum_values()`
- `parse_field_type_and_constraints()`
- `normalize_field_definition()`
- `extract_optional_inner_type()`
- `extract_reference_collection()`
- `extract_array_inner_type()`
- `extract_union_types()`
- `extract_literal_value()`
- `extract_string_constraints()`
- `extract_number_constraints()`
- `serialize_constraints()`
- `extract_default_value()`

### Options

**Option A: Delete Entirely**
- Remove all deprecated code (~1000 lines)
- Cleaner codebase
- Risk: Lose implementation reference if needed later

**Option B: Move to Separate Archive Module**
```
src-tauri/src/
├── parser.rs           # Only active code
└── parser_deprecated.rs # Archived for reference
```
- Keeps reference available
- Removes clutter from main module
- Can be deleted later if never needed

**Option C: Document and Keep**
- Add comprehensive documentation explaining history
- Keep current `#[allow(dead_code)]` approach
- Simplest option, most clutter

### Recommendation

**Option B (Archive)**: Move to `parser_deprecated.rs` with explanation comment:

```rust
// This module contains the deprecated Zod schema parsing implementation
// from before the schema architecture refactor (2025-10).
//
// It is preserved for reference only and should not be used in new code.
// All schema parsing now happens in schema_merger.rs.
//
// See: docs/tasks-done/task-2-schema-architecture-refactor.md
```

**Action Items:**

- [ ] Create `parser_deprecated.rs` with deprecation notice
- [ ] Move all deprecated code to new module
- [ ] Update `lib.rs` if needed (code is already unused)
- [ ] Remove deprecated code from `parser.rs`
- [ ] Verify compilation still works
- [ ] Add note in module docs explaining the archive

**Estimated Effort:** 1-2 hours

---

## 5. Documentation Updates

### Update Existing Docs

- [x] `docs/developer/architecture-guide.md` - Updated Schema Processing section
- [x] `CLAUDE.md` - Updated key files reference
- [ ] `docs/developer/astro-generated-contentcollection-schemas.md` - Update to reflect new parsing location (Rust)

### New Documentation

- [ ] Add JSDoc to `deserializeCompleteSchema()` in `schema.ts`
- [ ] Add Rust docs to key functions in `schema_merger.rs`
- [ ] Document test patterns in schema_merger tests

**Action Items:**

- [ ] Review and update Astro schemas doc
- [ ] Add comprehensive JSDoc/Rustdoc comments
- [ ] Update any remaining references to old parsing approach

**Estimated Effort:** 2-3 hours

---

## Success Criteria

### Phase 1: Test Fixes (Quick Wins)
- [ ] All 5 TypeScript tests passing
- [ ] Tests verify business logic correctly
- [ ] No test warnings or errors

### Phase 2: Parser Cleanup
- [ ] Deprecated parser tests either deleted or ported
- [ ] parser.rs only contains active collection discovery code
- [ ] Deprecated parsing code archived in separate module
- [ ] All Rust tests passing

### Phase 3: Test Coverage
- [ ] schema_merger.rs has comprehensive test suite
- [ ] >90% code coverage for schema_merger module
- [ ] All test categories from Task 2 spec covered
- [ ] Test documentation in place

### Phase 4: Documentation
- [ ] All docs updated to reflect new architecture
- [ ] Code comments accurate and helpful
- [ ] No references to removed code

---

## Priority & Sequencing

### High Priority (Do First)
1. Fix failing TypeScript tests (blocks confidence in test suite)
2. Decide on deprecated parser tests (clean up technical debt)

### Medium Priority (Do Next)
3. Comprehensive schema_merger tests (ensures reliability)
4. Archive deprecated parser code (reduces clutter)

### Low Priority (Nice to Have)
5. Documentation polish (improves maintainability)

---

## Estimated Total Effort

- **Minimum (Quick fixes only):** 5-7 hours
- **Recommended (All high + medium):** 15-20 hours
- **Complete (Everything):** 20-25 hours

---

## Notes

- This task can be done incrementally - each section is independent
- Tests are the highest priority to maintain confidence in the codebase
- Deprecated code cleanup is technical debt but not urgent
- Comprehensive tests are an investment in long-term quality

---

**Last Updated:** 2025-10-09
**Related Tasks:**
- Supersedes: `task-2-schema-architecture-refactor.md` (Phase 4 cleanup items)
- Depends on: Task 2 Phase 4 completion
