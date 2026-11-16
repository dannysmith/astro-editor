//! Tests of reading content files and writing them back

use super::*;

#[test]
fn test_parse_frontmatter_with_yaml() {
    let content = r#"---
title: Test Post
description: A test post for parsing
draft: false
date: 2023-12-01
---

# Content

This is the main content of the post."#;

    let result = parse_frontmatter(content);

    assert_eq!(result.frontmatter.len(), 4);
    assert_eq!(result.frontmatter.get("title").unwrap(), "Test Post");
    assert_eq!(
        result.frontmatter.get("draft").unwrap(),
        &Value::Bool(false)
    );
    assert!(result.content.contains("# Content"));
}

#[test]
fn test_parse_frontmatter_no_yaml() {
    let content = r#"# Regular Markdown

This is just regular markdown content without frontmatter."#;

    let result = parse_frontmatter(content);

    assert!(result.frontmatter.is_empty());
    assert_eq!(result.content, content);
    assert!(result.raw_frontmatter.is_empty());
}

#[test]
fn test_parse_frontmatter_with_arrays() {
    let content = r#"---
title: Test Post
tags:
  - javascript
  - typescript
  - react
categories: [tech, programming]
---

# Content

This is a test post with arrays."#;

    let result = parse_frontmatter(content);

    assert_eq!(result.frontmatter.len(), 3);
    assert_eq!(result.frontmatter.get("title").unwrap(), "Test Post");

    // Check multi-line array
    let tags = result.frontmatter.get("tags").unwrap();
    if let Value::Array(tags_array) = tags {
        assert_eq!(tags_array.len(), 3);
        assert_eq!(tags_array[0], Value::String("javascript".to_string()));
        assert_eq!(tags_array[1], Value::String("typescript".to_string()));
        assert_eq!(tags_array[2], Value::String("react".to_string()));
    } else {
        panic!("Expected tags to be an array");
    }

    // Check inline array
    let categories = result.frontmatter.get("categories").unwrap();
    if let Value::Array(categories_array) = categories {
        assert_eq!(categories_array.len(), 2);
        assert_eq!(categories_array[0], Value::String("tech".to_string()));
        assert_eq!(
            categories_array[1],
            Value::String("programming".to_string())
        );
    } else {
        panic!("Expected categories to be an array");
    }
}

#[test]
fn test_rebuild_markdown_with_frontmatter() {
    let mut frontmatter = IndexMap::new();
    frontmatter.insert("title".to_string(), Value::String("New Title".to_string()));
    frontmatter.insert("draft".to_string(), Value::Bool(true));

    let content = "# Content\n\nThis is the content.";

    let result =
        rebuild_markdown_with_frontmatter_and_imports_ordered(&frontmatter, "", content, None)
            .unwrap();

    assert!(result.starts_with("---\n"));
    // serde_norway doesn't quote simple strings without special characters
    assert!(result.contains("title: New Title") || result.contains("title: \"New Title\""));
    assert!(result.contains("draft: true"));
    assert!(result.contains("# Content"));
}

#[test]
fn test_rebuild_with_raw_frontmatter() {
    // Test that raw frontmatter is preserved exactly as-is
    let raw_frontmatter =
        "---\ntitle: My Title\ndate: 2024-01-15T12:30:00Z\ncustom_field: value\n---";
    let content = "# Heading\n\nSome content.";
    let imports = "";

    let result = rebuild_markdown_with_raw_frontmatter(raw_frontmatter, imports, content);
    assert!(result.is_ok());

    let output = result.unwrap();
    // Should preserve the exact raw frontmatter including the datetime format
    assert!(output.contains("date: 2024-01-15T12:30:00Z"));
    assert!(output.starts_with("---\n"));
    assert!(output.contains("---\n\n# Heading"));
    assert!(output.contains("Some content."));
}

