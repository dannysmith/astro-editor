//! Splits a Markdown or MDX file into its frontmatter, its MDX import block
//! and its body, and puts it back together.
//!
//! The frontmatter is found as Astro finds it (`find_block`), read with
//! `crate::yaml`, and kept as the text it was written as. Saving a file whose
//! frontmatter wasn't edited writes that text back, so the file is unchanged
//! byte for byte (except that CRLF line endings become LF). See "Auto-save and
//! data safety" in `docs/developer/editor.md`.

use indexmap::IndexMap;
use serde_json::Value;

use crate::mdx_esm::split_esm_block;
use crate::yaml::{self, YamlError};

#[cfg(test)]
mod corpus_tests;
#[cfg(test)]
mod tests;

/// A content file, split for the editor
#[derive(serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MarkdownContent {
    pub frontmatter: IndexMap<String, Value>,
    pub content: String,
    /// The frontmatter block as written, from the top of the file through
    /// the closing `---` (without its line ending), including any byte order
    /// mark, blank lines and spaces after the fences. Empty when the file has
    /// none. Saving writes it back unchanged when the frontmatter wasn't edited
    pub raw_frontmatter: String,
    pub imports: String, // MDX imports to hide from editor
    /// Why the frontmatter couldn't be read, if it couldn't: the parser's
    /// error, with line numbers counted from the top of the file. The
    /// frontmatter is then empty, and saving writes `raw_frontmatter` back
    /// unchanged
    pub frontmatter_error: Option<String>,
}

/// A file's frontmatter block
struct Block {
    /// The block as written, through the closing fence, without its line ending
    text: String,
    /// The YAML between the fences, ending in a newline as Astro reads it, so
    /// a `|` block scalar that's the last key keeps its trailing newline
    yaml: String,
    /// How many lines come before the YAML
    yaml_line: usize,
    /// How many lines the block takes up
    lines: usize,
}

/// A `---` line. Astro accepts anything after it, but only spaces are
/// allowed here: `---foo` is more likely a mistake than a fence
fn is_fence(line: &str) -> bool {
    line.trim_end() == "---"
}

/// The frontmatter block at the top of a file's `lines`, found as Astro finds
/// it: after an optional byte order mark and any blank lines, a `---` line,
/// up to the next one. `None` when there isn't one, including when the
/// opening `---` is never closed, which Astro reads as a file without
/// frontmatter (it's more likely a thematic break). Reads no further than the
/// closing line, so the listings never go through the body.
fn find_block<'a>(mut lines: impl Iterator<Item = &'a str>) -> Option<Block> {
    let mut text: Vec<&str> = vec![];
    // Blank lines, and a byte order mark, before the opening fence
    loop {
        let line = lines.next()?;
        text.push(line);
        let line = line.trim_start_matches('\u{feff}');
        if is_fence(line) {
            break;
        }
        if !line.trim().is_empty() {
            return None;
        }
    }
    let yaml_line = text.len();
    for line in lines {
        text.push(line);
        if is_fence(line) {
            let yaml_lines = &text[yaml_line..text.len() - 1];
            let mut yaml = yaml_lines.join("\n");
            if !yaml_lines.is_empty() {
                yaml.push('\n');
            }
            return Some(Block {
                text: text.join("\n"),
                yaml,
                yaml_line,
                lines: text.len(),
            });
        }
    }
    None
}

/// Splits a content file into its frontmatter (values and text), MDX import
/// block and body. Frontmatter that can't be read comes back empty, with its
/// text and the error
pub(crate) fn parse_frontmatter(content: &str) -> MarkdownContent {
    // Track if original content ends with newline - lines() drops this info
    let original_ends_with_newline = content.ends_with('\n');
    let lines: Vec<&str> = content.lines().collect();

    let (frontmatter, raw_frontmatter, frontmatter_error, body_start) =
        match find_block(lines.iter().copied()) {
            None => (IndexMap::new(), String::new(), None, 0),
            Some(block) => {
                let (values, error) = match yaml::mapping(&block.yaml) {
                    Ok(values) => (values, None),
                    Err(error) => {
                        let error = error.shifted(block.yaml_line as u64).to_string();
                        (IndexMap::new(), Some(error))
                    }
                };
                (values, block.text, error, block.lines)
            }
        };

    let (imports, mut body_content) = split_esm_block(&lines[body_start..].join("\n"));

    // Preserve trailing newline that lines() dropped.
    // lines() always drops exactly one trailing \n, so always add one back.
    if original_ends_with_newline && !body_content.is_empty() {
        body_content.push('\n');
    }

    MarkdownContent {
        frontmatter,
        content: body_content,
        raw_frontmatter,
        imports,
        frontmatter_error,
    }
}

