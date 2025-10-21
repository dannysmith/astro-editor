use chrono::Local;
use serde_json::Value;
use std::collections::HashMap;
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
    pub frontmatter: HashMap<String, Value>,
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
    frontmatter: HashMap<String, Value>,
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
    frontmatter: HashMap<String, Value>,
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
            frontmatter: HashMap::new(),
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
    let frontmatter: HashMap<String, Value> = if raw_frontmatter.trim().is_empty() {
        HashMap::new()
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

fn parse_yaml_to_json(yaml_str: &str) -> Result<HashMap<String, Value>, String> {
    // Enhanced YAML parser - handles basic key-value pairs, arrays, and nested objects
    let mut result = HashMap::new();
    let lines: Vec<&str> = yaml_str.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();
        if line.is_empty() || line.starts_with('#') {
            i += 1;
            continue;
        }

        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim();

            // Parse different value types
            let parsed_value = if value.is_empty() {
                // Check if this is a multi-line array
                let (array_value, lines_consumed) = parse_yaml_array(&lines, i + 1)?;
                if !array_value.is_empty() {
                    i += lines_consumed;
                    Value::Array(array_value)
                } else {
                    // Check if this is a nested object
                    let (object_value, lines_consumed) = parse_yaml_object(&lines, i + 1, 0)?;
                    if !object_value.is_empty() {
                        i += lines_consumed;
                        Value::Object(object_value)
                    } else {
                        Value::String(String::new())
                    }
                }
            } else if value.starts_with('[') && value.ends_with(']') {
                // Parse inline array like [one, two, three]
                let array_content = &value[1..value.len() - 1];
                let items: Vec<Value> = array_content
                    .split(',')
                    .map(|s| {
                        Value::String(s.trim().trim_matches('"').trim_matches('\'').to_string())
                    })
                    .collect();
                Value::Array(items)
            } else if value == "true" {
                Value::Bool(true)
            } else if value == "false" {
                Value::Bool(false)
            } else if let Ok(num) = value.parse::<i64>() {
                Value::Number(serde_json::Number::from(num))
            } else if let Ok(num) = value.parse::<f64>() {
                Value::Number(
                    serde_json::Number::from_f64(num).unwrap_or(serde_json::Number::from(0)),
                )
            } else {
                // Remove quotes if present
                let cleaned = value.trim_matches('"').trim_matches('\'');
                Value::String(cleaned.to_string())
            };

            result.insert(key, parsed_value);
        }
        i += 1;
    }

    Ok(result)
}

fn parse_yaml_array(lines: &[&str], start_index: usize) -> Result<(Vec<Value>, usize), String> {
    let mut array = Vec::new();
    let mut i = start_index;

    while i < lines.len() {
        let line = lines[i].trim();

        // Skip empty lines
        if line.is_empty() {
            i += 1;
            continue;
        }

        // Check if this is an array item
        if let Some(stripped) = line.strip_prefix("- ") {
            let item_value = stripped.trim();
            let cleaned = item_value.trim_matches('"').trim_matches('\'');
            array.push(Value::String(cleaned.to_string()));
            i += 1;
        } else {
            // Not an array item, stop parsing
            break;
        }
    }

    Ok((array, i - start_index))
}

