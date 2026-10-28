//! Finds a project's MDX components and reads their props, for the component builder.

mod prop_types;
pub mod starlight;

use crate::models::{ComponentFramework, MdxComponent, PropInfo, PropKind};
use prop_types::{
    astro_frontmatter, default_text, destructured_defaults, untyped_props, unwrap_ts_expr,
    PropResolver, SourceModule,
};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use swc_common::{Span, Spanned};
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};
use walkdir::WalkDir;

/// Validates that a file path is within the project boundaries
///
/// This function prevents path traversal attacks by ensuring all file operations
/// stay within the current project root directory.
fn validate_project_path(file_path: &Path, project_root: &Path) -> Result<PathBuf, String> {
    // Resolve canonical paths to handle symlinks and .. traversal
    let canonical_file = file_path
        .canonicalize()
        .map_err(|_| "Invalid file path".to_string())?;
    let canonical_root = project_root
        .canonicalize()
        .map_err(|_| "Invalid project root".to_string())?;

    // Ensure file is within project bounds
    canonical_file
        .strip_prefix(&canonical_root)
        .map_err(|_| "File outside project directory".to_string())?;

    Ok(canonical_file)
}

/// Detects the framework based on file extension
fn detect_framework(path: &Path) -> ComponentFramework {
    match path.extension().and_then(|s| s.to_str()) {
        Some("astro") => ComponentFramework::Astro,
        Some("tsx" | "jsx") => ComponentFramework::React,
        Some("vue") => ComponentFramework::Vue,
        Some("svelte") => ComponentFramework::Svelte,
        _ => ComponentFramework::Astro, // fallback
    }
}

/// Reads every component in `mdx_directory` (relative to the project root).
/// Files that can't be read are logged and skipped.
pub fn scan(project_root: &Path, mdx_directory: &str) -> Vec<MdxComponent> {
    let mdx_dir = project_root.join(mdx_directory);

    // Validate the MDX directory is within project bounds
    if !mdx_dir.exists() {
        eprintln!("[MDX] Directory not found: {}", mdx_dir.display());
        return vec![];
    }
    if let Err(e) = validate_project_path(&mdx_dir, project_root) {
        eprintln!(
            "[MDX] Directory outside project bounds: {}: {e}",
            mdx_dir.display()
        );
        return vec![];
    }

    let mut components = Vec::new();

    for entry in WalkDir::new(&mdx_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Only process supported component files
        let ext = path.extension().and_then(|s| s.to_str());
        if !matches!(ext, Some("astro" | "tsx" | "jsx" | "vue" | "svelte")) {
            continue;
        }

        // Skip index files
        if path.file_stem().and_then(|s| s.to_str()) == Some("index") {
            continue;
        }

        // Validate each component file is within project bounds
        match validate_project_path(path, project_root) {
            Ok(_) => match parse_component(path, project_root, detect_framework(path)) {
                Ok(component) => components.push(component),
                Err(e) => eprintln!("Error parsing MDX component {}: {e}", path.display()),
            },
            Err(e) => {
                eprintln!(
                    "Skipping file outside project directory: {}: {e}",
                    path.display()
                );
                continue;
            }
        }
    }

    // Keep this summary log for production debugging
    eprintln!(
        "[MDX] Found {} components in {}",
        components.len(),
        mdx_dir.display()
    );

    components
}

/// Where a component's source lives, so its relative type imports can be followed
#[derive(Clone, Copy)]
struct Location<'a> {
    file: &'a Path,
    root: &'a Path,
}

/// What we read from a component's source
#[derive(Default)]
struct ParsedProps {
    props: Vec<PropInfo>,
    has_slot: bool,
    description: Option<String>,
}

fn parse_component(
    path: &Path,
    project_root: &Path,
    framework: ComponentFramework,
) -> Result<MdxComponent, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))?;
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid filename")?
        .to_string();
    let file_path = path
        .strip_prefix(project_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();
    let location = Some(Location {
        file: path,
        root: project_root,
    });

    // A component whose code we can't parse is still listed, with no props
    let parsed = match framework {
        ComponentFramework::Astro => {
            parse_astro_props(&content, location).unwrap_or_else(|_| ParsedProps {
                has_slot: astro_has_slot(&content),
                ..Default::default()
            })
        }
        ComponentFramework::React => {
            parse_react_props(&content, &name, location).unwrap_or_default()
        }
        ComponentFramework::Vue => parse_vue_props(&content, location).unwrap_or_default(),
        ComponentFramework::Svelte => parse_svelte_props(&content, location).unwrap_or_default(),
    };

    Ok(MdxComponent {
        name,
        file_path,
        props: parsed.props,
        has_slot: parsed.has_slot,
        description: parsed.description,
        framework,
        import_source: None,
        slot_template: None,
    })
}

/// Parses `code` and registers it with a new resolver that follows imports within the project
fn resolver_for(
    code: String,
    location: Option<Location>,
    tsx: bool,
) -> Result<(PropResolver, usize), String> {
    let mut resolver = PropResolver::new(location.map(|l| l.root));
    let source = SourceModule::parse(code, location.map(|l| l.file.to_path_buf()), tsx)?;
    let m = resolver.add(source);
    Ok((resolver, m))
}

fn astro_has_slot(content: &str) -> bool {
    content.contains("<slot") || content.contains("Astro.slots")
}

