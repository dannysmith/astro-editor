# Rust Refactorings

## Overview

Improve Rust backend code quality through focused refactorings that reduce complexity, eliminate duplication, and improve testability. These refactorings target the parser and schema merger modules.

**Total Time:** 2-3 weeks (can be done incrementally)

**Impact:**
- Reduced cyclomatic complexity (~40%)
- Eliminated code duplication (~30 lines saved per refactoring)
- Improved testability and maintainability
- Easier to add new features and handle edge cases

**Dependencies:** Task 2 (Testing) provides safety net with comprehensive test coverage.

---

## Before Starting Implementation

**Safety Checks:**

```bash
# 1. Verify all tests pass (establishes baseline)
cargo test --lib

# 2. Create feature branch
git checkout -b refactor/rust-code-quality

# 3. Commit current state (checkpoint to return to if needed)
git add .
git commit -m "Checkpoint before Rust refactoring"

# 4. Verify Task 2 complete
ls docs/tasks-done/task-*-testing*.md
```

**Current Test Status:**
- Total tests: 127 passing
- Parser tests: 26 tests
- Schema merger tests: 4 tests (needs expansion)
- Import extraction tests: 2 tests

---

## Item 1: Simplify Brace Matching Logic (parser.rs)

**Priority:** HIGH (Foundation for other Rust refactorings)
**File:** `src-tauri/src/parser.rs`
**Lines:** Multiple functions (146-206, 294-335, 338-368)
**Time:** 2-3 days
**Risk:** LOW

### Current Issues

Three functions have nearly identical brace-counting logic:
- `extract_collections_block` (lines 146-206)
- `extract_basic_schema` (lines 294-335)
- `extract_schema_from_collection_block` (lines 338-368)

This duplication means:
- Bug fixes must be applied to all locations
- No single source of truth for brace matching
- Harder to handle edge cases (strings with braces, comments)

### Proposed Solution

Create a shared generic utility function:

```rust
/// Finds the position of the matching closing brace for an opening brace
///
/// # Arguments
/// * `content` - The string to search
/// * `start_pos` - Position of the opening brace
/// * `open_char` - The opening character (e.g., '{', '[', '(')
/// * `close_char` - The closing character (e.g., '}', ']', ')')
///
/// # Returns
/// * `Ok(usize)` - Position of the matching closing brace
/// * `Err(String)` - Error if no matching brace found
fn find_matching_closing_brace(
    content: &str,
    start_pos: usize,
    open_char: char,
    close_char: char
) -> Result<usize, String>
```

**Important Limitation:**
This utility performs naive character counting and does NOT handle:
- Strings containing braces (e.g., `"{"` or `"}"`)
- Comments containing braces
- Template literals or other JavaScript string features

The current implementations also don't handle these cases, so we maintain existing behavior. Future enhancement could add context-aware parsing if needed.

### Implementation Steps

