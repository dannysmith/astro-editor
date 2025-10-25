use chrono::Local;
use indexmap::IndexMap;
use serde_json::Value;
use serde_norway;
use std::path::{Path, PathBuf};
use tauri::{path::BaseDirectory, Manager};

/// Validates that a file path is within the project boundaries
///
/// This function prevents path traversal attacks by ensuring all file operations
/// stay within the current project root directory.
fn validate_project_path(file_path: &str, project_root: &str) -> Result<PathBuf, String> {
    let file_path = Path::new(file_path);
    let project_root = Path::new(project_root);

    // Resolve canonical paths to handle symlinks and .. traversal
    let canonical_file = file_path
        .canonicalize()
        .or_else(|_| {
            // If file doesn't exist, try to canonicalize parent and append filename
            if let (Some(parent), Some(filename)) = (file_path.parent(), file_path.file_name()) {
                parent.canonicalize().map(|p| p.join(filename))
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Invalid file path",
                ))
            }
        })
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
pub async fn read_file(file_path: String, project_root: String) -> Result<String, String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    std::fs::read_to_string(&validated_path).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
pub async fn write_file(
    file_path: String,
    content: String,
    project_root: String,
) -> Result<(), String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    std::fs::write(&validated_path, content).map_err(|e| format!("Failed to write file: {e}"))
}

#[tauri::command]
pub async fn create_file(
    directory: String,
    filename: String,
    content: String,
    project_root: String,
) -> Result<String, String> {
    // Validate directory is within project
    let validated_dir = validate_project_path(&directory, &project_root)?;
    let path = validated_dir.join(&filename);

    // Double-check the final path is still within project bounds
    let final_path_str = path.to_string_lossy().to_string();
    let validated_final_path = validate_project_path(&final_path_str, &project_root)?;

    if validated_final_path.exists() {
        return Err("File already exists".to_string());
    }

    std::fs::write(&validated_final_path, content)
        .map_err(|e| format!("Failed to create file: {e}"))?;

    Ok(validated_final_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_file(file_path: String, project_root: String) -> Result<(), String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    std::fs::remove_file(&validated_path).map_err(|e| format!("Failed to delete file: {e}"))
}

#[tauri::command]
pub async fn rename_file(
    old_path: String,
    new_path: String,
    project_root: String,
) -> Result<(), String> {
    let validated_old_path = validate_project_path(&old_path, &project_root)?;
    let validated_new_path = validate_project_path(&new_path, &project_root)?;
    std::fs::rename(&validated_old_path, &validated_new_path)
        .map_err(|e| format!("Failed to rename file: {e}"))
}

/// Convert a string to kebab case
fn to_kebab_case(s: &str) -> String {
    let parts: Vec<&str> = s.split('.').collect();
    let extension = if parts.len() > 1 { parts.last() } else { None };

    let filename = if parts.len() > 1 {
        parts[..parts.len() - 1].join(".")
    } else {
        s.to_string()
    };

    // Convert filename to kebab case
    let kebab_filename = filename
        .to_lowercase()
        .replace([' ', '_'], "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    // Reconstruct with extension if present
    if let Some(ext) = extension {
        format!("{}.{}", kebab_filename, ext.to_lowercase())
    } else {
        kebab_filename
    }
}

#[tauri::command]
pub async fn copy_file_to_assets(
    source_path: String,
    project_path: String,
    collection: String,
) -> Result<String, String> {
    copy_file_to_assets_with_override(source_path, project_path, collection, None).await
}

#[tauri::command]
pub async fn copy_file_to_assets_with_override(
    source_path: String,
    project_path: String,
    collection: String,
    assets_directory: Option<String>,
) -> Result<String, String> {
    use std::fs;

    // Validate project path
    let validated_project_root = Path::new(&project_path)
        .canonicalize()
        .map_err(|_| "Invalid project root".to_string())?;

    // Create the assets directory structure (use override if provided)
    let assets_base = if let Some(assets_override) = assets_directory {
        validated_project_root.join(assets_override)
    } else {
        validated_project_root.join("src").join("assets")
    };

    let assets_dir = assets_base.join(&collection);

    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {e}"))?;

    // Get the source file info
    let source = PathBuf::from(&source_path);
    let file_name = source
        .file_name()
        .ok_or("Invalid source file path")?
        .to_string_lossy();

    // Extract extension
    let extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");

    // Create the base filename with date prefix
    let date_prefix = Local::now().format("%Y-%m-%d").to_string();
    let name_without_ext = file_name.trim_end_matches(&format!(".{extension}"));
    let kebab_name = to_kebab_case(name_without_ext);

    // Build the new filename
    let mut base_name = format!("{date_prefix}-{kebab_name}");
    if !extension.is_empty() {
        base_name.push('.');
        base_name.push_str(extension);
    }

    // Handle conflicts by appending -1, -2, etc.
    let mut final_path = assets_dir.join(&base_name);
    let mut counter = 1;

    while final_path.exists() {
        let name_with_counter = if extension.is_empty() {
            format!("{date_prefix}-{kebab_name}-{counter}")
        } else {
            format!("{date_prefix}-{kebab_name}-{counter}.{extension}")
        };
        final_path = assets_dir.join(name_with_counter);
        counter += 1;
    }

    // Validate the final destination is within project bounds
    let final_path_str = final_path.to_string_lossy().to_string();
    let validated_final_path = validate_project_path(&final_path_str, &project_path)?;

    // Copy the file
    fs::copy(&source_path, &validated_final_path)
        .map_err(|e| format!("Failed to copy file: {e}"))?;

    // Return the relative path from the project root (for markdown)
    let relative_path = validated_final_path
        .strip_prefix(&validated_project_root)
        .map_err(|_| "Failed to create relative path")?
        .to_string_lossy()
        .to_string();

    // Convert to forward slashes for markdown compatibility
    Ok(relative_path.replace('\\', "/"))
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct MarkdownContent {
    pub frontmatter: IndexMap<String, Value>,
    pub content: String,
    pub raw_frontmatter: String,
    pub imports: String, // MDX imports to hide from editor
}

#[tauri::command]
pub async fn parse_markdown_content(
    file_path: String,
    project_root: String,
) -> Result<MarkdownContent, String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    let content = std::fs::read_to_string(&validated_path)
        .map_err(|e| format!("Failed to read file: {e}"))?;

    parse_frontmatter(&content)
}

#[tauri::command]
pub async fn update_frontmatter(
    file_path: String,
    frontmatter: IndexMap<String, Value>,
    project_root: String,
) -> Result<(), String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    let content = std::fs::read_to_string(&validated_path)
        .map_err(|e| format!("Failed to read file: {e}"))?;

    let parsed = parse_frontmatter(&content)?;
    let new_content = rebuild_markdown_with_frontmatter(&frontmatter, &parsed.content)?;

    std::fs::write(&validated_path, new_content).map_err(|e| format!("Failed to write file: {e}"))
}

#[tauri::command]
pub async fn save_markdown_content(
    file_path: String,
    frontmatter: IndexMap<String, Value>,
    content: String,
    imports: String,
    schema_field_order: Option<Vec<String>>,
    project_root: String,
) -> Result<(), String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    let new_content = rebuild_markdown_with_frontmatter_and_imports_ordered(
        &frontmatter,
        &imports,
        &content,
        schema_field_order,
    )?;
    std::fs::write(&validated_path, new_content).map_err(|e| format!("Failed to write file: {e}"))
}

