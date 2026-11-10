//! Reads a project's content config: which collections it defines, and where
//! each collection's loader finds its files.
//!
//! The config is parsed as TypeScript with swc and read statically: the
//! `collections` export, the `defineCollection()` call behind each entry (through
//! local variables), and the loader inside it. Anything only known at runtime,
//! like a `base` built from a variable or a custom loader, is reported as
//! unreadable rather than guessed. Zod schemas aren't read here: each
//! collection's `schema` source goes to `parser.rs`, which finds its `image()`
//! and `reference()` helpers.
//!
//! See `docs/developer/app-data.md`.

pub mod pattern;

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::rc::Rc;
use swc_common::sync::Lrc;
use swc_common::{BytePos, FileName, SourceMap, Span, Spanned};
use swc_ecma_ast::*;
use swc_ecma_parser::{parse_file_as_module, Syntax, TsSyntax};

/// Content config files in the order Astro looks for them, relative to `src/`.
/// The last four are the legacy location.
const CONFIG_FILES: [&str; 8] = [
    "content.config.mjs",
    "content.config.js",
    "content.config.mts",
    "content.config.ts",
    "content/config.ts",
    "content/config.js",
    "content/config.mjs",
    "content/config.mts",
];

/// Starlight's `docsLoader()` is `glob()` with these options
const STARLIGHT_DOCS_BASE: &str = "src/content/docs";
const STARLIGHT_DOCS_PATTERN: &str = "**/[^_]*.{markdown,mdown,mkdn,mkd,mdwn,md,mdx}";

/// How far to follow variables before giving up (guards against cycles)
const MAX_DEPTH: usize = 8;

/// Every path a project's content config could be at, in Astro's order
pub fn config_candidates(project: &Path) -> Vec<PathBuf> {
    CONFIG_FILES
        .iter()
        .map(|file| project.join("src").join(file))
        .collect()
}

/// Whether a path (with forward slashes) is one Astro reads a content config from
pub fn is_config_path(path: &str) -> bool {
    CONFIG_FILES
        .iter()
        .any(|file| path.ends_with(&format!("src/{file}")))
}

/// The project's content config, if it has one
pub fn find_config(project: &Path) -> Option<PathBuf> {
    config_candidates(project)
        .into_iter()
        .find(|path| path.is_file())
}

/// A collection as the content config defines it
#[derive(Debug, Clone, PartialEq)]
pub struct ConfigCollection {
    /// Its key in the `collections` export
    pub name: String,
    pub loader: Loader,
    /// Whether it has a `loader` option. Astro only makes collections from
    /// undefined `src/content` folders when none does.
    pub has_loader: bool,
    /// The source of its `schema` option, for `parser.rs` to find helpers in
    pub schema_source: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Loader {
    /// `glob()`, or a loader known to wrap it
    Glob {
        base: GlobBase,
        /// `None` when the pattern isn't something AE can read
        patterns: Option<Vec<String>>,
    },
    /// No loader: a legacy collection, which Astro loads from `src/content/<name>`
    Legacy,
    /// Data files rather than content: `file()`, Starlight's `i18nLoader()`,
    /// or a legacy `type: 'data'` collection. `file` is the `file()` loader's path,
    /// relative to the project root.
    Data { file: Option<String> },
    /// A loader AE doesn't know, or a collection it can't follow (imported from
    /// another file, say). `name` is the loader function's, when it's called by
    /// name, as in `atprotoLoader(...)`.
    Unknown { name: Option<String> },
}

#[derive(Debug, Clone, PartialEq)]
pub enum GlobBase {
    /// No `base`, so the project root
    Root,
    /// Relative to the project root, or absolute
    Path(PathBuf),
    /// Not something AE can read, like a variable
    Unreadable,
}

/// Reads the collections from a content config's source. `config_path` is where
/// it lives, for resolving `new URL(…, import.meta.url)`. Errors when the file
/// doesn't parse or has no `collections` export AE can read.
pub fn parse_config(
    source: &str,
    config_path: &Path,
    project: &Path,
) -> Result<Vec<ConfigCollection>, String> {
    let cm = Lrc::new(SourceMap::default());
    let fm = cm.new_source_file(Rc::new(FileName::Anon), source.to_string());
    let syntax = Syntax::Typescript(TsSyntax::default());
    let module = parse_file_as_module(&fm, syntax, EsVersion::latest(), None, &mut vec![])
        .map_err(|e| format!("Couldn't parse the content config: {:?}", e.kind()))?;

    let scope = Scope::new(&module, source, fm.start_pos, config_path, project);

    let collections = scope
        .vars
        .get("collections")
        .and_then(|expr| scope.resolve(expr))
        .ok_or("The content config has no `collections` export")?;
    let Expr::Object(collections) = collections else {
        return Err("The content config's `collections` isn't an object".to_string());
    };

    Ok(collections
        .props
        .iter()
        .filter_map(|prop| match prop {
            PropOrSpread::Prop(prop) => Some(prop),
            PropOrSpread::Spread(_) => None,
        })
        .filter_map(|prop| match prop.as_ref() {
            Prop::Shorthand(ident) => {
                let name = ident.sym.to_string();
                let definition = scope.vars.get(name.as_str()).copied();
                Some((name, definition))
            }
            Prop::KeyValue(kv) => Some((prop_name(&kv.key)?, Some(kv.value.as_ref()))),
            _ => None,
        })
        .map(|(name, definition)| scope.read_collection(name, definition))
        .collect())
}

/// The module's top-level variables and imports, for following names
struct Scope<'a> {
    /// Each top-level variable's initialiser
    vars: HashMap<&'a str, &'a Expr>,
    /// Imported local name → the name it was exported as
    imports: HashMap<&'a str, String>,
    source: &'a str,
    start: BytePos,
    config_dir: PathBuf,
    project: &'a Path,
}