1. **Create the utility function** at the top of `parser.rs` (after imports, before other functions):
   - Initialize brace counter to 1 (we're starting after the opening brace)
   - Iterate from `start_pos + 1` to end of content
   - Increment counter for `open_char`, decrement for `close_char`
   - Return position when counter reaches 0
   - Return error if end reached with unclosed braces

2. **Update `extract_collections_block`** (lines 146-206):
   - Find the line where brace counting starts (around line 165)
   - Replace the manual counting loop with `find_matching_closing_brace()`
   - Keep error handling logic

3. **Update `extract_basic_schema`** (lines 294-335):
   - Find the brace counting section
   - Replace with utility function call
   - Preserve the schema extraction logic

4. **Update `extract_schema_from_collection_block`** (lines 338-368):
   - Replace brace counting with utility function
   - Keep the schema block extraction logic

5. **Add comprehensive tests**:
   - Test nested braces: `{ { } }`
   - Test unmatched braces: `{ { }` (should error)
   - Test empty blocks: `{}`
   - Test with content: `{ foo: "bar" }`
   - Note: Strings with braces like `{ str: "}" }` will NOT work correctly (known limitation)

### Testing Strategy

**Before refactoring:**
```bash
# Run existing tests to establish baseline
cd src-tauri
cargo test parser -- --nocapture
```

**After refactoring:**
```bash
# Ensure all existing tests still pass
cargo test parser -- --nocapture

# Run new utility function tests
cargo test find_matching_closing_brace -- --nocapture
```

**Test cases to add** (in the test module at bottom of parser.rs):

```rust
#[test]
fn test_find_matching_closing_brace_simple() {
    let content = "{ foo }";
    let result = find_matching_closing_brace(content, 0, '{', '}');
    assert_eq!(result.unwrap(), 6);
}

#[test]
fn test_find_matching_closing_brace_nested() {
    let content = "{ { } }";
    let result = find_matching_closing_brace(content, 0, '{', '}');
    assert_eq!(result.unwrap(), 6);
}

#[test]
fn test_find_matching_closing_brace_unmatched() {
    let content = "{ { }";
    let result = find_matching_closing_brace(content, 0, '{', '}');
    assert!(result.is_err());
}
```

### Error Handling

- Return descriptive error messages: `"Unclosed braces: expected closing '}' but reached end of content"`
- Preserve existing error context from calling functions
- Add debug logging for the new utility function

### Expected Benefits

- Single source of truth for brace matching (~30 lines saved)
- Bug fixes benefit all call sites automatically
- Easier to add special case handling (strings, comments) later
- More testable in isolation

### Milestone

✅ **Complete when:** `cargo test parser -- --nocapture` passes with all 26+ tests

### Quality Check

```bash
pnpm run check:all
```

---

## Item 2: Extract Frontmatter Import Parsing Logic (files.rs)

**Priority:** HIGH
**File:** `src-tauri/src/commands/files.rs`
**Lines:** 382-466 (`extract_imports_from_content` function)
**Time:** 2-3 days
**Risk:** LOW (comprehensive tests exist)

### Current Issues

The `extract_imports_from_content` function (~85 lines, cyclomatic complexity ~12):
- Mixed concerns: import detection + empty line handling + markdown block detection
- Nested loops for multi-line import continuation (lines 401-425)
- Complex look-ahead logic for empty line handling (lines 427-445)
- Difficult to understand the complete logic flow at a glance

**Actual complexity drivers:**
- Three different loop types: import extraction, multi-line continuation, and empty line look-ahead
- Multiple termination conditions checked in different places
- Markdown block detection interleaved with import parsing

### Proposed Solution

Extract focused helper functions that match the actual implementation:

```rust
/// Check if a trimmed line starts an import or export statement
fn is_import_line(trimmed: &str) -> bool {
    trimmed.starts_with("import ") || trimmed.starts_with("export ")
}

/// Check if a line is a continuation of a multi-line import
fn is_import_continuation(line: &str) -> bool {
    let trimmed = line.trim();
    !trimmed.is_empty()
        && !is_markdown_block_start(trimmed)
        && !has_import_terminator(trimmed)
}

/// Check if a line has an import terminator (semicolon or closing quote)
fn has_import_terminator(trimmed: &str) -> bool {
    trimmed.ends_with(';')
        || trimmed.ends_with("';")
        || trimmed.ends_with("\";")
}

/// Check if there are more imports after empty lines (look-ahead logic)
/// Returns true if we should skip the empty line and continue collecting imports
fn should_skip_empty_line(lines: &[&str], current_idx: usize) -> bool {
    // Extract lines 427-445 logic into this helper
    let mut next_idx = current_idx + 1;
    while next_idx < lines.len() && lines[next_idx].trim().is_empty() {
        next_idx += 1;
    }

    if next_idx < lines.len() {
        let next_line = lines[next_idx].trim();
        is_import_line(next_line)
    } else {
        false
    }
}
```

### Implementation Steps

1. **Add helper functions** after `is_markdown_block_start` (around line 350):
   - Add `is_import_line()` - simple check for import/export start
   - Add `is_import_continuation()` - combines empty check, markdown check, and terminator check
   - Add `has_import_terminator()` - checks for semicolon or quote endings
   - Add `should_skip_empty_line()` - extracts the look-ahead logic (lines 427-445)
   - Add comprehensive doc comments for each function

2. **Refactor main loop** in `extract_imports_from_content` (lines 392-449):
   - Replace `line.starts_with("import ")` checks (line 396) with `is_import_line()`
   - Replace multi-line continuation conditions (lines 401-424) with `is_import_continuation()`
   - Replace empty line look-ahead block (lines 427-445) with `should_skip_empty_line()`
   - Preserve the overall structure: outer loop → import detection → multi-line loop → empty line handling

3. **Simplify control flow**:
   - Reduce nesting in multi-line import loop by using the new helper
   - Add comments documenting the three-phase logic: detection → continuation → look-ahead
   - Keep markdown block detection in place (it's already well-separated)

4. **Add unit tests for each helper**:
   - Test `is_import_line()` with various formats (with/without spaces, import vs export)
   - Test `is_import_continuation()` with empty lines, markdown blocks, and terminated lines
   - Test `has_import_terminator()` with all three ending formats
   - Test `should_skip_empty_line()` with different scenarios (more imports, no imports, EOF)

### Testing Strategy

**Existing test coverage** (lines 1383-1453):
- Various import formats
- Multi-line imports
- Markdown blocks
- Edge cases

**Before refactoring:**
```bash
cd src-tauri
cargo test extract_imports -- --nocapture
```

**New tests to add** (in test module):

```rust
#[test]
fn test_is_import_line() {
    // Should detect imports and exports
    assert!(is_import_line("import { foo } from 'bar'"));
    assert!(is_import_line("export const foo = 'bar'"));

    // Should handle leading spaces (line is already trimmed)
    assert!(is_import_line("import foo from 'bar'"));

    // Should not match imports within strings
    assert!(!is_import_line("const foo = 'import'"));
}

#[test]
fn test_is_import_continuation() {
    // Should continue on non-empty, non-terminated lines
    assert!(is_import_continuation("  from 'foo'"));

    // Should NOT continue on empty lines
    assert!(!is_import_continuation(""));

    // Should NOT continue on terminated lines
    assert!(!is_import_continuation("from 'foo';"));
    assert!(!is_import_continuation("from 'foo'"));

    // Should NOT continue on markdown blocks
    assert!(!is_import_continuation("# Heading"));
}

#[test]
fn test_has_import_terminator() {
    assert!(has_import_terminator("from 'foo';"));
    assert!(has_import_terminator("from 'foo'"));
    assert!(has_import_terminator("from \"foo\""));
    assert!(!has_import_terminator("from 'foo"));
}

#[test]
fn test_should_skip_empty_line() {
    let lines = vec!["import foo", "", "import bar"];
    assert!(should_skip_empty_line(&lines, 1)); // Should skip empty line at index 1

    let lines = vec!["import foo", "", "# Heading"];
    assert!(!should_skip_empty_line(&lines, 1)); // Should NOT skip, no more imports
}
```

**After refactoring:**
- All existing tests must pass (2 existing tests)
- New helper function tests must pass (4 new tests)
- Manual test with edge cases: imports without semicolons, nested quotes, markdown after imports

### Error Handling

- Preserve existing behavior (no errors returned from this function)
- Add debug logging to new helper functions for easier troubleshooting
- Document edge cases in helper function comments

### Expected Benefits

- 40% reduction in cyclomatic complexity
- Each helper function is self-documenting and testable
- Clearer separation of concerns: detection vs continuation vs look-ahead
- Easier to add new import patterns
- Better test coverage at granular level (6 tests vs 2)

### Milestone

✅ **Complete when:** `cargo test extract_imports -- --nocapture` passes with all 6+ tests

### Quality Check

```bash
pnpm run check:all
```

---

## Item 3: Simplify Schema Field Path Resolution (parser.rs)

**Priority:** HIGH
**File:** `src-tauri/src/parser.rs`
**Lines:** 461-521 (`resolve_field_path` function)
**Time:** 2-3 days
**Risk:** LOW-MEDIUM (good test coverage exists)

### Current Issues

The `resolve_field_path` function:
- Handles both immediate field name finding AND nested parent traversal
- Complex brace-level tracking mixed with path building (~60 lines)
- Difficult to debug when field resolution fails for deeply nested schemas

### Proposed Solution

Split into focused functions:

```rust
/// Find the field name at the current position
fn find_immediate_field_name(schema_text: &str, position: usize) -> Option<String> {
    // Logic to find field name at position
}

/// Build the parent path by traversing up through nested braces
fn build_parent_path(
    schema_text: &str,
    start_position: usize,
    chars: &[char]
) -> Vec<String> {
    // Logic to build path from nested braces
}

/// Main orchestration function
fn resolve_field_path(schema_text: &str, position: usize) -> Vec<String> {
    // Use helpers to build complete path
}
```

### Implementation Steps

1. **Extract `find_immediate_field_name`**:
   - Move the `find_field_name_backwards` usage into this function
   - Keep the logic for finding the field at the current cursor position
   - Return `Option<String>` (None if no field found)
   - Add error logging

2. **Extract `build_parent_path`**:
   - Move the parent brace traversal logic here
   - Keep the brace counting state management
   - Return `Vec<String>` of parent field names
   - Add detailed logging for each level found

3. **Simplify main `resolve_field_path`**:
   - Call `find_immediate_field_name()` first
   - If found, call `build_parent_path()` to get parents
   - Combine into complete path
   - Keep existing error handling

4. **Add comprehensive logging**:
   - Log each step of field resolution
   - Log brace levels as they're traversed
   - Log final resolved path

### Testing Strategy

**Existing test coverage:**
- 11 focused tests covering various nesting scenarios:
  - `test_resolve_top_level_field`
  - `test_resolve_nested_field`
  - `test_resolve_deep_nested_field`
  - `test_resolve_multiple_helpers`
  - `test_resolve_multiline_nested`
  - `test_resolve_array_of_references`
  - And 5 more tests for complex schemas

**Before refactoring:**
```bash
cd src-tauri
cargo test resolve_field_path -- --nocapture
```

**New edge case tests to add**:

```rust
#[test]
fn test_resolve_field_path_deeply_nested() {
    let schema = r#"
    const schema = z.object({
      level1: z.object({
        level2: z.object({
          level3: z.object({
            level4: z.string()
          })
        })
      })
    });
    "#;

    // Test resolution at level4
    // Should return ["level1", "level2", "level3", "level4"]
}

#[test]
fn test_resolve_field_path_mixed_types() {
    let schema = r#"
    const schema = z.object({
      arr: z.array(z.object({
        nested: z.string()
      }))
    });
    "#;

    // Test resolution in nested object within array
}
```

**After refactoring:**
- Run all existing tests (11 tests must pass)
- Run new edge case tests (2+ new tests)
- Test with real-world complex schemas from production

### Error Handling

- Return `Result<String, String>` with descriptive errors
- Preserve existing error messages for backwards compatibility
- Add context to errors: `"Could not find field name at position 245 in schema"`
- Add debug logging for each step of path resolution
- Log brace levels as they're traversed for easier debugging

### Expected Benefits

- Clearer separation between "finding" and "building" operations
- Easier to debug path resolution failures (can add logging to specific helpers)
- Individual functions can be tested in isolation
- Better error messages (can pinpoint which step failed: finding vs building)
- Reduced cognitive load for understanding the logic

### Milestone

✅ **Complete when:** `cargo test resolve_field_path -- --nocapture` passes with all 13+ tests

### Quality Check

```bash
pnpm run check:all
```

---

## Item 4: Extract Schema Merging Logic (schema_merger.rs)

**Priority:** MEDIUM
**File:** `src-tauri/src/schema_merger.rs`
**Lines:** Multiple long functions (260-616)
**Time:** 4-5 days
**Risk:** MEDIUM (core schema processing logic)

### Current Issues

Three mega-functions with too many responsibilities (1077 total lines, only 4 tests):

1. **`parse_entry_schema`** (lines 260-310): Combines field extraction, flattening, and result building
2. **`parse_field`** (lines 312-387): Handles type determination, nested object recursion, and field building in one function
3. **`determine_field_type`** (lines 398-616): 218-line function handling all JSON Schema type variations

**Specific issues with `determine_field_type`:**
- Deeply nested match statements with complex conditions
- FieldTypeInfo constructed 11+ times with repetitive boilerplate code
- Single point of failure - any bug affects all type determinations
- Each type variation is 15-30 lines of nearly identical code
- Difficult to test individual type handling in isolation

**Critical gap:** Very low test coverage (4 tests for 1077 lines = ~0.4%)

### Proposed Solution

Extract type-specific handlers for `determine_field_type`:

```rust
fn handle_anyof_type(any_of: &[JsonSchemaProperty]) -> Result<FieldTypeInfo, String>

fn handle_array_type(field_schema: &JsonSchemaProperty) -> Result<FieldTypeInfo, String>

fn handle_object_type(field_schema: &JsonSchemaProperty) -> Result<FieldTypeInfo, String>

fn handle_primitive_type(type_: &StringOrArray) -> FieldTypeInfo
```

Split `parse_field`:

```rust
fn build_field_info(
    name: String,
    schema: &JsonSchemaProperty,
    required: bool,
    parent: &str
) -> FieldTypeInfo

fn flatten_nested_object(
    schema: &JsonSchemaProperty,
    parent_path: &str
) -> Vec<SchemaField>
```

### Implementation Steps

**IMPORTANT:** This refactoring MUST include comprehensive test expansion. Current test coverage is dangerously low (4 tests for 1077 lines). Refactoring provides an opportunity to improve this to industry standards.

**Test-First Approach:**
Before refactoring, add integration tests for existing behavior to ensure we don't break anything. Then add unit tests for each new handler function.

1. **Start with `determine_field_type` refactoring**:

   a. **Create `handle_anyof_type`** (extract lines ~420-480):
      - Look for null type
      - Determine base type from non-null options
      - Return FieldTypeInfo with nullable flag

   b. **Create `handle_array_type`** (extract lines ~485-530):
      - Extract items schema
      - Determine item type
      - Handle nested arrays
      - Return FieldTypeInfo with array type

   c. **Create `handle_object_type`** (extract lines ~535-580):
      - Check for nested properties
      - Build object type info
      - Handle special object cases

   d. **Create `handle_primitive_type`** (extract lines ~585-610):
      - Match on string, number, boolean, etc.
      - Return appropriate FieldTypeInfo

   e. **Simplify main `determine_field_type`**:
      - Dispatch to appropriate handler based on schema structure

2. **Refactor `parse_field`**:
   - Extract `build_field_info` for field metadata building
   - Extract `flatten_nested_object` for nested object flattening
   - Simplify main function to coordinate operations

3. **ADD comprehensive tests** (not just update existing):
   - **Before refactoring:** Add integration tests for current behavior (5-10 tests)
   - **During refactoring:** Add unit tests for each new handler function (3-5 tests each)
   - **After refactoring:** Ensure existing tests still pass (4 existing tests)
   - **Goal:** Achieve 15-20+ total tests (vs current 4)
   - **Coverage target:** Each handler should have dedicated tests for success and error cases

### Testing Strategy

**Current state:** Only 4 tests exist for 1077 lines of code. This is insufficient.

**Before refactoring:**
```bash
cd src-tauri
cargo test schema_merger -- --nocapture
# Should see: 4 tests passing
```

**Add integration tests first** (before touching implementation):
- Test anyOf with nullable strings, numbers, dates
- Test arrays of primitives and objects
- Test nested objects with various structures
- Test edge cases: empty objects, null types, unknown types
- Goal: 5-10 integration tests to lock in current behavior

**New handler-specific tests to add during refactoring:**

```rust
#[test]
fn test_handle_anyof_type_nullable_string() {
    let any_of = vec![
        JsonSchemaProperty {
            type_: Some(StringOrArray::String("string".to_string())),
            ..Default::default()
        },
        JsonSchemaProperty {
            type_: Some(StringOrArray::String("null".to_string())),
            ..Default::default()
        },
    ];

    let result = handle_anyof_type(&any_of).unwrap();
    assert_eq!(result.field_type, "string");
    assert!(result.nullable);
}

#[test]
fn test_handle_array_type_string_array() {
    let schema = JsonSchemaProperty {
        type_: Some(StringOrArray::String("array".to_string())),
        items: Some(Box::new(JsonSchemaProperty {
            type_: Some(StringOrArray::String("string".to_string())),
            ..Default::default()
        })),
        ..Default::default()
    };

    let result = handle_array_type(&schema).unwrap();
    assert_eq!(result.field_type, "array");
}

// ... more tests for each handler
```

**After refactoring:**
- Run all existing schema merger tests (4 existing tests must pass)
- Run new integration tests (5-10 tests must pass)
- Run new handler unit tests (10-15 tests must pass)
- Test with complex real-world schemas from production
- Validate against JSON Schema edge cases
- **Goal:** 20+ total passing tests (5x improvement from current 4)

### Error Handling

- Return `Result<FieldTypeInfo, String>` with descriptive errors
- Preserve existing error messages for backwards compatibility
- Add context to errors indicating which handler failed: `"Failed to determine anyOf type: ..."`
- Add debug logging for each type determination
- Document edge cases and limitations in handler comments

### Expected Benefits

- **Testability:** Each type handler becomes self-contained and testable (20+ tests vs 4)
- **Maintainability:** Easier to add support for new JSON Schema features
- **Readability:** Reduced cognitive load (60-line handlers vs 218-line mega-function)
- **Performance:** Individual handlers can be optimized independently
- **Debugging:** Clearer error messages (know which handler failed: anyOf vs array vs object)
- **Confidence:** 5x test coverage increase ensures correctness

### Milestone

✅ **Complete when:** `cargo test schema_merger -- --nocapture` passes with 20+ tests (vs 4 currently)

### Quality Check

```bash
cd src-tauri
cargo test schema_merger -- --nocapture
cargo clippy --all-targets --all-features
cd ..
pnpm run check:all
```

---

## Overall Quality Gates

### During Implementation

```bash
# Run Rust checks
pnpm run check:rust

# Run specific tests
cd src-tauri
cargo test parser -- --nocapture
cargo test schema_merger -- --nocapture
```

### Before Completing Each Item

```bash
# Code quality metrics
cargo clippy -- -D warnings  # Fail on any warnings
cargo fmt -- --check         # Verify formatting

# Verify test count (example for Item 4)
cargo test schema_merger -- --list | grep "test" | wc -l
# Should see increased count

# Performance check (tests should run in <1s)
time cargo test --lib

# Run all quality checks
pnpm run check:all

# Ensure no console.logs or commented code
# Use /check command
```

### Before Marking Task Complete

```bash
# Full test suite
cd src-tauri
cargo test -- --nocapture

# Clippy linting
cargo clippy --all-targets --all-features

# Full project checks
cd ..
pnpm run check:all
```

---

## Success Criteria

Each refactoring item is complete when:

1. **Functionality preserved**: All existing tests pass
2. **New tests added**: New helper functions have dedicated tests
3. **Quality checks pass**: `pnpm run check:all` succeeds
4. **Documentation updated**: Add comments to new functions
5. **No performance regression**: Benchmarks show similar or better performance
6. **Code review ready**: Clean, focused changes without cruft

---

## Implementation Order

Each item includes a completion milestone - tests must pass before moving to the next item.

1. **Item 1** (Brace matching) - Foundation for other parser work
   - **Time:** 2-3 days
   - **Milestone:** `cargo test parser -- --nocapture` passes with 26+ tests

2. **Item 2** (Import parsing) - Independent, reduces complexity
   - **Time:** 2-3 days
   - **Milestone:** `cargo test extract_imports -- --nocapture` passes with 6+ tests

3. **Item 3** (Field path resolution) - Builds on Item 1
   - **Time:** 2-3 days
   - **Milestone:** `cargo test resolve_field_path -- --nocapture` passes with 13+ tests

4. **Item 4** (Schema merging) - Most complex, benefits from experience with first 3
   - **Time:** 4-5 days
   - **Critical:** ADD comprehensive tests FIRST, then refactor
   - **Milestone:** `cargo test schema_merger -- --nocapture` passes with 20+ tests

---

## Notes

- **Total effort:** 2-3 weeks (can be done incrementally)
- **Each item is independent:** No blocking dependencies
- **Comprehensive test coverage exists:** Refactoring is safe
- **Incremental approach recommended:** Do one item at a time, verify thoroughly
- **Use `/check` command before completing each item**
- **Update CLAUDE.md if new patterns emerge**

---

## Revision History

**Created:** 2025-11-01
**Updated:** 2025-11-01 - Pre-implementation review
- Added "Before Starting Implementation" safety checks
- Updated Item 1: Added limitation about string/comment handling
- Rewrote Item 2: Corrected to match actual code implementation (fixed mismatch)
- Updated Item 3: Fixed test coverage references (use test names not line numbers)
- Enhanced Item 4: Emphasized adding 20+ tests (5x improvement from current 4)
- Added error handling sections to all items
- Added completion milestones to all items
- Enhanced quality gates with specific metrics
- Updated implementation order with time estimates and milestones

**Status:** ✅ Ready for implementation (Task 2 complete, 127 tests passing)
