//! Finds the `image()` and `reference()` helpers in a collection's schema source,
//! which `content_config` reads from the content config.
//!
//! When it exists and parses, the generated JSON schema is the source of truth for
//! fields (see `schema_merger.rs`), and this parser only adds what the JSON loses:
//! which fields are images, and which collection a reference points to. Without
//! it, `create_complete_schema` falls back to this parser's output alone, which
//! has only those fields. Either way, it doesn't parse Zod structure. It
//! regex-matches the helper calls, then walks back through the braces to build
//! each field's dotted path. A line-based structural parser broke on
//! ordinary multi-line formatting such as `z\n  .object({ ... })`, so keep it this
//! way rather than growing it into a Zod parser.
//!
//! See `docs/developer/schema-system.md`.

use regex::Regex;

/// Finds the position of the matching closing brace for an opening brace
///
/// # Arguments
/// * `content` - The string to search
/// * `start_pos` - Position of the opening brace
/// * `open_char` - The opening character (e.g., '{', '[', '(')
/// * `close_char` - The closing character (e.g., '}', ']', ')')
///
/// # Returns
/// * `Ok(usize)` - Position of the matching closing brace (inclusive)
/// * `Err(String)` - Error if no matching brace found
///
/// # Limitations
/// This utility performs naive character counting and does NOT handle:
/// - Strings containing braces (e.g., `"{"` or `"}"`)
/// - Comments containing braces
/// - Template literals or other JavaScript string features
///
/// The current implementations also don't handle these cases, so we maintain existing behavior.
fn find_matching_closing_brace(
    content: &str,
    start_pos: usize,
    open_char: char,
    close_char: char,
) -> Result<usize, String> {
    let mut brace_count = 0;

    for (i, ch) in content[start_pos..].char_indices() {
        match ch {
            c if c == open_char => brace_count += 1,
            c if c == close_char => {
                brace_count -= 1;
                if brace_count == 0 {
                    return Ok(start_pos + i + 1);
                }
            }
            _ => {}
        }
    }

    Err(format!(
        "Unclosed braces: expected closing '{close_char}' but reached end of content"
    ))
}

/// Helper type for pattern matching approach
#[derive(Debug, Clone, PartialEq)]
enum HelperType {
    Image,
    Reference,
}

/// Represents a match of an image() or reference() helper call
#[derive(Debug, Clone)]
struct HelperMatch {
    helper_type: HelperType,
    position: usize,
    collection_name: Option<String>,
}

/// The `image()` and `reference()` helpers in a collection's `schema` source (as
/// `content_config` returns it), as the Zod-side JSON `schema_merger` reads.
/// `None` when there are none.
pub fn extract_helpers(schema_source: &str) -> Option<String> {
    extract_schema_from_collection_block(&remove_comments(schema_source))
}

fn remove_comments(content: &str) -> String {
    // Improved comment removal that handles edge cases better
    let mut result = String::new();
    let mut chars = content.chars().peekable();
    let mut in_string = false;
    let mut string_char = '"';
    let mut in_block_comment = false;
    let mut escape_next = false;

    while let Some(ch) = chars.next() {
        if escape_next {
            if !in_block_comment {
                result.push(ch);
            }
            escape_next = false;
            continue;
        }

        if in_string {
            if ch == '\\' {
                escape_next = true;
                result.push(ch);
            } else if ch == string_char {
                in_string = false;
                result.push(ch);
            } else {
                result.push(ch);
            }
            continue;
        }

        if in_block_comment {
            if ch == '*' && chars.peek() == Some(&'/') {
                chars.next(); // consume '/'
                in_block_comment = false;
            }
            continue;
        }

        match ch {
            '"' | '\'' => {
                in_string = true;
                string_char = ch;
                result.push(ch);
            }
            '/' => {
                if chars.peek() == Some(&'/') {
                    // Line comment - skip to end of line
                    chars.next(); // consume second '/'
                    for next_ch in chars.by_ref() {
                        if next_ch == '\n' {
                            result.push(next_ch);
                            break;
                        }
                    }
                } else if chars.peek() == Some(&'*') {
                    // Block comment start
                    chars.next(); // consume '*'
                    in_block_comment = true;
                } else {
                    result.push(ch);
                }
            }
            _ => result.push(ch),
        }
    }

    result
}