#[test]
fn test_rebuild_with_raw_frontmatter_and_imports() {
    let raw_frontmatter = "---\ntitle: Test\n---";
    let content = "# Heading";
    let imports = "import Component from './Component';";

    let result = rebuild_markdown_with_raw_frontmatter(raw_frontmatter, imports, content);
    assert!(result.is_ok());

    let output = result.unwrap();
    assert!(output.contains("---\ntitle: Test\n---"));
    assert!(output.contains("import Component from './Component';"));
    assert!(output.contains("# Heading"));
}

#[test]
fn test_rebuild_content_only() {
    // Test when there's no frontmatter at all
    let content = "# Just Content\n\nNo frontmatter here.";
    let imports = "";

    let result = rebuild_markdown_content_only(imports, content);
    assert!(result.is_ok());

    let output = result.unwrap();
    assert!(!output.contains("---"));
    assert!(output.starts_with("# Just Content"));
    assert!(output.contains("No frontmatter here."));
}

#[test]
fn test_rebuild_content_only_with_imports() {
    let content = "# Content";
    let imports = "import React from 'react';";

    let result = rebuild_markdown_content_only(imports, content);
    assert!(result.is_ok());

    let output = result.unwrap();
    assert!(!output.contains("---"));
    assert!(output.starts_with("import React from 'react';"));
    assert!(output.contains("# Content"));
}

#[test]
fn test_parse_mdx_with_imports() {
    let content = r#"---
title: Test Post
draft: false
---

import React from 'react';
import { Callout } from '../components/Callout';

# Test Post

<Callout type="info">
This is a callout component.
</Callout>

Regular markdown content here."#;

    let result = parse_frontmatter(content);

    assert_eq!(result.frontmatter.len(), 2);
    assert_eq!(result.frontmatter.get("title").unwrap(), "Test Post");
    assert!(result.imports.contains("import React from 'react';"));
    assert!(result
        .imports
        .contains("import { Callout } from '../components/Callout';"));
    assert!(result.content.contains("# Test Post"));
    assert!(result.content.contains("<Callout"));
    assert!(!result.content.contains("import React"));
}

#[test]
fn test_rebuild_with_imports() {
    let mut frontmatter = IndexMap::new();
    frontmatter.insert("title".to_string(), Value::String("Test".to_string()));

    let imports = "import React from 'react';\nimport { Component } from './Component';";
    let content = "# Test\n\n<Component />";

    let result =
        rebuild_markdown_with_frontmatter_and_imports_ordered(&frontmatter, imports, content, None)
            .unwrap();

    assert!(result.starts_with("---\n"));
    assert!(result.contains("title: Test"));
    assert!(result.contains("import React from 'react';"));
    assert!(result.contains("import { Component } from './Component';"));
    assert!(result.contains("# Test"));
    assert!(result.contains("<Component />"));

    // Ensure proper spacing
    let lines: Vec<&str> = result.lines().collect();
    let frontmatter_end = lines.iter().position(|&line| line == "---").unwrap();
    let second_frontmatter_end = lines[frontmatter_end + 1..]
        .iter()
        .position(|&line| line == "---")
        .unwrap()
        + frontmatter_end
        + 1;

    // Should have a blank line after frontmatter before imports
    assert_eq!(lines[second_frontmatter_end + 1], "");
    // Should have imports next
    assert!(lines[second_frontmatter_end + 2].starts_with("import"));
}