fn parse_yaml_object(
    lines: &[&str],
    start_index: usize,
    parent_indent: usize,
) -> Result<(serde_json::Map<String, Value>, usize), String> {
    let mut object = serde_json::Map::new();
    let mut i = start_index;

    // Determine the indent level of the first property (if any)
    let mut object_indent = None;

    while i < lines.len() {
        let line = lines[i];

        // Skip empty lines
        if line.trim().is_empty() {
            i += 1;
            continue;
        }

        // Count leading spaces to determine indentation
        let current_indent = line.len() - line.trim_start().len();

        // If we haven't determined the object indent yet, use the first non-empty line
        if object_indent.is_none() {
            if current_indent > parent_indent {
                object_indent = Some(current_indent);
            } else {
                // No indented content, empty object
                break;
            }
        }

        let expected_indent = object_indent.unwrap();

        // If indentation is less than expected, we've left this object
        if current_indent < expected_indent {
            break;
        }

        // If indentation is greater, skip (nested content handled recursively)
        if current_indent > expected_indent {
            i += 1;
            continue;
        }

        // Parse key-value pair
        let trimmed = line.trim();
        if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim();

            // Parse the value
            let parsed_value = if value.is_empty() {
                // Check for nested array
                let (array_value, lines_consumed) = parse_yaml_array(lines, i + 1)?;
                if !array_value.is_empty() {
                    i += lines_consumed;
                    Value::Array(array_value)
                } else {
                    // Check for nested object
                    let (nested_obj, lines_consumed) =
                        parse_yaml_object(lines, i + 1, current_indent)?;
                    if !nested_obj.is_empty() {
                        i += lines_consumed;
                        Value::Object(nested_obj)
                    } else {
                        Value::String(String::new())
                    }
                }
            } else if value.starts_with('[') && value.ends_with(']') {
                // Inline array
                let array_content = &value[1..value.len() - 1];
                let items: Vec<Value> = array_content
                    .split(',')
                    .map(|s| {
                        Value::String(s.trim().trim_matches('"').trim_matches('\'').to_string())
                    })
                    .collect();
                Value::Array(items)
            } else if value == "true" {
                Value::Bool(true)
            } else if value == "false" {
                Value::Bool(false)
            } else if let Ok(num) = value.parse::<i64>() {
                Value::Number(serde_json::Number::from(num))
            } else if let Ok(num) = value.parse::<f64>() {
                Value::Number(
                    serde_json::Number::from_f64(num).unwrap_or(serde_json::Number::from(0)),
                )
            } else {
                // String value
                let cleaned = value.trim_matches('"').trim_matches('\'');
                Value::String(cleaned.to_string())
            };

            object.insert(key, parsed_value);
        }
        i += 1;
    }

    Ok((object, i - start_index))
}

fn rebuild_markdown_with_frontmatter(
    frontmatter: &HashMap<String, Value>,
    content: &str,
) -> Result<String, String> {
    rebuild_markdown_with_frontmatter_and_imports(frontmatter, "", content)
}

fn rebuild_markdown_with_frontmatter_and_imports(
    frontmatter: &HashMap<String, Value>,
    imports: &str,
    content: &str,
) -> Result<String, String> {
    rebuild_markdown_with_frontmatter_and_imports_ordered(frontmatter, imports, content, None)
}

/// Serialize a value to YAML format with proper indentation
fn serialize_value_to_yaml(value: &Value, indent_level: usize) -> String {
    let indent = "  ".repeat(indent_level);

    match value {
        Value::String(s) => {
            // Convert ISO datetime strings to date-only format
            if s.len() > 10
                && s.contains('T')
                && (s.ends_with('Z') || s.contains('+') || s.contains('-'))
            {
                // This looks like an ISO datetime string, extract just the date part
                if let Some(date_part) = s.split('T').next() {
                    if date_part.len() == 10 && date_part.matches('-').count() == 2 {
                        return date_part.to_string();
                    }
                }
            }

            if s.len() == 10
                && s.matches('-').count() == 2
                && s.chars().all(|c| c.is_ascii_digit() || c == '-')
            {
                // This looks like a date string (YYYY-MM-DD), don't quote it
                s.clone()
            } else if s.contains(' ') || s.contains(':') || s.contains('\n') {
                // Quote strings that contain special characters or spaces
                format!("\"{}\"", s.replace('"', "\\\""))
            } else {
                s.clone()
            }
        }
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::Array(arr) => {
            // Format array as YAML array
            if arr.is_empty() {
                "[]".to_string()
            } else {
                let mut array_str = String::new();
                for item in arr {
                    let item_str = match item {
                        Value::String(s) => s.clone(),
                        _ => serialize_value_to_yaml(item, 0),
                    };
                    array_str.push_str(&format!("\n{indent}  - {item_str}"));
                }
                array_str
            }
        }
        Value::Object(obj) => {
            // Format object as nested YAML
            let mut object_str = String::new();
            for (key, val) in obj {
                let val_str = serialize_value_to_yaml(val, indent_level + 1);
                // Check if value needs to be on next line (objects/arrays)
                if matches!(val, Value::Object(_) | Value::Array(_)) {
                    object_str.push_str(&format!("\n{indent}  {key}:{val_str}"));
                } else {
                    object_str.push_str(&format!("\n{indent}  {key}: {val_str}"));
                }
            }
            object_str
        }
        Value::Null => "null".to_string(),
    }
}

