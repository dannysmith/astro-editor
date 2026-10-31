//! What ESM code imports: where each statement is in the text, and each import's
//! module and the names it binds. Adding an import splices text in at these
//! positions, so nothing else is reformatted.

use std::ops::Range;

use swc_common::Spanned;
use swc_ecma_ast::{Decl, ImportDecl, ImportSpecifier, ModuleDecl, ModuleExportName, ModuleItem};

use super::block::{find_block, line_end, line_starts_esm, offset, parse_chunk};

/// ESM code: the block after the frontmatter, or an ESM paragraph further down the body
pub struct Esm {
    pub text: String,
    pub statements: Vec<Statement>,
}

pub struct Statement {
    /// Where the statement is in `Esm::text`, including its semicolon
    pub range: Range<usize>,
    /// `None` for an export
    pub import: Option<Import>,
    /// The names an export declares: `x` in `export const x = …`
    pub declares: Vec<String>,
}

pub struct Import {
    /// The module, without its quotes
    pub source: String,
    /// The quote around the module
    pub quote: char,
    pub semicolon: bool,
    /// `import type …`
    pub type_only: bool,
    pub specifiers: Vec<Specifier>,
}

pub struct Specifier {
    /// The name it binds in the file
    pub local: String,
    pub binding: Binding,
    /// Where it is in `Esm::text`
    pub range: Range<usize>,
}

/// How a name is imported
#[derive(Clone, Debug, PartialEq)]
pub enum Binding {
    /// `import X from …`
    Default,
    /// `import { X } from …`, holding the exported name: `Y` in `import { Y as X }`
    Named(String),
    /// `import * as X from …`
    Namespace,
}

impl Esm {
    /// Reads ESM code. `None` if it's anything but import and export statements.
    pub fn parse(text: &str) -> Option<Esm> {
        let chunk = parse_chunk(text).ok()?;
        let position = |pos| offset(pos, chunk.start);
        let statements = chunk
            .items
            .iter()
            .map(|item| {
                let ModuleItem::ModuleDecl(decl) = item else {
                    return None;
                };
                let span = item.span();
                let mut end = position(span.hi);
                if text[end..].starts_with(';') {
                    end += 1;
                }
                Some(Statement {
                    range: position(span.lo)..end,
                    import: match decl {
                        ModuleDecl::Import(import) => {
                            Some(read_import(import, &text[..end], &position))
                        }
                        _ => None,
                    },
                    declares: match decl {
                        ModuleDecl::ExportDecl(export) => declared_names(&export.decl),
                        _ => Vec::new(),
                    },
                })
            })
            .collect::<Option<_>>()?;
        Some(Esm {
            text: text.to_string(),
            statements,
        })
    }

    pub fn imports(&self) -> impl Iterator<Item = (&Statement, &Import)> {
        self.statements
            .iter()
            .filter_map(|statement| Some((statement, statement.import.as_ref()?)))
    }

    /// The statement that imports `name`, if one does
    pub fn statement_importing(&self, name: &str) -> Option<&str> {
        self.imports()
            .find(|(_, import)| import.specifiers.iter().any(|s| s.local == name))
            .map(|(statement, _)| &self.text[statement.range.clone()])
    }

    /// Every name the code binds, imported or exported
    pub fn bindings(&self) -> impl Iterator<Item = &str> {
        self.statements.iter().flat_map(|statement| {
            let imported = statement
                .import
                .iter()
                .flat_map(|import| &import.specifiers)
                .map(|s| s.local.as_str());
            imported.chain(statement.declares.iter().map(String::as_str))
        })
    }
}

/// The names a declaration binds. Destructuring isn't followed, since nothing
/// the builder adds would clash with it.
fn declared_names(decl: &Decl) -> Vec<String> {
    match decl {
        Decl::Var(var) => var
            .decls
            .iter()
            .filter_map(|d| d.name.as_ident())
            .map(|ident| ident.sym.to_string())
            .collect(),
        Decl::Fn(f) => vec![f.ident.sym.to_string()],
        Decl::Class(c) => vec![c.ident.sym.to_string()],
        _ => Vec::new(),
    }
}

/// `text` runs to the end of the statement
fn read_import(
    import: &ImportDecl,
    text: &str,
    position: &impl Fn(swc_common::BytePos) -> usize,
) -> Import {
    let specifiers = import
        .specifiers
        .iter()
        .map(|specifier| {
            let (local, binding) = match specifier {
                ImportSpecifier::Default(s) => (&s.local, Binding::Default),
                ImportSpecifier::Namespace(s) => (&s.local, Binding::Namespace),
                ImportSpecifier::Named(s) => (
                    &s.local,
                    Binding::Named(match &s.imported {
                        Some(ModuleExportName::Ident(ident)) => ident.sym.to_string(),
                        Some(ModuleExportName::Str(s)) => s.value.to_string_lossy().to_string(),
                        None => s.local.sym.to_string(),
                    }),
                ),
            };
            let span = specifier.span();
            Specifier {
                local: local.sym.to_string(),
                binding,
                range: position(span.lo)..position(span.hi),
            }
        })
        .collect();

    Import {
        source: import.src.value.to_string_lossy().to_string(),
        quote: text[position(import.src.span.lo)..]
            .chars()
            .next()
            .unwrap_or('\''),
        semicolon: text.ends_with(';'),
        type_only: import.type_only,
        specifiers,
    }
}