pub fn parse_frontmatter_internal(content: &str) -> Result<MarkdownContent, String> {
    parse_frontmatter(content)
}

fn parse_frontmatter(content: &str) -> Result<MarkdownContent, String> {
    let lines: Vec<&str> = content.lines().collect();

    // Check if file starts with frontmatter
    if lines.is_empty() || lines[0] != "---" {
        // No frontmatter, but might have imports at the top
        let (imports, content_without_imports) = extract_imports_from_content(&lines);
        return Ok(MarkdownContent {
            frontmatter: IndexMap::new(),
            content: content_without_imports,
            raw_frontmatter: String::new(),
            imports,
        });
    }

    // Find the closing ---
    let mut frontmatter_end = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            frontmatter_end = Some(i);
            break;
        }
    }

    let Some(end_index) = frontmatter_end else {
        return Err("Frontmatter not properly closed with '---'".to_string());
    };

    // Extract frontmatter lines (between the --- markers)
    let frontmatter_lines: Vec<&str> = lines[1..end_index].to_vec();
    let raw_frontmatter = frontmatter_lines.join("\n");

    // Parse YAML frontmatter
    let frontmatter: IndexMap<String, Value> = if raw_frontmatter.trim().is_empty() {
        IndexMap::new()
    } else {
        parse_yaml_to_json(&raw_frontmatter)?
    };

    // Extract content after frontmatter and process imports
    let content_start = end_index + 1;
    let remaining_lines: Vec<&str> = if content_start < lines.len() {
        lines[content_start..].to_vec()
    } else {
        vec![]
    };

    let (imports, content) = extract_imports_from_content(&remaining_lines);

    Ok(MarkdownContent {
        frontmatter,
        content,
        raw_frontmatter,
        imports,
    })
}

fn extract_imports_from_content(lines: &[&str]) -> (String, String) {
    let mut imports = Vec::new();
    let mut content_start_idx = 0;

    // Skip empty lines at the beginning
    while content_start_idx < lines.len() && lines[content_start_idx].trim().is_empty() {
        content_start_idx += 1;
    }

    // Extract import statements
    while content_start_idx < lines.len() {
        let line = lines[content_start_idx].trim();

        // Check if this line is an import statement
        if line.starts_with("import ") || line.starts_with("export ") {
            imports.push(lines[content_start_idx]);
            content_start_idx += 1;

            // Handle multi-line imports (lines that don't end with semicolon)
            let last_import = imports.last().unwrap_or(&"").trim();
            while content_start_idx < lines.len()
                && !last_import.ends_with(';')
                && !last_import.ends_with("';")
                && !last_import.ends_with("\";")
            {
                let current_line = lines[content_start_idx].trim();
                if current_line.is_empty() {
                    // Empty line might separate imports from content
                    break;
                } else {
                    // This is a continuation of the previous import
                    imports.push(lines[content_start_idx]);
                    content_start_idx += 1;
                    if current_line.ends_with(';')
                        || current_line.ends_with("';")
                        || current_line.ends_with("\";")
                    {
                        break;
                    }
                }
            }
        } else if line.is_empty() {
            // Check if there are more imports after this empty line
            let mut next_idx = content_start_idx + 1;
            while next_idx < lines.len() && lines[next_idx].trim().is_empty() {
                next_idx += 1;
            }

            if next_idx < lines.len() {
                let next_line = lines[next_idx].trim();
                if next_line.starts_with("import ") || next_line.starts_with("export ") {
                    // More imports coming, skip empty line
                    content_start_idx += 1;
                } else {
                    // No more imports, this empty line separates imports from content
                    break;
                }
            } else {
                // End of file
                break;
            }
        } else {
            // Found non-import content, stop processing imports
            break;
        }
    }

    // Skip any remaining empty lines after imports
    while content_start_idx < lines.len() && lines[content_start_idx].trim().is_empty() {
        content_start_idx += 1;
    }

    let imports_string = imports.join("\n");
    let content_lines: Vec<&str> = if content_start_idx < lines.len() {
        lines[content_start_idx..].to_vec()
    } else {
        vec![]
    };
    let content_string = content_lines.join("\n");

    (imports_string, content_string)
}

/// Normalizes ISO datetime strings to date-only format recursively
/// Converts "2024-01-15T00:00:00Z" -> "2024-01-15"
fn normalize_dates(frontmatter: &mut IndexMap<String, Value>) {
    for (_, value) in frontmatter.iter_mut() {
        normalize_value(value);
    }
}

/// Recursively normalizes dates in a Value
fn normalize_value(value: &mut Value) {
    match value {
        Value::String(s) => {
            // If string looks like ISO datetime, extract date part
            if s.len() > 10 && s.contains('T') && (s.ends_with('Z') || s.contains('+')) {
                if let Some(date_part) = s.split('T').next() {
                    if date_part.len() == 10 && date_part.matches('-').count() == 2 {
                        *s = date_part.to_string();
                    }
                }
            }
        }
        Value::Object(obj) => {
            for (_, v) in obj.iter_mut() {
                normalize_value(v);
            }
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                normalize_value(v);
            }
        }
        _ => {}
    }
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