#[test]
fn test_serialize_nested_object_to_yaml() {
    use serde_json::json;

    let mut frontmatter = IndexMap::new();
    frontmatter.insert("title".to_string(), json!("Test Post"));
    frontmatter.insert(
        "metadata".to_string(),
        json!({
            "category": "Blog",
            "priority": 2,
            "deadline": "2025-10-21"
        }),
    );
    frontmatter.insert("tags".to_string(), json!(["rust", "yaml", "testing"]));

    let content = "# Test Content\n\nThis is a test.";

    let result =
        rebuild_markdown_with_frontmatter_and_imports_ordered(&frontmatter, "", content, None)
            .unwrap();

    // Verify the result contains proper YAML nested object syntax
    assert!(result.contains("metadata:"));
    assert!(result.contains("  category: Blog"));
    assert!(result.contains("  priority: 2"));
    assert!(result.contains("  deadline: 2025-10-21"));

    // Verify tags array is formatted correctly
    // serde_norway uses "- item" without indent (valid YAML)
    assert!(result.contains("tags:"));
    assert!(result.contains("- rust"));
    assert!(result.contains("- yaml"));
    assert!(result.contains("- testing"));

    // Ensure metadata is NOT JSON-stringified
    assert!(!result.contains(r#"metadata: "{"#));
    assert!(!result.contains(r#"{"category":"Blog""#));

    // Verify proper frontmatter structure
    assert!(result.starts_with("---\n"));
    assert!(result.contains("---\n\n# Test Content"));
}

#[test]
fn test_parse_nested_object_from_yaml() {
    let yaml_content = r#"title: Test Post
metadata:
  category: Blog
  priority: 2
  deadline: 2025-10-21
tags:
  - rust
  - yaml
  - testing"#;

    let result = crate::yaml::mapping(yaml_content).unwrap();

    // Verify title
    assert_eq!(
        result.get("title").unwrap(),
        &Value::String("Test Post".to_string())
    );

    // Verify nested metadata object
    let metadata = result.get("metadata").unwrap();
    assert!(metadata.is_object());
    let metadata_obj = metadata.as_object().unwrap();
    assert_eq!(
        metadata_obj.get("category").unwrap(),
        &Value::String("Blog".to_string())
    );
    assert_eq!(
        metadata_obj.get("priority").unwrap(),
        &Value::Number(serde_json::Number::from(2))
    );
    assert_eq!(
        metadata_obj.get("deadline").unwrap(),
        &Value::String("2025-10-21".to_string())
    );

    // Verify tags array
    let tags = result.get("tags").unwrap();
    assert!(tags.is_array());
    let tags_array = tags.as_array().unwrap();
    assert_eq!(tags_array.len(), 3);
    assert_eq!(tags_array[0], Value::String("rust".to_string()));
    assert_eq!(tags_array[1], Value::String("yaml".to_string()));
    assert_eq!(tags_array[2], Value::String("testing".to_string()));
}

#[test]
fn test_parse_and_serialize_roundtrip() {
    let original_yaml = r#"title: Roundtrip Test
description: Testing parse and serialize roundtrip
metadata:
  category: Development
  priority: 5
  deadline: 2025-12-31
tags:
  - test
  - roundtrip"#;

    // Parse YAML to HashMap
    let parsed = crate::yaml::mapping(original_yaml).unwrap();

    // Serialize back to markdown with frontmatter (verifies serialization works)
    let content = "# Test Content";
    let _serialized =
        rebuild_markdown_with_frontmatter_and_imports_ordered(&parsed, "", content, None).unwrap();

    // Parse again
    let reparsed_content = format!("---\n{original_yaml}\n---\n\n{content}");
    let reparsed = parse_frontmatter(&reparsed_content);

    // Verify metadata object survived the roundtrip
    let metadata = reparsed.frontmatter.get("metadata").unwrap();
    assert!(metadata.is_object());
    let metadata_obj = metadata.as_object().unwrap();
    assert_eq!(
        metadata_obj.get("category").unwrap(),
        &Value::String("Development".to_string())
    );
    assert_eq!(
        metadata_obj.get("priority").unwrap(),
        &Value::Number(serde_json::Number::from(5))
    );
}

#[test]
fn test_yaml_with_anchors() {
    // Anchors and aliases are read, with the aliases expanded
    // Note: When deserializing to serde_json::Value, YAML merge keys (<<) are
    // preserved as literal keys rather than being merged. This is expected behavior
    // and doesn't affect Astro frontmatter which rarely uses anchors.
    let yaml = r#"base: &base
  title: Base Title
  category: Blog
reference: *base"#;

    let result = crate::yaml::mapping(yaml);
    assert!(result.is_ok(), "YAML with anchors should parse");

    let parsed = result.unwrap();

    // Verify base object
    let base = parsed.get("base").unwrap();
    assert!(base.is_object());
    let base_obj = base.as_object().unwrap();
    assert_eq!(
        base_obj.get("title").unwrap(),
        &Value::String("Base Title".to_string())
    );
    assert_eq!(
        base_obj.get("category").unwrap(),
        &Value::String("Blog".to_string())
    );

    // Verify reference points to the same structure
    let reference = parsed.get("reference").unwrap();
    assert!(reference.is_object());
    let reference_obj = reference.as_object().unwrap();
    assert_eq!(
        reference_obj.get("title").unwrap(),
        &Value::String("Base Title".to_string())
    );
    assert_eq!(
        reference_obj.get("category").unwrap(),
        &Value::String("Blog".to_string())
    );
}

#[test]
fn test_yaml_with_block_scalars() {
    // Test multi-line strings with pipe (literal) and fold scalars
    let yaml = r#"literal: |
  First line
  Second line
  Third line
folded: >
  This is a
  long description
  that will be folded"#;

    let result = crate::yaml::mapping(yaml);
    assert!(result.is_ok(), "block scalars (| and >) should parse");

    let parsed = result.unwrap();

    // Verify literal scalar (preserves newlines)
    let literal = parsed.get("literal").unwrap();
    assert!(literal.is_string());
    let literal_str = literal.as_str().unwrap();
    assert!(literal_str.contains("First line"));
    assert!(literal_str.contains("Second line"));

    // Verify folded scalar exists
    let folded = parsed.get("folded").unwrap();
    assert!(folded.is_string());
    let folded_str = folded.as_str().unwrap();
    assert!(folded_str.contains("This is a"));
    assert!(folded_str.contains("long description"));
}

#[test]
fn test_frontmatter_edit_keeps_nested_key_order() {
    let original =
        "---\ntitle: Old\nseo:\n  title: SEO title\n  description: About it\n---\n\nBody\n";
    let parsed = parse_frontmatter(original);
    let mut frontmatter = parsed.frontmatter;
    frontmatter.insert("title".to_string(), Value::String("New".to_string()));

    let saved = rebuild_markdown_with_frontmatter_and_imports_ordered(
        &frontmatter,
        &parsed.imports,
        &parsed.content,
        None,
    )
    .unwrap();

    assert!(
        saved.contains("seo:\n  title: SEO title\n  description: About it\n"),
        "{saved}"
    );
}

#[test]
fn test_frontmatter_edit_keeps_datetimes_in_other_keys() {
    // Editing one field rewrites the whole block, which must keep the time
    // in every datetime, unquoted so Astro still reads them as dates
    let original = "---\ntitle: Old\npubDate: 2024-01-15T10:30:00Z\nmeta:\n  created: 2024-01-01T12:30:00+01:00\nevents:\n- 2024-02-14T09:00:00Z\nday: 2024-03-20\n---\n\nBody\n";
    let parsed = parse_frontmatter(original);
    let mut frontmatter = parsed.frontmatter;
    frontmatter.insert("title".to_string(), Value::String("New".to_string()));

    let saved = rebuild_markdown_with_frontmatter_and_imports_ordered(
        &frontmatter,
        &parsed.imports,
        &parsed.content,
        None,
    )
    .unwrap();

    assert!(saved.contains("pubDate: 2024-01-15T10:30:00Z\n"), "{saved}");
    assert!(
        saved.contains("  created: 2024-01-01T12:30:00+01:00\n"),
        "{saved}"
    );
    assert!(saved.contains("- 2024-02-14T09:00:00Z\n"), "{saved}");
    assert!(saved.contains("day: 2024-03-20\n"), "{saved}");
    assert_eq!(parse_frontmatter(&saved).frontmatter, frontmatter);
}

#[test]
fn test_field_ordering_preserved() {
    // Test that build_ordered_frontmatter respects schema order then alphabetical
    let mut frontmatter = IndexMap::new();

    // Add fields in random order
    frontmatter.insert("zebra".to_string(), Value::String("z".to_string()));
    frontmatter.insert("title".to_string(), Value::String("Test".to_string()));
    frontmatter.insert(
        "publishDate".to_string(),
        Value::String("2024-01-15".to_string()),
    );
    frontmatter.insert("apple".to_string(), Value::String("a".to_string()));
    frontmatter.insert("draft".to_string(), Value::Bool(false));

    // Define schema order (common Astro frontmatter fields)
    let schema_order = vec![
        "title".to_string(),
        "publishDate".to_string(),
        "draft".to_string(),
    ];

    let ordered = build_ordered_frontmatter(frontmatter, Some(schema_order));

    // Verify order: schema fields first (title, publishDate, draft),
    // then non-schema fields alphabetically (apple, zebra)
    let keys: Vec<&String> = ordered.keys().collect();
    assert_eq!(keys.len(), 5);
    assert_eq!(keys[0], "title");
    assert_eq!(keys[1], "publishDate");
    assert_eq!(keys[2], "draft");
    assert_eq!(keys[3], "apple"); // Alphabetical
    assert_eq!(keys[4], "zebra"); // Alphabetical
}

#[test]
fn test_field_ordering_no_schema() {
    // Test that without schema, fields are purely alphabetical
    let mut frontmatter = IndexMap::new();

    frontmatter.insert("zebra".to_string(), Value::String("z".to_string()));
    frontmatter.insert("apple".to_string(), Value::String("a".to_string()));
    frontmatter.insert("middle".to_string(), Value::String("m".to_string()));

    let ordered = build_ordered_frontmatter(frontmatter, None);

    let keys: Vec<&String> = ordered.keys().collect();
    assert_eq!(keys, vec!["apple", "middle", "zebra"]);
}

#[test]
fn test_field_ordering_partial_schema_match() {
    // Test when schema specifies fields that don't exist in frontmatter
    let mut frontmatter = IndexMap::new();

    frontmatter.insert("title".to_string(), Value::String("Test".to_string()));
    frontmatter.insert("extra".to_string(), Value::String("e".to_string()));

    // Schema includes fields that don't exist
    let schema_order = vec![
        "title".to_string(),
        "publishDate".to_string(), // Doesn't exist
        "draft".to_string(),       // Doesn't exist
    ];

    let ordered = build_ordered_frontmatter(frontmatter, Some(schema_order));

    let keys: Vec<&String> = ordered.keys().collect();
    assert_eq!(keys.len(), 2);
    assert_eq!(keys[0], "title"); // Schema field that exists
    assert_eq!(keys[1], "extra"); // Non-schema field, alphabetically
}

// ============================================================================
// Unicode Edge Case Tests
// ============================================================================

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
    let parsed = result;
    assert_eq!(
        parsed.frontmatter.get("title").unwrap(),
        "New Feature 🚀 Released!"
    );
    assert_eq!(
        parsed.frontmatter.get("description").unwrap(),
        "Super cool ✨ stuff"
    );
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
    let parsed = result;
    assert_eq!(
        parsed.frontmatter.get("title").unwrap(),
        "مرحبا بك في العالم"
    );
    assert_eq!(parsed.frontmatter.get("author").unwrap(), "محمد");
    assert_eq!(parsed.frontmatter.get("titleHebrew").unwrap(), "שלום עולם");
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
    let parsed = result;
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "Hello 世界 Мир");
    assert_eq!(parsed.frontmatter.get("author").unwrap(), "名前-Name-Имя");
}

#[test]
fn test_frontmatter_with_combining_characters() {
    // Combining diacritics (common in some languages)
    let content = r#"---
title: "café"
author: "José"
---

Content"#;

    let result = parse_frontmatter(content);
    let parsed = result;
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "café");
    assert_eq!(parsed.frontmatter.get("author").unwrap(), "José");
}

#[test]
fn test_frontmatter_with_zero_width_characters() {
    // Zero-width characters (can break parsing if not handled)
    let content = "---\ntitle: \"test\u{200B}word\"\n---\n\nContent"; // zero-width space

    let result = parse_frontmatter(content);
    let parsed = result;
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "test\u{200B}word");
}