/// Reads `interface Props` / `type Props` from an `.astro` file's frontmatter,
/// with defaults from `const { a = 'x' } = Astro.props`
fn parse_astro_props(content: &str, location: Option<Location>) -> Result<ParsedProps, String> {
    let has_slot = astro_has_slot(content);
    let Some(code) = astro_frontmatter(content) else {
        return Ok(ParsedProps {
            has_slot,
            ..Default::default()
        });
    };
    let (mut resolver, m) = resolver_for(code, location, false)?;
    let typed_props = resolver.props_of_named(m, "Props");

    let source = resolver.module(m);
    let destructure = source.module.body.iter().find_map(|item| {
        let ModuleItem::Stmt(Stmt::Decl(Decl::Var(var))) = item else {
            return None;
        };
        var.decls
            .iter()
            .find_map(|decl| match (&decl.name, &decl.init) {
                (Pat::Object(pat), Some(init)) if is_astro_props(init) => Some(pat),
                _ => None,
            })
    });

    // Without a Props type, the destructured names are all we know
    let mut props = match (typed_props, destructure) {
        (Some(props), _) => props,
        (None, Some(pat)) => untyped_props(pat),
        (None, None) => Vec::new(),
    };
    if let Some(pat) = destructure {
        resolver.apply_defaults(m, &mut props, &destructured_defaults(&source, pat));
    }

    Ok(ParsedProps {
        props,
        has_slot,
        description: source.leading_description(),
    })
}

/// `Astro.props`, also when cast (`Astro.props as Props`)
fn is_astro_props(expr: &Expr) -> bool {
    let Expr::Member(member) = unwrap_ts_expr(expr) else {
        return false;
    };
    matches!(member.obj.as_ref(), Expr::Ident(obj) if obj.sym.as_str() == "Astro")
        && matches!(&member.prop, MemberProp::Ident(prop) if prop.sym.as_str() == "props")
}

/// A React component function: its first parameter, and the type from a
/// `const X: FC<Props> = …` annotation when the parameter has none
struct ComponentFn<'a> {
    name: Option<String>,
    span: Span,
    param: Option<&'a Pat>,
    fc_type: Option<&'a TsType>,
}

/// Reads props from the component function in a `.tsx`/`.jsx` file. Prefers the
/// function named after the file, then a default export, then the last one found.
fn parse_react_props(
    content: &str,
    component_name: &str,
    location: Option<Location>,
) -> Result<ParsedProps, String> {
    let (mut resolver, m) = resolver_for(content.to_string(), location, true)?;
    let source = resolver.module(m);

    let mut candidates: Vec<ComponentFn> = Vec::new();
    let mut default_export: Option<ComponentFn> = None;
    for item in &source.module.body {
        match item {
            ModuleItem::Stmt(Stmt::Decl(Decl::Fn(f)))
            | ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl {
                decl: Decl::Fn(f),
                ..
            })) => candidates.push(ComponentFn {
                name: Some(f.ident.sym.to_string()),
                span: item.span(),
                param: f.function.params.first().map(|p| &p.pat),
                fc_type: None,
            }),
            ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
                decl: DefaultDecl::Fn(f),
                ..
            })) => {
                default_export = Some(ComponentFn {
                    name: f.ident.as_ref().map(|i| i.sym.to_string()),
                    span: item.span(),
                    param: f.function.params.first().map(|p| &p.pat),
                    fc_type: None,
                })
            }
            ModuleItem::Stmt(Stmt::Decl(Decl::Var(var)))
            | ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl {
                decl: Decl::Var(var),
                ..
            })) => {
                for d in &var.decls {
                    let (Pat::Ident(id), Some(Expr::Arrow(arrow))) = (&d.name, d.init.as_deref())
                    else {
                        continue;
                    };
                    let fc_type = id
                        .type_ann
                        .as_ref()
                        .and_then(|ann| match ann.type_ann.as_ref() {
                            TsType::TsTypeRef(r) => r.type_params.as_ref()?.params.first(),
                            _ => None,
                        })
                        .map(|t| t.as_ref());
                    candidates.push(ComponentFn {
                        name: Some(id.id.sym.to_string()),
                        span: item.span(),
                        param: arrow.params.first(),
                        fc_type,
                    });
                }
            }
            _ => {}
        }
    }

    let typed =
        |c: &ComponentFn| c.fc_type.is_some() || c.param.is_some_and(|p| pat_type(p).is_some());
    let component = candidates
        .iter()
        .find(|c| c.name.as_deref() == Some(component_name) && typed(c))
        .or(default_export.as_ref().filter(|c| typed(c)))
        .or_else(|| candidates.iter().rev().find(|c| typed(c)));
    let Some(component) = component else {
        return Ok(ParsedProps::default());
    };

    let props_type = component
        .param
        .and_then(pat_type)
        .or(component.fc_type)
        .ok_or("No props type")?;
    let mut props = resolver.props_of_type(m, props_type, 0);
    if let Some(Pat::Object(pat)) = component.param {
        resolver.apply_defaults(m, &mut props, &destructured_defaults(&source, pat));
    }

    let has_slot = props.iter().any(|p| p.name == "children");
    props.retain(|p| p.name != "children");

    Ok(ParsedProps {
        props,
        has_slot,
        description: source.doc_before(component.span.lo),
    })
}

/// The type annotation on a function parameter
fn pat_type(pat: &Pat) -> Option<&TsType> {
    match pat {
        Pat::Object(o) => o.type_ann.as_ref().map(|t| t.type_ann.as_ref()),
        Pat::Ident(i) => i.type_ann.as_ref().map(|t| t.type_ann.as_ref()),
        _ => None,
    }
}

/// The contents of the `<script>` block in a `.vue` or `.svelte` file whose opening
/// tag's attributes satisfy `prefer`, or the first one if none do
fn extract_script(content: &str, prefer: impl Fn(&str) -> bool) -> Result<String, String> {
    let mut blocks: Vec<(&str, &str)> = Vec::new();
    let mut rest = content;
    while let Some(start) = rest.find("<script") {
        let after_tag = &rest[start + "<script".len()..];
        let tag_end = after_tag.find('>').ok_or("Malformed <script> tag")?;
        let body = &after_tag[tag_end + 1..];
        let body_end = body.find("</script>").ok_or("No closing </script> tag")?;
        blocks.push((&after_tag[..tag_end], &body[..body_end]));
        rest = &body[body_end..];
    }
    blocks
        .iter()
        .find(|(attrs, _)| prefer(attrs))
        .or(blocks.first())
        .map(|(_, body)| body.to_string())
        .ok_or_else(|| "No <script> tag found".to_string())
}

