# Add High-Value Edge Case Tests

**Priority**: MEDIUM (nice to have before 1.0.0)
**Effort**: ~3-4 hours
**Type**: Testing, reliability, data integrity

## Context

**Current State**: Test suite is strong with 112 passing tests running in 0.04s. Tests use temporary directories with unique names and already have good coverage of:
- ✅ Basic file operations
- ✅ Path traversal security
- ✅ Frontmatter parsing (including nested objects, arrays, MDX imports)
- ✅ Schema parsing (image/reference helpers, nested fields)
- ✅ YAML features (anchors, block scalars, unicode)
- ✅ serde_norway migration (task #2 completed)

**What's Missing**: Focused edge case tests for scenarios that could cause data corruption or user-facing bugs.

## Problem Statement

While coverage is good, we lack tests for edge cases that users WILL encounter:
1. **Unicode edge cases** - emoji, RTL text, combining characters (users paste this into frontmatter)
2. **Malformed YAML** - common typos that could corrupt data or crash the editor
3. **Windows/Mac differences** - line endings, path separators, file naming
4. **Empty/minimal content** - edge cases in minimal valid input

## Goals

Add **~15 focused tests** that cover high-probability edge cases and prevent data loss. Focus on:
- **Data integrity**: Ensure we never corrupt user files
- **Real-world input**: Test what users actually type/paste
- **Cross-platform**: Handle Windows vs Mac differences
- **Parser robustness**: Gracefully handle malformed input

## High-Value Tests to Add

### 1. Unicode Edge Cases (6 tests)

**Why**: Users paste emoji, international text, and special characters into frontmatter daily.

```rust
#[test]
fn test_frontmatter_with_emoji_in_values() {
    // Real-world: users type emoji in titles and descriptions
    let content = r#"---
title: "New Feature 🚀 Released!"
description: "Super cool ✨ stuff"
tags: ["🎉", "announcement"]
---

Content here"#;

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
    let parsed = result.unwrap();
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "New Feature 🚀 Released!");
}

#[test]
fn test_frontmatter_with_rtl_text() {
    // Right-to-left languages (Arabic, Hebrew)
    let content = r#"---
title: "مرحبا بك في العالم"
author: "محمد"
titleHebrew: "שלום עולם"
---

Content"#;

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
}

#[test]
fn test_frontmatter_with_mixed_scripts() {
    // CJK + Latin + Cyrillic
    let content = r#"---
title: "Hello 世界 Мир"
author: "名前-Name-Имя"
---

Content"#;

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
}

#[test]
fn test_frontmatter_with_combining_characters() {
    // Combining diacritics (common in some languages)
    let content = r#"---
title: "café" # e + combining acute
author: "José"
---

Content"#;

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
}

#[test]
fn test_frontmatter_with_zero_width_characters() {
    // Zero-width characters (can break parsing if not handled)
    let content = "---\ntitle: \"test\u{200B}word\"\n---\n\nContent"; // zero-width space

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
}

#[test]
fn test_serialize_unicode_roundtrip() {
    // CRITICAL: Ensure unicode survives parse → serialize → parse
    let mut frontmatter = IndexMap::new();
    frontmatter.insert("title".to_string(), Value::String("🚀 Test 世界".to_string()));
    frontmatter.insert("emoji".to_string(), Value::String("✨🎉🔥".to_string()));

    let serialized = rebuild_markdown_with_frontmatter_and_imports(&frontmatter, "", "Content").unwrap();
    let reparsed = parse_frontmatter(&serialized).unwrap();

    assert_eq!(reparsed.frontmatter.get("title").unwrap(), "🚀 Test 世界");
    assert_eq!(reparsed.frontmatter.get("emoji").unwrap(), "✨🎉🔥");
}
```

### 2. Malformed YAML (4 tests)

**Why**: Users make typos. We should fail gracefully, not corrupt data.

```rust
#[test]
fn test_frontmatter_unclosed_quote() {
    // Common typo: forget closing quote
    let content = r#"---
title: "Unclosed quote
description: "Valid"
---

Content"#;

    let result = parse_frontmatter(content);
    assert!(result.is_err(), "Should reject unclosed quote");
}

#[test]
fn test_frontmatter_mixed_indentation() {
    // Common issue: mixing tabs and spaces
    let content = "---\ntitle: Test\n\tdescription: Mixed\n  author: Name\n---\n\nContent";

    let result = parse_frontmatter(content);
    // Should either parse correctly or fail gracefully (not corrupt)
    if result.is_ok() {
        let parsed = result.unwrap();
        assert!(parsed.frontmatter.contains_key("title"));
    }
}

#[test]
fn test_frontmatter_missing_closing_delimiter() {
    // Missing closing ---
    let content = r#"---
title: Test
description: Missing closer

Content starts here"#;

    let result = parse_frontmatter(content);
    assert!(result.is_err(), "Should reject missing closing delimiter");
}

#[test]
fn test_frontmatter_with_only_comments() {
    // Edge case: frontmatter block with only comments
    let content = r#"---
# This is just a comment
# Another comment
---

Content"#;

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
    assert!(result.unwrap().frontmatter.is_empty());
}
```

### 3. Line Ending Edge Cases (3 tests)

**Why**: Windows uses CRLF, Mac uses LF. Must handle both.

```rust
#[test]
fn test_frontmatter_with_crlf_line_endings() {
    // Windows line endings
    let content = "---\r\ntitle: Test\r\ndescription: Windows\r\n---\r\n\r\nContent";

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
    let parsed = result.unwrap();
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "Test");
}

#[test]
fn test_frontmatter_with_mixed_line_endings() {
    // Mixed CRLF and LF (can happen with git autocrlf)
    let content = "---\r\ntitle: Test\ndescription: Mixed\r\n---\n\nContent";

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
}

#[test]
fn test_serialize_preserves_unix_line_endings() {
    // Our output should always be LF, not CRLF
    let mut frontmatter = IndexMap::new();
    frontmatter.insert("title".to_string(), Value::String("Test".to_string()));

    let result = rebuild_markdown_with_frontmatter_and_imports(&frontmatter, "", "Content").unwrap();

    assert!(!result.contains("\r\n"), "Should use LF, not CRLF");
    assert!(result.contains("\n"), "Should have LF line endings");
}
```

### 4. Empty/Minimal Input (2 tests)

**Why**: Edge cases in minimal valid input can expose parser bugs.

```rust
#[test]
fn test_frontmatter_with_empty_string_values() {
    // Empty strings should be preserved, not treated as null
    let content = r#"---
title: ""
description: ""
author: "Actual Value"
---

Content"#;

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
    let parsed = result.unwrap();
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "");
    assert_eq!(parsed.frontmatter.get("description").unwrap(), "");
}

#[test]
fn test_single_character_content_after_frontmatter() {
    // Edge case: minimal content
    let content = r#"---
title: Test
---

X"#;

    let result = parse_frontmatter(content);
    assert!(result.is_ok());
    let parsed = result.unwrap();
    assert_eq!(parsed.content, "X");
}
```

## Implementation Plan

### Step 1: Add Unicode Tests (1 hour)
- Add 6 unicode edge case tests to `src-tauri/src/commands/files.rs` test module
- Run tests, fix any failures
- Verify roundtrip serialization preserves unicode correctly

### Step 2: Add Malformed YAML Tests (1 hour)
- Add 4 malformed YAML tests
- Ensure parser fails gracefully (returns Err, doesn't panic or corrupt)
- Document expected error behavior

### Step 3: Add Line Ending Tests (30 minutes)
- Add 3 line ending tests
- Verify CRLF input is handled correctly
- Ensure serialization always outputs LF

### Step 4: Add Empty/Minimal Input Tests (30 minutes)
- Add 2 minimal input tests
- Verify edge cases in boundary conditions

### Step 5: Verify All Tests Pass (30 minutes)
- Run full test suite: `cargo test --lib`
- Fix any failures
- Ensure tests still run fast (<1 second)

## Success Criteria

- [ ] 15 new tests added covering unicode, malformed YAML, line endings, and empty input
- [ ] All 127+ tests pass (112 existing + 15 new)
- [ ] Tests still run in <1 second
- [ ] No test failures on Mac (primary dev platform)
- [ ] Documentation updated if new edge cases discovered

## Out of Scope

These are NOT high-value for a 1.0.0 editor:
- ❌ Filesystem abstraction (tests already run in 0.04s)
- ❌ In-memory filesystem (unnecessary complexity)
- ❌ Extreme edge cases (100-level nesting, 10k arrays, 1MB strings)
- ❌ Concurrent access tests (OS-dependent, flaky)
- ❌ Permission error tests (OS-dependent, hard to mock reliably)
- ❌ Fuzzing (nice but significant effort, not critical)

## Why This Approach?

**Pragmatic over Perfect**: Focus on tests that will catch real bugs users will encounter, not theoretical edge cases. The current test suite is already strong (112 tests, 0.04s). We're adding targeted coverage for high-probability scenarios.

**Data Integrity First**: These tests primarily prevent data corruption - the worst outcome for a text editor. If we fail to parse something, that's okay. If we corrupt user data, that's unacceptable.

**Real-World Focus**: These tests cover things users actually do (paste emoji, type in multiple languages, edit on Windows and Mac).

## Estimated Effort

- Unicode tests: **1 hour**
- Malformed YAML tests: **1 hour**
- Line ending tests: **30 minutes**
- Empty/minimal tests: **30 minutes**
- Verification and fixes: **30 minutes**
- **Total: ~3.5 hours**

**ROI**: High - prevents data corruption and improves robustness with minimal effort.

## References

- Current test suite: `src-tauri/src/commands/files.rs` (lines 912-2202)
- YAML parser: Uses `serde_norway` (task #2 completed)
- Test results: 112 tests passing in 0.04s (fast, not slow as originally assumed)