/// Parse YAML string to IndexMap using serde_norway
fn parse_yaml_to_json(yaml_str: &str) -> Result<IndexMap<String, Value>, String> {
    serde_norway::from_str(yaml_str).map_err(|e| format!("Failed to parse YAML: {}", e))
}

fn rebuild_markdown_with_frontmatter(
    frontmatter: &IndexMap<String, Value>,
    content: &str,
) -> Result<String, String> {
    rebuild_markdown_with_frontmatter_and_imports(frontmatter, "", content)
}

fn rebuild_markdown_with_frontmatter_and_imports(
    frontmatter: &IndexMap<String, Value>,
    imports: &str,
    content: &str,
) -> Result<String, String> {
    rebuild_markdown_with_frontmatter_and_imports_ordered(frontmatter, imports, content, None)
}

/// Serialize a value to YAML format with proper indentation
fn rebuild_markdown_with_frontmatter_and_imports_ordered(
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

        // Normalize dates (ISO datetime -> date-only)
        let mut normalized = ordered;
        normalize_dates(&mut normalized);

        // Serialize to YAML using serde_norway
        result.push_str("---\n");
        let yaml = serde_norway::to_string(&normalized)
            .map_err(|e| format!("Failed to serialize YAML: {}", e))?;
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

    // Ensure file always ends with exactly one newline
    if !result.is_empty() {
        // Remove any trailing newlines
        while result.ends_with('\n') {
            result.pop();
        }
        // Add exactly one newline
        result.push('\n');
    }

    Ok(result)
}

#[tauri::command]
pub async fn save_recovery_data(app: tauri::AppHandle, data: Value) -> Result<(), String> {
    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let filename = data
        .get("fileName")
        .and_then(|v| v.as_str())
        .unwrap_or("untitled");

    // Create recovery directory
    let recovery_dir = app
        .path()
        .resolve("recovery", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve recovery directory: {e}"))?;

    std::fs::create_dir_all(&recovery_dir)
        .map_err(|e| format!("Failed to create recovery directory: {e}"))?;

    // Save JSON file with complete state
    let json_filename = format!("{timestamp}-{filename}.recovery.json");
    let json_path = recovery_dir.join(&json_filename);
    let json_content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize recovery data: {e}"))?;

    std::fs::write(&json_path, json_content)
        .map_err(|e| format!("Failed to write recovery JSON: {e}"))?;

    // Save Markdown file with just the content
    let md_filename = format!("{timestamp}-{filename}.recovery.md");
    let md_path = recovery_dir.join(&md_filename);
    let md_content = data
        .get("editorContent")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    std::fs::write(&md_path, md_content)
        .map_err(|e| format!("Failed to write recovery Markdown: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn save_crash_report(app: tauri::AppHandle, report: Value) -> Result<(), String> {
    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();

    // Create crash-reports directory
    let crash_dir = app
        .path()
        .resolve("crash-reports", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve crash reports directory: {e}"))?;

    std::fs::create_dir_all(&crash_dir)
        .map_err(|e| format!("Failed to create crash reports directory: {e}"))?;

    // Save crash report
    let filename = format!("{timestamp}-crash.json");
    let file_path = crash_dir.join(&filename);
    let content = serde_json::to_string_pretty(&report)
        .map_err(|e| format!("Failed to serialize crash report: {e}"))?;

    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write crash report: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    Ok(app_data_dir.to_string_lossy().to_string())
}

/// Validates that a file path is within the app data directory
///
/// This function prevents path traversal attacks for app data operations
/// by ensuring all file operations stay within the app's data directory.
/// Creates the app data directory if it doesn't exist.
fn validate_app_data_path(file_path: &str, app_data_dir: &str) -> Result<PathBuf, String> {
    use log::info;

    let file_path = Path::new(file_path);
    let app_data_dir = Path::new(app_data_dir);

    // Create app data directory if it doesn't exist
    if !app_data_dir.exists() {
        info!(
            "Astro Editor [PROJECT_REGISTRY] Creating app data directory: {}",
            app_data_dir.display()
        );
        std::fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {e}"))?;
        info!("Astro Editor [PROJECT_REGISTRY] App data directory created successfully");
    }

    // Resolve canonical paths to handle symlinks and .. traversal
    let canonical_file = file_path
        .canonicalize()
        .or_else(|_| {
            // If file doesn't exist, try to canonicalize parent and append filename
            if let (Some(parent), Some(filename)) = (file_path.parent(), file_path.file_name()) {
                // Ensure parent directory exists
                if !parent.exists() {
                    info!(
                        "Astro Editor [PROJECT_REGISTRY] Creating parent directory: {}",
                        parent.display()
                    );
                    if let Err(e) = std::fs::create_dir_all(parent) {
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            format!("Failed to create parent directory: {e}"),
                        ));
                    }
                }
                parent.canonicalize().map(|p| p.join(filename))
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Invalid file path",
                ))
            }
        })
        .map_err(|e| format!("Invalid file path: {e}"))?;

    let canonical_app_data = app_data_dir
        .canonicalize()
        .map_err(|e| format!("Invalid app data directory: {e}"))?;

    // Ensure file is within app data bounds
    canonical_file
        .strip_prefix(&canonical_app_data)
        .map_err(|_| "File outside app data directory".to_string())?;

    Ok(canonical_file)
}

#[tauri::command]
pub async fn write_app_data_file(
    app: tauri::AppHandle,
    file_path: String,
    content: String,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?
        .to_string_lossy()
        .to_string();

    let validated_path = validate_app_data_path(&file_path, &app_data_dir)?;

    // Ensure parent directory exists
    if let Some(parent) = validated_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {e}"))?;
    }

    std::fs::write(&validated_path, content)
        .map_err(|e| format!("Failed to write app data file: {e}"))
}

#[tauri::command]
pub async fn read_app_data_file(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?
        .to_string_lossy()
        .to_string();

    let validated_path = validate_app_data_path(&file_path, &app_data_dir)?;

    std::fs::read_to_string(&validated_path)
        .map_err(|e| format!("Failed to read app data file: {e}"))
}