impl<'a> Scope<'a> {
    fn new(
        module: &'a Module,
        source: &'a str,
        start: BytePos,
        config_path: &Path,
        project: &'a Path,
    ) -> Self {
        let mut vars = HashMap::new();
        let mut imports = HashMap::new();

        for item in &module.body {
            let var = match item {
                ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl {
                    decl: Decl::Var(var),
                    ..
                }))
                | ModuleItem::Stmt(Stmt::Decl(Decl::Var(var))) => var,
                ModuleItem::ModuleDecl(ModuleDecl::Import(import)) => {
                    for specifier in &import.specifiers {
                        if let ImportSpecifier::Named(named) = specifier {
                            let imported = match &named.imported {
                                Some(ModuleExportName::Ident(id)) => id.sym.to_string(),
                                Some(ModuleExportName::Str(s)) => {
                                    s.value.to_string_lossy().to_string()
                                }
                                None => named.local.sym.to_string(),
                            };
                            imports.insert(named.local.sym.as_str(), imported);
                        }
                    }
                    continue;
                }
                _ => continue,
            };
            for declarator in &var.decls {
                if let (Pat::Ident(name), Some(init)) = (&declarator.name, &declarator.init) {
                    vars.insert(name.id.sym.as_str(), init.as_ref());
                }
            }
        }

        Self {
            vars,
            imports,
            source,
            start,
            config_dir: config_path.parent().unwrap_or(project).to_path_buf(),
            project,
        }
    }

    /// Follows identifiers to the expression they name, and unwraps parentheses
    /// and TypeScript assertions
    fn resolve(&self, expr: &'a Expr) -> Option<&'a Expr> {
        let mut expr = expr;
        for _ in 0..MAX_DEPTH {
            expr = match expr {
                Expr::Paren(e) => &e.expr,
                Expr::TsAs(e) => &e.expr,
                Expr::TsSatisfies(e) => &e.expr,
                Expr::TsConstAssertion(e) => &e.expr,
                Expr::TsNonNull(e) => &e.expr,
                Expr::Ident(id) => self.vars.get(id.sym.as_str())?,
                _ => return Some(expr),
            };
        }
        None
    }

    /// The name a called function was imported as, or its local name
    fn callee_name(&self, call: &CallExpr) -> Option<String> {
        let Callee::Expr(callee) = &call.callee else {
            return None;
        };
        let Expr::Ident(id) = callee.as_ref() else {
            return None;
        };
        Some(
            self.imports
                .get(id.sym.as_str())
                .cloned()
                .unwrap_or_else(|| id.sym.to_string()),
        )
    }

    fn snippet(&self, span: Span) -> String {
        let lo = span.lo.0.saturating_sub(self.start.0) as usize;
        let hi = span.hi.0.saturating_sub(self.start.0) as usize;
        self.source.get(lo..hi).unwrap_or("").to_string()
    }

    fn read_collection(&self, name: String, definition: Option<&'a Expr>) -> ConfigCollection {
        let options = definition
            .and_then(|expr| self.resolve(expr))
            .and_then(|expr| match expr {
                Expr::Call(call)
                    if self.callee_name(call).as_deref() == Some("defineCollection") =>
                {
                    call.args.first()
                }
                _ => None,
            })
            .and_then(|arg| self.resolve(&arg.expr))
            .and_then(|expr| match expr {
                Expr::Object(object) => Some(object),
                _ => None,
            });

        let Some(options) = options else {
            return ConfigCollection {
                name,
                loader: Loader::Unknown { name: None },
                has_loader: true,
                schema_source: None,
            };
        };

        let loader_option = self.option(options, "loader");
        let loader = match loader_option {
            Some(loader) => self.read_loader(loader),
            None => match self.option(options, "type").and_then(string_value) {
                Some(kind) if kind == "data" => Loader::Data { file: None },
                _ => Loader::Legacy,
            },
        };
        let schema_source = self
            .option(options, "schema")
            .map(|schema| self.snippet(schema.span()));

        ConfigCollection {
            name,
            loader,
            has_loader: loader_option.is_some(),
            schema_source,
        }
    }

    /// An option's value from an object literal, resolved
    fn option(&self, object: &'a ObjectLit, key: &str) -> Option<&'a Expr> {
        object.props.iter().find_map(|prop| {
            let PropOrSpread::Prop(prop) = prop else {
                return None;
            };
            match prop.as_ref() {
                Prop::KeyValue(kv) if prop_name(&kv.key).as_deref() == Some(key) => {
                    self.resolve(&kv.value)
                }
                Prop::Shorthand(ident) if ident.sym == key => {
                    self.vars.get(key).and_then(|expr| self.resolve(expr))
                }
                _ => None,
            }
        })
    }

    fn read_loader(&self, loader: &'a Expr) -> Loader {
        let Expr::Call(call) = loader else {
            return Loader::Unknown { name: None };
        };
        let first_arg = call.args.first().and_then(|arg| self.resolve(&arg.expr));

        match self.callee_name(call).as_deref() {
            Some("glob") => {
                let Some(Expr::Object(options)) = first_arg else {
                    return Loader::Glob {
                        base: GlobBase::Unreadable,
                        patterns: None,
                    };
                };
                let base = match self.option(options, "base") {
                    None => GlobBase::Root,
                    Some(base) => self
                        .read_base(base)
                        .map_or(GlobBase::Unreadable, GlobBase::Path),
                };
                let patterns = self
                    .option(options, "pattern")
                    .and_then(|pattern| self.read_patterns(pattern));
                Loader::Glob { base, patterns }
            }
            Some("docsLoader") => Loader::Glob {
                base: GlobBase::Path(PathBuf::from(STARLIGHT_DOCS_BASE)),
                patterns: Some(vec![STARLIGHT_DOCS_PATTERN.to_string()]),
            },
            Some("file") => Loader::Data {
                file: first_arg
                    .and_then(string_value)
                    .map(|path| path.trim_start_matches("./").to_string()),
            },
            Some("i18nLoader") => Loader::Data { file: None },
            other => Loader::Unknown {
                name: other.map(str::to_string),
            },
        }
    }

    /// A glob `base`: a string relative to the project root, or a URL. A relative
    /// URL (`new URL('./content', import.meta.url)`) is relative to the config file.
    fn read_base(&self, base: &'a Expr) -> Option<PathBuf> {
        if let Some(path) = string_value(base) {
            return Some(PathBuf::from(path));
        }
        let Expr::New(new) = base else {
            return None;
        };
        if !matches!(new.callee.as_ref(), Expr::Ident(id) if id.sym == "URL") {
            return None;
        }
        let args = new.args.as_ref()?;
        let url = self.resolve(&args.first()?.expr).and_then(string_value)?;

        if let Some(absolute) = url.strip_prefix("file://") {
            return Some(PathBuf::from(absolute));
        }
        if !args.get(1).is_some_and(|arg| is_import_meta_url(&arg.expr)) {
            return None;
        }
        let resolved = normalize(&self.config_dir.join(url));
        Some(
            resolved
                .strip_prefix(self.project)
                .map(Path::to_path_buf)
                .unwrap_or(resolved),
        )
    }

    fn read_patterns(&self, pattern: &'a Expr) -> Option<Vec<String>> {
        if let Some(pattern) = string_value(pattern) {
            return Some(vec![pattern]);
        }
        let Expr::Array(array) = pattern else {
            return None;
        };
        array
            .elems
            .iter()
            .map(|elem| {
                let elem = elem.as_ref()?;
                if elem.spread.is_some() {
                    return None;
                }
                self.resolve(&elem.expr).and_then(string_value)
            })
            .collect()
    }
}

/// A string literal, or a template literal with nothing interpolated
fn string_value(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Lit(Lit::Str(s)) => Some(s.value.to_string_lossy().to_string()),
        Expr::Tpl(tpl) if tpl.exprs.is_empty() => tpl
            .quasis
            .first()
            .and_then(|quasi| quasi.cooked.as_ref())
            .map(|cooked| cooked.to_string_lossy().to_string()),
        _ => None,
    }
}