fn extract_schema_from_collection_block(collection_block: &str) -> Option<String> {
    // Look for z.object({ ... }) within the collection block
    let schema_start_re = Regex::new(r"z\.object\s*\(\s*\{").unwrap();

    if let Some(start_match) = schema_start_re.find(collection_block) {
        // Find the matching closing brace for the object
        let start = start_match.end() - 1; // Position of the opening brace

        if let Ok(end) = find_matching_closing_brace(collection_block, start, '{', '}') {
            let schema_text = &collection_block[start + 1..end - 1].trim(); // +1 to skip opening brace, -1 to skip closing brace
            return parse_schema_fields(schema_text);
        }
    }

    None
}

fn parse_schema_fields(schema_text: &str) -> Option<String> {
    extract_zod_special_fields(schema_text)
}

/// Find all image() and reference() helper calls in schema text
/// Returns positions and metadata for each helper found
fn find_helper_calls(schema_text: &str) -> Vec<HelperMatch> {
    let mut matches = Vec::new();

    // Find image() calls
    let image_re = Regex::new(r"image\s*\(\s*\)").unwrap();
    for image_match in image_re.find_iter(schema_text) {
        matches.push(HelperMatch {
            helper_type: HelperType::Image,
            position: image_match.start(),
            collection_name: None,
        });
    }

    // Find reference() calls
    let reference_re = Regex::new(r#"reference\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap();
    for reference_match in reference_re.captures_iter(schema_text) {
        let position = reference_match.get(0).unwrap().start();
        let collection_name = reference_match.get(1).unwrap().as_str().to_string();

        matches.push(HelperMatch {
            helper_type: HelperType::Reference,
            position,
            collection_name: Some(collection_name),
        });
    }

    matches
}

/// Whether a byte can be part of an identifier. Bytes of non-ASCII characters
/// count, so a non-ASCII identifier is kept whole.
fn is_identifier_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || !byte.is_ascii()
}

/// Find the field name by scanning backwards from a position to the nearest ':'
/// Returns the field name (identifier before the colon)
///
/// Positions are byte offsets, as the regexes in `find_helper_calls` give them.
/// Everything this looks for is ASCII, so scanning bytes is safe with any text.
fn find_field_name_backwards(schema_text: &str, start_pos: usize) -> Option<String> {
    let bytes = schema_text.as_bytes();
    let mut pos = start_pos;

    // Scan backwards to find ':'
    while pos > 0 {
        if bytes[pos] == b':' {
            // Found colon, now scan backwards to find the field name
            let mut field_end = pos;
            while field_end > 0 && bytes[field_end - 1].is_ascii_whitespace() {
                field_end -= 1;
            }

            let mut field_start = field_end;
            while field_start > 0 && is_identifier_byte(bytes[field_start - 1]) {
                field_start -= 1;
            }

            if field_start < field_end {
                return Some(schema_text[field_start..field_end].to_string());
            }
        }
        pos -= 1;
    }

    None
}

/// Check if a helper is inside a z.array() call
/// Returns true if z.array( appears between the last ':' and the helper position
fn is_inside_array(schema_text: &str, helper_position: usize) -> bool {
    // Scan backwards from helper position to find the last ':'
    let bytes = schema_text.as_bytes();
    let mut pos = helper_position;

    while pos > 0 {
        if bytes[pos] == b':' {
            // Found the field colon, now check if z.array( appears between : and helper
            let between = &schema_text[pos..helper_position];
            return between.contains("z.array(");
        }
        pos -= 1;
    }

    false
}

/// Find the field name at the current position by scanning backwards
///
/// Returns the field name if found, or None if no field name exists at this position
fn find_immediate_field_name(schema_text: &str, position: usize) -> Option<String> {
    find_field_name_backwards(schema_text, position)
}