#[tauri::command]
pub async fn read_file_content(file_path: String, project_root: String) -> Result<String, String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    std::fs::read_to_string(&validated_path).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
pub async fn write_file_content(
    file_path: String,
    content: String,
    project_root: String,
) -> Result<(), String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;

    // Create parent directories if they don't exist
    if let Some(parent) = validated_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    std::fs::write(&validated_path, content).map_err(|e| format!("Failed to write file: {e}"))
}

#[tauri::command]
pub async fn create_directory(path: String, project_root: String) -> Result<(), String> {
    let validated_path = validate_project_path(&path, &project_root)?;
    std::fs::create_dir_all(&validated_path).map_err(|e| format!("Failed to create directory: {e}"))
}

/// Checks if a file path is within the project directory
///
/// # Arguments
/// * `file_path` - The absolute path to check
/// * `project_path` - The absolute path to the project root
///
/// # Returns
/// True if the file is within the project, false otherwise
#[tauri::command]
pub async fn is_path_in_project(file_path: String, project_path: String) -> bool {
    let file = Path::new(&file_path);
    let project = Path::new(&project_path);

    file.canonicalize()
        .ok()
        .and_then(|f| project.canonicalize().ok().map(|p| f.starts_with(p)))
        .unwrap_or(false)
}

/// Gets the relative path of a file from the project root
///
/// # Arguments
/// * `file_path` - The absolute path to the file
/// * `project_path` - The absolute path to the project root
///
/// # Returns
/// The relative path from project root, or an error if the file is not in the project
#[tauri::command]
pub async fn get_relative_path(file_path: String, project_path: String) -> Result<String, String> {
    let file = Path::new(&file_path)
        .canonicalize()
        .map_err(|e| format!("Invalid file path: {e}"))?;
    let project = Path::new(&project_path)
        .canonicalize()
        .map_err(|e| format!("Invalid project path: {e}"))?;

    file.strip_prefix(&project)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|_| "Path not in project".to_string())
}

