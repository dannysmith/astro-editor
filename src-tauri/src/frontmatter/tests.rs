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
        let saved = assemble(&parsed.raw_frontmatter, &parsed.imports, &parsed.content);
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
    let saved = assemble(&parsed.raw_frontmatter, &parsed.imports, &parsed.content);
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

    let parsed = parse_frontmatter(content);
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "Test");
    assert_eq!(parsed.frontmatter.get("description").unwrap(), "Windows");
}

#[test]
fn test_frontmatter_with_mixed_line_endings() {
    // Mixed CRLF and LF (can happen with git autocrlf)
    let content = "---\r\ntitle: Test\ndescription: Mixed\r\n---\n\nContent";

    let parsed = parse_frontmatter(content);
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

    let parsed = parse_frontmatter(content);
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

    let parsed = parse_frontmatter(content);
    assert_eq!(parsed.content, "X");
    assert_eq!(parsed.frontmatter.get("title").unwrap(), "Test");
}

#[test]
fn test_roundtrip_keeps_a_blank_line_before_the_closing_marker() {
    let file = "---\ntitle: Test\n\n---\n\nHello world.\n";
    let parsed = parse_frontmatter(file);
    let saved = assemble(&parsed.raw_frontmatter, "", &parsed.content);
    assert_eq!(saved, file);
}

/// The body (and import block) read back from a saved file must be exactly
/// what was saved, trailing newlines included, or the editor's view jumps
#[test]
fn saved_bodies_read_back_exactly() {
    let block = "---\ntitle: Test\n---";
    for (block, imports, body) in [
        (block, "", "Hello world."),
        (block, "", "Hello world.\n"),
        (block, "", "Hello world.\n\n"),
        (block, "", "Hello world.\n\n\n"),
        (block, "import Foo from './foo'", "Some content"),
        (block, "import Foo from './foo'", "Some content\n\n"),
        ("", "", "Just some content."),
        ("", "", "Just some content.\n\n"),
    ] {
        let parsed = parse_frontmatter(&assemble(block, imports, body));
        assert_eq!(parsed.content, body, "{block:?} {imports:?} {body:?}");
        assert_eq!(parsed.imports, imports);
    }
}