/// The ESM further down an MDX body, which docs sites use a lot. Imports inside
/// code fences are examples, not code. Any other line that starts ESM counts,
/// even mid-paragraph where MDX would read it as text: missing an import means
/// adding a second one, which breaks the build, while an extra one only means
/// nothing is added.
pub fn body_esm(body: &str) -> Vec<Esm> {
    let mut found = Vec::new();
    let mut fence: Option<&str> = None;
    let mut pos = 0;

    while pos < body.len() {
        let end = line_end(body, pos);
        let line = &body[pos..end];

        if let Some(open) = fence {
            if closes_fence(line, open) {
                fence = None;
            }
        } else if let Some(open) = fence_start(line) {
            fence = Some(open);
        } else if line_starts_esm(line) {
            if let Some(block) = find_block(&body[pos..]) {
                found.extend(Esm::parse(&body[pos..pos + block.end]));
                pos = line_end(body, pos + block.end) + 1;
                continue;
            }
        }
        pos = end + 1;
    }
    found
}

/// The fence that opens a fenced code block on this line: three or more
/// backticks or tildes
fn fence_start(line: &str) -> Option<&str> {
    let trimmed = line.trim_start();
    let marker = trimmed.chars().next().filter(|c| matches!(c, '`' | '~'))?;
    let length = trimmed.len() - trimmed.trim_start_matches(marker).len();
    (length >= 3).then(|| &trimmed[..length])
}

/// Whether this line closes the code block `open` started: the same marker, at
/// least as many times, and nothing else
fn closes_fence(line: &str, open: &str) -> bool {
    let trimmed = line.trim();
    trimmed.len() >= open.len() && trimmed.chars().all(|c| open.starts_with(c))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn named(name: &str) -> Binding {
        Binding::Named(name.to_string())
    }

    #[test]
    fn reads_each_kind_of_import() {
        let esm = Esm::parse(
            "import A, { B, C as D } from \"./x\";\nimport * as ns from 'y'\nimport type { T } from './t';\nexport const e = 1;",
        )
        .unwrap();
        let imports: Vec<_> = esm.imports().map(|(_, i)| i).collect();
        assert_eq!(imports.len(), 3);

        let bindings: Vec<_> = imports[0]
            .specifiers
            .iter()
            .map(|s| {
                (
                    s.local.as_str(),
                    s.binding.clone(),
                    &esm.text[s.range.clone()],
                )
            })
            .collect();
        assert_eq!(
            bindings,
            [
                ("A", Binding::Default, "A"),
                ("B", named("B"), "B"),
                ("D", named("C"), "C as D"),
            ]
        );
        assert_eq!(
            (
                imports[0].source.as_str(),
                imports[0].quote,
                imports[0].semicolon
            ),
            ("./x", '"', true)
        );
        assert_eq!(imports[1].specifiers[0].binding, Binding::Namespace);
        assert_eq!((imports[1].quote, imports[1].semicolon), ('\'', false));
        assert!(imports[2].type_only);
        assert!(esm.statements[3].import.is_none());
    }

    #[test]
    fn statements_include_their_semicolons() {
        let esm = Esm::parse("import a from 'a';\nexport const b = 1;").unwrap();
        let texts: Vec<_> = esm
            .statements
            .iter()
            .map(|s| &esm.text[s.range.clone()])
            .collect();
        assert_eq!(texts, ["import a from 'a';", "export const b = 1;"]);
    }

    #[test]
    fn finds_the_statement_importing_a_name() {
        let esm = Esm::parse("import a from 'a'\nimport {\n  B,\n  Card,\n} from 'b'").unwrap();
        assert_eq!(
            esm.statement_importing("Card"),
            Some("import {\n  B,\n  Card,\n} from 'b'")
        );
        assert_eq!(esm.statement_importing("C"), None);
    }

    #[test]
    fn lists_the_names_it_binds() {
        let esm = Esm::parse(
            "import A, { b as c } from 'x'\nexport const d = 1, e = 2\nexport function f() {}",
        )
        .unwrap();
        assert_eq!(
            esm.bindings().collect::<Vec<_>>(),
            ["A", "c", "d", "e", "f"]
        );
    }

    #[test]
    fn only_imports_and_exports_parse() {
        assert!(Esm::parse("").is_some());
        assert!(Esm::parse("import a from 'a'\nconst b = 1").is_none());
        assert!(Esm::parse("import { broken").is_none());
    }

    #[test]
    fn finds_imports_further_down_the_body() {
        let body = "Some text.\n\nimport { Aside } from 'x';\nimport B from './b';\n\n<Aside />\n\nimport C from './c'\n\nEnd.";
        let found: Vec<_> = body_esm(body).into_iter().map(|e| e.text).collect();
        assert_eq!(
            found,
            [
                "import { Aside } from 'x';\nimport B from './b';",
                "import C from './c'"
            ]
        );
    }

    #[test]
    fn body_imports_start_a_line() {
        // After a heading, MDX reads this as ESM
        assert_eq!(body_esm("# Heading\nimport A from './a'").len(), 1);
        assert!(body_esm("  import A from './a'").is_empty());
        assert!(body_esm("import this idea, said the writer.").is_empty());
    }

    #[test]
    fn imports_in_code_fences_are_examples() {
        let body = "```mdx\nimport A from './a'\n```\n\n~~~~\nimport B from './b'\n```\nimport C from './c'\n~~~~\n\nimport D from './d'";
        let found: Vec<_> = body_esm(body).into_iter().map(|e| e.text).collect();
        assert_eq!(found, ["import D from './d'"]);
    }
}