/// Build the parent path by traversing up through nested braces
///
/// Returns a vector of parent field names (in reverse order - innermost to outermost)
fn build_parent_path(schema_text: &str, start_position: usize) -> Vec<String> {
    let bytes = schema_text.as_bytes();
    let mut path_components = Vec::new();
    let mut brace_level = 0;
    let mut current_pos = start_position;

    while current_pos > 0 {
        current_pos -= 1;

        match bytes[current_pos] {
            b'}' => {
                brace_level += 1;
            }
            b'{' => {
                brace_level -= 1;

                // When we exit to a parent level (brace_level becomes negative)
                if brace_level < 0 {
                    // Look for a parent field name before this '{'
                    if let Some(parent_field) = find_field_name_backwards(schema_text, current_pos)
                    {
                        // Make sure we haven't already added this field (avoid duplicates)
                        if path_components.last() != Some(&parent_field) {
                            path_components.push(parent_field);
                        }
                        // Reset brace level for the next parent
                        brace_level = 0;
                    } else {
                        // No parent field found, we've reached the top level
                        break;
                    }
                }
            }
            _ => {}
        }
    }

    path_components
}

/// Trace backwards from helper position to build dotted field path
///
/// Examples:
/// - Top-level: "heroImage: image()" → "heroImage"
/// - Nested: "coverImage: z.object({ image: image() })" → "coverImage.image"
/// - Deep: "meta: { author: { avatar: image() } }" → "meta.author.avatar"
fn resolve_field_path(schema_text: &str, helper_position: usize) -> Result<String, String> {
    // First, find the immediate field name for this helper
    if let Some(field_name) = find_immediate_field_name(schema_text, helper_position) {
        let mut path_components = vec![field_name];

        // Now trace backwards through brace levels to find parent fields
        let parent_fields = build_parent_path(schema_text, helper_position);
        path_components.extend(parent_fields);

        // Reverse to get the path from outermost to innermost
        path_components.reverse();
        let path = path_components.join(".");
        Ok(path)
    } else {
        Err(format!(
            "Could not find field name for helper at position {helper_position}"
        ))
    }
}

