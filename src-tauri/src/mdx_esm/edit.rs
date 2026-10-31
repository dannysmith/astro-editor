//! Adding an import to an ESM block. New text is spliced in, so everything else
//! stays exactly as the writer formatted it.

use std::ops::Range;

use super::block::line_end;
use super::imports::{Binding, Esm, Import, Statement};

/// How a file writes its imports
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Style {
    pub quote: char,
    pub semicolons: bool,
}

impl Default for Style {
    /// As in Astro's docs
    fn default() -> Self {
        Self {
            quote: '\'',
            semicolons: true,
        }
    }
}

/// Adds an import of `name` from `source` to `block`. A named import joins an
/// existing import from the same module (compared as text) that it can be
/// added to. Anything else gets a line of its own after the last import, or
/// above the first export when there are no imports. Returns the new block, and
/// where the statement added or changed is in it.
pub fn add_import(
    block: &Esm,
    name: &str,
    binding: &Binding,
    source: &str,
    style: Style,
) -> (String, Range<usize>) {
    let text = &block.text;

    if let Binding::Named(imported) = binding {
        let specifier = if imported == name {
            name.to_string()
        } else {
            format!("{imported} as {name}")
        };
        let target = block.imports().find(|(_, import)| {
            import.source == source
                && !import.type_only
                && !import.specifiers.is_empty()
                && import
                    .specifiers
                    .iter()
                    .all(|s| s.binding != Binding::Namespace)
        });
        if let Some((statement, import)) = target {
            let (at, insert) = merge(text, statement, import, &specifier);
            let end = statement.range.end + insert.len();
            return (splice(text, at, &insert), statement.range.start..end);
        }
    }

    let statement = new_statement(name, binding, source, style);
    let last_import = block.imports().last().map(|(statement, _)| statement);
    let (at, insert, start) = match (last_import, block.statements.first()) {
        (Some(last), _) => {
            let at = line_end(text, last.range.end);
            (at, format!("\n{statement}"), at + 1)
        }
        (None, Some(first)) => {
            let at = line_start(text, first.range.start);
            (at, format!("{statement}\n"), at)
        }
        (None, None) if text.trim().is_empty() => {
            let end = statement.len();
            return (statement, 0..end);
        }
        // Only comments, which stay above it
        (None, None) => (text.len(), format!("\n{statement}"), text.len() + 1),
    };
    (splice(text, at, &insert), start..start + statement.len())
}

/// Adds `export const name = await getEntry('collection', 'id')` at the end of
/// `block`. Returns the new block, and where the statement is in it.
pub fn add_entry_load(
    block: &Esm,
    name: &str,
    collection: &str,
    id: &str,
    style: Style,
) -> (String, Range<usize>) {
    let text = &block.text;
    let semicolon = if style.semicolons { ";" } else { "" };
    let statement = format!(
        "export const {name} = await getEntry({}, {}){semicolon}",
        quoted(collection, style),
        quoted(id, style)
    );
    // After the last statement's line, or after a block of only comments
    let at = match block.statements.last() {
        Some(last) => line_end(text, last.range.end),
        None if text.trim().is_empty() => {
            let end = statement.len();
            return (statement, 0..end);
        }
        None => text.len(),
    };
    (
        splice(text, at, &format!("\n{statement}")),
        at + 1..at + 1 + statement.len(),
    )
}

/// Where and what to insert to add `specifier` to `import`, matching how its
/// names are laid out: on one line or one per line, with or without a trailing
/// comma. An import with only a default gains braces: `import X, { Y } from …`.
fn merge(text: &str, statement: &Statement, import: &Import, specifier: &str) -> (usize, String) {
    let named: Vec<_> = import
        .specifiers
        .iter()
        .filter(|s| matches!(s.binding, Binding::Named(_)))
        .collect();
    let (Some(first), Some(last)) = (named.first(), named.last()) else {
        let default = &import.specifiers[0];
        return (default.range.end, format!(", {{ {specifier} }}"));
    };

    let after = &text[last.range.end..statement.range.end];
    let comma = after
        .find(',')
        .filter(|&i| after[..i].trim().is_empty())
        .map(|i| last.range.end + i + 1);
    let one_per_line = text[statement.range.start..first.range.start].contains('\n');
    let line = &text[line_start(text, last.range.start)..last.range.start];
    let indent = &line[..line.len() - line.trim_start().len()];

    match (one_per_line, comma) {
        (true, Some(at)) => (at, format!("\n{indent}{specifier},")),
        (true, None) => (last.range.end, format!(",\n{indent}{specifier}")),
        (false, Some(at)) => (at, format!(" {specifier},")),
        (false, None) => (last.range.end, format!(", {specifier}")),
    }
}

fn new_statement(name: &str, binding: &Binding, source: &str, style: Style) -> String {
    let what = match binding {
        Binding::Default => name.to_string(),
        Binding::Named(imported) if imported == name => format!("{{ {name} }}"),
        Binding::Named(imported) => format!("{{ {imported} as {name} }}"),
        Binding::Namespace => format!("* as {name}"),
    };
    let semicolon = if style.semicolons { ";" } else { "" };
    format!("import {what} from {}{semicolon}", quoted(source, style))
}

/// A string literal in the file's quotes, so a path or id containing that
/// quote, like `o'brien.png`, stays valid
fn quoted(value: &str, style: Style) -> String {
    let q = style.quote;
    let escaped = value.replace('\\', "\\\\").replace(q, &format!("\\{q}"));
    format!("{q}{escaped}{q}")
}

fn line_start(text: &str, pos: usize) -> usize {
    text[..pos].rfind('\n').map_or(0, |i| i + 1)
}

