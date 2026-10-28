//! Reads a component's props from TypeScript source, for the MDX component builder.
//!
//! This is static parsing, not type checking. It resolves what a writer-facing form
//! needs: local interfaces, type aliases and enums, `(typeof list)[number]` over const
//! arrays, intersections, and types imported through relative paths (followed into
//! sibling `.ts` and `.d.ts` files). Anything it can't resolve becomes `PropKind::Unknown`,
//! and anything inherited from types it can't see (e.g. `HTMLAttributes<'a'>`) is skipped.

use crate::models::{PropInfo, PropKind};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use swc_common::comments::{CommentKind, Comments, SingleThreadedComments};
use swc_common::sync::Lrc;
use swc_common::{BytePos, FileName, SourceMap, Span, Spanned};
use swc_ecma_ast::*;
use swc_ecma_parser::{parse_file_as_module, Syntax, TsSyntax};

/// How far to follow aliases and imports before giving up (guards against cycles)
const MAX_DEPTH: usize = 8;

/// A parsed TypeScript source and the comments in it.
pub struct SourceModule {
    path: Option<PathBuf>,
    src: String,
    start: BytePos,
    pub module: Module,
    comments: SingleThreadedComments,
}

impl SourceModule {
    /// Parses `src`. `path` is where it lives (for resolving relative imports), or
    /// `None` for code that has no file of its own.
    pub fn parse(src: String, path: Option<PathBuf>, tsx: bool) -> Result<Self, String> {
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(Rc::new(FileName::Anon), src.clone());
        let comments = SingleThreadedComments::default();
        let dts = path
            .as_ref()
            .is_some_and(|p| p.to_string_lossy().ends_with(".d.ts"));
        let syntax = Syntax::Typescript(TsSyntax {
            tsx,
            dts,
            ..Default::default()
        });
        let module = parse_file_as_module(
            &fm,
            syntax,
            EsVersion::latest(),
            Some(&comments),
            &mut vec![],
        )
        .map_err(|e| format!("Failed to parse TypeScript: {e:?}"))?;
        Ok(Self {
            path,
            src,
            start: fm.start_pos,
            module,
            comments,
        })
    }

    /// The source text of a node
    pub fn snippet(&self, span: Span) -> &str {
        let lo = (span.lo.0 - self.start.0) as usize;
        let hi = (span.hi.0 - self.start.0) as usize;
        self.src.get(lo..hi).unwrap_or("")
    }

    /// The JSDoc (`/** … */`) comment directly before `pos`, cleaned of its `*`s
    pub fn doc_before(&self, pos: BytePos) -> Option<String> {
        let comments = self.comments.get_leading(pos)?;
        comments
            .iter()
            .rev()
            .find(|c| c.kind == CommentKind::Block && c.text.starts_with('*'))
            .map(|c| clean_jsdoc(&c.text))
            .filter(|s| !s.is_empty())
    }

    /// The JSDoc comment on the same line after `pos`, as in `color: string /** CSS colour */`
    fn doc_after(&self, pos: BytePos) -> Option<String> {
        let comments = self.comments.get_trailing(pos)?;
        comments
            .iter()
            .find(|c| c.kind == CommentKind::Block && c.text.starts_with('*'))
            .map(|c| clean_jsdoc(&c.text))
            .filter(|s| !s.is_empty())
    }

    /// The first paragraph of the first JSDoc comment on a top-level statement,
    /// which components conventionally use to describe themselves
    pub fn leading_description(&self) -> Option<String> {
        self.module.body.iter().find_map(|item| {
            let doc = self.doc_before(item.span().lo)?;
            doc.split("\n\n").next().map(str::to_string)
        })
    }
}

