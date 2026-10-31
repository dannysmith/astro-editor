//! Finding where the ESM block ends.
//!
//! MDX treats a paragraph that starts with `import` or `export` at the start of
//! a line as ESM, and keeps reading past blank lines while the code is
//! incomplete. We mirror that: work through the text one blank-line-separated
//! chunk at a time, parse each chunk as TSX with swc, and take the module
//! declarations at its start. The block is returned as written, so files we
//! don't change are saved exactly as they were.
//!
//! This runs on every file open and save, so it must never panic. Anything it
//! can't make sense of stays in the body, where the writer can see it.

use std::ops::Range;
use std::rc::Rc;

use swc_common::sync::Lrc;
use swc_common::{BytePos, FileName, SourceMap, Spanned};
use swc_ecma_ast::{EsVersion, ModuleItem};
use swc_ecma_parser::error::SyntaxError;
use swc_ecma_parser::{parse_file_as_module, Syntax, TsSyntax};

/// Splits the text after the frontmatter into the ESM block and the markdown
/// body. Blank lines before either part are dropped; blank lines and comments
/// inside the block are kept.
pub fn split_esm_block(text: &str) -> (String, String) {
    match find_block(text) {
        Some(range) => {
            let body_start = skip_blank_lines(text, range.end);
            (text[range].to_string(), text[body_start..].to_string())
        }
        None => (String::new(), text[skip_blank_lines(text, 0)..].to_string()),
    }
}

/// More attempts than this on one chunk means pathological input, so we stop
/// and keep what we have
const MAX_CHUNK_ATTEMPTS: usize = 32;

/// The byte range of the ESM block at the start of `text`, if there is one.
///
/// Each chunk runs from an ESM line to the next blank line and is parsed as a
/// TSX module:
/// - It parses: take the module declarations at its start. Anything after them
///   (a JSX line or a bare `const`, both valid TSX statements) is body.
/// - The parser ran off the end: a statement spans a blank line (an object or
///   template literal), so extend the chunk to the next blank line and retry.
/// - An error part-way through: drop the line it's on and everything after,
///   and retry. An import followed directly by `# Heading` lands here.
pub(super) fn find_block(text: &str) -> Option<Range<usize>> {
    let block_start = skip_blank_lines(text, 0);
    let mut pos = block_start;
    let mut block_end = None;

    'chunks: while pos < text.len() {
        if !line_starts_esm(&text[pos..line_end(text, pos)]) {
            break;
        }

        let mut chunk_end = find_blank_line(text, pos);
        // Once an error has shortened the chunk, never extend it past that
        // point again, so extending and shortening can't cycle
        let mut ceiling = text.len();
        let mut attempts = 0;

        loop {
            attempts += 1;
            if attempts > MAX_CHUNK_ATTEMPTS {
                break 'chunks;
            }

            match parse_chunk(&text[pos..chunk_end]) {
                Ok(chunk) => {
                    let declarations = chunk
                        .items
                        .iter()
                        .take_while(|item| matches!(item, ModuleItem::ModuleDecl(_)))
                        .count();
                    if declarations == 0 {
                        break 'chunks;
                    }
                    let last = &chunk.items[declarations - 1];
                    block_end = Some(pos + offset(last.span().hi, chunk.start));
                    if declarations < chunk.items.len() {
                        break 'chunks;
                    }
                    pos = skip_blank_lines(text, chunk_end);
                    continue 'chunks;
                }
                Err(error) if error.incomplete && chunk_end < ceiling => {
                    let extended = find_blank_line(text, skip_blank_lines(text, chunk_end));
                    if extended <= chunk_end || extended > ceiling {
                        break 'chunks;
                    }
                    chunk_end = extended;
                }
                Err(error) => {
                    let error_pos = pos + error.offset.min(chunk_end - pos);
                    let error_line = text[..error_pos].rfind('\n').map_or(0, |i| i + 1);
                    // An error on the chunk's first line means it isn't ESM at all
                    if error_line <= pos || error_line >= chunk_end {
                        break 'chunks;
                    }
                    chunk_end = error_line;
                    ceiling = chunk_end;
                }
            }
        }
    }

    block_end.map(|end| block_start..extend_through_line_tail(text, end))
}