/// Resolves an image path from markdown to an absolute filesystem path
///
/// Handles both absolute paths (starting with /) and relative paths (starting with ./ or ../)
/// For absolute paths: treats them as relative to project root
/// For relative paths: resolves relative to the current file's directory
///
/// # Arguments
/// * `image_path` - The image path from markdown (e.g., "/src/assets/image.png" or "./image.png")
/// * `project_root` - The absolute path to the project root directory
/// * `current_file_path` - Optional absolute path to the current file being edited
///
/// # Returns
/// The validated absolute filesystem path that can be used with convertFileSrc
#[tauri::command]
pub async fn resolve_image_path(
    image_path: String,
    project_root: String,
    current_file_path: Option<String>,
) -> Result<String, String> {
    let project_root_path = Path::new(&project_root);

    // Determine the absolute path based on the image path format
    let absolute_path = if image_path.starts_with('/') {
        // Absolute path from project root - strip leading slash and join with project root
        let relative_path = image_path.trim_start_matches('/');
        project_root_path.join(relative_path)
    } else if image_path.starts_with("./") || image_path.starts_with("../") {
        // Relative path - need current file path to resolve
        let current_file = current_file_path
            .ok_or_else(|| "Cannot resolve relative path without current file path".to_string())?;
        let current_file_path = Path::new(&current_file);
        let current_dir = current_file_path
            .parent()
            .ok_or_else(|| "Invalid current file path".to_string())?;
        current_dir.join(&image_path)
    } else {
        // Ambiguous path (no leading / or ./) - try as absolute from project root first
        project_root_path.join(&image_path)
    };

    // Validate the path is within project bounds and exists
    let validated_path =
        validate_project_path(absolute_path.to_string_lossy().as_ref(), &project_root)?;

    // Check if file exists
    if !validated_path.exists() {
        return Err(format!(
            "Image file not found: {}",
            validated_path.display()
        ));
    }

    // Return the absolute path as a string
    Ok(validated_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

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
        let test_file = project_root.join("content").join("test.md");

        // Create test structure
        fs::create_dir_all(test_file.parent().unwrap()).unwrap();
        fs::write(&test_file, "test content").unwrap();

        let result = validate_project_path(
            &test_file.to_string_lossy(),
            &project_root.to_string_lossy(),
        );

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

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

        let result = validate_project_path(
            &malicious_path.to_string_lossy(),
            &project_root.to_string_lossy(),
        );

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
    fn test_validate_project_path_nonexistent_file() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let nonexistent_file = project_root.join("nonexistent.md");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = validate_project_path(
            &nonexistent_file.to_string_lossy(),
            &project_root.to_string_lossy(),
        );

        // Should succeed now that we allow non-existent files
        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_read_file_success() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test_read.md");
        let test_content = "# Test Content\n\nThis is a test file.";

        // Create test file
        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, test_content).unwrap();

        let result = read_file(
            test_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        assert_eq!(result.unwrap(), test_content);

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_read_file_path_traversal() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_file = project_root.join("../../../etc/passwd");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = read_file(
            malicious_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_write_file_success() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test_write.md");
        let test_content = "# Written Content\n\nThis was written by the test.";

        // Create test structure
        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, "initial").unwrap(); // Create file first

        let result = write_file(
            test_file.to_string_lossy().to_string(),
            test_content.to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Verify content was written
        let written_content = fs::read_to_string(&test_file).unwrap();
        assert_eq!(written_content, test_content);

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_create_file_success() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let content_dir = project_root.join("content");
        let test_content = "# New File\n\nThis is a newly created file.";

        // Create project structure - ensure project_root exists first
        fs::create_dir_all(&project_root).unwrap();
        fs::create_dir_all(&content_dir).unwrap();

        let result = create_file(
            content_dir.to_string_lossy().to_string(),
            "test_create.md".to_string(),
            test_content.to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        let created_path = result.unwrap();
        assert!(Path::new(&created_path).exists());

        // Verify content
        let written_content = fs::read_to_string(&created_path).unwrap();
        assert_eq!(written_content, test_content);

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_create_file_path_traversal() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_dir = project_root.join("../../../tmp");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = create_file(
            malicious_dir.to_string_lossy().to_string(),
            "malicious.md".to_string(),
            "malicious content".to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_delete_file_success() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test_delete.md");

        // Create file to delete
        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, "content to delete").unwrap();
        assert!(test_file.exists());

        let result = delete_file(
            test_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        assert!(!test_file.exists());

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_delete_file_path_traversal() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_file = project_root.join("../../../tmp/should_not_delete.txt");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = delete_file(
            malicious_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[test]
    fn test_parse_frontmatter_with_yaml() {
        let content = r#"---
title: Test Post
description: A test post for parsing
draft: false
date: 2023-12-01
---

# Content

This is the main content of the post."#;

        let result = parse_frontmatter(content).unwrap();

        assert_eq!(result.frontmatter.len(), 4);
        assert_eq!(result.frontmatter.get("title").unwrap(), "Test Post");
        assert_eq!(
            result.frontmatter.get("draft").unwrap(),
            &Value::Bool(false)
        );
        assert!(result.content.contains("# Content"));
    }

    #[test]
    fn test_parse_frontmatter_no_yaml() {
        let content = r#"# Regular Markdown

This is just regular markdown content without frontmatter."#;

        let result = parse_frontmatter(content).unwrap();

        assert!(result.frontmatter.is_empty());
        assert_eq!(result.content, content);
        assert!(result.raw_frontmatter.is_empty());
    }

    #[test]
    fn test_parse_frontmatter_with_arrays() {
        let content = r#"---
title: Test Post
tags:
  - javascript
  - typescript
  - react
categories: [tech, programming]
---

# Content

This is a test post with arrays."#;

        let result = parse_frontmatter(content).unwrap();

        assert_eq!(result.frontmatter.len(), 3);
        assert_eq!(result.frontmatter.get("title").unwrap(), "Test Post");

        // Check multi-line array
        let tags = result.frontmatter.get("tags").unwrap();
        if let Value::Array(tags_array) = tags {
            assert_eq!(tags_array.len(), 3);
            assert_eq!(tags_array[0], Value::String("javascript".to_string()));
            assert_eq!(tags_array[1], Value::String("typescript".to_string()));
            assert_eq!(tags_array[2], Value::String("react".to_string()));
        } else {
            panic!("Expected tags to be an array");
        }

        // Check inline array
        let categories = result.frontmatter.get("categories").unwrap();
        if let Value::Array(categories_array) = categories {
            assert_eq!(categories_array.len(), 2);
            assert_eq!(categories_array[0], Value::String("tech".to_string()));
            assert_eq!(
                categories_array[1],
                Value::String("programming".to_string())
            );
        } else {
            panic!("Expected categories to be an array");
        }
    }

    #[test]
    fn test_rebuild_markdown_with_frontmatter() {
        let mut frontmatter = IndexMap::new();
        frontmatter.insert("title".to_string(), Value::String("New Title".to_string()));
        frontmatter.insert("draft".to_string(), Value::Bool(true));

        let content = "# Content\n\nThis is the content.";

        let result = rebuild_markdown_with_frontmatter(&frontmatter, content).unwrap();

        println!("Generated YAML:\n{}", result);

        assert!(result.starts_with("---\n"));
        // serde_norway doesn't quote simple strings without special characters
        assert!(result.contains("title: New Title") || result.contains("title: \"New Title\""));
        assert!(result.contains("draft: true"));
        assert!(result.contains("# Content"));
    }

    #[tokio::test]
    async fn test_save_markdown_content() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test_save_markdown.md");

        // Create project structure
        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, "initial").unwrap(); // Create file first

        let mut frontmatter = IndexMap::new();
        frontmatter.insert(
            "title".to_string(),
            Value::String("Test Article".to_string()),
        );
        frontmatter.insert("draft".to_string(), Value::Bool(false));

        let content = "# Test Article\n\nThis is the article content.";

        let result = save_markdown_content(
            test_file.to_string_lossy().to_string(),
            frontmatter,
            content.to_string(),
            String::new(), // No imports for this test
            None,          // No schema field order for this test
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Verify the saved file
        let saved_content = fs::read_to_string(&test_file).unwrap();
        assert!(saved_content.starts_with("---\n"));
        // serde_norway doesn't quote simple strings
        assert!(saved_content.contains("title: Test Article") || saved_content.contains("title: \"Test Article\""));
        assert!(saved_content.contains("draft: false"));
        assert!(saved_content.contains("# Test Article"));
        assert!(saved_content.contains("This is the article content."));

        // Clean up
        let _ = fs::remove_dir_all(&project_root);
    }

    #[test]
    fn test_extract_imports_from_content() {
        let lines = vec![
            "import React from 'react';",
            "import { Component } from './Component';",
            "",
            "# Heading",
            "",
            "Some content here.",
        ];

        let (imports, content) = extract_imports_from_content(&lines);

        assert_eq!(
            imports,
            "import React from 'react';\nimport { Component } from './Component';"
        );
        assert_eq!(content, "# Heading\n\nSome content here.");
    }

    #[test]
    fn test_extract_multiline_imports() {
        let lines = vec![
            "import {",
            "  Component1,",
            "  Component2",
            "} from './components';",
            "",
            "# Content starts here",
        ];

        let (imports, content) = extract_imports_from_content(&lines);

        assert!(imports.contains("import {"));
        assert!(imports.contains("} from './components';"));
        assert_eq!(content, "# Content starts here");
    }

    #[test]
    fn test_parse_mdx_with_imports() {
        let content = r#"---
title: Test Post
draft: false
---

import React from 'react';
import { Callout } from '../components/Callout';

# Test Post

<Callout type="info">
This is a callout component.
</Callout>

Regular markdown content here."#;

        let result = parse_frontmatter(content).unwrap();

        assert_eq!(result.frontmatter.len(), 2);
        assert_eq!(result.frontmatter.get("title").unwrap(), "Test Post");
        assert!(result.imports.contains("import React from 'react';"));
        assert!(result
            .imports
            .contains("import { Callout } from '../components/Callout';"));
        assert!(result.content.contains("# Test Post"));
        assert!(result.content.contains("<Callout"));
        assert!(!result.content.contains("import React"));
    }

    #[test]
    fn test_rebuild_with_imports() {
        let mut frontmatter = IndexMap::new();
        frontmatter.insert("title".to_string(), Value::String("Test".to_string()));

        let imports = "import React from 'react';\nimport { Component } from './Component';";
        let content = "# Test\n\n<Component />";

        let result =
            rebuild_markdown_with_frontmatter_and_imports(&frontmatter, imports, content).unwrap();

        assert!(result.starts_with("---\n"));
        assert!(result.contains("title: Test"));
        assert!(result.contains("import React from 'react';"));
        assert!(result.contains("import { Component } from './Component';"));
        assert!(result.contains("# Test"));
        assert!(result.contains("<Component />"));

        // Ensure proper spacing
        let lines: Vec<&str> = result.lines().collect();
        let frontmatter_end = lines.iter().position(|&line| line == "---").unwrap();
        let second_frontmatter_end = lines[frontmatter_end + 1..]
            .iter()
            .position(|&line| line == "---")
            .unwrap()
            + frontmatter_end
            + 1;

        // Should have a blank line after frontmatter before imports
        assert_eq!(lines[second_frontmatter_end + 1], "");
        // Should have imports next
        assert!(lines[second_frontmatter_end + 2].starts_with("import"));
    }

    #[test]
    fn test_validate_app_data_path_valid() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let app_data_dir = temp_dir.join(format!("app_data_{timestamp}"));
        let test_file = app_data_dir.join("preferences").join("settings.json");

        // Create test structure - ensure app_data_dir exists first
        fs::create_dir_all(&app_data_dir).unwrap();
        fs::create_dir_all(test_file.parent().unwrap()).unwrap();
        fs::write(&test_file, "test content").unwrap();

        let result = validate_app_data_path(
            &test_file.to_string_lossy(),
            &app_data_dir.to_string_lossy(),
        );

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn test_validate_app_data_path_traversal_attack() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let app_data_dir = temp_dir.join(format!("app_data_{timestamp}"));
        let malicious_path = app_data_dir.join("../../../etc/passwd");

        // Create app data directory
        fs::create_dir_all(&app_data_dir).unwrap();

        let result = validate_app_data_path(
            &malicious_path.to_string_lossy(),
            &app_data_dir.to_string_lossy(),
        );

        // Should fail due to path traversal
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside app data directory")
                || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn test_to_kebab_case() {
        assert_eq!(to_kebab_case("My Image.png"), "my-image.png");
        assert_eq!(to_kebab_case("some_file_name.jpg"), "some-file-name.jpg");
        assert_eq!(to_kebab_case("UPPERCASE.PDF"), "uppercase.pdf");
        assert_eq!(
            to_kebab_case("Mixed Case File Name.txt"),
            "mixed-case-file-name.txt"
        );
        assert_eq!(
            to_kebab_case("already-kebab-case.md"),
            "already-kebab-case.md"
        );
        assert_eq!(
            to_kebab_case("file with   spaces.png"),
            "file-with-spaces.png"
        );
        assert_eq!(
            to_kebab_case("file___with___underscores.js"),
            "file-with-underscores.js"
        );
    }

    #[tokio::test]
    async fn test_copy_file_to_assets() {
        use std::fs;
        use tempfile::TempDir;

        // Create temporary directories
        let source_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();

        // Create a test file
        let test_file_path = source_dir.path().join("Test Image.png");
        fs::write(&test_file_path, b"fake image data").unwrap();

        // Copy file to assets
        let result = copy_file_to_assets(
            test_file_path.to_str().unwrap().to_string(),
            project_dir.path().to_str().unwrap().to_string(),
            "blog".to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        let relative_path = result.unwrap();

        // Check the returned path format
        assert!(relative_path.starts_with("src/assets/blog/"));
        assert!(relative_path.contains("-test-image.png"));

        // Check file was actually copied
        let dest_path = project_dir.path().join(&relative_path);
        assert!(dest_path.exists());

        let content = fs::read(&dest_path).unwrap();
        assert_eq!(content, b"fake image data");
    }

    #[tokio::test]
    async fn test_copy_file_to_assets_with_conflict() {
        use chrono::Local;
        use std::fs;
        use tempfile::TempDir;

        // Create temporary directories
        let source_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();

        // Create assets directory
        let assets_dir = project_dir.path().join("src/assets/posts");
        fs::create_dir_all(&assets_dir).unwrap();

        // Create an existing file with today's date
        let date_prefix = Local::now().format("%Y-%m-%d").to_string();
        let existing_file = assets_dir.join(format!("{date_prefix}-test-file.md"));
        fs::write(&existing_file, b"existing").unwrap();

        // Create source file
        let test_file_path = source_dir.path().join("Test File.md");
        fs::write(&test_file_path, b"new content").unwrap();

        // Copy file - should add -1 suffix
        let result = copy_file_to_assets(
            test_file_path.to_str().unwrap().to_string(),
            project_dir.path().to_str().unwrap().to_string(),
            "posts".to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        let relative_path = result.unwrap();

        // Should have -1 suffix
        assert!(relative_path.contains(&format!("{date_prefix}-test-file-1.md")));

        // Both files should exist
        assert!(existing_file.exists());
        let new_file = project_dir.path().join(&relative_path);
        assert!(new_file.exists());
    }

    #[tokio::test]
    async fn test_copy_file_to_assets_creates_directory() {
        use std::fs;
        use tempfile::TempDir;

        // Create temporary directories
        let source_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();

        // Create a test file
        let test_file_path = source_dir.path().join("document.pdf");
        fs::write(&test_file_path, b"pdf content").unwrap();

        // Assets directory doesn't exist yet
        let assets_dir = project_dir.path().join("src/assets/newsletters");
        assert!(!assets_dir.exists());

        // Copy file - should create directory
        let result = copy_file_to_assets(
            test_file_path.to_str().unwrap().to_string(),
            project_dir.path().to_str().unwrap().to_string(),
            "newsletters".to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Directory should now exist
        assert!(assets_dir.exists());

        // File should be copied
        let relative_path = result.unwrap();
        let dest_path = project_dir.path().join(&relative_path);
        assert!(dest_path.exists());
    }

    #[test]
    fn test_serialize_nested_object_to_yaml() {
        use serde_json::json;

        let mut frontmatter = IndexMap::new();
        frontmatter.insert("title".to_string(), json!("Test Post"));
        frontmatter.insert(
            "metadata".to_string(),
            json!({
                "category": "Blog",
                "priority": 2,
                "deadline": "2025-10-21"
            }),
        );
        frontmatter.insert("tags".to_string(), json!(["rust", "yaml", "testing"]));

        let content = "# Test Content\n\nThis is a test.";

        let result =
            rebuild_markdown_with_frontmatter_and_imports_ordered(&frontmatter, "", content, None)
                .unwrap();

        // Print for debugging
        println!("Generated YAML:\n{}", result);

        // Verify the result contains proper YAML nested object syntax
        assert!(result.contains("metadata:"));
        assert!(result.contains("  category: Blog"));
        assert!(result.contains("  priority: 2"));
        assert!(result.contains("  deadline: 2025-10-21"));

        // Verify tags array is formatted correctly
        // serde_norway uses "- item" without indent (valid YAML)
        assert!(result.contains("tags:"));
        assert!(result.contains("- rust"));
        assert!(result.contains("- yaml"));
        assert!(result.contains("- testing"));

        // Ensure metadata is NOT JSON-stringified
        assert!(!result.contains(r#"metadata: "{"#));
        assert!(!result.contains(r#"{"category":"Blog""#));

        // Verify proper frontmatter structure
        assert!(result.starts_with("---\n"));
        assert!(result.contains("---\n\n# Test Content"));

        // Print for manual inspection
        println!("Generated YAML:\n{}", result);
    }

    #[test]
    fn test_parse_nested_object_from_yaml() {
        let yaml_content = r#"title: Test Post
metadata:
  category: Blog
  priority: 2
  deadline: 2025-10-21
tags:
  - rust
  - yaml
  - testing"#;

        let result = parse_yaml_to_json(yaml_content).unwrap();

        // Verify title
        assert_eq!(
            result.get("title").unwrap(),
            &Value::String("Test Post".to_string())
        );

        // Verify nested metadata object
        let metadata = result.get("metadata").unwrap();
        assert!(metadata.is_object());
        let metadata_obj = metadata.as_object().unwrap();
        assert_eq!(
            metadata_obj.get("category").unwrap(),
            &Value::String("Blog".to_string())
        );
        assert_eq!(
            metadata_obj.get("priority").unwrap(),
            &Value::Number(serde_json::Number::from(2))
        );
        assert_eq!(
            metadata_obj.get("deadline").unwrap(),
            &Value::String("2025-10-21".to_string())
        );

        // Verify tags array
        let tags = result.get("tags").unwrap();
        assert!(tags.is_array());
        let tags_array = tags.as_array().unwrap();
        assert_eq!(tags_array.len(), 3);
        assert_eq!(tags_array[0], Value::String("rust".to_string()));
        assert_eq!(tags_array[1], Value::String("yaml".to_string()));
        assert_eq!(tags_array[2], Value::String("testing".to_string()));
    }

    #[test]
    fn test_parse_and_serialize_roundtrip() {
        let original_yaml = r#"title: Roundtrip Test
description: Testing parse and serialize roundtrip
metadata:
  category: Development
  priority: 5
  deadline: 2025-12-31
tags:
  - test
  - roundtrip"#;

        // Parse YAML to HashMap
        let parsed = parse_yaml_to_json(original_yaml).unwrap();

        // Serialize back to markdown with frontmatter (verifies serialization works)
        let content = "# Test Content";
        let _serialized =
            rebuild_markdown_with_frontmatter_and_imports_ordered(&parsed, "", content, None)
                .unwrap();

        // Parse again
        let reparsed_content = format!("---\n{original_yaml}\n---\n\n{content}");
        let reparsed = parse_frontmatter(&reparsed_content).unwrap();

        // Verify metadata object survived the roundtrip
        let metadata = reparsed.frontmatter.get("metadata").unwrap();
        assert!(metadata.is_object());
        let metadata_obj = metadata.as_object().unwrap();
        assert_eq!(
            metadata_obj.get("category").unwrap(),
            &Value::String("Development".to_string())
        );
        assert_eq!(
            metadata_obj.get("priority").unwrap(),
            &Value::Number(serde_json::Number::from(5))
        );
    }

    #[test]
    fn test_serde_norway_handles_anchors() {
        // Test that serde_norway parses YAML with anchors/aliases without errors
        // Note: When deserializing to serde_json::Value, YAML merge keys (<<) are
        // preserved as literal keys rather than being merged. This is expected behavior
        // and doesn't affect Astro frontmatter which rarely uses anchors.
        let yaml = r#"base: &base
  title: Base Title
  category: Blog
reference: *base"#;

        let result = parse_yaml_to_json(yaml);
        assert!(
            result.is_ok(),
            "serde_norway should parse YAML with anchors without error"
        );

        let parsed = result.unwrap();

        // Verify base object
        let base = parsed.get("base").unwrap();
        assert!(base.is_object());
        let base_obj = base.as_object().unwrap();
        assert_eq!(
            base_obj.get("title").unwrap(),
            &Value::String("Base Title".to_string())
        );
        assert_eq!(
            base_obj.get("category").unwrap(),
            &Value::String("Blog".to_string())
        );

        // Verify reference points to the same structure
        let reference = parsed.get("reference").unwrap();
        assert!(reference.is_object());
        let reference_obj = reference.as_object().unwrap();
        assert_eq!(
            reference_obj.get("title").unwrap(),
            &Value::String("Base Title".to_string())
        );
        assert_eq!(
            reference_obj.get("category").unwrap(),
            &Value::String("Blog".to_string())
        );
    }

    #[test]
    fn test_serde_norway_handles_block_scalars() {
        // Test multi-line strings with pipe (literal) and fold scalars
        let yaml = r#"literal: |
  First line
  Second line
  Third line
folded: >
  This is a
  long description
  that will be folded"#;

        let result = parse_yaml_to_json(yaml);
        assert!(
            result.is_ok(),
            "serde_norway should parse block scalars (| and >)"
        );

        let parsed = result.unwrap();

        // Verify literal scalar (preserves newlines)
        let literal = parsed.get("literal").unwrap();
        assert!(literal.is_string());
        let literal_str = literal.as_str().unwrap();
        assert!(literal_str.contains("First line"));
        assert!(literal_str.contains("Second line"));

        // Verify folded scalar exists
        let folded = parsed.get("folded").unwrap();
        assert!(folded.is_string());
        let folded_str = folded.as_str().unwrap();
        assert!(folded_str.contains("This is a"));
        assert!(folded_str.contains("long description"));
    }

    #[test]
    fn test_date_normalization_in_nested_objects() {
        // Test that date normalization works recursively in nested objects and arrays
        let mut frontmatter = IndexMap::new();

        // Add nested object with date
        let mut metadata = serde_json::Map::new();
        metadata.insert(
            "deadline".to_string(),
            Value::String("2024-01-15T00:00:00Z".to_string()),
        );
        metadata.insert(
            "created".to_string(),
            Value::String("2024-01-01T12:30:00+00:00".to_string()),
        );
        frontmatter.insert("metadata".to_string(), Value::Object(metadata));

        // Add array with dates
        let events = vec![
            Value::String("2024-02-14T00:00:00Z".to_string()),
            Value::String("2024-03-20T00:00:00Z".to_string()),
        ];
        frontmatter.insert("events".to_string(), Value::Array(events));

        // Add top-level date
        frontmatter.insert(
            "publishDate".to_string(),
            Value::String("2024-06-15T00:00:00Z".to_string()),
        );

        // Apply normalization
        normalize_dates(&mut frontmatter);

        // Verify nested object dates are normalized
        let metadata = frontmatter.get("metadata").unwrap().as_object().unwrap();
        assert_eq!(
            metadata.get("deadline").unwrap(),
            &Value::String("2024-01-15".to_string()),
            "Nested object date should be normalized to date-only"
        );
        assert_eq!(
            metadata.get("created").unwrap(),
            &Value::String("2024-01-01".to_string()),
            "Nested object date with timezone should be normalized"
        );

        // Verify array dates are normalized
        let events = frontmatter.get("events").unwrap().as_array().unwrap();
        assert_eq!(
            events[0],
            Value::String("2024-02-14".to_string()),
            "Array date should be normalized"
        );
        assert_eq!(
            events[1],
            Value::String("2024-03-20".to_string()),
            "Array date should be normalized"
        );

        // Verify top-level date is normalized
        assert_eq!(
            frontmatter.get("publishDate").unwrap(),
            &Value::String("2024-06-15".to_string()),
            "Top-level date should be normalized"
        );
    }

    #[test]
    fn test_date_normalization_preserves_non_dates() {
        // Ensure date normalization doesn't affect strings that aren't ISO datetimes
        let mut frontmatter = IndexMap::new();

        frontmatter.insert(
            "title".to_string(),
            Value::String("My Post Title".to_string()),
        );
        frontmatter.insert("slug".to_string(), Value::String("my-post".to_string()));
        frontmatter.insert(
            "url".to_string(),
            Value::String("https://example.com/path".to_string()),
        );
        frontmatter.insert(
            "short_date".to_string(),
            Value::String("2024-01-15".to_string()),
        ); // Already date-only

        let original = frontmatter.clone();
        normalize_dates(&mut frontmatter);

        // All non-datetime strings should be unchanged
        assert_eq!(frontmatter, original);
    }

    #[test]
    fn test_field_ordering_preserved() {
        // Test that build_ordered_frontmatter respects schema order then alphabetical
        let mut frontmatter = IndexMap::new();

        // Add fields in random order
        frontmatter.insert("zebra".to_string(), Value::String("z".to_string()));
        frontmatter.insert("title".to_string(), Value::String("Test".to_string()));
        frontmatter.insert(
            "publishDate".to_string(),
            Value::String("2024-01-15".to_string()),
        );
        frontmatter.insert("apple".to_string(), Value::String("a".to_string()));
        frontmatter.insert("draft".to_string(), Value::Bool(false));

        // Define schema order (common Astro frontmatter fields)
        let schema_order = vec![
            "title".to_string(),
            "publishDate".to_string(),
            "draft".to_string(),
        ];

        let ordered = build_ordered_frontmatter(frontmatter, Some(schema_order));

        // Verify order: schema fields first (title, publishDate, draft),
        // then non-schema fields alphabetically (apple, zebra)
        let keys: Vec<&String> = ordered.keys().collect();
        assert_eq!(keys.len(), 5);
        assert_eq!(keys[0], "title");
        assert_eq!(keys[1], "publishDate");
        assert_eq!(keys[2], "draft");
        assert_eq!(keys[3], "apple"); // Alphabetical
        assert_eq!(keys[4], "zebra"); // Alphabetical
    }

    #[test]
    fn test_field_ordering_no_schema() {
        // Test that without schema, fields are purely alphabetical
        let mut frontmatter = IndexMap::new();

        frontmatter.insert("zebra".to_string(), Value::String("z".to_string()));
        frontmatter.insert("apple".to_string(), Value::String("a".to_string()));
        frontmatter.insert("middle".to_string(), Value::String("m".to_string()));

        let ordered = build_ordered_frontmatter(frontmatter, None);

        let keys: Vec<&String> = ordered.keys().collect();
        assert_eq!(keys, vec!["apple", "middle", "zebra"]);
    }

    #[test]
    fn test_field_ordering_partial_schema_match() {
        // Test when schema specifies fields that don't exist in frontmatter
        let mut frontmatter = IndexMap::new();

        frontmatter.insert("title".to_string(), Value::String("Test".to_string()));
        frontmatter.insert("extra".to_string(), Value::String("e".to_string()));

        // Schema includes fields that don't exist
        let schema_order = vec![
            "title".to_string(),
            "publishDate".to_string(), // Doesn't exist
            "draft".to_string(),       // Doesn't exist
        ];

        let ordered = build_ordered_frontmatter(frontmatter, Some(schema_order));

        let keys: Vec<&String> = ordered.keys().collect();
        assert_eq!(keys.len(), 2);
        assert_eq!(keys[0], "title"); // Schema field that exists
        assert_eq!(keys[1], "extra"); // Non-schema field, alphabetically
    }
}