/// Strips the `*`s and indentation from a JSDoc comment's text and unwraps its
/// lines, keeping paragraphs separated by a blank line
fn clean_jsdoc(text: &str) -> String {
    let lines: Vec<&str> = text
        .lines()
        .map(|line| line.trim().trim_start_matches('*').trim())
        .collect();
    lines
        .split(|line| line.is_empty())
        .filter(|para| !para.is_empty())
        .map(|para| para.join(" "))
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// A top-level declaration that a type name can resolve to
enum TypeDecl {
    Interface(TsInterfaceDecl),
    Alias(TsType),
    /// A string enum, or a const array/tuple of strings (for `(typeof X)[number]`)
    Values(Vec<String>),
}

/// Resolves prop types across a component's source and the files it imports.
pub struct PropResolver {
    modules: Vec<Rc<SourceModule>>,
    by_path: HashMap<PathBuf, usize>,
    /// Imports are only followed to files inside this directory
    root: Option<PathBuf>,
}

impl PropResolver {
    /// `root` bounds which files imports may be followed into; `None` disables following imports
    pub fn new(root: Option<&Path>) -> Self {
        Self {
            modules: Vec::new(),
            by_path: HashMap::new(),
            root: root.and_then(|r| r.canonicalize().ok()),
        }
    }

    /// Adds a parsed source and returns its index for the other methods
    pub fn add(&mut self, module: SourceModule) -> usize {
        if let Some(path) = &module.path {
            self.by_path.insert(path.clone(), self.modules.len());
        }
        self.modules.push(Rc::new(module));
        self.modules.len() - 1
    }

    pub fn module(&self, m: usize) -> Rc<SourceModule> {
        Rc::clone(&self.modules[m])
    }

    /// The props of the type named `name` (usually `Props`) in module `m`
    pub fn props_of_named(&mut self, m: usize, name: &str) -> Option<Vec<PropInfo>> {
        let (dm, decl) = self.lookup(m, name, 0)?;
        Some(self.props_of_decl(dm, decl, 0))
    }

    /// The props described by a type annotation, e.g. `{ a: string }` or `Props & Extra`
    pub fn props_of_type(&mut self, m: usize, ty: &TsType, depth: usize) -> Vec<PropInfo> {
        if depth > MAX_DEPTH {
            return Vec::new();
        }
        match ty {
            TsType::TsTypeLit(lit) => self.props_of_members(m, &lit.members),
            TsType::TsParenthesizedType(p) => self.props_of_type(m, &p.type_ann, depth + 1),
            TsType::TsUnionOrIntersectionType(TsUnionOrIntersectionType::TsIntersectionType(i)) => {
                i.types
                    .iter()
                    .flat_map(|t| self.props_of_type(m, t, depth + 1))
                    .collect()
            }
            TsType::TsTypeRef(r) => match &r.type_name {
                TsEntityName::Ident(id) => match self.lookup(m, id.sym.as_str(), depth + 1) {
                    Some((dm, decl)) => self.props_of_decl(dm, decl, depth + 1),
                    None => Vec::new(),
                },
                TsEntityName::TsQualifiedName(_) => Vec::new(),
            },
            _ => Vec::new(),
        }
    }

    fn props_of_decl(&mut self, m: usize, decl: TypeDecl, depth: usize) -> Vec<PropInfo> {
        match decl {
            TypeDecl::Interface(iface) => {
                let mut props = Vec::new();
                for parent in &iface.extends {
                    if let Expr::Ident(id) = parent.expr.as_ref() {
                        if let Some((pm, pdecl)) = self.lookup(m, id.sym.as_str(), depth + 1) {
                            props.extend(self.props_of_decl(pm, pdecl, depth + 1));
                        }
                    }
                }
                props.extend(self.props_of_members(m, &iface.body.body));
                props
            }
            TypeDecl::Alias(ty) => self.props_of_type(m, &ty, depth + 1),
            TypeDecl::Values(_) => Vec::new(),
        }
    }

    fn props_of_members(&mut self, m: usize, members: &[TsTypeElement]) -> Vec<PropInfo> {
        let source = self.module(m);
        members
            .iter()
            .filter_map(|member| {
                let TsTypeElement::TsPropertySignature(prop) = member else {
                    return None;
                };
                let name = match prop.key.as_ref() {
                    Expr::Ident(id) => id.sym.to_string(),
                    Expr::Lit(Lit::Str(s)) => s.value.to_string_lossy().to_string(),
                    _ => return None,
                };
                let (prop_type, kind) = match &prop.type_ann {
                    Some(ann) => (
                        collapse_whitespace(source.snippet(ann.type_ann.span())),
                        self.kind_of(m, &ann.type_ann, 0),
                    ),
                    None => ("unknown".to_string(), PropKind::Unknown),
                };
                let description = source
                    .doc_before(prop.span.lo)
                    .or_else(|| source.doc_after(prop.span.hi));
                Some(PropInfo {
                    name,
                    prop_type,
                    kind,
                    is_optional: prop.optional,
                    default_value: None,
                    description,
                })
            })
            .collect()
    }

    /// Resolves a type to the kind of value a writer would enter for it
    pub fn kind_of(&mut self, m: usize, ty: &TsType, depth: usize) -> PropKind {
        if depth > MAX_DEPTH {
            return PropKind::Unknown;
        }
        match ty {
            TsType::TsKeywordType(k) => match k.kind {
                TsKeywordTypeKind::TsStringKeyword => PropKind::String,
                TsKeywordTypeKind::TsNumberKeyword => PropKind::Number,
                TsKeywordTypeKind::TsBooleanKeyword => PropKind::Boolean,
                _ => PropKind::Unknown,
            },
            TsType::TsLitType(lit) => match &lit.lit {
                TsLit::Str(s) => PropKind::Literals {
                    values: vec![s.value.to_string_lossy().to_string()],
                },
                TsLit::Bool(_) => PropKind::Boolean,
                TsLit::Number(_) => PropKind::Number,
                _ => PropKind::Unknown,
            },
            TsType::TsParenthesizedType(p) => self.kind_of(m, &p.type_ann, depth + 1),
            TsType::TsTypeOperator(op) if op.op == TsTypeOperatorOp::ReadOnly => {
                self.kind_of(m, &op.type_ann, depth + 1)
            }
            TsType::TsArrayType(arr) => PropKind::Array {
                items: Box::new(self.kind_of(m, &arr.elem_type, depth + 1)),
            },
            TsType::TsUnionOrIntersectionType(TsUnionOrIntersectionType::TsUnionType(u)) => {
                let kinds: Vec<PropKind> = u
                    .types
                    .iter()
                    .filter(|t| !is_nullish(t))
                    .map(|t| self.kind_of(m, t, depth + 1))
                    .collect();
                merge_union(kinds)
            }
            TsType::TsIndexedAccessType(access) => self.kind_of_indexed(m, access, depth),
            TsType::TsTypeRef(r) => self.kind_of_ref(m, r, depth),
            _ => PropKind::Unknown,
        }
    }

    fn kind_of_ref(&mut self, m: usize, r: &TsTypeRef, depth: usize) -> PropKind {
        let TsEntityName::Ident(id) = &r.type_name else {
            return PropKind::Unknown;
        };
        let first_param = r
            .type_params
            .as_ref()
            .and_then(|p| p.params.first())
            .map(|t| t.as_ref());
        match (id.sym.as_str(), first_param) {
            ("Date", _) => PropKind::Date,
            ("ImageMetadata", _) => PropKind::Image,
            ("CollectionEntry", Some(TsType::TsLitType(lit))) => match &lit.lit {
                TsLit::Str(s) => PropKind::CollectionEntry {
                    collection: s.value.to_string_lossy().to_string(),
                },
                _ => PropKind::Unknown,
            },
            ("Array" | "ReadonlyArray" | "Set", Some(item)) => PropKind::Array {
                items: Box::new(self.kind_of(m, item, depth + 1)),
            },
            (name, _) => match self.lookup(m, name, depth + 1) {
                Some((dm, TypeDecl::Alias(ty))) => self.kind_of(dm, &ty, depth + 1),
                Some((_, TypeDecl::Values(values))) => PropKind::Literals { values },
                _ => PropKind::Unknown,
            },
        }
    }

    /// `(typeof list)[number]`, the union of a const array's items
    fn kind_of_indexed(
        &mut self,
        m: usize,
        access: &TsIndexedAccessType,
        depth: usize,
    ) -> PropKind {
        let is_number_index = matches!(
            access.index_type.as_ref(),
            TsType::TsKeywordType(k) if k.kind == TsKeywordTypeKind::TsNumberKeyword
        );
        let mut obj = access.obj_type.as_ref();
        while let TsType::TsParenthesizedType(p) = obj {
            obj = &p.type_ann;
        }
        if let (true, TsType::TsTypeQuery(q)) = (is_number_index, obj) {
            if let TsTypeQueryExpr::TsEntityName(TsEntityName::Ident(id)) = &q.expr_name {
                if let Some((_, TypeDecl::Values(values))) =
                    self.lookup(m, id.sym.as_str(), depth + 1)
                {
                    return PropKind::Literals { values };
                }
            }
        }
        PropKind::Unknown
    }

    /// Finds what `name` refers to in module `m`, following imports and re-exports
    fn lookup(&mut self, m: usize, name: &str, depth: usize) -> Option<(usize, TypeDecl)> {
        if depth > MAX_DEPTH {
            return None;
        }
        let source = self.module(m);
        if let Some(decl) = find_local_decl(&source.module, name) {
            return Some((m, decl));
        }

        // Imported, or re-exported from another file
        let mut next: Vec<(String, String)> = Vec::new();
        for item in &source.module.body {
            let ModuleItem::ModuleDecl(decl) = item else {
                continue;
            };
            match decl {
                ModuleDecl::Import(import) => {
                    for spec in &import.specifiers {
                        if let ImportSpecifier::Named(named) = spec {
                            if named.local.sym.as_str() == name {
                                let imported = named
                                    .imported
                                    .as_ref()
                                    .map_or_else(|| name.to_string(), export_name);
                                next.push((
                                    import.src.value.to_string_lossy().to_string(),
                                    imported,
                                ));
                            }
                        }
                    }
                }
                ModuleDecl::ExportNamed(export) => {
                    let Some(src) = &export.src else { continue };
                    for spec in &export.specifiers {
                        if let ExportSpecifier::Named(named) = spec {
                            let exported = named.exported.as_ref().unwrap_or(&named.orig);
                            if export_name(exported) == name {
                                next.push((
                                    src.value.to_string_lossy().to_string(),
                                    export_name(&named.orig),
                                ));
                            }
                        }
                    }
                }
                ModuleDecl::ExportAll(all) => {
                    next.push((
                        all.src.value.to_string_lossy().to_string(),
                        name.to_string(),
                    ));
                }
                _ => {}
            }
        }
        for (specifier, imported) in next {
            if let Some(target) = self.load(m, &specifier) {
                if let Some(found) = self.lookup(target, &imported, depth + 1) {
                    return Some(found);
                }
            }
        }
        None
    }

    /// Loads the file a relative import points to. Bare and aliased specifiers
    /// (`astro`, `@components/x`) aren't followed.
    fn load(&mut self, from: usize, specifier: &str) -> Option<usize> {
        let root = self.root.clone()?;
        if !specifier.starts_with("./") && !specifier.starts_with("../") {
            return None;
        }
        let dir = self.modules[from].path.as_ref()?.parent()?.to_path_buf();
        let path = resolve_relative(&dir, specifier)?.canonicalize().ok()?;
        if !path.starts_with(&root) {
            return None;
        }
        if let Some(&m) = self.by_path.get(&path) {
            return Some(m);
        }
        let src = fs::read_to_string(&path).ok()?;
        let tsx = path.extension().is_some_and(|e| e == "tsx");
        let module = SourceModule::parse(src, Some(path), tsx).ok()?;
        Some(self.add(module))
    }
}

/// Finds a type-relevant declaration of `name` at the top level of a module
fn find_local_decl(module: &Module, name: &str) -> Option<TypeDecl> {
    for item in &module.body {
        let decl = match item {
            ModuleItem::Stmt(Stmt::Decl(decl)) => decl,
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => &export.decl,
            _ => continue,
        };
        match decl {
            Decl::TsInterface(i) if i.id.sym.as_str() == name => {
                return Some(TypeDecl::Interface((**i).clone()));
            }
            Decl::TsTypeAlias(a) if a.id.sym.as_str() == name => {
                return Some(TypeDecl::Alias((*a.type_ann).clone()));
            }
            Decl::TsEnum(e) if e.id.sym.as_str() == name => {
                let values = e
                    .members
                    .iter()
                    .filter_map(|member| match member.init.as_deref() {
                        Some(Expr::Lit(Lit::Str(s))) => Some(s.value.to_string_lossy().to_string()),
                        _ => None,
                    })
                    .collect();
                return Some(TypeDecl::Values(values));
            }
            Decl::Var(var) => {
                for d in &var.decls {
                    let Pat::Ident(id) = &d.name else { continue };
                    if id.id.sym.as_str() != name {
                        continue;
                    }
                    let values = d
                        .init
                        .as_deref()
                        .and_then(string_array_values)
                        .or_else(|| {
                            id.type_ann
                                .as_ref()
                                .and_then(|t| string_tuple_values(&t.type_ann))
                        })?;
                    return Some(TypeDecl::Values(values));
                }
            }
            _ => {}
        }
    }
    None
}

/// `['a', 'b'] as const` (or `satisfies …`) → `["a", "b"]`
fn string_array_values(expr: &Expr) -> Option<Vec<String>> {
    match expr {
        Expr::TsConstAssertion(e) => string_array_values(&e.expr),
        Expr::TsAs(e) => string_array_values(&e.expr),
        Expr::TsSatisfies(e) => string_array_values(&e.expr),
        Expr::Array(arr) => arr
            .elems
            .iter()
            .map(|el| match el.as_ref().map(|e| e.expr.as_ref()) {
                Some(Expr::Lit(Lit::Str(s))) => Some(s.value.to_string_lossy().to_string()),
                _ => None,
            })
            .collect(),
        _ => None,
    }
}

/// `readonly ["a", "b"]`, as `.d.ts` files declare const arrays
fn string_tuple_values(ty: &TsType) -> Option<Vec<String>> {
    match ty {
        TsType::TsTypeOperator(op) => string_tuple_values(&op.type_ann),
        TsType::TsTupleType(tuple) => tuple
            .elem_types
            .iter()
            .map(|el| match el.ty.as_ref() {
                TsType::TsLitType(TsLitType {
                    lit: TsLit::Str(s), ..
                }) => Some(s.value.to_string_lossy().to_string()),
                _ => None,
            })
            .collect(),
        _ => None,
    }
}

fn export_name(name: &ModuleExportName) -> String {
    match name {
        ModuleExportName::Ident(id) => id.sym.to_string(),
        ModuleExportName::Str(s) => s.value.to_string_lossy().to_string(),
    }
}

/// Resolves `./x`, `./x.js` or `./dir` to a TypeScript file next to `dir`
fn resolve_relative(dir: &Path, specifier: &str) -> Option<PathBuf> {
    let base = dir.join(specifier);
    let stem = base.to_string_lossy();
    let stem = stem
        .strip_suffix(".js")
        .or_else(|| stem.strip_suffix(".mjs"))
        .unwrap_or(&stem)
        .to_string();
    [
        format!("{stem}.ts"),
        format!("{stem}.d.ts"),
        format!("{stem}.tsx"),
        format!("{stem}/index.ts"),
        format!("{stem}/index.d.ts"),
        stem.clone(),
    ]
    .into_iter()
    .map(PathBuf::from)
    .find(|p| p.is_file() && p.extension().is_some_and(|e| e == "ts" || e == "tsx"))
}

fn is_nullish(ty: &TsType) -> bool {
    matches!(
        ty,
        TsType::TsKeywordType(k) if matches!(
            k.kind,
            TsKeywordTypeKind::TsUndefinedKeyword | TsKeywordTypeKind::TsNullKeyword
        )
    )
}

/// Combines the kinds of a union's members. Literals merge; `boolean` is `true | false`;
/// a plain `string` absorbs literals and types we can't enter anyway (`string | URL`).
fn merge_union(kinds: Vec<PropKind>) -> PropKind {
    if kinds.len() == 1 {
        return kinds.into_iter().next().unwrap_or(PropKind::Unknown);
    }
    if kinds.iter().all(|k| matches!(k, PropKind::Literals { .. })) {
        let mut values: Vec<String> = Vec::new();
        for k in kinds {
            if let PropKind::Literals { values: v } = k {
                for value in v {
                    if !values.contains(&value) {
                        values.push(value);
                    }
                }
            }
        }
        return PropKind::Literals { values };
    }
    if !kinds.is_empty() && kinds.iter().all(|k| *k == PropKind::Boolean) {
        return PropKind::Boolean;
    }
    if kinds.contains(&PropKind::String)
        && kinds.iter().all(|k| {
            matches!(
                k,
                PropKind::String | PropKind::Literals { .. } | PropKind::Unknown
            )
        })
    {
        return PropKind::String;
    }
    PropKind::Unknown
}

fn collapse_whitespace(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Default values from a destructuring pattern like `{ type = 'note', size }`.
/// Strings come back unquoted; other expressions as written.
pub fn destructured_defaults(source: &SourceModule, pat: &ObjectPat) -> HashMap<String, String> {
    let mut defaults = HashMap::new();
    for prop in &pat.props {
        let (key, value) = match prop {
            ObjectPatProp::Assign(a) => match &a.value {
                Some(v) => (a.key.id.sym.to_string(), v.as_ref()),
                None => continue,
            },
            ObjectPatProp::KeyValue(kv) => {
                let key = match &kv.key {
                    PropName::Ident(id) => id.sym.to_string(),
                    PropName::Str(s) => s.value.to_string_lossy().to_string(),
                    _ => continue,
                };
                match kv.value.as_ref() {
                    Pat::Assign(assign) => (key, assign.right.as_ref()),
                    _ => continue,
                }
            }
            ObjectPatProp::Rest(_) => continue,
        };
        let text = match value {
            Expr::Lit(Lit::Str(s)) => s.value.to_string_lossy().to_string(),
            other => source.snippet(other.span()).to_string(),
        };
        defaults.insert(key, text);
    }
    defaults
}

/// Fills in `default_value` on props from a map of defaults
pub fn apply_defaults(props: &mut [PropInfo], defaults: &HashMap<String, String>) {
    for prop in props {
        if let Some(value) = defaults.get(&prop.name) {
            prop.default_value = Some(value.clone());
        }
    }
}

/// The TypeScript between an `.astro` file's `---` fences. The fences must be
/// whole lines, so `---` elsewhere in the code doesn't end the frontmatter.
pub fn astro_frontmatter(content: &str) -> Option<String> {
    let mut lines = content.lines();
    if lines.next()?.trim_end() != "---" {
        return None;
    }
    let mut code = Vec::new();
    for line in lines {
        if line.trim_end() == "---" {
            return Some(code.join("\n"));
        }
        code.push(line);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn props_of(code: &str) -> Vec<PropInfo> {
        let mut resolver = PropResolver::new(None);
        let module = SourceModule::parse(code.to_string(), None, false).unwrap();
        let m = resolver.add(module);
        resolver.props_of_named(m, "Props").unwrap_or_default()
    }

    fn kind(props: &[PropInfo], name: &str) -> PropKind {
        props.iter().find(|p| p.name == name).unwrap().kind.clone()
    }

    fn literals(values: &[&str]) -> PropKind {
        PropKind::Literals {
            values: values.iter().map(|v| v.to_string()).collect(),
        }
    }

    #[test]
    fn resolves_basic_kinds() {
        let props = props_of(
            r#"
            interface Props {
                title: string
                count?: number
                open?: boolean
                size?: 'sm' | 'md' | 'lg'
                tags?: string[]
                when?: Date
                image?: ImageMetadata
                post?: CollectionEntry<'blog'>
                onClick?: () => void
                href: string | URL
                maybe?: string | undefined
            }
            "#,
        );
        assert_eq!(kind(&props, "title"), PropKind::String);
        assert_eq!(kind(&props, "count"), PropKind::Number);
        assert_eq!(kind(&props, "open"), PropKind::Boolean);
        assert_eq!(kind(&props, "size"), literals(&["sm", "md", "lg"]));
        assert_eq!(
            kind(&props, "tags"),
            PropKind::Array {
                items: Box::new(PropKind::String)
            }
        );
        assert_eq!(kind(&props, "when"), PropKind::Date);
        assert_eq!(kind(&props, "image"), PropKind::Image);
        assert_eq!(
            kind(&props, "post"),
            PropKind::CollectionEntry {
                collection: "blog".to_string()
            }
        );
        assert_eq!(kind(&props, "onClick"), PropKind::Unknown);
        assert_eq!(kind(&props, "href"), PropKind::String);
        assert_eq!(kind(&props, "maybe"), PropKind::String);
    }

    #[test]
    fn resolves_local_aliases_enums_and_const_arrays() {
        let props = props_of(
            r#"
            const SIZES = ['s', 'm', 'l'] as const
            type Size = (typeof SIZES)[number]
            type Variant = 'a' | 'b'
            enum Tone { Warm = 'warm', Cool = 'cool' }
            type Props = {
                size: Size
                variant: Variant | 'c'
                tone: Tone
            }
            "#,
        );
        assert_eq!(kind(&props, "size"), literals(&["s", "m", "l"]));
        assert_eq!(kind(&props, "variant"), literals(&["a", "b", "c"]));
        assert_eq!(kind(&props, "tone"), literals(&["warm", "cool"]));
    }

    #[test]
    fn merges_intersections_and_local_extends_and_skips_unknown_parents() {
        let props = props_of(
            r#"
            interface Base { id: string }
            interface Props extends Base, Omit<HTMLAttributes<'a'>, 'href'> { label: string }
            "#,
        );
        let names: Vec<_> = props.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, ["id", "label"]);

        let props = props_of(
            r#"
            type Own = { text: string }
            type Props = Own & HTMLAttributes<'span'>
            "#,
        );
        let names: Vec<_> = props.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, ["text"]);
    }

    #[test]
    fn reads_jsdoc_before_and_after_props() {
        let props = props_of(
            r#"
            interface Props {
                /**
                 * The heading
                 * text
                 */
                title: string
                color: string /** CSS colour */
                // Not documentation
                plain: string
            }
            "#,
        );
        assert_eq!(props[0].description.as_deref(), Some("The heading text"));
        assert_eq!(props[1].description.as_deref(), Some("CSS colour"));
        assert_eq!(props[2].description, None);
    }

    #[test]
    fn reads_destructured_defaults() {
        let code =
            "const { type = 'note', size = 2, open = false, title: t = 'x', plain } = Astro.props";
        let source = SourceModule::parse(code.to_string(), None, false).unwrap();
        let ModuleItem::Stmt(Stmt::Decl(Decl::Var(var))) = &source.module.body[0] else {
            panic!("expected a var")
        };
        let Pat::Object(pat) = &var.decls[0].name else {
            panic!("expected an object pattern")
        };
        let defaults = destructured_defaults(&source, pat);
        assert_eq!(defaults["type"], "note");
        assert_eq!(defaults["size"], "2");
        assert_eq!(defaults["open"], "false");
        assert_eq!(defaults["title"], "x");
        assert!(!defaults.contains_key("plain"));
    }

    #[test]
    fn frontmatter_needs_whole_line_fences() {
        let content = "---\nconst a = '---'\nconst b = 1 --- 2\n---\n<div>---</div>";
        assert_eq!(
            astro_frontmatter(content).unwrap(),
            "const a = '---'\nconst b = 1 --- 2"
        );
        assert_eq!(astro_frontmatter("<div />"), None);
        assert_eq!(astro_frontmatter("---\nunclosed"), None);
    }
}