fn prop_name(key: &PropName) -> Option<String> {
    match key {
        PropName::Ident(id) => Some(id.sym.to_string()),
        PropName::Str(s) => Some(s.value.to_string_lossy().to_string()),
        _ => None,
    }
}

fn is_import_meta_url(expr: &Expr) -> bool {
    let Expr::Member(member) = expr else {
        return false;
    };
    matches!(member.obj.as_ref(), Expr::MetaProp(meta) if meta.kind == MetaPropKind::ImportMeta)
        && matches!(&member.prop, MemberProp::Ident(prop) if prop.sym == "url")
}

/// Resolves `.` and `..` without touching the filesystem
pub fn normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    normalized.push("..");
                }
            }
            other => normalized.push(other),
        }
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(source: &str) -> Vec<ConfigCollection> {
        let project = Path::new("/site");
        parse_config(source, &project.join("src/content.config.ts"), project).unwrap()
    }

    fn loader(source: &str) -> Loader {
        parse(source).remove(0).loader
    }

    fn glob(base: GlobBase, patterns: &[&str]) -> Loader {
        Loader::Glob {
            base,
            patterns: Some(patterns.iter().map(|p| p.to_string()).collect()),
        }
    }

    fn path(p: &str) -> GlobBase {
        GlobBase::Path(PathBuf::from(p))
    }

    #[test]
    fn finds_config_in_astros_order() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(find_config(dir.path()), None);

        std::fs::create_dir_all(dir.path().join("src/content")).unwrap();
        std::fs::write(dir.path().join("src/content/config.ts"), "").unwrap();
        assert_eq!(
            find_config(dir.path()),
            Some(dir.path().join("src/content/config.ts"))
        );

        std::fs::write(dir.path().join("src/content.config.ts"), "").unwrap();
        std::fs::write(dir.path().join("src/content.config.mjs"), "").unwrap();
        assert_eq!(
            find_config(dir.path()),
            Some(dir.path().join("src/content.config.mjs"))
        );
    }

    #[test]
    fn reads_every_form_of_the_collections_export() {
        let collections = parse(
            r#"
            import { defineCollection } from 'astro:content';
            import { glob } from 'astro/loaders';
            const blog = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/blog' }) });
            const notesCollection = defineCollection({ loader: glob({ pattern: '*.md' }) });
            export const collections = {
                blog,
                notes: notesCollection,
                'my-docs': defineCollection({ loader: glob({ pattern: '**/*.mdx', base: 'docs' }) }),
            };
            "#,
        );
        let names: Vec<_> = collections.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, ["blog", "notes", "my-docs"]);
        assert_eq!(
            collections[0].loader,
            glob(path("./src/blog"), &["**/*.md"])
        );
        assert_eq!(collections[1].loader, glob(GlobBase::Root, &["*.md"]));
        assert_eq!(collections[2].loader, glob(path("docs"), &["**/*.mdx"]));
    }

    #[test]
    fn follows_variables_and_assertions() {
        let collections = parse(
            r#"
            const base = './content/posts';
            const postsLoader = glob({ pattern: ['**/*.md', '!**/drafts/**'], base });
            const posts = defineCollection({ loader: postsLoader }) satisfies unknown;
            const all = { posts };
            export const collections = all as const;
            "#,
        );
        assert_eq!(
            collections[0].loader,
            glob(path("./content/posts"), &["**/*.md", "!**/drafts/**"])
        );
    }

    #[test]
    fn reads_url_bases_relative_to_the_config() {
        assert_eq!(
            loader(
                r#"export const collections = { blog: defineCollection({
                    loader: glob({ pattern: '**/*.md', base: new URL('./content/blog', import.meta.url) }),
                }) };"#
            ),
            glob(path("src/content/blog"), &["**/*.md"])
        );
        assert_eq!(
            loader(
                r#"export const collections = { blog: defineCollection({
                    loader: glob({ pattern: '**/*.md', base: new URL('../posts/', import.meta.url) }),
                }) };"#
            ),
            glob(path("posts"), &["**/*.md"])
        );
    }

    #[test]
    fn reports_options_it_cant_read() {
        assert_eq!(
            loader(
                r#"const dir = process.env.DIR;
                export const collections = { blog: defineCollection({
                    loader: glob({ pattern: `**/*.${ext}`, base: `${dir}/blog` }),
                }) };"#
            ),
            Loader::Glob {
                base: GlobBase::Unreadable,
                patterns: None
            }
        );
    }

    #[test]
    fn follows_renamed_imports() {
        assert_eq!(
            loader(
                r#"import { glob as g } from 'astro/loaders';
                import { defineCollection as dc } from 'astro:content';
                export const collections = { blog: dc({ loader: g({ pattern: '*.md' }) }) };"#
            ),
            glob(GlobBase::Root, &["*.md"])
        );
    }

    #[test]
    fn recognises_legacy_data_starlight_and_unknown_loaders() {
        let collections = parse(
            r#"
            import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
            import { posts } from './posts';
            export const collections = {
                legacy: defineCollection({ schema: z.object({}) }),
                empty: defineCollection({}),
                typed: defineCollection({ type: 'content' }),
                legacyData: defineCollection({ type: 'data' }),
                authors: defineCollection({ schema: z.object({}), loader: file('./src/data/authors.json') }),
                docs: defineCollection({ loader: docsLoader() }),
                i18n: defineCollection({ loader: i18nLoader() }),
                feed: defineCollection({ loader: rssLoader('https://example.com') }),
                inline: defineCollection({ loader: async () => [] }),
                posts,
            };
            "#,
        );
        let loaders: Vec<_> = collections.into_iter().map(|c| c.loader).collect();
        assert_eq!(
            loaders,
            [
                Loader::Legacy,
                Loader::Legacy,
                Loader::Legacy,
                Loader::Data { file: None },
                Loader::Data {
                    file: Some("src/data/authors.json".to_string())
                },
                glob(path(STARLIGHT_DOCS_BASE), &[STARLIGHT_DOCS_PATTERN]),
                Loader::Data { file: None },
                Loader::Unknown {
                    name: Some("rssLoader".to_string())
                },
                Loader::Unknown { name: None },
                Loader::Unknown { name: None },
            ]
        );
    }

    #[test]
    fn returns_each_collections_schema_source() {
        let collections = parse(
            r#"
            const postSchema = z.object({ cover: image() });
            export const collections = {
                inline: defineCollection({ schema: ({ image }) => z.object({ cover: image() }) }),
                shared: defineCollection({ schema: postSchema }),
                none: defineCollection({}),
            };
            "#,
        );
        assert_eq!(
            collections[0].schema_source.as_deref(),
            Some("({ image }) => z.object({ cover: image() })")
        );
        assert_eq!(
            collections[1].schema_source.as_deref(),
            Some("z.object({ cover: image() })")
        );
        assert_eq!(collections[2].schema_source, None);
    }

    #[test]
    fn errors_without_a_readable_collections_export() {
        let project = Path::new("/site");
        let config = project.join("src/content.config.ts");
        assert!(parse_config("export const nothing = 1;", &config, project).is_err());
        assert!(parse_config(
            "export const collections = getCollections();",
            &config,
            project
        )
        .is_err());
        assert!(parse_config("export const collections = {", &config, project).is_err());
    }
}
