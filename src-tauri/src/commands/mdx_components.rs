use crate::models::{ComponentFramework, MdxComponent, PropInfo};
use std::fs;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use swc_common::sync::Lrc;
use swc_common::{FileName, SourceMap};
use swc_ecma_ast::EsVersion;
use swc_ecma_ast::*;
use swc_ecma_parser::{parse_file_as_module, Syntax, TsSyntax};
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

#[tauri::command]
pub async fn scan_mdx_components(
    project_path: String,
    mdx_directory: Option<String>,
) -> Result<Vec<MdxComponent>, String> {
    let project_root = Path::new(&project_path);
    let mdx_dir_path = mdx_directory.unwrap_or_else(|| "src/components/mdx".to_string());
    let mdx_dir = project_root.join(&mdx_dir_path);

    // Validate the MDX directory is within project bounds
    if mdx_dir.exists() {
        let _validated_mdx_dir = validate_project_path(&mdx_dir, project_root)?;
    } else {
        // Keep this one log for production debugging
        eprintln!("[MDX] Directory not found: {}", mdx_dir.display());
        return Ok(vec![]);
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
            Ok(_) => {
                let framework = detect_framework(path);
                let result = match framework {
                    ComponentFramework::Astro => parse_astro_component(path, &project_path),
                    ComponentFramework::React => parse_react_component(path, &project_path),
                    ComponentFramework::Vue => parse_vue_component(path, &project_path),
                    ComponentFramework::Svelte => parse_svelte_component(path, &project_path),
                };
                match result {
                    Ok(component) => components.push(component),
                    Err(e) => eprintln!("Error parsing MDX component {}: {e}", path.display()),
                }
            }
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

    Ok(components)
}

fn parse_astro_component(path: &Path, project_root: &str) -> Result<MdxComponent, String> {
    // Validate the component file path is within project bounds
    let project_root_path = Path::new(project_root);
    let _validated_path = validate_project_path(path, project_root_path)?;

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))?;

    // Extract component name from filename
    let component_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid filename")?
        .to_string();

    // Extract frontmatter (TypeScript code between ---)
    let frontmatter = extract_frontmatter(&content)?;

    // Parse TypeScript AST
    let props = parse_props_from_typescript(&frontmatter)?;

    // Check for <slot /> in the template part
    let has_slot = content.contains("<slot") || content.contains("<slot/>");

    // Calculate relative path
    let relative_path = path
        .strip_prefix(project_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    Ok(MdxComponent {
        name: component_name,
        file_path: relative_path,
        props,
        has_slot,
        description: None, // TODO: Extract from JSDoc comments
        framework: ComponentFramework::Astro,
    })
}

fn parse_react_component(path: &Path, project_root: &str) -> Result<MdxComponent, String> {
    // Validate the component file path is within project bounds
    let project_root_path = Path::new(project_root);
    let _validated_path = validate_project_path(path, project_root_path)?;

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))?;

    // Extract component name from filename
    let component_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid filename")?
        .to_string();

    // Calculate relative path
    let relative_path = path
        .strip_prefix(project_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    // Parse React component props (with graceful degradation)
    let (props, has_slot) = parse_react_props(&content).unwrap_or_else(|_| (Vec::new(), false));

    Ok(MdxComponent {
        name: component_name,
        file_path: relative_path,
        props,
        has_slot,
        description: None,
        framework: ComponentFramework::React,
    })
}

fn parse_vue_component(path: &Path, project_root: &str) -> Result<MdxComponent, String> {
    // Validate the component file path is within project bounds
    let project_root_path = Path::new(project_root);
    let _validated_path = validate_project_path(path, project_root_path)?;

    let _content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))?;

    // Extract component name from filename
    let component_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid filename")?
        .to_string();

    // Calculate relative path
    let relative_path = path
        .strip_prefix(project_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    // TODO: Implement Vue props parsing
    // For now, return empty props with graceful degradation
    Ok(MdxComponent {
        name: component_name,
        file_path: relative_path,
        props: Vec::new(),
        has_slot: false,
        description: None,
        framework: ComponentFramework::Vue,
    })
}