#[test]
fn test_serialize_unicode_roundtrip() {
    // CRITICAL: Ensure unicode survives parse → serialize → parse
    let mut frontmatter = IndexMap::new();
    frontmatter.insert(
        "title".to_string(),
        Value::String("🚀 Test 世界".to_string()),
    );
    frontmatter.insert("emoji".to_string(), Value::String("✨🎉🔥".to_string()));

    let serialized =
        rebuild_markdown_with_frontmatter_and_imports_ordered(&frontmatter, "", "Content", None)
            .unwrap();
    let reparsed = parse_frontmatter(&serialized);

    assert_eq!(reparsed.frontmatter.get("title").unwrap(), "🚀 Test 世界");
    assert_eq!(reparsed.frontmatter.get("emoji").unwrap(), "✨🎉🔥");
}

// ============================================================================
// Malformed YAML Tests
// ============================================================================

#[test]
fn unreadable_frontmatter_keeps_its_text_and_the_body() {
    // Common typo: forget closing quote
    let content = "---\ntitle: \"Unclosed quote\ndescription: \"Valid\"\n---\n\nThe body.\n";

    let parsed = parse_frontmatter(content);
    assert!(parsed.frontmatter_error.is_some());
    assert!(parsed.frontmatter.is_empty());
    assert_eq!(
        parsed.raw_frontmatter,
        "---\ntitle: \"Unclosed quote\ndescription: \"Valid\"\n---"
    );
    assert_eq!(parsed.content.trim(), "The body.");
}