fn splice(text: &str, at: usize, insert: &str) -> String {
    format!("{}{insert}{}", &text[..at], &text[at..])
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Adds the import and returns the new block and the statement added or changed
    fn add(block: &str, name: &str, binding: Binding, source: &str) -> (String, String) {
        let (text, range) = add_import(
            &Esm::parse(block).unwrap(),
            name,
            &binding,
            source,
            Style::default(),
        );
        let statement = text[range].to_string();
        (text, statement)
    }

    fn named(name: &str) -> Binding {
        Binding::Named(name.to_string())
    }

    #[test]
    fn starts_an_empty_block() {
        assert_eq!(
            add("", "Callout", Binding::Default, "./Callout.astro"),
            (
                "import Callout from './Callout.astro';".into(),
                "import Callout from './Callout.astro';".into()
            )
        );
    }

    #[test]
    fn writes_each_kind_of_binding_in_the_style() {
        let style = Style {
            quote: '"',
            semicolons: false,
        };
        let new = |binding| new_statement("Card", &binding, "x", style);
        assert_eq!(new(Binding::Default), "import Card from \"x\"");
        assert_eq!(new(named("Card")), "import { Card } from \"x\"");
        assert_eq!(new(named("Box")), "import { Box as Card } from \"x\"");
        assert_eq!(new(Binding::Namespace), "import * as Card from \"x\"");
        assert_eq!(
            new_statement(
                "oBrien",
                &Binding::Default,
                "./o'brien.png",
                Style::default()
            ),
            "import oBrien from './o\\'brien.png';"
        );
    }

    #[test]
    fn goes_after_the_last_import_and_leaves_the_rest_alone() {
        let block = "import a from 'a'; // keep\n\nimport b from 'b';\n\nexport const meta = {\n  x: 1,\n};";
        let (text, statement) = add(block, "C", Binding::Default, "./c");
        assert_eq!(
            text,
            "import a from 'a'; // keep\n\nimport b from 'b';\nimport C from './c';\n\nexport const meta = {\n  x: 1,\n};"
        );
        assert_eq!(statement, "import C from './c';");
    }

    #[test]
    fn goes_above_exports_when_there_are_no_imports() {
        let (text, _) = add("// Data\nexport const a = 1;", "C", Binding::Default, "./c");
        assert_eq!(text, "// Data\nimport C from './c';\nexport const a = 1;");
    }

    #[test]
    fn keeps_a_block_of_only_comments() {
        let (text, statement) = add("// Nothing yet", "C", Binding::Default, "./c");
        assert_eq!(text, "// Nothing yet\nimport C from './c';");
        assert_eq!(statement, "import C from './c';");
    }

    #[test]
    fn joins_a_named_import_on_one_line() {
        assert_eq!(
            add(
                "import { Aside } from 'x'; // note",
                "Card",
                named("Card"),
                "x"
            ),
            (
                "import { Aside, Card } from 'x'; // note".into(),
                "import { Aside, Card } from 'x';".into()
            )
        );
        assert_eq!(
            add("import { Aside, } from 'x'", "Card", named("Card"), "x").0,
            "import { Aside, Card, } from 'x'"
        );
        assert_eq!(
            add("import { Aside } from 'x'", "Card", named("Box"), "x").0,
            "import { Aside, Box as Card } from 'x'"
        );
    }

    #[test]
    fn joins_a_named_import_with_one_name_per_line() {
        assert_eq!(
            add(
                "import {\n    Aside,\n    Badge,\n} from 'x'",
                "Card",
                named("Card"),
                "x"
            ),
            (
                "import {\n    Aside,\n    Badge,\n    Card,\n} from 'x'".into(),
                "import {\n    Aside,\n    Badge,\n    Card,\n} from 'x'".into()
            )
        );
        assert_eq!(
            add("import {\n  Aside\n} from 'x'", "Card", named("Card"), "x").0,
            "import {\n  Aside,\n  Card\n} from 'x'"
        );
    }

    #[test]
    fn adds_braces_to_a_default_import() {
        assert_eq!(
            add("import Widget from './w'", "Gauge", named("Gauge"), "./w").0,
            "import Widget, { Gauge } from './w'"
        );
    }

    #[test]
    fn loads_an_entry_at_the_end_in_the_style() {
        let block = "import { getEntry } from \"astro:content\"\nexport const a = 1 // note";
        let style = Style {
            quote: '"',
            semicolons: false,
        };
        let (text, range) = add_entry_load(
            &Esm::parse(block).unwrap(),
            "post",
            "blog",
            "it's \"new\"",
            style,
        );
        assert_eq!(
            text,
            "import { getEntry } from \"astro:content\"\nexport const a = 1 // note\nexport const post = await getEntry(\"blog\", \"it's \\\"new\\\"\")"
        );
        assert_eq!(
            &text[range],
            "export const post = await getEntry(\"blog\", \"it's \\\"new\\\"\")"
        );
        let (text, _) = add_entry_load(
            &Esm::parse("").unwrap(),
            "post",
            "blog",
            "a",
            Style::default(),
        );
        assert_eq!(text, "export const post = await getEntry('blog', 'a');");
    }

    #[test]
    fn gets_its_own_line_when_it_cant_join() {
        // A default import, a type import, a namespace import, a side-effect import
        // and an import of a different module
        for (block, binding) in [
            ("import { a } from 'x';", Binding::Default),
            ("import type { a } from 'x';", named("C")),
            ("import * as a from 'x';", named("C")),
            ("import 'x';", named("C")),
            ("import { a } from 'y';", named("C")),
        ] {
            let (text, statement) = add(block, "C", binding, "x");
            assert_eq!(text, format!("{block}\n{statement}"), "{block}");
        }
    }
}
