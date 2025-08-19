use crate::models::{MdxComponent, PropInfo};
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

        // Only process .astro files
        if path.extension().and_then(|s| s.to_str()) != Some("astro") {
            continue;
        }

        // Skip index files
        if path.file_stem().and_then(|s| s.to_str()) == Some("index") {
            continue;
        }

        // Validate each component file is within project bounds
        match validate_project_path(path, project_root) {
            Ok(_) => match parse_astro_component(path, &project_path) {
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
    })
}

fn extract_frontmatter(content: &str) -> Result<String, String> {
    let parts: Vec<&str> = content.split("---").collect();

    if parts.len() < 3 {
        return Err("No frontmatter found".to_string());
    }

    Ok(parts[1].to_string())
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
}