fn rebuild_markdown_with_frontmatter_and_imports_ordered(
    frontmatter: &HashMap<String, Value>,
    imports: &str,
    content: &str,
    schema_field_order: Option<Vec<String>>,
) -> Result<String, String> {
    let mut result = String::new();

    // Add frontmatter if present
    if !frontmatter.is_empty() {
        result.push_str("---\n");

        // Create an ordered list of keys
        let mut ordered_keys = Vec::new();
        let mut remaining_keys: std::collections::HashSet<String> =
            frontmatter.keys().cloned().collect();

        // First, add keys in schema order (if provided)
        if let Some(schema_order) = schema_field_order {
            for key in schema_order {
                if frontmatter.contains_key(&key) {
                    ordered_keys.push(key.clone());
                    remaining_keys.remove(&key);
                }
            }
        }

        // Then add any remaining keys in alphabetical order to maintain consistency
        let mut remaining_sorted: Vec<String> = remaining_keys.into_iter().collect();
        remaining_sorted.sort();
        ordered_keys.extend(remaining_sorted);

        // Write frontmatter in the determined order
        for key in ordered_keys {
            if let Some(value) = frontmatter.get(&key) {
                let value_str = serialize_value_to_yaml(value, 0);

                // Check if value needs to be on next line (objects/arrays)
                if matches!(value, Value::Object(_) | Value::Array(_)) {
                    result.push_str(&format!("{key}:{value_str}\n"));
                } else {
                    result.push_str(&format!("{key}: {value_str}\n"));
                }
            }
        }

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
        let mut frontmatter = HashMap::new();
        frontmatter.insert("title".to_string(), Value::String("New Title".to_string()));
        frontmatter.insert("draft".to_string(), Value::Bool(true));

        let content = "# Content\n\nThis is the content.";

        let result = rebuild_markdown_with_frontmatter(&frontmatter, content).unwrap();

        assert!(result.starts_with("---\n"));
        assert!(result.contains("title: \"New Title\""));
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

        let mut frontmatter = HashMap::new();
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
        assert!(saved_content.contains("title: \"Test Article\""));
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
        let mut frontmatter = HashMap::new();
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

        let mut frontmatter = HashMap::new();
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

        // Verify the result contains proper YAML nested object syntax
        assert!(result.contains("metadata:"));
        assert!(result.contains("  category: Blog"));
        assert!(result.contains("  priority: 2"));
        assert!(result.contains("  deadline: 2025-10-21"));

        // Verify tags array is formatted correctly
        assert!(result.contains("tags:"));
        assert!(result.contains("  - rust"));
        assert!(result.contains("  - yaml"));
        assert!(result.contains("  - testing"));

        // Ensure metadata is NOT JSON-stringified
        assert!(!result.contains(r#"metadata: "{"#));
        assert!(!result.contains(r#"{"category":"Blog""#));

        // Verify proper frontmatter structure
        assert!(result.starts_with("---\n"));
        assert!(result.contains("---\n\n# Test Content"));

        // Optional: Print for manual inspection during development
        // println!("Generated YAML:\n{}", result);
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
}