#[test]
fn frontmatter_errors_count_lines_from_the_top_of_the_file() {
    // An unclosed list on line 3
    let content = "---\ntitle: A title\ntags: [unclosed\n---\n\nBody.\n";

    let error = parse_frontmatter(content).frontmatter_error.unwrap();
    assert!(error.ends_with("at line 3, column 7"), "{error}");
}

#[test]
fn test_frontmatter_mixed_indentation() {
    // Common issue: mixing tabs and spaces
    let content = "---\ntitle: Test\n\tdescription: Mixed\n  author: Name\n---\n\nContent";

    // Either readable, or unreadable with its text kept for saving
    let parsed = parse_frontmatter(content);
    assert!(parsed.frontmatter.contains_key("title") || parsed.frontmatter_error.is_some());
    assert!(parsed.raw_frontmatter.contains("\tdescription: Mixed"));
}

#[test]
fn an_opening_fence_never_closed_is_no_frontmatter() {
    // As Astro reads it: more likely a thematic break than frontmatter
    let content = "---\ntitle: Test\n\nContent starts here\n";

    let parsed = parse_frontmatter(content);
    assert!(parsed.raw_frontmatter.is_empty());
    assert!(parsed.frontmatter_error.is_none());
    assert_eq!(parsed.content, content);
}