/// Finds `defineProps<T>()`, `withDefaults(defineProps<T>(), { … })`,
/// `const { a = 1 } = defineProps<T>()`, and runtime declarations like
/// `defineProps({ a: String })` or `defineProps(['a'])`, in a Vue `<script setup>`
#[derive(Default)]
struct DefinePropsFinder {
    props_type: Option<TsType>,
    runtime: Option<Expr>,
    defaults: Option<ObjectLit>,
    pattern: Option<ObjectPat>,
}

impl Visit for DefinePropsFinder {
    fn visit_var_declarator(&mut self, node: &VarDeclarator) {
        if let (Pat::Object(pat), Some(Expr::Call(call))) = (&node.name, node.init.as_deref()) {
            if callee_name(call) == Some("defineProps") {
                self.pattern = Some(pat.clone());
            }
        }
        node.visit_children_with(self);
    }

    fn visit_call_expr(&mut self, call: &CallExpr) {
        match callee_name(call) {
            Some("defineProps") => {
                if let Some(params) = &call.type_args {
                    self.props_type = params.params.first().map(|t| (**t).clone());
                } else if let Some(arg) = call.args.first() {
                    self.runtime = Some((*arg.expr).clone());
                }
            }
            Some("withDefaults") => {
                if let Some(Expr::Object(obj)) = call.args.get(1).map(|a| a.expr.as_ref()) {
                    self.defaults = Some(obj.clone());
                }
            }
            _ => {}
        }
        call.visit_children_with(self);
    }
}

fn callee_name(call: &CallExpr) -> Option<&str> {
    match &call.callee {
        Callee::Expr(expr) => match expr.as_ref() {
            Expr::Ident(id) => Some(id.sym.as_str()),
            _ => None,
        },
        _ => None,
    }
}

fn parse_vue_props(content: &str, location: Option<Location>) -> Result<ParsedProps, String> {
    let script = extract_script(content, |attrs| attrs.contains("setup"))?;
    let (mut resolver, m) = resolver_for(script, location, false)?;
    let source = resolver.module(m);

    let mut finder = DefinePropsFinder::default();
    source.module.visit_with(&mut finder);

    let mut props = match (&finder.props_type, &finder.runtime) {
        (Some(ty), _) => resolver.props_of_type(m, ty, 0),
        (None, Some(runtime)) => vue_runtime_props(&source, runtime),
        (None, None) => Vec::new(),
    };
    if let Some(pat) = &finder.pattern {
        resolver.apply_defaults(m, &mut props, &destructured_defaults(&source, pat));
    }
    if let Some(obj) = &finder.defaults {
        resolver.apply_defaults(m, &mut props, &object_literal_values(&source, obj));
    }

    Ok(ParsedProps {
        props,
        has_slot: content.contains("<slot"),
        description: None,
    })
}

/// Props from Vue's runtime declaration: `['a', 'b']`, or an object whose values
/// are a constructor (`String`) or an options object (`{ type: Number, required: true, default: 1 }`)
fn vue_runtime_props(source: &SourceModule, runtime: &Expr) -> Vec<PropInfo> {
    let constructor_kind = |expr: &Expr| match expr {
        Expr::Ident(id) => match id.sym.as_str() {
            "String" => PropKind::String,
            "Number" => PropKind::Number,
            "Boolean" => PropKind::Boolean,
            "Date" => PropKind::Date,
            "Array" => PropKind::Array {
                items: Box::new(PropKind::Unknown),
            },
            _ => PropKind::Unknown,
        },
        _ => PropKind::Unknown,
    };
    let prop = |name: String, kind: PropKind| PropInfo {
        name,
        prop_type: "unknown".to_string(),
        kind,
        is_optional: true,
        default_value: None,
        description: None,
    };

    match unwrap_ts_expr(runtime) {
        Expr::Array(names) => names
            .elems
            .iter()
            .filter_map(|el| match el.as_ref().map(|e| e.expr.as_ref()) {
                Some(Expr::Lit(Lit::Str(s))) => {
                    Some(prop(s.value.to_string_lossy().to_string(), PropKind::Unknown))
                }
                _ => None,
            })
            .collect(),
        Expr::Object(obj) => obj
            .props
            .iter()
            .filter_map(|p| {
                let PropOrSpread::Prop(p) = p else {
                    return None;
                };
                let Prop::KeyValue(kv) = p.as_ref() else {
                    return None;
                };
                let name = match &kv.key {
                    PropName::Ident(id) => id.sym.to_string(),
                    PropName::Str(s) => s.value.to_string_lossy().to_string(),
                    _ => return None,
                };
                let Expr::Object(options) = kv.value.as_ref() else {
                    return Some(prop(name, constructor_kind(&kv.value)));
                };
                let option = |key: &str| {
                    options.props.iter().find_map(|o| match o {
                        PropOrSpread::Prop(o) => match o.as_ref() {
                            Prop::KeyValue(kv)
                                if matches!(&kv.key, PropName::Ident(id) if id.sym.as_str() == key) =>
                            {
                                Some(kv.value.as_ref())
                            }
                            _ => None,
                        },
                        PropOrSpread::Spread(_) => None,
                    })
                };
                let mut info = prop(name, option("type").map_or(PropKind::Unknown, constructor_kind));
                info.is_optional = !matches!(option("required"), Some(Expr::Lit(Lit::Bool(b))) if b.value);
                info.default_value = option("default").and_then(|value| match value {
                    Expr::Lit(Lit::Str(s)) => Some(s.value.to_string_lossy().to_string()),
                    Expr::Lit(_) => Some(source.snippet(value.span()).to_string()),
                    _ => None,
                });
                Some(info)
            })
            .collect(),
        _ => Vec::new(),
    }
}