/// Extract special fields (image and reference helpers) using pattern matching
///
/// This is the main entry point. Returns the JSON that `extract_zod_enhancements`
/// and `parse_zod_schema` in `schema_merger.rs` read.
fn extract_zod_special_fields(schema_text: &str) -> Option<String> {
    // 1. Find all helper calls
    let helpers = find_helper_calls(schema_text);

    if helpers.is_empty() {
        return None;
    }

    // 2. Resolve field path for each helper
    let mut fields_json = Vec::new();

    for helper in helpers {
        match resolve_field_path(schema_text, helper.position) {
            Ok(field_path) => {
                // Check if this helper is inside an array
                let in_array = is_inside_array(schema_text, helper.position);

                // Create field JSON based on helper type and array context
                let field_json = if in_array {
                    // Array field
                    match helper.helper_type {
                        HelperType::Image => {
                            serde_json::json!({
                                "name": field_path,
                                "type": "Array",
                                "arrayType": "Image",
                                "optional": true,
                                "default": null,
                                "constraints": {}
                            })
                        }
                        HelperType::Reference => {
                            serde_json::json!({
                                "name": field_path,
                                "type": "Array",
                                "arrayType": "Reference",
                                "arrayReferenceCollection": helper.collection_name.unwrap_or_default(),
                                "optional": true,
                                "default": null,
                                "constraints": {}
                            })
                        }
                    }
                } else {
                    // Non-array field
                    match helper.helper_type {
                        HelperType::Image => {
                            serde_json::json!({
                                "name": field_path,
                                "type": "Image",
                                "optional": true,
                                "default": null,
                                "constraints": {}
                            })
                        }
                        HelperType::Reference => {
                            serde_json::json!({
                                "name": field_path,
                                "type": "Reference",
                                "referencedCollection": helper.collection_name.unwrap_or_default(),
                                "optional": true,
                                "default": null,
                                "constraints": {}
                            })
                        }
                    }
                };

                fields_json.push(field_json);
            }
            Err(_) => {
                // Skip this field - it will be treated as whatever JSON schema says
            }
        }
    }

    // 3. Serialize to JSON (same format as before)
    if !fields_json.is_empty() {
        let schema_json = serde_json::json!({
            "type": "zod",
            "fields": fields_json
        });

        return Some(schema_json.to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    /// The helpers found in the first collection of a content config
    fn helpers_in(config: &str) -> serde_json::Value {
        let project = Path::new("/site");
        let collections = crate::content_config::parse_config(
            config,
            &project.join("src/content.config.ts"),
            project,
        )
        .unwrap();
        let source = collections[0].schema_source.as_deref().unwrap();
        serde_json::from_str(&extract_helpers(source).unwrap()).unwrap()
    }

    // --- UNIT TESTS FOR BRACE MATCHING UTILITY ---

    #[test]
    fn test_find_matching_closing_brace_simple() {
        let content = "{ foo }";
        let result = find_matching_closing_brace(content, 0, '{', '}');
        assert!(result.is_ok(), "Should find matching brace");
        assert_eq!(
            result.unwrap(),
            7,
            "Should point to position after closing brace"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_nested() {
        let content = "{ { } }";
        let result = find_matching_closing_brace(content, 0, '{', '}');
        assert!(
            result.is_ok(),
            "Should find matching brace for nested structure"
        );
        assert_eq!(
            result.unwrap(),
            7,
            "Should point to outermost closing brace"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_deep_nested() {
        let content = "{ { { } } }";
        let result = find_matching_closing_brace(content, 0, '{', '}');
        assert!(
            result.is_ok(),
            "Should find matching brace for deeply nested structure"
        );
        assert_eq!(
            result.unwrap(),
            11,
            "Should point to outermost closing brace"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_with_content() {
        let content = r#"{ foo: "bar", baz: 123 }"#;
        let result = find_matching_closing_brace(content, 0, '{', '}');
        assert!(result.is_ok(), "Should find matching brace with content");
        assert_eq!(
            result.unwrap(),
            24,
            "Should point to position after closing brace"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_empty() {
        let content = "{}";
        let result = find_matching_closing_brace(content, 0, '{', '}');
        assert!(result.is_ok(), "Should find matching brace for empty block");
        assert_eq!(
            result.unwrap(),
            2,
            "Should point to position after closing brace"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_unmatched() {
        let content = "{ { }";
        let result = find_matching_closing_brace(content, 0, '{', '}');
        assert!(result.is_err(), "Should return error for unmatched braces");
        assert!(
            result.unwrap_err().contains("Unclosed braces"),
            "Error message should mention unclosed braces"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_parentheses() {
        let content = "( foo ( bar ) )";
        let result = find_matching_closing_brace(content, 0, '(', ')');
        assert!(result.is_ok(), "Should work with parentheses");
        assert_eq!(
            result.unwrap(),
            15,
            "Should point to position after closing parenthesis"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_brackets() {
        let content = "[ [ 1, 2 ], [ 3, 4 ] ]";
        let result = find_matching_closing_brace(content, 0, '[', ']');
        assert!(result.is_ok(), "Should work with square brackets");
        assert_eq!(
            result.unwrap(),
            22,
            "Should point to position after closing bracket"
        );
    }

    #[test]
    fn test_find_matching_closing_brace_real_world_example() {
        let content = r#"{ blog: defineCollection({ schema: z.object({ title: z.string() }) }) }"#;
        let result = find_matching_closing_brace(content, 0, '{', '}');
        assert!(
            result.is_ok(),
            "Should work with real-world nested structure"
        );
        assert_eq!(result.unwrap(), 71, "Should find outermost closing brace");
    }

    // --- END BRACE MATCHING UTILITY TESTS ---

    #[test]
    fn test_remove_comments() {
        let content = r#"
// This is a comment
export default defineConfig({
  /* This is a block comment */
  collections: {
    blog: defineCollection({}) // End comment
  }
});
"#;
        let clean = remove_comments(content);
        assert!(!clean.contains("This is a comment"));
        assert!(!clean.contains("block comment"));
        assert!(!clean.contains("End comment"));
        assert!(clean.contains("defineConfig"));
    }

    #[test]
    fn test_improved_comment_stripping() {
        let content = r#"
// Line comment at start
export const collections = {
  test: defineCollection({
    /* Multi-line block comment
       with multiple lines
       // and nested line comment
    */
    schema: z.object({
      title: z.string(), // End-of-line comment
      description: z.string().optional(), /* inline block */
      content: "/* not a comment inside string */",
      regex: /\/\* also not a comment in regex \*\//,
    }),
  }),
};
"#;
        let clean = remove_comments(content);

        // Should remove comments
        assert!(!clean.contains("Line comment at start"));
        assert!(!clean.contains("Multi-line block comment"));
        assert!(!clean.contains("End-of-line comment"));
        assert!(!clean.contains("inline block"));

        // Should preserve content inside strings and regex
        assert!(clean.contains("/* not a comment inside string */"));
        // The regex content should be preserved (just check for the path structure)
        assert!(clean.contains("regex:"));

        // Should preserve the actual code
        assert!(clean.contains("export const collections"));
        assert!(clean.contains("z.string()"));
    }

    // --- UNIT TESTS FOR HELPER DISCOVERY ---

    #[test]
    fn test_find_helper_calls_basic() {
        let schema_text = r#"
        z.object({
            hero: image(),
            author: reference('authors'),
            title: z.string(),
            tags: z.array(reference('tags')),
        })
        "#;

        let helpers = find_helper_calls(schema_text);

        // Should find 1 image() and 2 reference() calls
        assert_eq!(helpers.len(), 3, "Should find 3 helpers total");

        let image_helpers: Vec<_> = helpers
            .iter()
            .filter(|h| h.helper_type == HelperType::Image)
            .collect();
        assert_eq!(image_helpers.len(), 1, "Should find 1 image() helper");

        let reference_helpers: Vec<_> = helpers
            .iter()
            .filter(|h| h.helper_type == HelperType::Reference)
            .collect();
        assert_eq!(
            reference_helpers.len(),
            2,
            "Should find 2 reference() helpers"
        );

        // Verify collection names are extracted
        let author_helper = reference_helpers
            .iter()
            .find(|h| h.collection_name == Some("authors".to_string()));
        assert!(author_helper.is_some(), "Should find reference('authors')");

        let tags_helper = reference_helpers
            .iter()
            .find(|h| h.collection_name == Some("tags".to_string()));
        assert!(tags_helper.is_some(), "Should find reference('tags')");
    }

    #[test]
    fn test_find_helper_calls_multiline() {
        let schema_text = r#"
        z.object({
            coverImage: z
                .object({
                    image: image().optional(),
                    alt: z.string(),
                })
                .optional(),
        })
        "#;

        let helpers = find_helper_calls(schema_text);

        // Should find the image() even with multi-line formatting
        assert_eq!(helpers.len(), 1, "Should find 1 helper");
        assert_eq!(helpers[0].helper_type, HelperType::Image);
    }

    #[test]
    fn test_find_helper_calls_deep_nesting() {
        let schema_text = r#"
        z.object({
            metadata: z.object({
                author: z.object({
                    avatar: image(),
                }),
            }),
        })
        "#;

        let helpers = find_helper_calls(schema_text);

        // Should find the deeply nested image()
        assert_eq!(helpers.len(), 1, "Should find 1 helper");
        assert_eq!(helpers[0].helper_type, HelperType::Image);
    }

    // --- UNIT TEST FOR INTEGRATION ---

    #[test]
    fn test_extract_zod_special_fields_basic() {
        // This is what should be extracted from z.object({ ... })
        let schema_text = r#"
hero: image(),
title: z.string(),
        "#;

        let result = extract_zod_special_fields(schema_text);
        assert!(result.is_some(), "Should find image() helper");

        let schema_json = result.unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&schema_json).unwrap();

        assert_eq!(parsed["type"], "zod");
        let fields = parsed["fields"].as_array().unwrap();
        assert_eq!(fields.len(), 1, "Should have 1 field (only image helper)");
        assert_eq!(fields[0]["name"], "hero");
        assert_eq!(fields[0]["type"], "Image");
    }

    #[test]
    fn test_extract_basic_schema_with_arrow_function() {
        let content = r#"
export const test = defineCollection({
  schema: ({ image }) => z.object({
    hero: image(),
    title: z.string(),
  }),
});
        "#;

        let parsed = helpers_in(&format!(
            "{content}\nexport const collections = {{ test }};"
        ));

        assert_eq!(parsed["type"], "zod");
        let fields = parsed["fields"].as_array().unwrap();
        assert_eq!(fields.len(), 1, "Should have 1 field");
        assert_eq!(fields[0]["name"], "hero");
        assert_eq!(fields[0]["type"], "Image");
    }

    // --- UNIT TESTS FOR PATH RESOLUTION ---

    #[test]
    fn test_resolve_top_level_field() {
        let schema_text = r#"
        z.object({
            hero: image(),
            title: z.string(),
        })
        "#;

        let helpers = find_helper_calls(schema_text);
        assert_eq!(helpers.len(), 1);

        let path = resolve_field_path(schema_text, helpers[0].position);
        assert!(path.is_ok(), "Should resolve path successfully");
        assert_eq!(path.unwrap(), "hero", "Should resolve to 'hero'");
    }

    #[test]
    fn test_resolve_nested_field() {
        let schema_text = r#"
        z.object({
            coverImage: z.object({
                image: image(),
                alt: z.string(),
            }),
        })
        "#;

        let helpers = find_helper_calls(schema_text);
        assert_eq!(helpers.len(), 1);

        let path = resolve_field_path(schema_text, helpers[0].position);
        assert!(path.is_ok(), "Should resolve path successfully");
        assert_eq!(
            path.unwrap(),
            "coverImage.image",
            "Should resolve to 'coverImage.image'"
        );
    }

    #[test]
    fn test_resolve_deep_nested_field() {
        let schema_text = r#"
        z.object({
            metadata: z.object({
                author: z.object({
                    avatar: image(),
                }),
            }),
        })
        "#;

        let helpers = find_helper_calls(schema_text);
        assert_eq!(helpers.len(), 1);

        let path = resolve_field_path(schema_text, helpers[0].position);
        assert!(path.is_ok(), "Should resolve path successfully");
        assert_eq!(
            path.unwrap(),
            "metadata.author.avatar",
            "Should resolve to 'metadata.author.avatar'"
        );
    }

    #[test]
    fn test_resolve_multiline_nested() {
        let schema_text = r#"
        z.object({
            coverImage: z
                .object({
                    image: image().optional(),
                    alt: z.string(),
                })
                .optional(),
        })
        "#;

        let helpers = find_helper_calls(schema_text);
        assert_eq!(helpers.len(), 1);

        let path = resolve_field_path(schema_text, helpers[0].position);
        assert!(path.is_ok(), "Should resolve path successfully");
        assert_eq!(
            path.unwrap(),
            "coverImage.image",
            "Should resolve to 'coverImage.image' even with multi-line"
        );
    }

    #[test]
    fn test_resolve_array_of_references() {
        let schema_text = r#"
        z.object({
            tags: z.array(reference('tags')),
        })
        "#;

        let helpers = find_helper_calls(schema_text);
        assert_eq!(helpers.len(), 1);

        let path = resolve_field_path(schema_text, helpers[0].position);
        assert!(path.is_ok(), "Should resolve path successfully");
        assert_eq!(path.unwrap(), "tags", "Should resolve to 'tags'");
    }

    #[test]
    fn test_resolve_multiple_helpers() {
        let schema_text = r#"
        z.object({
            hero: image(),
            author: reference('authors'),
            coverImage: z.object({
                image: image(),
                alt: z.string(),
            }),
        })
        "#;

        let helpers = find_helper_calls(schema_text);
        assert_eq!(helpers.len(), 3, "Should find 3 helpers");

        // Test each helper's path
        for helper in &helpers {
            let path = resolve_field_path(schema_text, helper.position);
            assert!(path.is_ok(), "Should resolve all paths successfully");
            let path_str = path.unwrap();

            match helper.helper_type {
                HelperType::Image => {
                    assert!(
                        path_str == "hero" || path_str == "coverImage.image",
                        "Image path should be 'hero' or 'coverImage.image', got '{path_str}'"
                    );
                }
                HelperType::Reference => {
                    assert_eq!(path_str, "author", "Reference path should be 'author'");
                }
            }
        }
    }

    // --- NEW FOCUSED TESTS FOR PATTERN MATCHING APPROACH ---

    #[test]
    fn test_find_top_level_image() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ image }) => z.object({
      hero: image(),
      title: z.string(),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Should find hero as Image type
        let hero_field = fields.iter().find(|f| f["name"] == "hero");
        assert!(hero_field.is_some(), "Should find hero field");
        let hero_field = hero_field.unwrap();
        assert_eq!(hero_field["type"], "Image");
    }

    #[test]
    fn finds_helpers_after_non_ascii_text() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ image }) => z.object({
      title: z.string().describe('日本語のタイトル — ブログ記事の見出しです'),
      meta: z.object({ hero: image() }),
      author: reference('authors'),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let names: Vec<&str> = parsed_schema["fields"]
            .as_array()
            .unwrap()
            .iter()
            .map(|f| f["name"].as_str().unwrap())
            .collect();
        assert_eq!(names, ["meta.hero", "author"]);
    }

    #[test]
    fn test_find_nested_image() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ image }) => z.object({
      coverImage: z.object({
        image: image().optional(),
        alt: z.string(),
      }),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Should find coverImage.image with dotted path
        let image_field = fields.iter().find(|f| f["name"] == "coverImage.image");
        assert!(
            image_field.is_some(),
            "Should find coverImage.image field with dotted path"
        );
        let image_field = image_field.unwrap();
        assert_eq!(image_field["type"], "Image");
    }

    #[test]
    fn test_find_deep_nested_image() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ image }) => z.object({
      metadata: z.object({
        author: z.object({
          avatar: image(),
        }),
      }),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Should find metadata.author.avatar with dotted path
        let avatar_field = fields
            .iter()
            .find(|f| f["name"] == "metadata.author.avatar");
        assert!(
            avatar_field.is_some(),
            "Should find metadata.author.avatar field with dotted path"
        );
        let avatar_field = avatar_field.unwrap();
        assert_eq!(avatar_field["type"], "Image");
    }

    #[test]
    fn test_find_reference_helper() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ reference }) => z.object({
      author: reference('authors'),
      tags: z.array(reference('tags')),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Should find author as Reference type with collection name
        let author_field = fields.iter().find(|f| f["name"] == "author");
        assert!(author_field.is_some(), "Should find author field");
        let author_field = author_field.unwrap();
        assert_eq!(author_field["type"], "Reference");
        assert_eq!(author_field["referencedCollection"], "authors");

        // Should find tags as Array type with Reference inner type
        let tags_field = fields.iter().find(|f| f["name"] == "tags");
        assert!(tags_field.is_some(), "Should find tags field");
        let tags_field = tags_field.unwrap();
        assert_eq!(tags_field["type"], "Array");
        assert_eq!(tags_field["arrayType"], "Reference");
        assert_eq!(tags_field["arrayReferenceCollection"], "tags");
    }

    #[test]
    fn test_multiline_nested_object() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ image }) => z.object({
      coverImage: z
        .object({
          image: image().optional(),
          alt: z.string().optional(),
        })
        .optional(),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Should find coverImage.image despite multi-line formatting
        let image_field = fields.iter().find(|f| f["name"] == "coverImage.image");
        assert!(
            image_field.is_some(),
            "Should find coverImage.image field even with multi-line formatting"
        );
        let image_field = image_field.unwrap();
        assert_eq!(image_field["type"], "Image");
    }

    #[test]
    fn test_array_of_references() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ reference }) => z.object({
      relatedArticles: z.array(reference('articles')),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Should find relatedArticles as Array with Reference inner type
        let related_field = fields.iter().find(|f| f["name"] == "relatedArticles");
        assert!(related_field.is_some(), "Should find relatedArticles field");
        let related_field = related_field.unwrap();
        assert_eq!(related_field["type"], "Array");
        assert_eq!(related_field["arrayType"], "Reference");
        assert_eq!(related_field["arrayReferenceCollection"], "articles");
    }

    #[test]
    fn test_helpers_with_comments() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: ({ image }) => z.object({
      // Profile image
      avatar: image().optional(),
      /* Cover image */
      cover: z.object({
        image: image(), // The actual image
      }),
    }),
  }),
};
"#;
        let parsed_schema = helpers_in(content);
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Should find both avatar and cover.image
        let avatar_field = fields.iter().find(|f| f["name"] == "avatar");
        assert!(avatar_field.is_some(), "Should find avatar field");
        assert_eq!(avatar_field.unwrap()["type"], "Image");

        let cover_image_field = fields.iter().find(|f| f["name"] == "cover.image");
        assert!(cover_image_field.is_some(), "Should find cover.image field");
        assert_eq!(cover_image_field.unwrap()["type"], "Image");
    }

    // --- END NEW FOCUSED TESTS ---
}
