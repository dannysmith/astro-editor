# Improve Rust Test Suite

**Priority**: HIGH (should do before 1.0.0 if time permits)
**Effort**: ~1 day
**Type**: Testing, code quality, reliability

## Problem

The Rust backend handles critical operations (file I/O, YAML parsing, schema parsing) but the test suite has several weaknesses that reduce confidence in reliability:

1. **Real filesystem dependency**: Tests create/delete actual files, making them slow, brittle, and order-dependent
2. **Missing negative test cases**: Tests mostly verify happy paths, not error conditions or malformed input
3. **Limited edge case coverage**: YAML parsing especially needs more comprehensive testing (relevant to task #2)
4. **Difficult to test race conditions**: Real I/O makes timing-dependent scenarios hard to reproduce

**Evidence from Rust Test Suite Review** (⭐⭐⭐⭐ rating):
> "Correctly identifies testing anti-patterns... specific, actionable recommendations... No over-engineering"

## Current Test Coverage

**What we have**:
- Basic tests for file reading/writing
- Happy path tests for frontmatter parsing
- Schema parsing tests with valid input
- Command tests with real file system

**What we're missing**:
- Negative tests (malformed YAML, invalid paths, permission errors)
- Edge cases (empty files, huge files, special characters)
- Boundary conditions (max path length, unicode, etc.)
- Isolated, fast unit tests (no file I/O)

## Requirements

**Must Have**:
- [ ] Abstract filesystem behind trait for testing
- [ ] In-memory filesystem implementation for tests
- [ ] Negative test cases for YAML/frontmatter parsing
- [ ] Edge case tests for file operations
- [ ] All tests run without touching real filesystem

**Should Have**:
- [ ] Property-based tests for YAML parsing (after task #2 migration to serde_yaml)
- [ ] Benchmark tests for performance-critical paths
- [ ] Integration tests for end-to-end command flows
- [ ] Test utilities for common setup/teardown

**Nice to Have**:
- [ ] Fuzzing for YAML parser
- [ ] Concurrent access tests
- [ ] Memory leak detection in long-running operations

## Implementation Approach

### 1. Abstract Filesystem Operations

Create a trait to abstract file operations:

```rust
// src-tauri/src/fs/trait.rs
use std::path::Path;
use async_trait::async_trait;

#[async_trait]
pub trait FileSystem: Send + Sync {
    async fn read_to_string(&self, path: &Path) -> Result<String, std::io::Error>;
    async fn write(&self, path: &Path, content: &str) -> Result<(), std::io::Error>;
    async fn exists(&self, path: &Path) -> bool;
    async fn create_dir_all(&self, path: &Path) -> Result<(), std::io::Error>;
    async fn remove_file(&self, path: &Path) -> Result<(), std::io::Error>;
    async fn read_dir(&self, path: &Path) -> Result<Vec<PathBuf>, std::io::Error>;
}

// Real implementation
pub struct RealFileSystem;

#[async_trait]
impl FileSystem for RealFileSystem {
    async fn read_to_string(&self, path: &Path) -> Result<String, std::io::Error> {
        tokio::fs::read_to_string(path).await
    }

    async fn write(&self, path: &Path, content: &str) -> Result<(), std::io::Error> {
        tokio::fs::write(path, content).await
    }

    // ... other methods
}
```

**In-memory implementation for tests**:

```rust
// src-tauri/src/fs/memory.rs
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct InMemoryFileSystem {
    files: Arc<Mutex<HashMap<PathBuf, String>>>,
}

impl InMemoryFileSystem {
    pub fn new() -> Self {
        Self {
            files: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn with_files(files: HashMap<PathBuf, String>) -> Self {
        Self {
            files: Arc::new(Mutex::new(files)),
        }
    }
}

#[async_trait]
impl FileSystem for InMemoryFileSystem {
    async fn read_to_string(&self, path: &Path) -> Result<String, std::io::Error> {
        self.files
            .lock()
            .unwrap()
            .get(path)
            .cloned()
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("File not found: {}", path.display())
                )
            })
    }

    async fn write(&self, path: &Path, content: &str) -> Result<(), std::io::Error> {
        self.files
            .lock()
            .unwrap()
            .insert(path.to_path_buf(), content.to_string());
        Ok(())
    }

    // ... other methods
}
```

### 2. Update Commands to Use Trait

**Before**:
```rust
#[tauri::command]
pub async fn save_markdown_content(
    file_path: String,
    content: String,
) -> Result<(), String> {
    tokio::fs::write(&file_path, content)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**After**:
```rust
#[tauri::command]
pub async fn save_markdown_content(
    file_path: String,
    content: String,
    state: State<'_, AppFileSystem>,
) -> Result<(), String> {
    state
        .write(Path::new(&file_path), &content)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// In setup
pub struct AppFileSystem(Arc<dyn FileSystem>);

fn main() {
    tauri::Builder::default()
        .manage(AppFileSystem(Arc::new(RealFileSystem)))
        .invoke_handler(tauri::generate_handler![save_markdown_content])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. Add Negative Test Cases

**YAML Parsing Negative Tests**:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_yaml_malformed_syntax() {
        let yaml = r#"
title: "Unclosed quote
description: Valid
"#;
        let result = parse_yaml_to_json(yaml);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("quote"));
    }

    #[test]
    fn test_parse_yaml_invalid_nesting() {
        let yaml = r#"
title: Test
  invalid_indent: This shouldn't be here
"#;
        let result = parse_yaml_to_json(yaml);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_yaml_type_mismatch() {
        // When schema expects number but gets string
        let yaml = r#"
count: "not a number"
"#;
        let schema = /* schema expecting count: number */;
        let result = validate_against_schema(yaml, schema);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_yaml_reserved_keywords() {
        let yaml = r#"
yes: true
no: false
on: true
off: false
"#;
        // YAML 1.1 vs 1.2 difference - should handle correctly
        let result = parse_yaml_to_json(yaml);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_yaml_special_characters() {
        let yaml = r#"
title: "Title with emoji 🚀"
description: "Has: colons, and, commas"
code: "function() { return 'test'; }"
"#;
        let result = parse_yaml_to_json(yaml);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_yaml_unicode() {
        let yaml = r#"
title: "こんにちは世界"
author: "Владимир"
content: "مرحبا بك"
"#;
        let result = parse_yaml_to_json(yaml);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_yaml_empty() {
        let yaml = "";
        let result = parse_yaml_to_json(yaml);
        // Should return empty object, not error
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_yaml_only_whitespace() {
        let yaml = "   \n\n   \t  \n";
        let result = parse_yaml_to_json(yaml);
        assert!(result.is_ok());
    }
}
```

**File Operation Negative Tests**:

```rust
#[tokio::test]
async fn test_read_nonexistent_file() {
    let fs = InMemoryFileSystem::new();
    let result = fs.read_to_string(Path::new("/fake/path.md")).await;
    assert!(result.is_err());
    assert_eq!(result.unwrap_err().kind(), std::io::ErrorKind::NotFound);
}

#[tokio::test]
async fn test_write_to_invalid_path() {
    let fs = InMemoryFileSystem::new();
    // Path with null bytes (invalid on most systems)
    let result = fs.write(Path::new("/path\0/file.md"), "content").await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_read_file_permission_denied() {
    // Mock permission error
    let fs = InMemoryFileSystem::new();
    // TODO: Need to add permission simulation to InMemoryFileSystem
}
```

### 4. Edge Case Tests

**Boundary Conditions**:

```rust
#[test]
fn test_parse_yaml_max_nesting_depth() {
    // Generate deeply nested YAML (100+ levels)
    let mut yaml = String::from("root:\n");
    for i in 0..100 {
        yaml.push_str(&format!("{}level{}:\n", "  ".repeat(i + 1), i));
    }
    yaml.push_str(&format!("{}value: deep", "  ".repeat(101)));

    let result = parse_yaml_to_json(&yaml);
    // Should either handle gracefully or fail with clear error
    assert!(result.is_ok() || result.unwrap_err().contains("depth"));
}

#[test]
fn test_parse_yaml_large_array() {
    // Array with 10,000 items
    let items: Vec<String> = (0..10000).map(|i| format!("item{}", i)).collect();
    let yaml = format!("items:\n  - {}", items.join("\n  - "));

    let result = parse_yaml_to_json(&yaml);
    assert!(result.is_ok());
}

#[test]
fn test_parse_yaml_long_string_value() {
    // 1MB string value
    let long_string = "a".repeat(1024 * 1024);
    let yaml = format!("content: \"{}\"", long_string);

    let result = parse_yaml_to_json(&yaml);
    assert!(result.is_ok());
}
```

**YAML Spec Edge Cases** (for task #2 validation after serde_yaml migration):

```rust
#[test]
fn test_parse_yaml_anchors_and_aliases() {
    let yaml = r#"
defaults: &defaults
  timeout: 30
  retries: 3

production:
  <<: *defaults
  host: prod.example.com
"#;
    let result = parse_yaml_to_json(yaml);
    assert!(result.is_ok());
    // Verify anchors are properly expanded
}

#[test]
fn test_parse_yaml_multiline_strings() {
    let yaml = r#"
literal: |
  Line 1
  Line 2
  Line 3
folded: >
  This is a long
  line that will
  be folded
"#;
    let result = parse_yaml_to_json(yaml);
    assert!(result.is_ok());
}

#[test]
fn test_parse_yaml_explicit_types() {
    let yaml = r#"
string: !!str 123
int: !!int "456"
"#;
    let result = parse_yaml_to_json(yaml);
    assert!(result.is_ok());
}
```

### 5. Test Organization

**New test structure**:
```
src-tauri/
├── src/
│   ├── fs/
│   │   ├── mod.rs          # FileSystem trait
│   │   ├── real.rs         # RealFileSystem impl
│   │   └── memory.rs       # InMemoryFileSystem impl
│   ├── commands/
│   │   ├── files.rs
│   │   └── files_test.rs   # Tests using InMemoryFileSystem
│   └── lib.rs
└── tests/
    ├── integration/        # Integration tests
    ├── negative/           # Negative test cases
    └── edge_cases/         # Boundary and edge case tests
```

## Success Criteria

- [ ] `FileSystem` trait defined and documented
- [ ] `InMemoryFileSystem` implementation complete
- [ ] All file commands refactored to use trait
- [ ] All tests run without touching real filesystem
- [ ] 20+ negative test cases added (malformed input, errors, etc.)
- [ ] 10+ edge case tests added (boundaries, special chars, etc.)
- [ ] Tests run 5-10x faster than before (no I/O)
- [ ] Test coverage for backend > 85%
- [ ] All tests pass reliably without flakiness
- [ ] CI runs Rust tests on every commit

## Testing Strategy

**Unit Tests**: Fast, isolated, use `InMemoryFileSystem`
```bash
cargo test --lib
```

**Integration Tests**: Test actual Tauri commands with mocked filesystem
```bash
cargo test --test integration
```

**Run all tests**:
```bash
cargo test
```

**With coverage**:
```bash
cargo tarpaulin --out Html
```

## Impact on Task #2 (YAML Parser Migration)

These tests directly support the YAML parser replacement:

1. **Before migration**: Negative tests will likely fail with custom parser → documents current limitations
2. **During migration**: Tests serve as regression suite to ensure serde_yaml handles all cases
3. **After migration**: Tests validate edge cases are properly handled

The edge case tests (anchors, multiline, explicit types) specifically validate that serde_yaml solves the problems identified in task #2.

## Out of Scope

- Frontend/Rust integration tests (covered by task #3)
- Performance benchmarking (separate task if needed)
- Fuzzing (would be nice but not critical for 1.0.0)
- Multi-threaded concurrency tests

## References

- Rust Test Suite Review: `docs/reviews/rust-test-suite-review-2025-10-24.md`
- Meta-analysis: `docs/reviews/analyysis-of-reviews.md` (Week 2, item #5)
- Current tests: `src-tauri/src/commands/files.rs` (inline tests)
- Task #2: `task-2-replace-custom-yaml-parser.md` (these tests validate that migration)

## Dependencies

**Blocks**: None
**Blocked by**: None (but complements task #2)
**Related**:
- Task #2 (YAML parser) - these tests validate the migration
- Task #3 (integration tests) - complementary frontend testing

## Recommendation

**Do this in Week 2 if time permits, ideally before or alongside task #2**. The negative tests will expose limitations of the current custom YAML parser, which strengthens the case for migration. After migration to serde_yaml, the tests validate edge cases are handled correctly.

**Estimated effort**:
- FileSystem abstraction: 2 hours
- InMemoryFileSystem implementation: 2 hours
- Refactor commands to use trait: 1 hour
- Negative test cases (20+): 2 hours
- Edge case tests (10+): 2 hours
- Documentation and cleanup: 1 hour
- **Total: 1 full day**

**ROI**: High - faster tests, better coverage, supports critical YAML migration