/// `{ a: 'x', b: 2 }` → `a: x`, `b: 2`, formatted like `destructured_defaults`
fn object_literal_values(source: &SourceModule, obj: &ObjectLit) -> HashMap<String, String> {
    obj.props
        .iter()
        .filter_map(|prop| {
            let PropOrSpread::Prop(prop) = prop else {
                return None;
            };
            let Prop::KeyValue(kv) = prop.as_ref() else {
                return None;
            };
            let PropName::Ident(key) = &kv.key else {
                return None;
            };
            let value = default_text(source, &kv.value);
            Some((key.sym.to_string(), value))
        })
        .collect()
}

/// Reads Svelte 4 `export let name: Type = default` props, or a Svelte 5
/// `let { a = 1 }: Props = $props()` destructure
fn parse_svelte_props(content: &str, location: Option<Location>) -> Result<ParsedProps, String> {
    // Skip the module script (`<script module>`, or `context="module"` in Svelte 4)
    let script = extract_script(content, |attrs| !attrs.contains("module"))?;
    let (mut resolver, m) = resolver_for(script, location, false)?;
    let source = resolver.module(m);

    let mut props = Vec::new();
    for item in &source.module.body {
        match item {
            // Svelte 4
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl {
                decl: Decl::Var(var),
                ..
            })) => {
                for d in &var.decls {
                    let Pat::Ident(id) = &d.name else { continue };
                    let ty = id.type_ann.as_ref().map(|t| t.type_ann.as_ref());
                    let is_optional = d.init.is_some() || ty.is_some_and(includes_undefined);
                    props.push(PropInfo {
                        name: id.id.sym.to_string(),
                        prop_type: ty.map_or_else(
                            || "unknown".to_string(),
                            |t| source.snippet(t.span()).to_string(),
                        ),
                        kind: ty.map_or(PropKind::Unknown, |t| resolver.kind_of(m, t, 0)),
                        is_optional,
                        default_value: d
                            .init
                            .as_deref()
                            .map(|e| resolver.resolve_default(m, &default_text(&source, e))),
                        description: source.doc_before(item.span().lo),
                    });
                }
            }
            // Svelte 5
            ModuleItem::Stmt(Stmt::Decl(Decl::Var(var))) => {
                for d in &var.decls {
                    let (Pat::Object(pat), Some(Expr::Call(call))) =
                        (&d.name, d.init.as_deref().map(unwrap_ts_expr))
                    else {
                        continue;
                    };
                    if callee_name(call) != Some("$props") {
                        continue;
                    }
                    props = match pat.type_ann.as_ref() {
                        Some(ty) => resolver.props_of_type(m, &ty.type_ann, 0),
                        None => untyped_props(pat),
                    };
                    resolver.apply_defaults(m, &mut props, &destructured_defaults(&source, pat));
                }
            }
            _ => {}
        }
    }

    let has_slot = content.contains("<slot") || props.iter().any(|p| p.name == "children");
    props.retain(|p| p.name != "children");

    Ok(ParsedProps {
        props,
        has_slot,
        description: None,
    })
}

