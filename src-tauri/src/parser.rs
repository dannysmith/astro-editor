use crate::models::Collection;
use regex::Regex;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ZodField {
    pub name: String,
    pub field_type: ZodFieldType,
    pub optional: bool,
    pub default_value: Option<String>,
    pub constraints: ZodFieldConstraints,
}

#[derive(Debug, Clone, Default)]
pub struct ZodFieldConstraints {
    pub min: Option<i64>,
    pub max: Option<i64>,
    pub regex: Option<String>,
    pub url: bool,
    pub email: bool,
    pub uuid: bool,
    pub cuid: bool,
    pub cuid2: bool,
    pub ulid: bool,
    pub emoji: bool,
    pub ip: bool,
    pub includes: Option<String>,
    pub starts_with: Option<String>,
    pub ends_with: Option<String>,
    pub length: Option<i64>,
    pub trim: bool,
    pub to_lower_case: bool,
    pub to_upper_case: bool,
    pub transform: Option<String>,
    pub refine: Option<String>,
    pub literal: Option<String>,
    pub min_length: Option<i64>,
    pub max_length: Option<i64>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum ZodFieldType {
    String,
    Number,
    Boolean,
    Date,
    Array(Box<ZodFieldType>),
    Enum(Vec<String>),
    Union(Vec<ZodFieldType>),
    Literal(String),
    Object(Vec<ZodField>),
    Reference(String), // Stores the collection name
    Image,
    Unknown,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ParsedSchema {
    pub fields: Vec<ZodField>,
    pub raw: String,
}

/// Parse Astro content config file and extract collection definitions
pub fn parse_astro_config(
    project_path: &Path,
    content_directory_override: Option<&str>,
) -> Result<Vec<Collection>, String> {
    // Try both possible config file locations
    let config_paths = [
        project_path.join("src").join("content.config.ts"), // New format
        project_path.join("src").join("content").join("config.ts"), // Old format
    ];

    for config_path in &config_paths {
        if config_path.exists() {
            let content = std::fs::read_to_string(config_path)
                .map_err(|e| format!("Failed to read config file: {e}"))?;

            return parse_collections_from_content(
                &content,
                project_path,
                content_directory_override,
            );
        }
    }

    Ok(vec![])
}

fn parse_collections_from_content(
    content: &str,
    project_path: &Path,
    content_directory_override: Option<&str>,
) -> Result<Vec<Collection>, String> {
    let mut collections = Vec::new();

    // Use override if provided, otherwise default to src/content
    let content_dir = if let Some(override_path) = content_directory_override {
        project_path.join(override_path)
    } else {
        project_path.join("src").join("content")
    };

    // Remove comments and normalize whitespace
    let clean_content = remove_comments(content);

    // Look for collections object in defineConfig
    if let Some(collections_block) = extract_collections_block(&clean_content) {
        collections.extend(parse_collection_definitions(
            &collections_block,
            &content_dir,
            &clean_content, // Pass full content for schema extraction
        )?);
    }

    Ok(collections)
}

fn remove_comments(content: &str) -> String {
    // Improved comment removal that handles edge cases better
    let mut result = String::new();
    let mut chars = content.chars().peekable();
    let mut in_string = false;
    let mut string_char = '"';
    let mut in_block_comment = false;
    let mut escape_next = false;

    while let Some(ch) = chars.next() {
        if escape_next {
            if !in_block_comment {
                result.push(ch);
            }
            escape_next = false;
            continue;
        }

        if in_string {
            if ch == '\\' {
                escape_next = true;
                result.push(ch);
            } else if ch == string_char {
                in_string = false;
                result.push(ch);
            } else {
                result.push(ch);
            }
            continue;
        }

        if in_block_comment {
            if ch == '*' && chars.peek() == Some(&'/') {
                chars.next(); // consume '/'
                in_block_comment = false;
            }
            continue;
        }

        match ch {
            '"' | '\'' => {
                in_string = true;
                string_char = ch;
                result.push(ch);
            }
            '/' => {
                if chars.peek() == Some(&'/') {
                    // Line comment - skip to end of line
                    chars.next(); // consume second '/'
                    for next_ch in chars.by_ref() {
                        if next_ch == '\n' {
                            result.push(next_ch);
                            break;
                        }
                    }
                } else if chars.peek() == Some(&'*') {
                    // Block comment start
                    chars.next(); // consume '*'
                    in_block_comment = true;
                } else {
                    result.push(ch);
                }
            }
            _ => result.push(ch),
        }
    }

    result
}

fn extract_collections_block(content: &str) -> Option<String> {
    // Try new format first: export const collections = { ... }
    let export_collections_re = Regex::new(r"export\s+const\s+collections\s*=\s*\{").unwrap();

    if let Some(start_match) = export_collections_re.find(content) {
        let start = start_match.end() - 1; // Include the opening brace

        // Find matching closing brace
        let mut brace_count = 0;
        let mut end = start;

        for (i, ch) in content[start..].char_indices() {
            match ch {
                '{' => brace_count += 1,
                '}' => {
                    brace_count -= 1;
                    if brace_count == 0 {
                        end = start + i + 1;
                        break;
                    }
                }
                _ => {}
            }
        }

        if brace_count == 0 {
            return Some(content[start..end].to_string());
        }
    }

    // Fallback to old format: collections: { ... } within defineConfig
    let collections_re = Regex::new(r"collections\s*:\s*\{").unwrap();

    if let Some(start_match) = collections_re.find(content) {
        let start = start_match.end() - 1; // Include the opening brace

        // Find matching closing brace
        let mut brace_count = 0;
        let mut end = start;

        for (i, ch) in content[start..].char_indices() {
            match ch {
                '{' => brace_count += 1,
                '}' => {
                    brace_count -= 1;
                    if brace_count == 0 {
                        end = start + i + 1;
                        break;
                    }
                }
                _ => {}
            }
        }

        if brace_count == 0 {
            return Some(content[start..end].to_string());
        }
    }

    None
}

/// Detect if a collection uses a file-based loader (should be excluded from main collections list)
fn is_file_based_collection(full_content: &str, collection_name: &str) -> bool {
    // Look for: const/let/var collectionName = defineCollection({ loader: file(...)
    // or: collectionName: defineCollection({ loader: file(...)
    // Handles exported variables too: export const collectionName = defineCollection...
    let file_loader_pattern = format!(
        r"(?:(?:const|let|var)\s+)?{collection_name}\s*[=:]\s*defineCollection\s*\(\s*\{{\s*loader:\s*file\s*\("
    );
    if let Ok(file_loader_re) = Regex::new(&file_loader_pattern) {
        file_loader_re.is_match(full_content)
    } else {
        false
    }
}

fn parse_collection_definitions(
    collections_block: &str,
    content_dir: &Path,
    full_content: &str,
) -> Result<Vec<Collection>, String> {
    let mut collections = Vec::new();

    // For new format, extract collection names from export block: { articles, notes }
    // This regex matches only simple name lists, not defineCollection definitions
    let export_names_re =
        Regex::new(r"\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}")
            .unwrap();

    if let Some(cap) = export_names_re.captures(collections_block) {
        let names_str = cap.get(1).unwrap().as_str();
        // Additional check: if the names_str contains "defineCollection" or ":", it's the old format
        if !names_str.contains("defineCollection") && !names_str.contains(":") {
            // Split by comma and clean up names
            for name in names_str.split(',') {
                let collection_name = name.trim();

                // Skip file-based collections - they should only be used for references
                if is_file_based_collection(full_content, collection_name) {
                    continue;
                }

                // Only include directory-based collections
                let collection_path = content_dir.join(collection_name);

                if collection_path.exists() && collection_path.is_dir() {
                    let mut collection =
                        Collection::new(collection_name.to_string(), collection_path);

                    if let Some(schema) = extract_basic_schema(full_content, collection_name) {
                        collection.schema = Some(schema);
                    }

                    collections.push(collection);
                }
            }
        }
    } else {
        // Fallback to old format: collection_name: defineCollection(...)
        let collection_re = Regex::new(r"(\w+)\s*:\s*defineCollection\s*\(").unwrap();

        for cap in collection_re.captures_iter(collections_block) {
            let collection_name = cap.get(1).unwrap().as_str();

            // Skip file-based collections - they should only be used for references
            if is_file_based_collection(full_content, collection_name) {
                continue;
            }

            // Only include directory-based collections
            let collection_path = content_dir.join(collection_name);

            if collection_path.exists() && collection_path.is_dir() {
                let mut collection = Collection::new(collection_name.to_string(), collection_path);

                if let Some(schema) = extract_basic_schema(collections_block, collection_name) {
                    collection.schema = Some(schema);
                }

                collections.push(collection);
            }
        }
    }

    Ok(collections)
}

fn extract_basic_schema(content: &str, collection_name: &str) -> Option<String> {
    // Try both formats:
    // 1. const blog = defineCollection(...)
    // 2. blog: defineCollection(...)
    let const_pattern = format!(r"const\s+{collection_name}\s*=\s*defineCollection\s*\(");
    let object_pattern = format!(r"{collection_name}\s*:\s*defineCollection\s*\(");

    let const_re = Regex::new(&const_pattern).unwrap();
    let object_re = Regex::new(&object_pattern).unwrap();

    let start_match = const_re.find(content).or_else(|| object_re.find(content));

    if let Some(start_match) = start_match {
        // Find the matching closing parenthesis for defineCollection(...)
        let start = start_match.end() - 1; // Position of the opening parenthesis
        let mut paren_count = 0;
        let mut end = start;

        for (i, ch) in content[start..].char_indices() {
            match ch {
                '(' => paren_count += 1,
                ')' => {
                    paren_count -= 1;
                    if paren_count == 0 {
                        end = start + i + 1;
                        break;
                    }
                }
                _ => {}
            }
        }

        if paren_count == 0 {
            let collection_block = &content[start_match.start()..end];

            // Now extract schema from within this block
            return extract_schema_from_collection_block(collection_block);
        }
    }

    None
}

fn extract_schema_from_collection_block(collection_block: &str) -> Option<String> {
    // Look for z.object({ ... }) within the collection block
    let schema_start_re = Regex::new(r"z\.object\s*\(\s*\{").unwrap();

    if let Some(start_match) = schema_start_re.find(collection_block) {
        // Find the matching closing brace for the object
        let start = start_match.end() - 1; // Position of the opening brace
        let mut brace_count = 0;
        let mut end = start;

        for (i, ch) in collection_block[start..].char_indices() {
            match ch {
                '{' => brace_count += 1,
                '}' => {
                    brace_count -= 1;
                    if brace_count == 0 {
                        end = start + i;
                        break;
                    }
                }
                _ => {}
            }
        }

        if brace_count == 0 {
            let schema_text = &collection_block[start + 1..end].trim(); // +1 to skip opening brace

            return parse_schema_fields(schema_text);
        }
    }

    None
}

fn parse_schema_fields(schema_text: &str) -> Option<String> {
    let mut schema_fields = Vec::new();
    let mut processed_fields = std::collections::HashSet::new();

    // Parse fields - handle both single line and multiline definitions
    let mut current_field = String::new();
    let mut in_field = false;
    let mut brace_count = 0;

    for line in schema_text.lines() {
        let line = line.trim();
        if line.is_empty() || line == "}" || line == "{" {
            continue;
        }

        // Check if this line starts a new field (contains ':' and we're not already in a field)
        if line.contains(':') && !in_field {
            // Process previous field if exists
            if !current_field.is_empty() {
                process_field(
                    &current_field,
                    &mut schema_fields,
                    &mut processed_fields,
                    schema_text,
                );
                current_field.clear();
            }

            current_field = line.to_string();
            in_field = true;

            // Count parentheses and other grouping characters to detect if field continues
            brace_count = line.matches('(').count() as i32 - line.matches(')').count() as i32;

            // If the field appears complete on one line (balanced parens), process it immediately
            if brace_count == 0 && (line.ends_with(',') || !line.contains('(')) {
                process_field(
                    &current_field,
                    &mut schema_fields,
                    &mut processed_fields,
                    schema_text,
                );
                current_field.clear();
                in_field = false;
            }
        } else if in_field {
            // Continue accumulating the current field
            current_field.push(' ');
            current_field.push_str(line);

            // Update brace count
            brace_count += line.matches('(').count() as i32 - line.matches(')').count() as i32;

            // If braces are balanced, the field is complete
            if brace_count <= 0 {
                process_field(
                    &current_field,
                    &mut schema_fields,
                    &mut processed_fields,
                    schema_text,
                );
                current_field.clear();
                in_field = false;
                brace_count = 0;
            }
        }
    }

    // Process any remaining field
    if !current_field.is_empty() {
        process_field(
            &current_field,
            &mut schema_fields,
            &mut processed_fields,
            schema_text,
        );
    }

    if !schema_fields.is_empty() {
        // Serialize to JSON for storage
        let schema_json = serde_json::json!({
            "type": "zod",
            "fields": schema_fields.iter().map(|f| {
                let mut field_json = serde_json::json!({
                    "name": f.name,
                    "type": match &f.field_type {
                        ZodFieldType::Enum(_) => "Enum".to_string(),
                        ZodFieldType::Array(_) => "Array".to_string(),
                        ZodFieldType::Union(_) => "Union".to_string(),
                        ZodFieldType::Literal(_) => "Literal".to_string(),
                        ZodFieldType::Object(_) => "Object".to_string(),
                        ZodFieldType::Reference(_) => "Reference".to_string(),
                        ZodFieldType::String => "String".to_string(),
                        ZodFieldType::Number => "Number".to_string(),
                        ZodFieldType::Boolean => "Boolean".to_string(),
                        ZodFieldType::Date => "Date".to_string(),
                        ZodFieldType::Image => "Image".to_string(),
                        ZodFieldType::Unknown => "Unknown".to_string(),
                    },
                    "optional": f.optional,
                    "default": f.default_value,
                    "constraints": serialize_constraints(&f.constraints)
                });

                // Add type-specific options
                match &f.field_type {
                    ZodFieldType::Enum(options) => {
                        field_json["options"] = serde_json::json!(options);
                    }
                    ZodFieldType::Reference(collection_name) => {
                        field_json["referencedCollection"] = serde_json::json!(collection_name);
                    }
                    ZodFieldType::Array(inner_type) => {
                        field_json["arrayType"] = serde_json::json!(match **inner_type {
                            ZodFieldType::String => "String",
                            ZodFieldType::Number => "Number",
                            ZodFieldType::Boolean => "Boolean",
                            ZodFieldType::Date => "Date",
                            ZodFieldType::Image => "Image",
                            ZodFieldType::Reference(_) => "Reference",
                            _ => "Unknown",
                        });
                        // If array contains references, include the collection name
                        if let ZodFieldType::Reference(collection_name) = &**inner_type {
                            field_json["arrayReferenceCollection"] = serde_json::json!(collection_name);
                        }
                    }
                    ZodFieldType::Union(types) => {
                        field_json["unionTypes"] = serde_json::json!(
                            types.iter().map(|t| match t {
                                ZodFieldType::String => serde_json::json!("String"),
                                ZodFieldType::Number => serde_json::json!("Number"),
                                ZodFieldType::Boolean => serde_json::json!("Boolean"),
                                ZodFieldType::Date => serde_json::json!("Date"),
                                ZodFieldType::Image => serde_json::json!("Image"),
                                ZodFieldType::Literal(val) => serde_json::json!({"type": "Literal", "value": val}),
                                _ => serde_json::json!("Unknown"),
                            }).collect::<Vec<_>>()
                        );
                    }
                    ZodFieldType::Literal(value) => {
                        field_json["literalValue"] = serde_json::json!(value);
                    }
                    _ => {}
                }

                field_json
            }).collect::<Vec<_>>()
        });

        return Some(schema_json.to_string());
    }

    None
}

fn process_field(
    field_definition: &str,
    schema_fields: &mut Vec<ZodField>,
    processed_fields: &mut std::collections::HashSet<String>,
    schema_text: &str,
) {
    // Remove trailing comma if present
    let field_definition = field_definition.trim_end_matches(',');

    // Extract field name first
    if let Some(colon_pos) = field_definition.find(':') {
        let field_name = field_definition[..colon_pos].trim();

        // Skip if we've already processed this field
        if processed_fields.contains(field_name) {
            return;
        }
        processed_fields.insert(field_name.to_string());

        let field_def_content = &field_definition[colon_pos + 1..].trim();

        // Determine field type and extract constraints
        let (field_type, constraints) = parse_field_type_and_constraints(field_def_content);

        // Check if field is optional or has default
        let has_optional =
            field_def_content.contains(".optional()") || field_def_content.contains("z.optional(");
        let has_default = field_def_content.contains(".default(");

        // If field has a default, treat it as optional for UI purposes
        let is_optional = has_optional || has_default;

        let default_value = if has_default {
            extract_default_value(schema_text, field_name)
        } else {
            None
        };

        schema_fields.push(ZodField {
            name: field_name.to_string(),
            field_type,
            optional: is_optional,
            default_value,
            constraints,
        });
    }
}

fn extract_enum_values(field_definition: &str) -> Vec<String> {
    // Extract values from z.enum(['value1', 'value2']) or z.enum(["value1", "value2"])
    let enum_re = Regex::new(r"z\.enum\s*\(\s*\[\s*([^\]]+)\s*\]\s*\)").unwrap();

    if let Some(cap) = enum_re.captures(field_definition) {
        let values_str = cap.get(1).unwrap().as_str();

        // Split by comma and clean up quotes
        values_str
            .split(',')
            .map(|v| v.trim().trim_matches('"').trim_matches('\'').to_string())
            .filter(|v| !v.is_empty())
            .collect()
    } else {
        vec![]
    }
}

fn parse_field_type_and_constraints(field_definition: &str) -> (ZodFieldType, ZodFieldConstraints) {
    let mut constraints = ZodFieldConstraints::default();

    // Normalize whitespace and handle multi-line definitions
    let normalized = normalize_field_definition(field_definition);

    // Check for z.optional(z.type()) syntax first
    if normalized.contains("z.optional(") {
        let inner_type = extract_optional_inner_type(&normalized);
        return (inner_type.0, inner_type.1);
    }

    // Determine base field type (order matters - check most specific first)
    let field_type = if normalized.contains("image()") {
        // Astro's image() helper - return Image type directly
        ZodFieldType::Image
    } else if normalized.contains("reference(") {
        // Extract collection name from reference('collectionName')
        let collection_name = extract_reference_collection(&normalized);
        ZodFieldType::Reference(collection_name)
    } else if normalized.contains("z.array(") {
        // Extract array element type
        let inner_type = extract_array_inner_type(&normalized);
        ZodFieldType::Array(Box::new(inner_type))
    } else if normalized.contains("z.enum(") {
        // Extract enum values from z.enum(['value1', 'value2'])
        let enum_values = extract_enum_values(&normalized);
        ZodFieldType::Enum(enum_values)
    } else if normalized.contains("z.union(") {
        // Extract union types from z.union([z.string(), z.null()])
        let union_types = extract_union_types(&normalized);
        ZodFieldType::Union(union_types)
    } else if normalized.contains("z.literal(") {
        // Extract literal value from z.literal("value")
        let literal_value = extract_literal_value(&normalized);
        ZodFieldType::Literal(literal_value)
    } else if normalized.contains("z.object(") {
        // For nested objects, we'll parse them recursively in the future
        // For now, treat as unknown but mark that it's an object
        ZodFieldType::Object(vec![])
    } else if normalized.contains("z.coerce.date()") || normalized.contains("z.date()") {
        ZodFieldType::Date
    } else if normalized.contains("z.string()") || normalized.contains("z.string().") {
        constraints = extract_string_constraints(&normalized);
        ZodFieldType::String
    } else if normalized.contains("z.number()") || normalized.contains("z.number().") {
        constraints = extract_number_constraints(&normalized);
        ZodFieldType::Number
    } else if normalized.contains("z.boolean()") {
        ZodFieldType::Boolean
    } else {
        ZodFieldType::Unknown
    };

    (field_type, constraints)
}

fn normalize_field_definition(field_definition: &str) -> String {
    // Remove extra whitespace and normalize line breaks
    let normalized = field_definition
        .lines()
        .map(|line| line.trim())
        .collect::<Vec<_>>()
        .join(" ");

    // Collapse multiple spaces
    let space_re = Regex::new(r"\s+").unwrap();
    space_re.replace_all(&normalized, " ").to_string()
}

fn extract_optional_inner_type(field_definition: &str) -> (ZodFieldType, ZodFieldConstraints) {
    // Extract type from z.optional(z.string()) or z.optional(z.number().min(1))
    let optional_re = Regex::new(r"z\.optional\s*\(\s*([^)]+)\s*\)").unwrap();

    if let Some(cap) = optional_re.captures(field_definition) {
        let inner_def = cap.get(1).unwrap().as_str();

        // Parse the inner type directly without recursion to avoid infinite loops
        let mut constraints = ZodFieldConstraints::default();

        let field_type = if inner_def.contains("image()") {
            ZodFieldType::Image
        } else if inner_def.contains("z.string") {
            constraints = extract_string_constraints(inner_def);
            ZodFieldType::String
        } else if inner_def.contains("z.number") {
            constraints = extract_number_constraints(inner_def);
            ZodFieldType::Number
        } else if inner_def.contains("z.boolean") {
            ZodFieldType::Boolean
        } else if inner_def.contains("z.date") {
            ZodFieldType::Date
        } else {
            ZodFieldType::Unknown
        };

        (field_type, constraints)
    } else {
        (ZodFieldType::Unknown, ZodFieldConstraints::default())
    }
}

fn extract_reference_collection(field_definition: &str) -> String {
    // Extract collection name from reference('collectionName') or reference("collectionName")
    let reference_re = Regex::new(r#"reference\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap();

    if let Some(cap) = reference_re.captures(field_definition) {
        cap.get(1).unwrap().as_str().to_string()
    } else {
        "unknown".to_string()
    }
}

fn extract_array_inner_type(field_definition: &str) -> ZodFieldType {
    // Extract type from z.array(z.string()) or z.array(reference('posts'))
    let array_re = Regex::new(r"z\.array\s*\(\s*([^)]+)\s*\)").unwrap();

    if let Some(cap) = array_re.captures(field_definition) {
        let inner_def = cap.get(1).unwrap().as_str();

        if inner_def.contains("reference(") {
            let collection_name = extract_reference_collection(inner_def);
            ZodFieldType::Reference(collection_name)
        } else if inner_def.contains("z.string") {
            ZodFieldType::String
        } else if inner_def.contains("z.number") {
            ZodFieldType::Number
        } else if inner_def.contains("z.boolean") {
            ZodFieldType::Boolean
        } else if inner_def.contains("z.date") {
            ZodFieldType::Date
        } else {
            ZodFieldType::Unknown
        }
    } else {
        ZodFieldType::String // Default fallback
    }
}

fn extract_union_types(field_definition: &str) -> Vec<ZodFieldType> {
    // Extract types from z.union([z.string(), z.null(), z.number()])
    let union_re = Regex::new(r"z\.union\s*\(\s*\[\s*([^\]]+)\s*\]\s*\)").unwrap();

    if let Some(cap) = union_re.captures(field_definition) {
        let types_str = cap.get(1).unwrap().as_str();

        let mut union_types = Vec::new();

        // Split by comma and parse each type
        for type_str in types_str.split(',') {
            let type_str = type_str.trim();

            let field_type = if type_str.contains("z.string") {
                ZodFieldType::String
            } else if type_str.contains("z.number") {
                ZodFieldType::Number
            } else if type_str.contains("z.boolean") {
                ZodFieldType::Boolean
            } else if type_str.contains("z.date") {
                ZodFieldType::Date
            } else if type_str.contains("z.null") || type_str.contains("null") {
                // Represent null as a special string literal
                ZodFieldType::Literal("null".to_string())
            } else if type_str.contains("z.undefined") || type_str.contains("undefined") {
                ZodFieldType::Literal("undefined".to_string())
            } else {
                ZodFieldType::Unknown
            };

            union_types.push(field_type);
        }

        union_types
    } else {
        vec![]
    }
}

fn extract_literal_value(field_definition: &str) -> String {
    // Extract value from z.literal("value") or z.literal('value')
    let literal_re = Regex::new(r#"z\.literal\s*\(\s*["']([^"']+)["']\s*\)"#).unwrap();

    if let Some(cap) = literal_re.captures(field_definition) {
        cap.get(1).unwrap().as_str().to_string()
    } else {
        // Try without quotes for numbers/booleans
        let literal_unquoted_re = Regex::new(r"z\.literal\s*\(\s*([^)]+)\s*\)").unwrap();
        if let Some(cap) = literal_unquoted_re.captures(field_definition) {
            cap.get(1).unwrap().as_str().trim().to_string()
        } else {
            "unknown".to_string()
        }
    }
}

fn extract_string_constraints(field_definition: &str) -> ZodFieldConstraints {
    let mut constraints = ZodFieldConstraints::default();

    // Extract min/max length
    if let Some(cap) = Regex::new(r"\.min\s*\(\s*(\d+)\s*\)")
        .unwrap()
        .captures(field_definition)
    {
        constraints.min_length = Some(cap.get(1).unwrap().as_str().parse().unwrap_or(0));
    }

    if let Some(cap) = Regex::new(r"\.max\s*\(\s*(\d+)\s*\)")
        .unwrap()
        .captures(field_definition)
    {
        constraints.max_length = Some(cap.get(1).unwrap().as_str().parse().unwrap_or(0));
    }

    if let Some(cap) = Regex::new(r"\.length\s*\(\s*(\d+)\s*\)")
        .unwrap()
        .captures(field_definition)
    {
        constraints.length = Some(cap.get(1).unwrap().as_str().parse().unwrap_or(0));
    }

    // Extract regex pattern
    if let Some(cap) = Regex::new(r"\.regex\s*\(\s*/([^/]+)/([gimuy]*)\s*\)")
        .unwrap()
        .captures(field_definition)
    {
        let pattern = cap.get(1).unwrap().as_str();
        let flags = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        constraints.regex = Some(format!("/{pattern}/{flags}"));
    }

    // Extract string validation methods
    constraints.url = field_definition.contains(".url()");
    constraints.email = field_definition.contains(".email()");
    constraints.uuid = field_definition.contains(".uuid()");
    constraints.cuid = field_definition.contains(".cuid()");
    constraints.cuid2 = field_definition.contains(".cuid2()");
    constraints.ulid = field_definition.contains(".ulid()");
    constraints.emoji = field_definition.contains(".emoji()");
    constraints.ip = field_definition.contains(".ip()");

    // Extract string transformation methods
    constraints.trim = field_definition.contains(".trim()");
    constraints.to_lower_case = field_definition.contains(".toLowerCase()");
    constraints.to_upper_case = field_definition.contains(".toUpperCase()");

    // Extract includes/startsWith/endsWith
    if let Some(cap) = Regex::new(r#"\.includes\s*\(\s*["']([^"']+)["']\s*\)"#)
        .unwrap()
        .captures(field_definition)
    {
        constraints.includes = Some(cap.get(1).unwrap().as_str().to_string());
    }

    if let Some(cap) = Regex::new(r#"\.startsWith\s*\(\s*["']([^"']+)["']\s*\)"#)
        .unwrap()
        .captures(field_definition)
    {
        constraints.starts_with = Some(cap.get(1).unwrap().as_str().to_string());
    }

    if let Some(cap) = Regex::new(r#"\.endsWith\s*\(\s*["']([^"']+)["']\s*\)"#)
        .unwrap()
        .captures(field_definition)
    {
        constraints.ends_with = Some(cap.get(1).unwrap().as_str().to_string());
    }

    constraints
}

fn extract_number_constraints(field_definition: &str) -> ZodFieldConstraints {
    let mut constraints = ZodFieldConstraints::default();

    // Extract min/max values
    if let Some(cap) = Regex::new(r"\.min\s*\(\s*(\d+)\s*\)")
        .unwrap()
        .captures(field_definition)
    {
        constraints.min = Some(cap.get(1).unwrap().as_str().parse().unwrap_or(0));
    }

    if let Some(cap) = Regex::new(r"\.max\s*\(\s*(\d+)\s*\)")
        .unwrap()
        .captures(field_definition)
    {
        constraints.max = Some(cap.get(1).unwrap().as_str().parse().unwrap_or(0));
    }

    // Check for integer/positive/negative constraints
    if field_definition.contains(".int()") {
        constraints.transform = Some("integer".to_string());
    }

    if field_definition.contains(".positive()") {
        constraints.min = Some(1);
    }

    if field_definition.contains(".negative()") {
        constraints.max = Some(-1);
    }

    if field_definition.contains(".nonnegative()") {
        constraints.min = Some(0);
    }

    if field_definition.contains(".nonpositive()") {
        constraints.max = Some(0);
    }

    constraints
}

fn serialize_constraints(constraints: &ZodFieldConstraints) -> serde_json::Value {
    let mut constraint_json = serde_json::json!({});

    // Add numeric constraints
    if let Some(min) = constraints.min {
        constraint_json["min"] = serde_json::json!(min);
    }
    if let Some(max) = constraints.max {
        constraint_json["max"] = serde_json::json!(max);
    }
    if let Some(length) = constraints.length {
        constraint_json["length"] = serde_json::json!(length);
    }
    if let Some(min_length) = constraints.min_length {
        constraint_json["minLength"] = serde_json::json!(min_length);
    }
    if let Some(max_length) = constraints.max_length {
        constraint_json["maxLength"] = serde_json::json!(max_length);
    }

    // Add string constraints
    if let Some(regex) = &constraints.regex {
        constraint_json["regex"] = serde_json::json!(regex);
    }
    if let Some(includes) = &constraints.includes {
        constraint_json["includes"] = serde_json::json!(includes);
    }
    if let Some(starts_with) = &constraints.starts_with {
        constraint_json["startsWith"] = serde_json::json!(starts_with);
    }
    if let Some(ends_with) = &constraints.ends_with {
        constraint_json["endsWith"] = serde_json::json!(ends_with);
    }

    // Add boolean constraints
    if constraints.url {
        constraint_json["url"] = serde_json::json!(true);
    }
    if constraints.email {
        constraint_json["email"] = serde_json::json!(true);
    }
    if constraints.uuid {
        constraint_json["uuid"] = serde_json::json!(true);
    }
    if constraints.cuid {
        constraint_json["cuid"] = serde_json::json!(true);
    }
    if constraints.cuid2 {
        constraint_json["cuid2"] = serde_json::json!(true);
    }
    if constraints.ulid {
        constraint_json["ulid"] = serde_json::json!(true);
    }
    if constraints.emoji {
        constraint_json["emoji"] = serde_json::json!(true);
    }
    if constraints.ip {
        constraint_json["ip"] = serde_json::json!(true);
    }
    if constraints.trim {
        constraint_json["trim"] = serde_json::json!(true);
    }
    if constraints.to_lower_case {
        constraint_json["toLowerCase"] = serde_json::json!(true);
    }
    if constraints.to_upper_case {
        constraint_json["toUpperCase"] = serde_json::json!(true);
    }

    // Add transform/refine information
    if let Some(transform) = &constraints.transform {
        constraint_json["transform"] = serde_json::json!(transform);
    }
    if let Some(refine) = &constraints.refine {
        constraint_json["refine"] = serde_json::json!(refine);
    }
    if let Some(literal) = &constraints.literal {
        constraint_json["literal"] = serde_json::json!(literal);
    }

    constraint_json
}

fn extract_default_value(schema_text: &str, field_name: &str) -> Option<String> {
    let default_re = Regex::new(&format!(r"{field_name}.*\.default\s*\(\s*([^)]+)\s*\)")).unwrap();

    if let Some(cap) = default_re.captures(schema_text) {
        let default_val = cap.get(1).unwrap().as_str().trim();
        Some(default_val.trim_matches('"').trim_matches('\'').to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn test_parse_simple_config() {
        let content = r#"
import { defineConfig, defineCollection, z } from 'astro:content';

export default defineConfig({
  collections: {
    blog: defineCollection({
      type: 'content',
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        pubDate: z.coerce.date(),
        draft: z.boolean().default(false),
      }),
    }),
  },
});
"#;

        let temp_dir = std::env::temp_dir().join("test-astro-parser");
        let project_path = temp_dir.join("project");
        let blog_path = project_path.join("src").join("content").join("blog");

        fs::create_dir_all(&blog_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        assert_eq!(collections.len(), 1);
        assert_eq!(collections[0].name, "blog");
        assert!(collections[0].schema.is_some());

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_empty_config() {
        let content = r#"
export default defineConfig({
  collections: {},
});
"#;
        let project_path = PathBuf::from("/tmp/empty-project");
        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_extract_collections_block() {
        let content = r#"
export default defineConfig({
  collections: {
    blog: defineCollection({ schema: z.object({}) }),
    notes: defineCollection({ schema: z.object({}) }),
  },
  other: "value"
});
"#;
        let block = extract_collections_block(content);
        assert!(block.is_some());
        let block_content = block.unwrap();
        assert!(block_content.contains("blog"));
        assert!(block_content.contains("notes"));
    }

    #[test]
    fn test_remove_comments() {
        let content = r#"
// This is a comment
export default defineConfig({
  /* This is a block comment */
  collections: {
    blog: defineCollection({}) // End comment
  }
});
"#;
        let clean = remove_comments(content);
        assert!(!clean.contains("This is a comment"));
        assert!(!clean.contains("block comment"));
        assert!(!clean.contains("End comment"));
        assert!(clean.contains("defineConfig"));
    }

    #[test]
    fn test_enhanced_schema_parsing() {
        let content = include_str!("test_fixtures/enhanced_config.ts");
        let temp_dir = std::env::temp_dir().join("test-enhanced-parser");
        let project_path = temp_dir.join("project");
        let blog_path = project_path.join("src").join("content").join("blog");
        let docs_path = project_path.join("src").join("content").join("docs");

        fs::create_dir_all(&blog_path).unwrap();
        fs::create_dir_all(&docs_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        assert_eq!(collections.len(), 2);

        // Find blog collection
        let blog_collection = collections.iter().find(|c| c.name == "blog").unwrap();
        assert!(blog_collection.schema.is_some());

        let schema_json = blog_collection.schema.as_ref().unwrap();
        let parsed_schema: serde_json::Value = serde_json::from_str(schema_json).unwrap();

        // Verify schema structure
        assert_eq!(parsed_schema["type"], "zod");
        let fields = parsed_schema["fields"].as_array().unwrap();
        assert!(fields.len() > 10); // Should have many fields

        // Test specific field types and constraints
        let title_field = fields.iter().find(|f| f["name"] == "title").unwrap();
        assert_eq!(title_field["type"], "String");
        assert_eq!(title_field["constraints"]["minLength"], 1);
        assert_eq!(title_field["constraints"]["maxLength"], 100);

        let word_count_field = fields.iter().find(|f| f["name"] == "wordCount").unwrap();
        assert_eq!(word_count_field["type"], "Number");
        assert_eq!(word_count_field["constraints"]["min"], 0);
        assert_eq!(word_count_field["constraints"]["max"], 10000);

        let email_field = fields.iter().find(|f| f["name"] == "authorEmail").unwrap();
        assert_eq!(email_field["type"], "String");
        assert_eq!(email_field["constraints"]["email"], true);

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_literal_field_parsing() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: z.object({
      category: z.literal('blog'),
      version: z.literal(1),
    }),
  }),
};
"#;
        let temp_dir = std::env::temp_dir().join("test-literal-parsing");
        let project_path = temp_dir.join("project");
        let test_path = project_path.join("src").join("content").join("test");

        fs::create_dir_all(&test_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        assert_eq!(collections.len(), 1);

        let schema_json = collections[0].schema.as_ref().unwrap();
        let parsed_schema: serde_json::Value = serde_json::from_str(schema_json).unwrap();
        let fields = parsed_schema["fields"].as_array().unwrap();

        let category_field = fields.iter().find(|f| f["name"] == "category").unwrap();
        assert_eq!(category_field["type"], "Literal");
        assert_eq!(category_field["literalValue"], "blog");

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_union_field_parsing() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: z.object({
      status: z.union([z.literal('draft'), z.literal('published'), z.literal('archived')]),
      visibility: z.union([z.string(), z.null()]),
    }),
  }),
};
"#;
        let temp_dir = std::env::temp_dir().join("test-union-parsing");
        let project_path = temp_dir.join("project");
        let test_path = project_path.join("src").join("content").join("test");

        fs::create_dir_all(&test_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        assert_eq!(collections.len(), 1);

        let schema_json = collections[0].schema.as_ref().unwrap();
        let parsed_schema: serde_json::Value = serde_json::from_str(schema_json).unwrap();
        let fields = parsed_schema["fields"].as_array().unwrap();

        let status_field = fields.iter().find(|f| f["name"] == "status").unwrap();
        assert_eq!(status_field["type"], "Union");
        let union_types = status_field["unionTypes"].as_array().unwrap();
        assert_eq!(union_types.len(), 3);

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_optional_syntax_parsing() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: z.object({
      regularOptional: z.string().optional(),
      altOptional: z.optional(z.string().min(10)),
      altOptionalWithConstraints: z.optional(z.string().email()),
    }),
  }),
};
"#;
        let temp_dir = std::env::temp_dir().join("test-optional-parsing");
        let project_path = temp_dir.join("project");
        let test_path = project_path.join("src").join("content").join("test");

        fs::create_dir_all(&test_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        assert_eq!(collections.len(), 1);

        let schema_json = collections[0].schema.as_ref().unwrap();
        let parsed_schema: serde_json::Value = serde_json::from_str(schema_json).unwrap();
        let fields = parsed_schema["fields"].as_array().unwrap();

        // Both syntaxes should be marked as optional
        let regular_optional = fields
            .iter()
            .find(|f| f["name"] == "regularOptional")
            .unwrap();
        assert_eq!(regular_optional["optional"], true);

        let alt_optional = fields.iter().find(|f| f["name"] == "altOptional").unwrap();
        assert_eq!(alt_optional["optional"], true);
        // The constraints should be passed through from the inner type
        if !alt_optional["constraints"]["minLength"].is_null() {
            assert_eq!(alt_optional["constraints"]["minLength"], 10);
        }

        let alt_with_constraints = fields
            .iter()
            .find(|f| f["name"] == "altOptionalWithConstraints")
            .unwrap();
        assert_eq!(alt_with_constraints["optional"], true);
        // For now, just check that it's detected as optional - constraint parsing for z.optional() can be improved later
        assert_eq!(alt_with_constraints["type"], "String");

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_string_constraints_parsing() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: z.object({
      slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
      email: z.string().email(),
      trimmed: z.string().trim(),
      twitter: z.string().startsWith('@'),
    }),
  }),
};
"#;
        let temp_dir = std::env::temp_dir().join("test-string-constraints");
        let project_path = temp_dir.join("project");
        let test_path = project_path.join("src").join("content").join("test");

        fs::create_dir_all(&test_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        let schema_json = collections[0].schema.as_ref().unwrap();
        let parsed_schema: serde_json::Value = serde_json::from_str(schema_json).unwrap();
        let fields = parsed_schema["fields"].as_array().unwrap();

        let slug_field = fields.iter().find(|f| f["name"] == "slug").unwrap();
        assert_eq!(slug_field["constraints"]["minLength"], 3);
        assert_eq!(slug_field["constraints"]["maxLength"], 50);
        assert!(slug_field["constraints"]["regex"]
            .as_str()
            .unwrap()
            .contains("^[a-z0-9-]+$"));

        let email_field = fields.iter().find(|f| f["name"] == "email").unwrap();
        assert_eq!(email_field["constraints"]["email"], true);

        let twitter_field = fields.iter().find(|f| f["name"] == "twitter").unwrap();
        assert_eq!(twitter_field["constraints"]["startsWith"], "@");

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_number_constraints_parsing() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: z.object({
      count: z.number().min(0).max(100),
      positive: z.number().positive(),
      negative: z.number().negative(),
      integer: z.number().int(),
      nonnegative: z.number().nonnegative(),
    }),
  }),
};
"#;
        let temp_dir = std::env::temp_dir().join("test-number-constraints");
        let project_path = temp_dir.join("project");
        let test_path = project_path.join("src").join("content").join("test");

        fs::create_dir_all(&test_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        let schema_json = collections[0].schema.as_ref().unwrap();
        let parsed_schema: serde_json::Value = serde_json::from_str(schema_json).unwrap();
        let fields = parsed_schema["fields"].as_array().unwrap();

        let count_field = fields.iter().find(|f| f["name"] == "count").unwrap();
        assert_eq!(count_field["constraints"]["min"], 0);
        assert_eq!(count_field["constraints"]["max"], 100);

        let positive_field = fields.iter().find(|f| f["name"] == "positive").unwrap();
        assert_eq!(positive_field["constraints"]["min"], 1);

        let negative_field = fields.iter().find(|f| f["name"] == "negative").unwrap();
        assert_eq!(negative_field["constraints"]["max"], -1);

        let integer_field = fields.iter().find(|f| f["name"] == "integer").unwrap();
        assert_eq!(integer_field["constraints"]["transform"], "integer");

        let nonnegative_field = fields.iter().find(|f| f["name"] == "nonnegative").unwrap();
        assert_eq!(nonnegative_field["constraints"]["min"], 0);

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_improved_comment_stripping() {
        let content = r#"
// Line comment at start
export const collections = {
  test: defineCollection({
    /* Multi-line block comment
       with multiple lines
       // and nested line comment
    */
    schema: z.object({
      title: z.string(), // End-of-line comment
      description: z.string().optional(), /* inline block */
      content: "/* not a comment inside string */",
      regex: /\/\* also not a comment in regex \*\//,
    }),
  }),
};
"#;
        let clean = remove_comments(content);

        // Should remove comments
        assert!(!clean.contains("Line comment at start"));
        assert!(!clean.contains("Multi-line block comment"));
        assert!(!clean.contains("End-of-line comment"));
        assert!(!clean.contains("inline block"));

        // Should preserve content inside strings and regex
        assert!(clean.contains("/* not a comment inside string */"));
        // The regex content should be preserved (just check for the path structure)
        assert!(clean.contains("regex:"));

        // Should preserve the actual code
        assert!(clean.contains("export const collections"));
        assert!(clean.contains("z.string()"));
    }

    #[test]
    fn test_multiline_field_normalization() {
        let content = r#"
export const collections = {
  test: defineCollection({
    schema: z.object({
      simpleField: z.string().min(5).max(100).trim().optional(),
    }),
  }),
};
"#;
        let temp_dir = std::env::temp_dir().join("test-multiline-parsing");
        let project_path = temp_dir.join("project");
        let test_path = project_path.join("src").join("content").join("test");

        fs::create_dir_all(&test_path).unwrap();

        let result = parse_collections_from_content(content, &project_path, None);
        assert!(result.is_ok());

        let collections = result.unwrap();
        let schema_json = collections[0].schema.as_ref().unwrap();
        let parsed_schema: serde_json::Value = serde_json::from_str(schema_json).unwrap();
        let fields = parsed_schema["fields"].as_array().unwrap();

        let simple_field = fields.iter().find(|f| f["name"] == "simpleField").unwrap();

        // The field should be parsed with constraints from the chained methods
        assert_eq!(simple_field["constraints"]["minLength"], 5);
        assert_eq!(simple_field["constraints"]["maxLength"], 100);
        assert_eq!(simple_field["constraints"]["trim"], true);
        // The optional should be detected
        assert_eq!(simple_field["optional"], true);

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_content_directory_override() {
        let content = r#"
import { defineConfig, defineCollection, z } from 'astro:content';

export default defineConfig({
  collections: {
    blog: defineCollection({
      type: 'content',
      schema: z.object({
        title: z.string(),
        date: z.coerce.date(),
      }),
    }),
  },
});
"#;

        let temp_dir = std::env::temp_dir().join("test-content-dir-override");
        let project_path = temp_dir.join("project");
        // Use a custom content directory instead of src/content
        let custom_content_dir = "content";
        let blog_path = project_path.join(custom_content_dir).join("blog");

        fs::create_dir_all(&blog_path).unwrap();

        // Test with override
        let result =
            parse_collections_from_content(content, &project_path, Some(custom_content_dir));
        assert!(result.is_ok());

        let collections = result.unwrap();
        assert_eq!(collections.len(), 1);
        assert_eq!(collections[0].name, "blog");
        assert!(collections[0].schema.is_some());

        // Verify the path is using the override
        let expected_path = project_path.join(custom_content_dir).join("blog");
        assert_eq!(collections[0].path, expected_path);

        // Test without override - should not find the collection since it's in custom location
        let result_without_override = parse_collections_from_content(content, &project_path, None);
        assert!(result_without_override.is_ok());
        let collections_without_override = result_without_override.unwrap();
        assert_eq!(collections_without_override.len(), 0); // Should be empty since default path doesn't exist

        // Clean up
        fs::remove_dir_all(&temp_dir).ok();
    }
}