pub(super) struct ParsedChunk {
    /// Where the chunk starts in swc's positions
    pub start: BytePos,
    pub items: Vec<ModuleItem>,
}

pub(super) struct ChunkError {
    /// Byte offset of the error within the chunk
    offset: usize,
    /// The parser ran off the end of the chunk, so more text may complete it
    incomplete: bool,
}

pub(super) fn parse_chunk(chunk: &str) -> Result<ParsedChunk, ChunkError> {
    let cm: Lrc<SourceMap> = Lrc::new(SourceMap::default());
    let fm = cm.new_source_file(Rc::new(FileName::Anon), chunk.to_string());
    let syntax = Syntax::Typescript(TsSyntax {
        tsx: true,
        ..Default::default()
    });

    let mut recovered = Vec::new();
    let result = parse_file_as_module(&fm, syntax, EsVersion::latest(), None, &mut recovered);
    let error = |e: swc_ecma_parser::error::Error| {
        let span = e.span();
        ChunkError {
            offset: offset(span.lo, fm.start_pos).min(chunk.len()),
            incomplete: matches!(e.kind(), SyntaxError::Eof)
                || offset(span.hi, fm.start_pos) >= chunk.len(),
        }
    };
    // Recovered errors count too: prose or JSX that swc recovers into
    // statements must not end up in the block
    match (result, recovered.into_iter().next()) {
        (Ok(module), None) => Ok(ParsedChunk {
            start: fm.start_pos,
            items: module.body,
        }),
        (Ok(_), Some(e)) | (Err(e), _) => Err(error(e)),
    }
}

pub(super) fn offset(pos: BytePos, start: BytePos) -> usize {
    pos.0.saturating_sub(start.0) as usize
}

/// Whether a line starts an ESM statement: `import` or `export` at the start of
/// the line, followed by a character that can continue one (`import{a}` and
/// `import"./x"` are valid). Prose like "import this…" passes here and is
/// rejected by the parser.
pub(super) fn line_starts_esm(line: &str) -> bool {
    ["import", "export"].iter().any(|keyword| {
        line.strip_prefix(keyword)
            .and_then(|rest| rest.chars().next())
            .is_some_and(|c| matches!(c, ' ' | '\t' | '{' | '*' | '\'' | '"'))
    })
}

/// The end of the line that `pos` is on, before its `\n`
pub(super) fn line_end(text: &str, pos: usize) -> usize {
    text[pos..].find('\n').map_or(text.len(), |i| pos + i)
}

/// The start of the first line at or after `pos` that isn't blank
fn skip_blank_lines(text: &str, mut pos: usize) -> usize {
    while pos < text.len() {
        let end = line_end(text, pos);
        if !text[pos..end].trim().is_empty() {
            break;
        }
        pos = (end + 1).min(text.len());
    }
    pos
}

/// The start of the first blank line at or after `pos`, or the end of the text
fn find_blank_line(text: &str, mut pos: usize) -> usize {
    while pos < text.len() {
        let end = line_end(text, pos);
        if text[pos..end].trim().is_empty() {
            return pos;
        }
        pos = (end + 1).min(text.len());
    }
    text.len()
}