fn includes_undefined(ty: &TsType) -> bool {
    match ty {
        TsType::TsKeywordType(k) => k.kind == TsKeywordTypeKind::TsUndefinedKeyword,
        TsType::TsUnionOrIntersectionType(TsUnionOrIntersectionType::TsUnionType(u)) => {
            u.types.iter().any(|t| includes_undefined(t))
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_validate_project_path_valid() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("components").join("Alert.astro");

        // Create test structure
        fs::create_dir_all(test_file.parent().unwrap()).unwrap();
        fs::write(&test_file, "test content").unwrap();

        let result = validate_project_path(&test_file, &project_root);

        assert!(result.is_ok());

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[test]
    fn test_validate_project_path_traversal_attack() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_path = project_root.join("../../../etc/passwd");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = validate_project_path(&malicious_path, &project_root);

        // Should fail due to path traversal
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[test]
    fn test_parse_props_from_typescript() {
        let typescript_code = r#"
            interface Props {
                title: string;
                type?: 'warning' | 'info' | 'error';
                isOpen: boolean;
                count?: number;
            }
        "#;

        let props = parse_astro_props(&format!("---\n{typescript_code}\n---\n"), None)
            .unwrap()
            .props;

        assert_eq!(props.len(), 4);

        assert_eq!(props[0].name, "title");
        assert_eq!(props[0].prop_type, "string");
        assert!(!props[0].is_optional);

        assert_eq!(props[1].name, "type");
        assert!(props[1].prop_type.contains("warning"));
        assert!(props[1].is_optional);

        assert_eq!(props[2].name, "isOpen");
        assert_eq!(props[2].prop_type, "boolean");
        assert!(!props[2].is_optional);

        assert_eq!(props[3].name, "count");
        assert_eq!(props[3].prop_type, "number");
        assert!(props[3].is_optional);
    }

    #[test]
    fn test_scan_mdx_components() {
        let temp_dir = TempDir::new().unwrap();
        let mdx_dir = temp_dir.path().join("src/components/mdx");
        fs::create_dir_all(&mdx_dir).unwrap();

        // Create a test component
        let component_content = r#"---
interface Props {
    message: string;
    variant?: 'primary' | 'secondary';
}
---

<div class="alert">
    <slot />
</div>"#;

        fs::write(mdx_dir.join("Alert.astro"), component_content).unwrap();

        let components = scan(temp_dir.path(), "src/components/mdx");

        assert_eq!(components.len(), 1);
        assert_eq!(components[0].name, "Alert");
        assert_eq!(components[0].props.len(), 2);
        assert!(components[0].has_slot);
        // Verify framework is detected correctly
        assert!(matches!(components[0].framework, ComponentFramework::Astro));
    }

    #[test]
    fn test_detect_framework() {
        use std::path::PathBuf;

        assert!(matches!(
            detect_framework(&PathBuf::from("Alert.astro")),
            ComponentFramework::Astro
        ));
        assert!(matches!(
            detect_framework(&PathBuf::from("Button.tsx")),
            ComponentFramework::React
        ));
        assert!(matches!(
            detect_framework(&PathBuf::from("Card.jsx")),
            ComponentFramework::React
        ));
        assert!(matches!(
            detect_framework(&PathBuf::from("Modal.vue")),
            ComponentFramework::Vue
        ));
        assert!(matches!(
            detect_framework(&PathBuf::from("Tabs.svelte")),
            ComponentFramework::Svelte
        ));
        // Test fallback for unknown extension
        assert!(matches!(
            detect_framework(&PathBuf::from("Unknown.xyz")),
            ComponentFramework::Astro
        ));
    }

    #[test]
    fn test_scan_mdx_components_path_traversal_protection() {
        let temp_dir = TempDir::new().unwrap();
        let project_root = temp_dir.path().join("project");
        fs::create_dir_all(&project_root).unwrap();

        // Try to scan outside the project directory
        // Returns nothing, since the path isn't within project bounds
        assert_eq!(scan(&project_root, "../../../etc").len(), 0);
    }

    // React Parser Tests

    #[test]
    fn test_parse_react_inline_types() {
        let code = r#"
            function Button({ variant, size }: { variant: 'primary' | 'secondary', size?: number }) {
                return <button>{variant}</button>;
            }
        "#;

        let ParsedProps {
            props,
            has_slot: has_children,
            ..
        } = parse_react_props(code, "Component", None).unwrap();

        assert_eq!(props.len(), 2);
        assert_eq!(props[0].name, "variant");
        assert!(props[0].prop_type.contains("primary"));
        assert!(!props[0].is_optional);

        assert_eq!(props[1].name, "size");
        assert_eq!(props[1].prop_type, "number");
        assert!(props[1].is_optional);

        assert!(!has_children);
    }

    #[test]
    fn test_parse_react_interface() {
        let code = r#"
            interface ButtonProps {
                variant: 'primary' | 'secondary';
                disabled?: boolean;
            }

            function Button({ variant, disabled }: ButtonProps) {
                return <button disabled={disabled}>{variant}</button>;
            }
        "#;

        let ParsedProps {
            props,
            has_slot: has_children,
            ..
        } = parse_react_props(code, "Component", None).unwrap();

        assert_eq!(props.len(), 2);
        assert_eq!(props[0].name, "variant");
        assert!(props[0].prop_type.contains("primary"));
        assert!(!props[0].is_optional);

        assert_eq!(props[1].name, "disabled");
        assert_eq!(props[1].prop_type, "boolean");
        assert!(props[1].is_optional);

        assert!(!has_children);
    }

    #[test]
    fn test_parse_react_children() {
        let code = r#"
            interface CardProps {
                title: string;
                children?: React.ReactNode;
            }

            function Card({ title, children }: CardProps) {
                return <div><h1>{title}</h1>{children}</div>;
            }
        "#;

        let ParsedProps {
            props,
            has_slot: has_children,
            ..
        } = parse_react_props(code, "Component", None).unwrap();

        // `children` is the slot, not a prop to fill in
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].name, "title");
        assert!(has_children);
    }

    #[test]
    fn test_parse_react_arrow_function() {
        let code = r#"
            const Alert = ({ message, type }: { message: string, type?: 'info' | 'warning' }) => {
                return <div className={type}>{message}</div>;
            };
        "#;

        let ParsedProps {
            props,
            has_slot: has_children,
            ..
        } = parse_react_props(code, "Component", None).unwrap();

        assert_eq!(props.len(), 2);
        assert_eq!(props[0].name, "message");
        assert_eq!(props[0].prop_type, "string");
        assert!(!props[0].is_optional);

        assert_eq!(props[1].name, "type");
        assert!(props[1].prop_type.contains("info"));
        assert!(props[1].is_optional);

        assert!(!has_children);
    }

    #[test]
    fn test_parse_react_optional_props() {
        let code = r#"
            interface Props {
                required: string;
                optional?: string;
                optionalNumber?: number;
            }

            export default function Component({ required, optional, optionalNumber }: Props) {
                return <div>{required}</div>;
            }
        "#;

        let ParsedProps { props, .. } = parse_react_props(code, "Component", None).unwrap();

        assert_eq!(props.len(), 3);
        assert!(!props[0].is_optional); // required
        assert!(props[1].is_optional); // optional
        assert!(props[2].is_optional); // optionalNumber
    }

    #[test]
    fn test_parse_react_graceful_degradation() {
        // Malformed code should return empty props, not crash
        let code = r#"
            this is not valid typescript code at all!
        "#;

        let result = parse_react_props(code, "Component", None);

        // Should fail gracefully
        assert!(result.is_err());
    }

    #[test]
    fn test_scan_mixed_components() {
        let temp_dir = TempDir::new().unwrap();
        let mdx_dir = temp_dir.path().join("src/components/mdx");
        fs::create_dir_all(&mdx_dir).unwrap();

        // Create Astro component
        let astro_content = r#"---
interface Props {
    message: string;
}
---
<div>{message}</div>"#;
        fs::write(mdx_dir.join("Alert.astro"), astro_content).unwrap();

        // Create React component
        let react_content = r#"
export default function Button({ label }: { label: string }) {
    return <button>{label}</button>;
}
"#;
        fs::write(mdx_dir.join("Button.tsx"), react_content).unwrap();

        // Create Vue component with props
        let vue_content = r#"
<script setup lang="ts">
const props = defineProps<{
  title: string
}>()
</script>

<template>
  <div>{{ title }}</div>
</template>
"#;
        fs::write(mdx_dir.join("Card.vue"), vue_content).unwrap();

        let components = scan(temp_dir.path(), "src/components/mdx");

        assert_eq!(components.len(), 3);

        // Find each component by name
        let alert = components.iter().find(|c| c.name == "Alert").unwrap();
        let button = components.iter().find(|c| c.name == "Button").unwrap();
        let card = components.iter().find(|c| c.name == "Card").unwrap();

        // Verify Astro component
        assert!(matches!(alert.framework, ComponentFramework::Astro));
        assert_eq!(alert.props.len(), 1);
        assert_eq!(alert.props[0].name, "message");

        // Verify React component
        assert!(matches!(button.framework, ComponentFramework::React));
        assert_eq!(button.props.len(), 1);
        assert_eq!(button.props[0].name, "label");

        // Verify Vue component
        assert!(matches!(card.framework, ComponentFramework::Vue));
        assert_eq!(card.props.len(), 1);
        assert_eq!(card.props[0].name, "title");
    }

    // Vue Parser Tests

    #[test]
    fn test_parse_vue_define_props() {
        let code = r#"
<script setup lang="ts">
const props = defineProps<{
  variant: 'info' | 'warning'
  message: string
  count?: number
}>()
</script>

<template>
  <div>{{ message }}</div>
</template>
"#;

        let ParsedProps {
            props, has_slot, ..
        } = parse_vue_props(code, None).unwrap();

        assert_eq!(props.len(), 3);
        assert_eq!(props[0].name, "variant");
        assert!(props[0].prop_type.contains("info"));
        assert!(!props[0].is_optional);

        assert_eq!(props[1].name, "message");
        assert_eq!(props[1].prop_type, "string");
        assert!(!props[1].is_optional);

        assert_eq!(props[2].name, "count");
        assert_eq!(props[2].prop_type, "number");
        assert!(props[2].is_optional);

        assert!(!has_slot);
    }

    #[test]
    fn test_parse_vue_runtime_props() {
        let code = r#"
<script setup>
defineProps({
  title: String,
  count: { type: Number, required: true },
  url: { type: String, default: '/kestra.yml' },
  open: { type: Boolean, default: false },
})
</script>
"#;
        let ParsedProps { props, .. } = parse_vue_props(code, None).unwrap();
        let names: Vec<_> = props.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, ["title", "count", "url", "open"]);
        assert_eq!(props[0].kind, PropKind::String);
        assert!(props[0].is_optional);
        assert_eq!(props[1].kind, PropKind::Number);
        assert!(!props[1].is_optional);
        assert_eq!(props[2].default_value.as_deref(), Some("/kestra.yml"));
        assert_eq!(props[3].default_value.as_deref(), Some("false"));

        let code = "<script setup>\ndefineProps(['a', 'b'])\n</script>";
        let ParsedProps { props, .. } = parse_vue_props(code, None).unwrap();
        assert_eq!(props.len(), 2);
    }

    #[test]
    fn test_parse_astro_cast_and_untyped_props() {
        let typed = "---\ninterface Props { kind?: 'a' | 'b' }\nconst { kind = 'a' } = Astro.props as Props\n---\n";
        let props = parse_astro_props(typed, None).unwrap().props;
        assert_eq!(props[0].default_value.as_deref(), Some("a"));

        let untyped = "---\nconst { url, max = 3 } = Astro.props\n---\n";
        let props = parse_astro_props(untyped, None).unwrap().props;
        let names: Vec<_> = props.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, ["url", "max"]);
        assert_eq!(props[1].kind, PropKind::Number);
        assert_eq!(props[1].default_value.as_deref(), Some("3"));
    }

    #[test]
    fn test_parse_react_props_with_children() {
        let code = r#"
            import type { PropsWithChildren } from 'react'
            export default function Callout({ type }: PropsWithChildren<{ type: 'note' | 'tip' }>) {
                return null
            }
        "#;
        let ParsedProps {
            props, has_slot, ..
        } = parse_react_props(code, "Callout", None).unwrap();
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].name, "type");
        assert!(has_slot);
    }

    #[test]
    fn test_parse_vue_prefers_script_setup() {
        let code = r#"
<script lang="ts">
export default { name: 'Card' }
</script>
<script setup lang="ts">
defineProps<{ title: string }>()
</script>
"#;
        let ParsedProps { props, .. } = parse_vue_props(code, None).unwrap();
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].name, "title");
    }

    #[test]
    fn test_parse_svelte_skips_module_script() {
        let code = r#"
<script module lang="ts">
  export const shared = 1
</script>
<script lang="ts">
  let { label }: { label: string } = $props()
</script>
"#;
        let ParsedProps { props, .. } = parse_svelte_props(code, None).unwrap();
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].name, "label");
    }

    #[test]
    fn test_parse_vue_with_slot() {
        let code = r#"
<script setup lang="ts">
const props = defineProps<{
  title: string
}>()
</script>

<template>
  <div>
    <h1>{{ title }}</h1>
    <slot />
  </div>
</template>
"#;

        let ParsedProps {
            props, has_slot, ..
        } = parse_vue_props(code, None).unwrap();

        assert_eq!(props.len(), 1);
        assert_eq!(props[0].name, "title");
        assert!(has_slot);
    }

    #[test]
    fn test_parse_vue_optional_props() {
        let code = r#"
<script setup lang="ts">
const props = defineProps<{
  required: string
  optional?: string
  optionalNumber?: number
}>()
</script>

<template>
  <div />
</template>
"#;

        let ParsedProps { props, .. } = parse_vue_props(code, None).unwrap();

        assert_eq!(props.len(), 3);
        assert!(!props[0].is_optional); // required
        assert!(props[1].is_optional); // optional
        assert!(props[2].is_optional); // optionalNumber
    }

    #[test]
    fn test_parse_vue_union_types() {
        let code = r#"
<script setup lang="ts">
const props = defineProps<{
  size: 'small' | 'medium' | 'large'
  variant: 'primary' | 'secondary'
}>()
</script>

<template>
  <div />
</template>
"#;

        let ParsedProps { props, .. } = parse_vue_props(code, None).unwrap();

        assert_eq!(props.len(), 2);
        assert_eq!(props[0].name, "size");
        assert!(props[0].prop_type.contains("small"));
        assert!(props[0].prop_type.contains("medium"));
        assert!(props[0].prop_type.contains("large"));

        assert_eq!(props[1].name, "variant");
        assert!(props[1].prop_type.contains("primary"));
        assert!(props[1].prop_type.contains("secondary"));
    }

    #[test]
    fn test_parse_vue_no_script() {
        // Vue component without script section
        let code = r#"
<template>
  <div>Simple template</div>
</template>
"#;

        let result = parse_vue_props(code, None);

        // Should fail gracefully
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_vue_no_define_props() {
        // Vue component with script but no defineProps has no props
        let code = r#"
<script setup lang="ts">
const message = ref('hello')
</script>

<template>
  <div>{{ message }}</div>
</template>
"#;

        let result = parse_vue_props(code, None);

        assert!(result.unwrap().props.is_empty());
    }

    #[test]
    fn test_parse_vue_graceful_degradation() {
        // Malformed Vue code
        let code = r#"
<script setup lang="ts">
const props = defineProps<{
  this is not valid typescript
}>()
</script>
"#;

        let result = parse_vue_props(code, None);

        // Should fail gracefully
        assert!(result.is_err());
    }

    // Svelte Parser Tests

    #[test]
    fn test_parse_svelte_export_let() {
        let code = r#"
<script lang="ts">
  export let variant: 'info' | 'warning'
  export let message: string
  export let count: number
</script>

<div>{message}</div>
"#;

        let ParsedProps {
            props, has_slot, ..
        } = parse_svelte_props(code, None).unwrap();

        assert_eq!(props.len(), 3);
        assert_eq!(props[0].name, "variant");
        assert!(props[0].prop_type.contains("info"));
        assert!(!props[0].is_optional);

        assert_eq!(props[1].name, "message");
        assert_eq!(props[1].prop_type, "string");
        assert!(!props[1].is_optional);

        assert_eq!(props[2].name, "count");
        assert_eq!(props[2].prop_type, "number");
        assert!(!props[2].is_optional);

        assert!(!has_slot);
    }

    #[test]
    fn test_parse_svelte_optional_props() {
        let code = r#"
<script lang="ts">
  export let required: string
  export let optional: string | undefined = undefined
  export let withDefault: number = 42
</script>

<div />
"#;

        let ParsedProps { props, .. } = parse_svelte_props(code, None).unwrap();

        assert_eq!(props.len(), 3);
        assert!(!props[0].is_optional); // required
        assert!(props[1].is_optional); // optional (has undefined)
        assert!(props[2].is_optional); // withDefault (has default value)
    }

    #[test]
    fn test_parse_svelte_with_slot() {
        let code = r#"
<script lang="ts">
  export let title: string
</script>

<div>
  <h1>{title}</h1>
  <slot />
</div>
"#;

        let ParsedProps {
            props, has_slot, ..
        } = parse_svelte_props(code, None).unwrap();

        assert_eq!(props.len(), 1);
        assert_eq!(props[0].name, "title");
        assert!(has_slot);
    }

    #[test]
    fn test_parse_svelte_union_types() {
        let code = r#"
<script lang="ts">
  export let size: 'small' | 'medium' | 'large'
  export let variant: 'primary' | 'secondary'
</script>

<div />
"#;

        let ParsedProps { props, .. } = parse_svelte_props(code, None).unwrap();

        assert_eq!(props.len(), 2);
        assert_eq!(props[0].name, "size");
        assert!(props[0].prop_type.contains("small"));
        assert!(props[0].prop_type.contains("medium"));
        assert!(props[0].prop_type.contains("large"));

        assert_eq!(props[1].name, "variant");
        assert!(props[1].prop_type.contains("primary"));
        assert!(props[1].prop_type.contains("secondary"));
    }

    #[test]
    fn test_parse_svelte_no_script() {
        // Svelte component without script section
        let code = r#"
<div>Simple markup</div>
"#;

        let result = parse_svelte_props(code, None);

        // Should fail gracefully
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_svelte_no_export_let() {
        // Svelte component with script but no export let has no props
        let code = r#"
<script lang="ts">
  let message = 'hello'
</script>

<div>{message}</div>
"#;

        let result = parse_svelte_props(code, None);

        assert!(result.unwrap().props.is_empty());
    }

    #[test]
    fn test_parse_svelte_untyped_export_let() {
        // Export let without type annotation is still a prop
        let code = r#"
<script>
  export let message
</script>
"#;

        let result = parse_svelte_props(code, None);

        let props = result.unwrap().props;
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].name, "message");
        assert_eq!(props[0].kind, PropKind::Unknown);
    }

    #[test]
    fn test_scan_all_frameworks() {
        let temp_dir = TempDir::new().unwrap();
        let mdx_dir = temp_dir.path().join("src/components/mdx");
        fs::create_dir_all(&mdx_dir).unwrap();

        // Create Astro component
        let astro_content = r#"---
interface Props {
    message: string;
}
---
<div>{message}</div>"#;
        fs::write(mdx_dir.join("Alert.astro"), astro_content).unwrap();

        // Create React component
        let react_content = r#"
export default function Button({ label }: { label: string }) {
    return <button>{label}</button>;
}
"#;
        fs::write(mdx_dir.join("Button.tsx"), react_content).unwrap();

        // Create Vue component
        let vue_content = r#"
<script setup lang="ts">
const props = defineProps<{
  title: string
}>()
</script>

<template>
  <div>{{ title }}</div>
</template>
"#;
        fs::write(mdx_dir.join("Card.vue"), vue_content).unwrap();

        // Create Svelte component
        let svelte_content = r#"
<script lang="ts">
  export let count: number
</script>

<div>{count}</div>
"#;
        fs::write(mdx_dir.join("Counter.svelte"), svelte_content).unwrap();

        let components = scan(temp_dir.path(), "src/components/mdx");

        assert_eq!(components.len(), 4);

        // Find each component by name
        let alert = components.iter().find(|c| c.name == "Alert").unwrap();
        let button = components.iter().find(|c| c.name == "Button").unwrap();
        let card = components.iter().find(|c| c.name == "Card").unwrap();
        let counter = components.iter().find(|c| c.name == "Counter").unwrap();

        // Verify Astro component
        assert!(matches!(alert.framework, ComponentFramework::Astro));
        assert_eq!(alert.props.len(), 1);
        assert_eq!(alert.props[0].name, "message");

        // Verify React component
        assert!(matches!(button.framework, ComponentFramework::React));
        assert_eq!(button.props.len(), 1);
        assert_eq!(button.props[0].name, "label");

        // Verify Vue component
        assert!(matches!(card.framework, ComponentFramework::Vue));
        assert_eq!(card.props.len(), 1);
        assert_eq!(card.props[0].name, "title");

        // Verify Svelte component
        assert!(matches!(counter.framework, ComponentFramework::Svelte));
        assert_eq!(counter.props.len(), 1);
        assert_eq!(counter.props[0].name, "count");
    }
}