fn parse_svelte_component(path: &Path, project_root: &str) -> Result<MdxComponent, String> {
    // Validate the component file path is within project bounds
    let project_root_path = Path::new(project_root);
    let _validated_path = validate_project_path(path, project_root_path)?;

    let _content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {e}"))?;

    // Extract component name from filename
    let component_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid filename")?
        .to_string();

    // Calculate relative path
    let relative_path = path
        .strip_prefix(project_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string();

    // TODO: Implement Svelte props parsing
    // For now, return empty props with graceful degradation
    Ok(MdxComponent {
        name: component_name,
        file_path: relative_path,
        props: Vec::new(),
        has_slot: false,
        description: None,
        framework: ComponentFramework::Svelte,
    })
}

fn extract_frontmatter(content: &str) -> Result<String, String> {
    let parts: Vec<&str> = content.split("---").collect();

    if parts.len() < 3 {
        return Err("No frontmatter found".to_string());
    }

    Ok(parts[1].to_string())
}

/// Parse React component props from TypeScript/TSX file
/// Supports inline types and interface references
/// Returns (props, has_children)
fn parse_react_props(content: &str) -> Result<(Vec<PropInfo>, bool), String> {
    // Create a source map (required by swc)
    let cm = Lrc::new(SourceMap::default());

    // Create a file source
    let fm = cm.new_source_file(
        Rc::new(FileName::Custom("component.tsx".into())),
        content.to_string(),
    );

    // Parse the TypeScript code
    let syntax = Syntax::Typescript(TsSyntax {
        tsx: true,
        decorators: false,
        ..Default::default()
    });

    let module = parse_file_as_module(&fm, syntax, EsVersion::Es2022, None, &mut vec![])
        .map_err(|e| format!("Failed to parse TypeScript: {e:?}"))?;

    // Find function component and extract props
    let mut visitor = ReactPropsVisitor {
        props: Vec::new(),
        interfaces: std::collections::HashMap::new(),
    };

    module.visit_with(&mut visitor);

    // Check if 'children' prop exists
    let has_children = visitor.props.iter().any(|p| p.name == "children");

    Ok((visitor.props, has_children))
}

struct ReactPropsVisitor {
    props: Vec<PropInfo>,
    interfaces: std::collections::HashMap<String, Vec<PropInfo>>,
}

impl Visit for ReactPropsVisitor {
    // Collect interface definitions
    fn visit_ts_interface_decl(&mut self, node: &TsInterfaceDecl) {
        let interface_name = node.id.sym.to_string();
        let mut interface_props = Vec::new();

        for member in &node.body.body {
            if let TsTypeElement::TsPropertySignature(prop) = member {
                if let Some(prop_info) = extract_prop_info(prop) {
                    interface_props.push(prop_info);
                }
            }
        }

        self.interfaces.insert(interface_name, interface_props);
    }

    // Find function declarations
    fn visit_fn_decl(&mut self, node: &FnDecl) {
        if let Some(props) = extract_props_from_function(&node.function, &self.interfaces) {
            self.props = props;
        }
    }

    // Find arrow functions (const Component = () => {})
    fn visit_var_declarator(&mut self, node: &VarDeclarator) {
        if let Some(init) = &node.init {
            if let Expr::Arrow(arrow) = init.as_ref() {
                if let Some(props) = extract_props_from_arrow(arrow, &self.interfaces) {
                    self.props = props;
                }
            }
        }
    }

    // Handle export default function
    fn visit_export_default_decl(&mut self, node: &ExportDefaultDecl) {
        if let DefaultDecl::Fn(fn_expr) = &node.decl {
            if let Some(props) = extract_props_from_function(&fn_expr.function, &self.interfaces) {
                self.props = props;
            }
        }
    }
}

/// Extract props from a function declaration
fn extract_props_from_function(
    func: &Function,
    interfaces: &std::collections::HashMap<String, Vec<PropInfo>>,
) -> Option<Vec<PropInfo>> {
    // Get first parameter
    let first_param = func.params.first()?;

    // Extract type annotation from the pattern
    extract_type_ann_from_pat(&first_param.pat, interfaces)
}

/// Extract props from an arrow function
fn extract_props_from_arrow(
    arrow: &ArrowExpr,
    interfaces: &std::collections::HashMap<String, Vec<PropInfo>>,
) -> Option<Vec<PropInfo>> {
    // Get first parameter
    let first_param = arrow.params.first()?;

    // Extract type annotation from the pattern
    extract_type_ann_from_pat(first_param, interfaces)
}

/// Extract type annotation from a Pat (pattern)
fn extract_type_ann_from_pat(
    pat: &Pat,
    interfaces: &std::collections::HashMap<String, Vec<PropInfo>>,
) -> Option<Vec<PropInfo>> {
    match pat {
        Pat::Object(obj_pat) => {
            if let Some(type_ann) = &obj_pat.type_ann {
                extract_props_from_type_annotation(&type_ann.type_ann, interfaces)
            } else {
                None
            }
        }
        Pat::Ident(ident) => {
            if let Some(type_ann) = &ident.type_ann {
                extract_props_from_type_annotation(&type_ann.type_ann, interfaces)
            } else {
                None
            }
        }
        _ => None,
    }
}

/// Extract props from a type annotation
/// Handles inline object types and interface references
fn extract_props_from_type_annotation(
    ts_type: &TsType,
    interfaces: &std::collections::HashMap<String, Vec<PropInfo>>,
) -> Option<Vec<PropInfo>> {
    match ts_type {
        // Inline object type: { prop: Type }
        TsType::TsTypeLit(type_lit) => {
            let mut props = Vec::new();
            for member in &type_lit.members {
                if let TsTypeElement::TsPropertySignature(prop) = member {
                    if let Some(prop_info) = extract_prop_info(prop) {
                        props.push(prop_info);
                    }
                }
            }
            Some(props)
        }
        // Interface reference: PropsInterface
        TsType::TsTypeRef(type_ref) => {
            if let TsEntityName::Ident(ident) = &type_ref.type_name {
                let interface_name = ident.sym.to_string();
                interfaces.get(&interface_name).cloned()
            } else {
                None
            }
        }
        _ => None,
    }
}

fn parse_props_from_typescript(typescript_code: &str) -> Result<Vec<PropInfo>, String> {
    // Create a source map (required by swc)
    let cm = Lrc::new(SourceMap::default());

    // Create a file source
    let fm = cm.new_source_file(
        Rc::new(FileName::Custom("props.ts".into())),
        typescript_code.to_string(),
    );

    // Parse the TypeScript code
    let syntax = Syntax::Typescript(TsSyntax {
        tsx: true,
        decorators: false,
        ..Default::default()
    });

    let module = parse_file_as_module(&fm, syntax, EsVersion::Es2022, None, &mut vec![])
        .map_err(|e| format!("Failed to parse TypeScript: {e:?}"))?;

    // Find Props interface
    let mut visitor = PropsVisitor { props: Vec::new() };

    module.visit_with(&mut visitor);

    Ok(visitor.props)
}

struct PropsVisitor {
    props: Vec<PropInfo>,
}

impl Visit for PropsVisitor {
    fn visit_ts_interface_decl(&mut self, node: &TsInterfaceDecl) {
        // Look for interface named "Props"
        if node.id.sym.as_str() == "Props" {
            for member in &node.body.body {
                if let TsTypeElement::TsPropertySignature(prop) = member {
                    if let Some(prop_info) = extract_prop_info(prop) {
                        self.props.push(prop_info);
                    }
                }
            }
        }
    }
}

fn extract_prop_info(prop: &TsPropertySignature) -> Option<PropInfo> {
    // Extract property name
    let name = match prop.key.as_ref() {
        Expr::Ident(ident) => ident.sym.to_string(),
        _ => return None,
    };

    // Check if optional
    let is_optional = prop.optional;

    // Extract type as string
    let prop_type = if let Some(type_ann) = &prop.type_ann {
        type_to_string(&type_ann.type_ann)
    } else {
        "unknown".to_string()
    };

    Some(PropInfo {
        name,
        prop_type,
        is_optional,
        default_value: None, // TODO: Extract default values from AST
    })
}

fn type_to_string(ts_type: &TsType) -> String {
    match ts_type {
        TsType::TsKeywordType(keyword) => match keyword.kind {
            TsKeywordTypeKind::TsStringKeyword => "string".to_string(),
            TsKeywordTypeKind::TsNumberKeyword => "number".to_string(),
            TsKeywordTypeKind::TsBooleanKeyword => "boolean".to_string(),
            TsKeywordTypeKind::TsAnyKeyword => "any".to_string(),
            _ => "unknown".to_string(),
        },
        TsType::TsLitType(lit) => match &lit.lit {
            TsLit::Str(s) => format!("'{}'", s.value),
            TsLit::Number(n) => n.value.to_string(),
            TsLit::Bool(b) => b.value.to_string(),
            _ => "literal".to_string(),
        },
        TsType::TsUnionOrIntersectionType(union) => {
            if let TsUnionOrIntersectionType::TsUnionType(union_type) = union {
                union_type
                    .types
                    .iter()
                    .map(|t| type_to_string(t))
                    .collect::<Vec<_>>()
                    .join(" | ")
            } else {
                "intersection".to_string()
            }
        }
        TsType::TsTypeRef(type_ref) => {
            if let TsEntityName::Ident(ident) = &type_ref.type_name {
                ident.sym.to_string()
            } else {
                "unknown".to_string()
            }
        }
        TsType::TsArrayType(array_type) => {
            format!("{}[]", type_to_string(&array_type.elem_type))
        }
        _ => "unknown".to_string(),
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

        let props = parse_props_from_typescript(typescript_code).unwrap();

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

    #[tokio::test]
    async fn test_scan_mdx_components() {
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

        let components = scan_mdx_components(
            temp_dir.path().to_str().unwrap().to_string(),
            Some("src/components/mdx".to_string()),
        )
        .await
        .unwrap();

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

    #[tokio::test]
    async fn test_scan_mdx_components_path_traversal_protection() {
        let temp_dir = TempDir::new().unwrap();
        let project_root = temp_dir.path().join("project");
        fs::create_dir_all(&project_root).unwrap();

        // Try to scan outside the project directory
        let result = scan_mdx_components(
            project_root.to_str().unwrap().to_string(),
            Some("../../../etc".to_string()),
        )
        .await;

        // Should succeed but return empty results since the path doesn't exist within project bounds
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    // React Parser Tests

    #[test]
    fn test_parse_react_inline_types() {
        let code = r#"
            function Button({ variant, size }: { variant: 'primary' | 'secondary', size?: number }) {
                return <button>{variant}</button>;
            }
        "#;

        let (props, has_children) = parse_react_props(code).unwrap();

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

        let (props, has_children) = parse_react_props(code).unwrap();

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

        let (props, has_children) = parse_react_props(code).unwrap();

        assert_eq!(props.len(), 2);
        assert_eq!(props[0].name, "title");
        assert_eq!(props[1].name, "children");

        // Children prop should trigger has_slot
        assert!(has_children);
    }

    #[test]
    fn test_parse_react_arrow_function() {
        let code = r#"
            const Alert = ({ message, type }: { message: string, type?: 'info' | 'warning' }) => {
                return <div className={type}>{message}</div>;
            };
        "#;

        let (props, has_children) = parse_react_props(code).unwrap();

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

        let (props, _) = parse_react_props(code).unwrap();

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

        let result = parse_react_props(code);

        // Should fail gracefully
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_scan_mixed_components() {
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

        // Create Vue component (will have empty props for now)
        let vue_content = r#"
<template>
  <div>{{ message }}</div>
</template>
"#;
        fs::write(mdx_dir.join("Card.vue"), vue_content).unwrap();

        let components = scan_mdx_components(
            temp_dir.path().to_str().unwrap().to_string(),
            Some("src/components/mdx".to_string()),
        )
        .await
        .unwrap();

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

        // Verify Vue component (empty props for now)
        assert!(matches!(card.framework, ComponentFramework::Vue));
        assert_eq!(card.props.len(), 0);
    }
}