/// Moves the end of the block to the end of its line when all that's left is a
/// semicolon or a comment, which a statement's span may not include
fn extend_through_line_tail(text: &str, end: usize) -> usize {
    let line_end = line_end(text, end);
    let tail = text[end..line_end].trim();
    let rest = tail.strip_prefix(';').unwrap_or(tail).trim_start();
    if rest.is_empty() || rest.starts_with("//") || (rest.starts_with("/*") && rest.ends_with("*/"))
    {
        line_end
    } else {
        end
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn split(text: &str) -> (String, String) {
        split_esm_block(text)
    }

    #[test]
    fn imports_with_and_without_semicolons() {
        assert_eq!(
            split("import React from 'react';\n\n# Heading\n\nText."),
            (
                "import React from 'react';".into(),
                "# Heading\n\nText.".into()
            )
        );
        assert_eq!(
            split("import React from 'react'\n\n# Heading"),
            ("import React from 'react'".into(), "# Heading".into())
        );
    }

    #[test]
    fn multi_line_import() {
        let (block, body) = split("import {\n  One,\n  Two\n} from './c';\n\n# Content");
        assert_eq!(block, "import {\n  One,\n  Two\n} from './c';");
        assert_eq!(body, "# Content");
    }

    #[test]
    fn every_kind_of_import() {
        let text = "import type { P } from './p';\nimport * as ns from 'y';\nimport './x.css';\nimport Foo, { Bar as Baz } from './x';\n\nBody.";
        let (block, body) = split(text);
        assert_eq!(block, text.strip_suffix("\n\nBody.").unwrap());
        assert_eq!(body, "Body.");
    }

    #[test]
    fn statement_with_a_blank_line_inside() {
        let (block, body) = split(
            "export const authors = [\n  { name: 'Ann' },\n\n  { name: 'Ben' },\n];\n\n# Heading",
        );
        assert_eq!(
            block,
            "export const authors = [\n  { name: 'Ann' },\n\n  { name: 'Ben' },\n];"
        );
        assert_eq!(body, "# Heading");

        let (block, body) = split("export const snippet = `first\n\nsecond`;\n\nBody.");
        assert_eq!(block, "export const snippet = `first\n\nsecond`;");
        assert_eq!(body, "Body.");
    }

    #[test]
    fn heading_or_jsx_straight_after_an_import() {
        assert_eq!(
            split("import Foo from './foo'\n# Heading\n\nText."),
            (
                "import Foo from './foo'".into(),
                "# Heading\n\nText.".into()
            )
        );
        assert_eq!(
            split("import { C } from './c';\n<C />\n\nText."),
            ("import { C } from './c';".into(), "<C />\n\nText.".into())
        );
    }

    #[test]
    fn bare_const_is_body() {
        // MDX only allows import and export as ESM
        let (block, body) = split("import a from 'a';\nconst x = 1;\n\nText.");
        assert_eq!(block, "import a from 'a';");
        assert_eq!(body, "const x = 1;\n\nText.");
    }

    #[test]
    fn prose_starting_with_import() {
        let text = "import this idea into your writing\n\nMore prose.";
        assert_eq!(split(text), (String::new(), text.into()));
    }

    #[test]
    fn indented_import_is_body() {
        let text = "  import a from 'a'\n\nText.";
        assert_eq!(split(text), (String::new(), text.into()));
    }

    #[test]
    fn groups_separated_by_blank_lines() {
        assert_eq!(
            split("import a from 'a';\n\nimport b from 'b';\n\n\n# Heading"),
            (
                "import a from 'a';\n\nimport b from 'b';".into(),
                "# Heading".into()
            )
        );
    }

    #[test]
    fn comments_stay_with_the_block() {
        assert_eq!(
            split("import a from 'a'; // for the demo\n\n# Heading"),
            (
                "import a from 'a'; // for the demo".into(),
                "# Heading".into()
            )
        );
        assert_eq!(
            split("import a from 'a'\n// Images\nimport b from './b.png'\n\nText."),
            (
                "import a from 'a'\n// Images\nimport b from './b.png'".into(),
                "Text.".into()
            )
        );
    }

    #[test]
    fn non_ascii_text() {
        assert_eq!(
            split("import Café from './café.astro'; // “fancy”\n\n# Cafés ☕"),
            (
                "import Café from './café.astro'; // “fancy”".into(),
                "# Cafés ☕".into()
            )
        );
    }

    #[test]
    fn export_default_function_with_jsx_and_a_blank_line() {
        let block = "export default function Layout({ children }) {\n  return (\n    <main>\n      <header />\n\n      {children}\n    </main>\n  )\n}";
        assert_eq!(
            split(&format!("{block}\n\n# Body")),
            (block.into(), "# Body".into())
        );
    }

    #[test]
    fn broken_import_stays_visible() {
        let text = "import a from './a\n\nText.";
        assert_eq!(split(text), (String::new(), text.into()));
        assert_eq!(
            split("import {\n  Never"),
            (String::new(), "import {\n  Never".into())
        );
    }

    #[test]
    fn empty_and_blank_text() {
        assert_eq!(split(""), (String::new(), String::new()));
        assert_eq!(split("\n\n# Heading"), (String::new(), "# Heading".into()));
        assert_eq!(
            split("import a from 'a';"),
            ("import a from 'a';".into(), String::new())
        );
    }
}