/// Runs the scanner over the real-world components in `test/mdx-components`
#[cfg(test)]
mod fixture_tests {
    use super::*;

    fn fixtures() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../test/mdx-components")
    }

    fn scan_fixture(root: &str, dir: &str) -> Vec<MdxComponent> {
        let root = fixtures().join(root);
        scan(&root, dir)
    }

    fn prop<'a>(components: &'a [MdxComponent], component: &str, prop: &str) -> &'a PropInfo {
        components
            .iter()
            .find(|c| c.name == component)
            .unwrap_or_else(|| panic!("no component {component}"))
            .props
            .iter()
            .find(|p| p.name == prop)
            .unwrap_or_else(|| panic!("no prop {component}.{prop}"))
    }

    /// Prints what every fixture folder reads as, for eyeballing. Each folder is
    /// scanned as its own project, so imports resolve within it:
    /// `cargo test --lib dump_all_fixtures -- --ignored --nocapture`
    /// The test project's components, which cover each prop kind and framework pattern
    #[test]
    fn reads_test_project_components() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../test/dummy-astro-project");
        let components = scan(&root, "src/components/mdx");
        dump(&components);

        assert_eq!(
            prop(&components, "Pricing", "plan").kind,
            PropKind::Literals {
                values: ["starter", "team", "enterprise"].map(String::from).to_vec()
            }
        );
        assert_eq!(prop(&components, "Figure", "image").kind, PropKind::Image);
        assert_eq!(
            prop(&components, "Figure", "related").kind,
            PropKind::CollectionEntry {
                collection: "articles".to_string()
            }
        );
        assert_eq!(
            prop(&components, "Poll", "layout").default_value.as_deref(),
            Some("list")
        );
        assert_eq!(
            prop(&components, "Rating", "max").default_value.as_deref(),
            Some("5")
        );
        // An enum member default is shown as its value
        assert_eq!(
            prop(&components, "Timeline", "orientation")
                .default_value
                .as_deref(),
            Some("vertical")
        );
        assert_eq!(
            prop(&components, "Timeline", "orientation").kind,
            PropKind::Literals {
                values: ["vertical", "horizontal"].map(String::from).to_vec()
            }
        );
        assert_eq!(
            prop(&components, "Event", "tracks").kind,
            PropKind::Array {
                items: Box::new(PropKind::Literals {
                    values: ["design", "engineering", "writing"]
                        .map(String::from)
                        .to_vec()
                })
            }
        );
    }

    #[test]
    #[ignore]
    fn dump_all_fixtures() {
        let mut dirs: Vec<_> = fs::read_dir(fixtures())
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect();
        dirs.sort();
        for dir in dirs {
            println!("\n===== {}", dir.file_name().unwrap().to_string_lossy());
            dump(&scan(&dir, "."));
        }
    }

    fn dump(components: &[MdxComponent]) {
        let mut components: Vec<_> = components.iter().collect();
        components.sort_by(|a, b| a.name.cmp(&b.name));
        for c in components {
            println!(
                "{}{}{}",
                c.name,
                if c.has_slot { " [slot]" } else { "" },
                c.description
                    .as_ref()
                    .map(|d| format!("  — {d}"))
                    .unwrap_or_default()
            );
            for p in &c.props {
                let kind = match &p.kind {
                    PropKind::Literals { values } if values.len() > 6 => {
                        format!("literals({} values)", values.len())
                    }
                    other => format!("{other:?}"),
                };
                println!(
                    "    {}{}: {}  →  {}{}{}",
                    p.name,
                    if p.is_optional { "?" } else { "" },
                    p.prop_type,
                    kind,
                    p.default_value
                        .as_ref()
                        .map(|d| format!("  = {d}"))
                        .unwrap_or_default(),
                    p.description
                        .as_ref()
                        .map(|d| format!("  // {d}"))
                        .unwrap_or_default()
                );
            }
        }
    }

    #[test]
    fn reads_dannyis_components() {
        let components = scan_fixture("dannyis", ".");
        dump(&components);

        let spacer = prop(&components, "Spacer", "size");
        assert!(matches!(&spacer.kind, PropKind::Literals { values } if values.len() == 9));
        assert_eq!(spacer.default_value.as_deref(), Some("m"));
        assert_eq!(prop(&components, "Grid", "columns").kind, PropKind::Number);
        assert_eq!(
            prop(&components, "Grid", "columns")
                .default_value
                .as_deref(),
            Some("2")
        );
        assert_eq!(
            prop(&components, "ColorSwatch", "color")
                .description
                .as_deref(),
            Some("CSS color value or variable")
        );
        assert_eq!(
            prop(&components, "ContentCard", "item")
                .description
                .as_deref(),
            Some("`\"collection/id\"`, e.g. `\"articles/my-article-slug\"`")
        );
    }

    #[test]
    fn reads_starlight_components_through_imports() {
        let components = scan_fixture("starlight", "user-components");
        dump(&components);

        let aside_type = prop(&components, "Aside", "type");
        assert_eq!(
            aside_type.kind,
            PropKind::Literals {
                values: ["note", "tip", "caution", "danger"]
                    .map(String::from)
                    .to_vec()
            }
        );
        assert_eq!(aside_type.default_value.as_deref(), Some("note"));
        assert!(
            matches!(&prop(&components, "Icon", "name").kind, PropKind::Literals { values } if values.len() > 200)
        );
        assert_eq!(
            prop(&components, "LinkButton", "href").kind,
            PropKind::String
        );
    }
}