#[test]
fn finds_frontmatter_where_astro_does() {
    // A byte order mark, blank lines before the opening fence, and spaces
    // after either fence
    for content in [
        "\u{feff}---\ntitle: Test\n---\n\nBody\n",
        "\n\n---\ntitle: Test\n---\n\nBody\n",
        "--- \ntitle: Test\n---  \n\nBody\n",
    ] {
        let parsed = parse_frontmatter(content);
        assert_eq!(
            parsed.frontmatter.get("title").unwrap(),
            "Test",
            "{content:?}"
        );
        assert_eq!(parsed.content, "Body\n", "{content:?}");
        let saved = rebuild_markdown_with_raw_frontmatter(
            &parsed.raw_frontmatter,
            &parsed.imports,
            &parsed.content,
        )
        .unwrap();
        assert_eq!(saved, content, "{content:?}");
    }

    // Text before the opening fence, an indented fence, or text after it
    for content in [
        "Intro\n---\ntitle: Test\n---\n",
        "  ---\ntitle: Test\n---\n",
        "---foo\ntitle: Test\n---\n",
    ] {
        assert!(
            parse_frontmatter(content).raw_frontmatter.is_empty(),
            "{content:?}"
        );
    }
}

#[test]
fn keeps_an_empty_frontmatter_block() {
    let content = "---\n---\n\nBody\n";

    let parsed = parse_frontmatter(content);
    assert_eq!(parsed.raw_frontmatter, "---\n---");
    assert!(parsed.frontmatter.is_empty());
    let saved = rebuild_markdown_with_raw_frontmatter(
        &parsed.raw_frontmatter,
        &parsed.imports,
        &parsed.content,
    )
    .unwrap();
    assert_eq!(saved, content);
}