/// A file's frontmatter as YAML text, found as `parse_frontmatter` finds it,
/// without reading the body. `None` when it has none.
pub(crate) fn frontmatter_yaml(content: &str) -> Option<String> {
    find_block(content.lines()).map(|block| block.yaml)
}

/// The values in a file's frontmatter, as `parse_frontmatter` reads them, for
/// the file listings, which don't need the body or the MDX imports
pub(crate) fn frontmatter_values(content: &str) -> Result<IndexMap<String, Value>, YamlError> {
    frontmatter_yaml(content).map_or_else(|| Ok(IndexMap::new()), |yaml| yaml::mapping(&yaml))
}

/// Builds an ordered IndexMap with schema fields first, then remaining fields alphabetically
fn build_ordered_frontmatter(
    frontmatter: IndexMap<String, Value>,
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
    let mut remaining: Vec<_> = frontmatter
        .iter()
        .filter(|(k, _)| !ordered.contains_key(*k))
        .collect();
    remaining.sort_by_key(|(k, _)| *k);

    for (key, value) in remaining {
        ordered.insert(key.clone(), value.clone());
    }

    ordered
}

/// Rebuilds the file with the frontmatter serialised from its values, schema
/// fields first. Values are written as they are: dates and datetimes stay the
/// strings they were read as (the date picker writes `YYYY-MM-DD`), and
/// serde_norway leaves them unquoted, so Astro reads them as dates
pub(crate) fn rebuild_markdown_with_frontmatter_and_imports_ordered(
    frontmatter: &IndexMap<String, Value>,
    imports: &str,
    content: &str,
    schema_field_order: Option<Vec<String>>,
) -> Result<String, String> {
    let mut result = String::new();

    // Add frontmatter if present
    if !frontmatter.is_empty() {
        // Build ordered frontmatter (schema fields first, then alphabetical)
        let ordered = build_ordered_frontmatter(frontmatter.clone(), schema_field_order);

        // Serialize to YAML using serde_norway
        result.push_str("---\n");
        let yaml = serde_norway::to_string(&ordered)
            .map_err(|e| format!("Failed to serialize YAML: {e}"))?;
        result.push_str(&yaml);
        result.push_str("---\n");
    }

    // Add imports if present
    if !imports.trim().is_empty() {
        if !frontmatter.is_empty() {
            result.push('\n');
        }
        result.push_str(imports);
        if !imports.ends_with('\n') {
            result.push('\n');
        }
    }

    // Add content if present
    if !content.is_empty() {
        if !frontmatter.is_empty() || !imports.trim().is_empty() {
            result.push('\n');
        }
        result.push_str(content);
    }

    Ok(result)
}

/// Rebuilds the file with its frontmatter block written back as it was read
/// (`MarkdownContent::raw_frontmatter`)
pub(crate) fn rebuild_markdown_with_raw_frontmatter(
    raw_frontmatter: &str,
    imports: &str,
    content: &str,
) -> Result<String, String> {
    let mut result = String::new();

    // The block ends at the closing fence, without its line ending
    result.push_str(raw_frontmatter);
    result.push('\n');

    // Add imports if present
    if !imports.trim().is_empty() {
        result.push('\n');
        result.push_str(imports);
        if !imports.ends_with('\n') {
            result.push('\n');
        }
    }

    // Add content if present
    if !content.is_empty() {
        result.push('\n');
        result.push_str(content);
    }

    Ok(result)
}

/// Rebuild markdown file with no frontmatter (content only)
pub(crate) fn rebuild_markdown_content_only(
    imports: &str,
    content: &str,
) -> Result<String, String> {
    let mut result = String::new();

    // Add imports if present
    if !imports.trim().is_empty() {
        result.push_str(imports);
        if !imports.ends_with('\n') {
            result.push('\n');
        }
    }

    // Add content if present
    if !content.is_empty() {
        if !imports.trim().is_empty() {
            result.push('\n');
        }
        result.push_str(content);
    }

    Ok(result)
}