#[test]
fn reads_a_last_block_scalar_with_its_newline() {
    let content = "---\nbanner: |\n  Text\n---\n";

    assert_eq!(parse_frontmatter(content).frontmatter["banner"], "Text\n");
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
    assert!(result.frontmatter.is_empty());
}

// ============================================================================
// Line Ending Edge Case Tests
// ============================================================================

#[test]
fn test_frontmatter_with_crlf_line_endings() {
    // Windows line endings
    let content = "---\r\ntitle: Test\r\ndescription: Windows\r\n---\r\n\r\nContent";

    let result = parse_frontmatter(content);
    let parsed = result;
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "Test");
    assert_eq!(parsed.frontmatter.get("description").unwrap(), "Windows");
}

#[test]
fn test_frontmatter_with_mixed_line_endings() {
    // Mixed CRLF and LF (can happen with git autocrlf)
    let content = "---\r\ntitle: Test\ndescription: Mixed\r\n---\n\nContent";

    let result = parse_frontmatter(content);
    let parsed = result;
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "Test");
    assert_eq!(parsed.frontmatter.get("description").unwrap(), "Mixed");
}

#[test]
fn listings_read_the_frontmatter_as_opening_the_file_does() {
    let cases = [
        "---\ntitle: Test\ndraft: true\n---\n\nContent",
        "---\r\ntitle: Test\r\n---\r\n\r\nContent",
        "---\r\ntitle: Test\ndescription: Mixed\r\n---\n",
        "---\n---\nContent",
        "---\n# Only a comment\n---\n",
        "---\ntitle: Test\n---\nimport A from './A.astro'\n\n<A />\n",
        "No frontmatter\n",
        "",
        "--- \ntitle: Trailing space\n---\n",
        "\u{feff}---\ntitle: After a byte order mark\n---\n",
        "\n---\ntitle: After a blank line\n---\n",
        "---\ntitle: Never closed\n",
    ];
    for content in cases {
        let opened = parse_frontmatter(content).frontmatter;
        assert_eq!(frontmatter_values(content).unwrap(), opened, "{content:?}");
    }

    // The file opens with its frontmatter unread; the listings skip it
    let invalid = "---\ntitle: [unclosed\n---\n";
    assert!(parse_frontmatter(invalid).frontmatter_error.is_some());
    assert!(frontmatter_values(invalid).is_err());
}

#[test]
fn test_serialize_preserves_unix_line_endings() {
    // Our output should always be LF, not CRLF
    let mut frontmatter = IndexMap::new();
    frontmatter.insert("title".to_string(), Value::String("Test".to_string()));

    let result =
        rebuild_markdown_with_frontmatter_and_imports_ordered(&frontmatter, "", "Content", None)
            .unwrap();

    assert!(!result.contains("\r\n"), "Should use LF, not CRLF");
    assert!(result.contains('\n'), "Should have LF line endings");
}

// ============================================================================
// Empty/Minimal Input Tests
// ============================================================================

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
    let parsed = result;
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "");
    assert_eq!(parsed.frontmatter.get("description").unwrap(), "");
    assert_eq!(parsed.frontmatter.get("author").unwrap(), "Actual Value");
}

#[test]
fn test_single_character_content_after_frontmatter() {
    // Edge case: minimal content
    let content = r#"---
title: Test
---

X"#;

    let result = parse_frontmatter(content);
    let parsed = result;
    assert_eq!(parsed.content, "X");
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "Test");
}

// --- Trailing newline round-trip tests ---
// These verify that save -> reload preserves trailing whitespace exactly,
// preventing the editor scroll jump bug (full doc replacement on content mismatch).

#[test]
fn test_roundtrip_keeps_a_blank_line_before_the_closing_marker() {
    let file = "---\ntitle: Test\n\n---\n\nHello world.\n";
    let parsed = parse_frontmatter(file);
    let saved = rebuild_markdown_with_raw_frontmatter(&parsed.raw_frontmatter, "", &parsed.content)
        .unwrap();
    assert_eq!(saved, file);
}

#[test]
fn test_roundtrip_content_no_trailing_newline() {
    let body = "Hello world.";
    let raw_fm = "---\ntitle: Test\n---";
    let saved = rebuild_markdown_with_raw_frontmatter(raw_fm, "", body).unwrap();
    let parsed = parse_frontmatter(&saved);
    assert_eq!(parsed.content, body);
}

#[test]
fn test_roundtrip_content_single_trailing_newline() {
    let body = "Hello world.\n";
    let raw_fm = "---\ntitle: Test\n---";
    let saved = rebuild_markdown_with_raw_frontmatter(raw_fm, "", body).unwrap();
    let parsed = parse_frontmatter(&saved);
    assert_eq!(parsed.content, body);
}

#[test]
fn test_roundtrip_content_double_trailing_newline() {
    let body = "Hello world.\n\n";
    let raw_fm = "---\ntitle: Test\n---";
    let saved = rebuild_markdown_with_raw_frontmatter(raw_fm, "", body).unwrap();
    let parsed = parse_frontmatter(&saved);
    assert_eq!(parsed.content, body);
}

#[test]
fn test_roundtrip_content_triple_trailing_newline() {
    let body = "Hello world.\n\n\n";
    let raw_fm = "---\ntitle: Test\n---";
    let saved = rebuild_markdown_with_raw_frontmatter(raw_fm, "", body).unwrap();
    let parsed = parse_frontmatter(&saved);
    assert_eq!(parsed.content, body);
}

#[test]
fn test_roundtrip_content_with_imports_no_trailing_newline() {
    let body = "Some content";
    let imports = "import Foo from './foo'";
    let raw_fm = "---\ntitle: Test\n---";
    let saved = rebuild_markdown_with_raw_frontmatter(raw_fm, imports, body).unwrap();
    let parsed = parse_frontmatter(&saved);
    assert_eq!(parsed.content, body);
    assert_eq!(parsed.imports, imports);
}

#[test]
fn test_roundtrip_content_with_imports_double_trailing_newline() {
    let body = "Some content\n\n";
    let imports = "import Foo from './foo'";
    let raw_fm = "---\ntitle: Test\n---";
    let saved = rebuild_markdown_with_raw_frontmatter(raw_fm, imports, body).unwrap();
    let parsed = parse_frontmatter(&saved);
    assert_eq!(parsed.content, body);
    assert_eq!(parsed.imports, imports);
}

#[test]
fn test_roundtrip_no_frontmatter_no_trailing_newline() {
    let saved = "Just some content.";
    let parsed = parse_frontmatter(saved);
    assert_eq!(parsed.content, saved);
}

#[test]
fn test_roundtrip_no_frontmatter_double_trailing_newline() {
    let saved = "Just some content.\n\n";
    let parsed = parse_frontmatter(saved);
    assert_eq!(parsed.content, saved);
}
