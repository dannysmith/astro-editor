use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

/// Complete schema definition sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDefinition {
    pub collection_name: String,
    pub fields: Vec<SchemaField>,
}

/// Individual field in the schema
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaField {
    // Identity
    pub name: String,
    pub label: String,

    // Type
    pub field_type: String, // "string", "number", "reference", etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_type: Option<String>, // For arrays

    // Validation
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraints: Option<FieldConstraints>,

    // Metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<Value>,

    // Type-specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enum_values: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_collection: Option<String>, // For reference fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub array_reference_collection: Option<String>, // For array of references

    // Nested objects
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_nested: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_path: Option<String>,
}

/// Field constraints
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldConstraints {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>, // "email", "uri", "date-time", "date"
}

/// Astro JSON Schema structure
#[derive(Debug, Deserialize)]
struct AstroJsonSchema {
    #[serde(rename = "$ref")]
    ref_: String,
    definitions: IndexMap<String, JsonSchemaDefinition>,
}

/// JSON Schema definition
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonSchemaDefinition {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    type_: String,
    #[serde(default)]
    properties: Option<IndexMap<String, JsonSchemaProperty>>,
    #[serde(default)]
    required: Option<Vec<String>>,
    #[serde(default)]
    additional_properties: Option<CollectionAdditionalProperties>,
}

/// Additional properties at collection level (for file-based collections)
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum CollectionAdditionalProperties {
    #[allow(dead_code)]
    Boolean(bool),
    Schema(Box<JsonSchemaDefinition>),
}

/// Additional properties at property level (for dynamic properties)
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum PropertyAdditionalProperties {
    #[allow(dead_code)]
    Boolean(bool),
    #[allow(dead_code)]
    Schema(Box<JsonSchemaProperty>),
}

/// JSON Schema property
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonSchemaProperty {
    #[serde(rename = "type")]
    type_: Option<StringOrArray>,
    #[serde(default)]
    format: Option<String>,
    #[serde(default)]
    any_of: Option<Vec<JsonSchemaProperty>>,
    #[serde(rename = "enum", default)]
    enum_: Option<Vec<String>>,
    #[serde(rename = "const", default)]
    const_: Option<String>,
    #[serde(default)]
    items: Option<Box<ItemsType>>,
    #[serde(default)]
    properties: Option<IndexMap<String, JsonSchemaProperty>>,
    #[serde(default)]
    additional_properties: Option<PropertyAdditionalProperties>,
    #[serde(default)]
    required: Option<Vec<String>>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    markdown_description: Option<String>,
    #[serde(default)]
    default: Option<Value>,
    #[serde(default)]
    minimum: Option<f64>,
    #[serde(default)]
    maximum: Option<f64>,
    #[serde(default)]
    exclusive_minimum: Option<f64>,
    #[serde(default)]
    exclusive_maximum: Option<f64>,
    #[serde(default)]
    min_length: Option<usize>,
    #[serde(default)]
    max_length: Option<usize>,
    #[serde(default)]
    min_items: Option<usize>,
    #[serde(default)]
    max_items: Option<usize>,
    #[serde(default)]
    pattern: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    not: Option<Value>, // Ignored - used for validation, not structure
}

/// Type can be string or array of strings
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum StringOrArray {
    String(String),
    #[allow(dead_code)]
    Array(Vec<String>),
}

/// Array items can be single schema or tuple
#[derive(Debug, Deserialize)]
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
enum ItemsType {
    Single(Box<JsonSchemaProperty>),
    #[allow(dead_code)]
    Tuple(Vec<JsonSchemaProperty>),
}

/// Parse and merge schemas from all sources
pub fn create_complete_schema(
    collection_name: &str,
    json_schema: Option<&str>,
    zod_schema: Option<&str>,
) -> Result<SchemaDefinition, String> {
    log::debug!(
        "[Schema] Creating complete schema for: {} (json: {}, zod: {})",
        collection_name,
        json_schema.is_some(),
        zod_schema.is_some()
    );

    // 1. Try JSON schema first (most accurate for structure)
    if let Some(json) = json_schema {
        match parse_json_schema(collection_name, json) {
            Ok(mut schema) => {
                log::debug!(
                    "[Schema] Successfully parsed JSON schema with {} fields",
                    schema.fields.len()
                );
                // 2. Enhance with Zod information (references and image types)
                if let Some(zod) = zod_schema {
                    if let Err(e) = enhance_schema_from_zod(&mut schema, zod) {
                        log::warn!(
                            "Failed to enhance schema with Zod data for {collection_name}: {e}"
                        );
                    }
                }
                return Ok(schema);
            }
            Err(e) => {
                log::warn!("[Schema] Failed to parse JSON schema: {e}");
            }
        }
    }

    // 3. Fallback to Zod-only parsing
    if let Some(zod) = zod_schema {
        log::debug!("[Schema] Falling back to Zod-only parsing");
        return parse_zod_schema(collection_name, zod);
    }

    log::error!("[Schema] No schema available for collection: {collection_name}");
    Err("No schema available".to_string())
}

/// Parse Astro JSON schema
fn parse_json_schema(collection_name: &str, json_schema: &str) -> Result<SchemaDefinition, String> {
    log::debug!("[Schema] Parsing JSON schema for collection: {collection_name}");

    let schema: AstroJsonSchema =
        serde_json::from_str(json_schema).map_err(|e| format!("Failed to parse JSON: {e}"))?;

    // Extract collection definition
    let collection_name_from_ref = schema.ref_.replace("#/definitions/", "");
    log::debug!("[Schema] Looking for definition: {collection_name_from_ref}");

    let collection_def = schema
        .definitions
        .get(&collection_name_from_ref)
        .ok_or_else(|| format!("Collection definition not found: {collection_name}"))?;

    // Check for file-based collection
    if let Some(CollectionAdditionalProperties::Schema(entry_schema)) =
        &collection_def.additional_properties
    {
        log::debug!("[Schema] File-based collection detected");
        return parse_entry_schema(collection_name, entry_schema);
    }

    // Standard collection
    log::debug!("[Schema] Standard collection detected");
    parse_entry_schema(collection_name, collection_def)
}

/// Parse an entry schema definition
fn parse_entry_schema(
    collection_name: &str,
    entry_schema: &JsonSchemaDefinition,
) -> Result<SchemaDefinition, String> {
    let properties = entry_schema
        .properties
        .as_ref()
        .ok_or("No properties found")?;

    log::debug!(
        "[Schema] Found {} properties in entry schema",
        properties.len()
    );

    let required_set: HashSet<String> = entry_schema
        .required
        .as_ref()
        .map(|r| r.iter().cloned().collect())
        .unwrap_or_default();

    log::debug!("[Schema] Required fields: {required_set:?}");

    let mut fields = Vec::new();

    for (field_name, field_schema) in properties {
        // Skip $schema metadata
        if field_name == "$schema" {
            continue;
        }

        let is_required = required_set.contains(field_name);
        let parsed_fields = parse_field(field_name, field_schema, is_required, "")?;
        log::debug!(
            "[Schema] Parsed field '{}' into {} field(s)",
            field_name,
            parsed_fields.len()
        );
        fields.extend(parsed_fields);
    }

    log::debug!(
        "[Schema] Total fields extracted: {} for collection {}",
        fields.len(),
        collection_name
    );

    Ok(SchemaDefinition {
        collection_name: collection_name.to_string(),
        fields,
    })
}

/// Parse a single field (may return multiple fields for nested objects)
fn parse_field(
    field_name: &str,
    field_schema: &JsonSchemaProperty,
    is_required: bool,
    parent_path: &str,
) -> Result<Vec<SchemaField>, String> {
    let full_path = if parent_path.is_empty() {
        field_name.to_string()
    } else {
        format!("{parent_path}.{field_name}")
    };

    let label = camel_case_to_title_case(field_name);

    // Determine field type
    let field_type_info = determine_field_type(field_schema)?;

    // Handle nested objects - recursively flatten
    if field_type_info.field_type == "unknown"
        && matches!(
            &field_schema.type_,
            Some(StringOrArray::String(s)) if s == "object"
        )
        && field_schema.properties.is_some()
    {
        // Flatten nested object
        let mut nested_fields = Vec::new();
        let nested_required: HashSet<String> = field_schema
            .required
            .as_ref()
            .map(|r| r.iter().cloned().collect())
            .unwrap_or_default();

        for (nested_name, nested_schema) in field_schema.properties.as_ref().unwrap() {
            let is_nested_required = nested_required.contains(nested_name);
            let parsed = parse_field(nested_name, nested_schema, is_nested_required, &full_path)?;
            nested_fields.extend(parsed);
        }

        return Ok(nested_fields);
    }

    // Extract constraints
    let constraints = extract_constraints(field_schema, &field_type_info.field_type);

    // Build field
    let field = SchemaField {
        name: full_path.clone(),
        label, // Use simple label; parent context is shown via UI grouping
        field_type: field_type_info.field_type,
        sub_type: field_type_info.sub_type,
        required: is_required && field_schema.default.is_none(),
        constraints,
        description: field_schema
            .description
            .clone()
            .or_else(|| field_schema.markdown_description.clone()),
        default: field_schema.default.clone(),
        enum_values: field_type_info.enum_values,
        reference_collection: field_type_info.reference_collection,
        array_reference_collection: field_type_info.array_reference_collection,
        is_nested: if !parent_path.is_empty() {
            Some(true)
        } else {
            None
        },
        parent_path: if !parent_path.is_empty() {
            Some(parent_path.to_string())
        } else {
            None
        },
    };

    Ok(vec![field])
}

/// Field type information
struct FieldTypeInfo {
    field_type: String,
    sub_type: Option<String>,
    enum_values: Option<Vec<String>>,
    reference_collection: Option<String>,
    array_reference_collection: Option<String>,
}

/// Handle anyOf types (dates, references, nullable unions)
fn handle_anyof_type(any_of: &[JsonSchemaProperty]) -> Result<FieldTypeInfo, String> {
    if is_date_field(any_of) {
        return Ok(FieldTypeInfo {
            field_type: "date".to_string(),
            sub_type: None,
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        });
    }
    if is_reference_field(any_of) {
        return Ok(FieldTypeInfo {
            field_type: "reference".to_string(),
            sub_type: None,
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        });
    }
    // Handle nullable primitives (e.g., z.number().nullish() → anyOf: [number, null])
    if let Some(primitive_type) = extract_nullable_primitive_type(any_of) {
        return Ok(FieldTypeInfo {
            field_type: primitive_type,
            sub_type: None,
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        });
    }
    // Handle nullable arrays (e.g., z.array(z.string()).nullish() → anyOf: [array, null])
    if let Some(array_type) = extract_nullable_array_type(any_of) {
        return Ok(array_type);
    }
    // Handle nullable enums (e.g., z.enum([...]).nullish() → anyOf: [enum, null])
    if let Some(enum_type) = extract_nullable_enum_type(any_of) {
        return Ok(enum_type);
    }
    // Other unions - treat as string for now
    Ok(FieldTypeInfo {
        field_type: "string".to_string(),
        sub_type: None,
        enum_values: None,
        reference_collection: None,
        array_reference_collection: None,
    })
}

/// Extract primitive type from a nullable anyOf (e.g., [number, null] → "number")
/// Returns None if not a simple nullable primitive pattern
fn extract_nullable_primitive_type(any_of: &[JsonSchemaProperty]) -> Option<String> {
    // Only handle simple two-element nullable unions: [primitive, null]
    if any_of.len() != 2 {
        return None;
    }

    let mut primitive_type = None;
    let mut has_null = false;

    for schema in any_of {
        match &schema.type_ {
            Some(StringOrArray::String(t)) if t == "null" => {
                has_null = true;
            }
            Some(StringOrArray::String(t)) => {
                match t.as_str() {
                    "number" | "integer" | "boolean" => {
                        primitive_type = Some(t.clone());
                    }
                    "string" => {
                        // Skip strings with enum values - they should be handled as enums
                        if schema.enum_.is_some() {
                            return None;
                        }
                        primitive_type = Some(t.clone());
                    }
                    _ => return None, // Not a simple primitive
                }
            }
            _ => return None, // Array type or missing type
        }
    }

    if has_null {
        primitive_type
    } else {
        None
    }
}

/// Extract array type from a nullable anyOf (e.g., [array, null] → array info)
/// Returns None if not a nullable array pattern
fn extract_nullable_array_type(any_of: &[JsonSchemaProperty]) -> Option<FieldTypeInfo> {
    // Only handle simple two-element nullable unions: [array, null]
    if any_of.len() != 2 {
        return None;
    }

    let mut array_schema = None;
    let mut has_null = false;

    for schema in any_of {
        match &schema.type_ {
            Some(StringOrArray::String(t)) if t == "null" => {
                has_null = true;
            }
            Some(StringOrArray::String(t)) if t == "array" => {
                array_schema = Some(schema);
            }
            _ => return None, // Not a simple nullable array pattern
        }
    }

    if has_null {
        if let Some(schema) = array_schema {
            // Delegate to existing handle_array_type logic
            return handle_array_type(schema).ok();
        }
    }
    None
}

/// Extract enum type from a nullable anyOf (e.g., [enum, null] → enum info)
/// Returns None if not a nullable enum pattern
fn extract_nullable_enum_type(any_of: &[JsonSchemaProperty]) -> Option<FieldTypeInfo> {
    // Only handle simple two-element nullable unions: [enum, null]
    if any_of.len() != 2 {
        return None;
    }

    let mut enum_values = None;
    let mut has_null = false;

    for schema in any_of {
        match &schema.type_ {
            Some(StringOrArray::String(t)) if t == "null" => {
                has_null = true;
            }
            Some(StringOrArray::String(t)) if t == "string" => {
                // Check if this string type has enum values
                if let Some(values) = &schema.enum_ {
                    enum_values = Some(values.clone());
                }
            }
            _ => {} // Continue checking other schemas
        }
    }

    if has_null && enum_values.is_some() {
        return Some(FieldTypeInfo {
            field_type: "enum".to_string(),
            sub_type: None,
            enum_values,
            reference_collection: None,
            array_reference_collection: None,
        });
    }
    None
}

/// Handle array types
fn handle_array_type(field_schema: &JsonSchemaProperty) -> Result<FieldTypeInfo, String> {
    if let Some(items) = &field_schema.items {
        let item_type_info = match &**items {
            ItemsType::Single(item_schema) => determine_field_type(item_schema)?,
            ItemsType::Tuple(_) => {
                // Tuple - treat as JSON string for now
                return Ok(FieldTypeInfo {
                    field_type: "string".to_string(),
                    sub_type: None,
                    enum_values: None,
                    reference_collection: None,
                    array_reference_collection: None,
                });
            }
        };

        // If array items are references
        if item_type_info.field_type == "reference" {
            return Ok(FieldTypeInfo {
                field_type: "array".to_string(),
                sub_type: Some(item_type_info.field_type),
                enum_values: None,
                reference_collection: None,
                array_reference_collection: None,
            });
        }

        return Ok(FieldTypeInfo {
            field_type: "array".to_string(),
            sub_type: Some(item_type_info.field_type),
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        });
    }
    Ok(FieldTypeInfo {
        field_type: "array".to_string(),
        sub_type: Some("string".to_string()),
        enum_values: None,
        reference_collection: None,
        array_reference_collection: None,
    })
}

/// Handle object types
fn handle_object_type(field_schema: &JsonSchemaProperty) -> Result<FieldTypeInfo, String> {
    // Records (with additionalProperties: true or schema) - treat as JSON string
    // Note: additionalProperties: false means "strict object", not a dynamic record
    if matches!(
        &field_schema.additional_properties,
        Some(PropertyAdditionalProperties::Boolean(true))
            | Some(PropertyAdditionalProperties::Schema(_))
    ) {
        return Ok(FieldTypeInfo {
            field_type: "string".to_string(),
            sub_type: None,
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        });
    }
    // Nested objects (including those with additionalProperties: false) will be flattened by parse_field
    Ok(FieldTypeInfo {
        field_type: "unknown".to_string(),
        sub_type: None,
        enum_values: None,
        reference_collection: None,
        array_reference_collection: None,
    })
}

/// Handle primitive types (string, integer, number, boolean)
fn handle_primitive_type(type_: &StringOrArray) -> Result<FieldTypeInfo, String> {
    match type_ {
        StringOrArray::String(s) => match s.as_str() {
            "string" => Ok(FieldTypeInfo {
                field_type: "string".to_string(),
                sub_type: None,
                enum_values: None,
                reference_collection: None,
                array_reference_collection: None,
            }),
            "integer" => Ok(FieldTypeInfo {
                field_type: "integer".to_string(),
                sub_type: None,
                enum_values: None,
                reference_collection: None,
                array_reference_collection: None,
            }),
            "number" => Ok(FieldTypeInfo {
                field_type: "number".to_string(),
                sub_type: None,
                enum_values: None,
                reference_collection: None,
                array_reference_collection: None,
            }),
            "boolean" => Ok(FieldTypeInfo {
                field_type: "boolean".to_string(),
                sub_type: None,
                enum_values: None,
                reference_collection: None,
                array_reference_collection: None,
            }),
            _ => Ok(FieldTypeInfo {
                field_type: "unknown".to_string(),
                sub_type: None,
                enum_values: None,
                reference_collection: None,
                array_reference_collection: None,
            }),
        },
        StringOrArray::Array(_) => {
            // Multiple types - treat as string for now
            Ok(FieldTypeInfo {
                field_type: "string".to_string(),
                sub_type: None,
                enum_values: None,
                reference_collection: None,
                array_reference_collection: None,
            })
        }
    }
}

/// Determine field type from JSON schema property
fn determine_field_type(field_schema: &JsonSchemaProperty) -> Result<FieldTypeInfo, String> {
    // Handle anyOf (dates, references, unions)
    if let Some(any_of) = &field_schema.any_of {
        return handle_anyof_type(any_of);
    }

    // Handle enum
    if let Some(enum_values) = &field_schema.enum_ {
        return Ok(FieldTypeInfo {
            field_type: "enum".to_string(),
            sub_type: None,
            enum_values: Some(enum_values.clone()),
            reference_collection: None,
            array_reference_collection: None,
        });
    }

    // Handle const (literal) - treat as string
    if field_schema.const_.is_some() {
        return Ok(FieldTypeInfo {
            field_type: "string".to_string(),
            sub_type: None,
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        });
    }

    // Handle arrays
    if matches!(
        &field_schema.type_,
        Some(StringOrArray::String(s)) if s == "array"
    ) {
        return handle_array_type(field_schema);
    }

    // Handle objects
    if matches!(
        &field_schema.type_,
        Some(StringOrArray::String(s)) if s == "object"
    ) {
        return handle_object_type(field_schema);
    }

    // Handle primitives with special formats (email, url)
    if let Some(type_) = &field_schema.type_ {
        if let StringOrArray::String(s) = type_ {
            if s == "string" {
                if let Some(format) = &field_schema.format {
                    match format.as_str() {
                        "email" => {
                            return Ok(FieldTypeInfo {
                                field_type: "email".to_string(),
                                sub_type: None,
                                enum_values: None,
                                reference_collection: None,
                                array_reference_collection: None,
                            })
                        }
                        "uri" => {
                            return Ok(FieldTypeInfo {
                                field_type: "url".to_string(),
                                sub_type: None,
                                enum_values: None,
                                reference_collection: None,
                                array_reference_collection: None,
                            })
                        }
                        _ => {}
                    }
                }
            }
        }
        return handle_primitive_type(type_);
    }

    Ok(FieldTypeInfo {
        field_type: "unknown".to_string(),
        sub_type: None,
        enum_values: None,
        reference_collection: None,
        array_reference_collection: None,
    })
}

/// Check if anyOf represents a date field
fn is_date_field(any_of: &[JsonSchemaProperty]) -> bool {
    any_of.iter().any(|s| {
        s.format
            .as_ref()
            .map(|f| f == "date-time" || f == "date" || f == "unix-time")
            .unwrap_or(false)
    })
}

/// Check if anyOf represents a reference field
fn is_reference_field(any_of: &[JsonSchemaProperty]) -> bool {
    any_of.iter().any(|s| {
        if matches!(&s.type_, Some(StringOrArray::String(t)) if t == "object") {
            if let Some(props) = &s.properties {
                return props.contains_key("collection")
                    && (props.contains_key("id") || props.contains_key("slug"));
            }
        }
        false
    })
}

/// Extract constraints from field schema
fn extract_constraints(
    field_schema: &JsonSchemaProperty,
    field_type: &str,
) -> Option<FieldConstraints> {
    let mut constraints = FieldConstraints {
        min: None,
        max: None,
        min_length: None,
        max_length: None,
        pattern: None,
        format: None,
    };

    // Numeric constraints
    if let Some(min) = field_schema.minimum {
        constraints.min = Some(min);
    }
    if let Some(max) = field_schema.maximum {
        constraints.max = Some(max);
    }
    if let Some(exclusive_min) = field_schema.exclusive_minimum {
        constraints.min = Some(exclusive_min + 1.0);
    }
    if let Some(exclusive_max) = field_schema.exclusive_maximum {
        constraints.max = Some(exclusive_max - 1.0);
    }

    // String constraints
    if let Some(min_length) = field_schema.min_length {
        constraints.min_length = Some(min_length);
    }
    if let Some(max_length) = field_schema.max_length {
        constraints.max_length = Some(max_length);
    }
    if let Some(pattern) = &field_schema.pattern {
        constraints.pattern = Some(pattern.clone());
    }

    // Format constraints
    if let Some(format) = &field_schema.format {
        if matches!(format.as_str(), "email" | "uri" | "date-time" | "date") {
            constraints.format = Some(format.clone());
        }
    }

    // Array constraints
    if field_type == "array" {
        if let Some(min_items) = field_schema.min_items {
            constraints.min_length = Some(min_items);
        }
        if let Some(max_items) = field_schema.max_items {
            constraints.max_length = Some(max_items);
        }
    }

    // Only return constraints if any are set
    if constraints.min.is_some()
        || constraints.max.is_some()
        || constraints.min_length.is_some()
        || constraints.max_length.is_some()
        || constraints.pattern.is_some()
        || constraints.format.is_some()
    {
        Some(constraints)
    } else {
        None
    }
}

/// Enhance JSON schema with Zod reference collection names
fn enhance_schema_from_zod(schema: &mut SchemaDefinition, zod_schema: &str) -> Result<(), String> {
    // Parse Zod schema to extract reference mappings and image field types
    let (reference_map, image_fields) = extract_zod_enhancements(zod_schema)?;

    // Apply enhancements to fields
    for field in &mut schema.fields {
        // Apply reference collection names
        if let Some(collection_name) = reference_map.get(&field.name) {
            match field.field_type.as_str() {
                "reference" => {
                    field.reference_collection = Some(collection_name.clone());
                }
                "array" if field.sub_type.as_deref() == Some("reference") => {
                    field.array_reference_collection = Some(collection_name.clone());
                }
                _ => {}
            }
        }

        // Apply image field types (override string type from JSON schema)
        if image_fields.contains(&field.name) {
            if field.field_type == "string" {
                field.field_type = "image".to_string();
            } else if field.field_type == "array" && field.sub_type.as_deref() == Some("string") {
                field.sub_type = Some("image".to_string());
            }
        }
    }

    Ok(())
}

/// Extract reference field mappings and image field names from Zod schema JSON
fn extract_zod_enhancements(
    zod_schema: &str,
) -> Result<(IndexMap<String, String>, HashSet<String>), String> {
    #[derive(Deserialize)]
    struct ZodSchema {
        fields: Vec<ZodField>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ZodField {
        name: String,
        #[serde(rename = "type")]
        type_: String,
        #[serde(default)]
        referenced_collection: Option<String>,
        #[serde(default)]
        array_reference_collection: Option<String>,
        #[serde(default)]
        array_type: Option<String>,
    }

    let schema: ZodSchema =
        serde_json::from_str(zod_schema).map_err(|e| format!("Failed to parse Zod JSON: {e}"))?;

    let mut reference_map = IndexMap::new();
    let mut image_fields = HashSet::new();

    for field in schema.fields {
        // Single reference
        if let Some(collection) = field.referenced_collection {
            reference_map.insert(field.name.clone(), collection);
        }
        // Array reference
        else if let Some(collection) = field.array_reference_collection {
            reference_map.insert(field.name.clone(), collection);
        }

        // Image field detection
        if field.type_ == "Image"
            || (field.type_ == "Array" && field.array_type.as_deref() == Some("Image"))
        {
            image_fields.insert(field.name);
        }
    }

    Ok((reference_map, image_fields))
}

/// Parse Zod schema (fallback when JSON schema unavailable)
fn parse_zod_schema(collection_name: &str, zod_schema: &str) -> Result<SchemaDefinition, String> {
    // Reuse existing Zod parsing logic from parser.rs but convert to SchemaField format
    #[derive(Deserialize)]
    struct ZodSchema {
        #[allow(dead_code)]
        #[serde(rename = "type")]
        type_: String,
        fields: Vec<ZodField>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ZodField {
        name: String,
        #[serde(rename = "type")]
        #[allow(dead_code)]
        type_: String,
        optional: bool,
        #[serde(default)]
        default: Option<String>,
        #[serde(default)]
        options: Option<Vec<String>>,
        #[serde(default)]
        constraints: Option<Value>,
        #[serde(default)]
        array_type: Option<String>,
        #[serde(default)]
        referenced_collection: Option<String>,
        #[serde(default)]
        array_reference_collection: Option<String>,
    }

    let schema: ZodSchema =
        serde_json::from_str(zod_schema).map_err(|e| format!("Failed to parse Zod JSON: {e}"))?;

    let fields = schema
        .fields
        .into_iter()
        .map(|f| {
            let field_type = zod_type_to_field_type(&f.type_);
            let sub_type = f.array_type.as_ref().map(|t| zod_type_to_field_type(t));

            SchemaField {
                name: f.name.clone(),
                label: camel_case_to_title_case(&f.name),
                field_type,
                sub_type,
                required: !f.optional,
                constraints: f.constraints.and_then(|c| parse_zod_constraints(&c)),
                description: None,
                default: f.default.map(Value::String),
                enum_values: f.options,
                reference_collection: f.referenced_collection,
                array_reference_collection: f.array_reference_collection,
                is_nested: None,
                parent_path: None,
            }
        })
        .collect();

    Ok(SchemaDefinition {
        collection_name: collection_name.to_string(),
        fields,
    })
}

/// Convert Zod type string to field type string
fn zod_type_to_field_type(zod_type: &str) -> String {
    match zod_type {
        "String" => "string",
        "Number" => "number",
        "Boolean" => "boolean",
        "Date" => "date",
        "Array" => "array",
        "Enum" => "enum",
        "Reference" => "reference",
        "Image" => "image",
        _ => "unknown",
    }
    .to_string()
}

/// Parse Zod constraints Value into FieldConstraints
fn parse_zod_constraints(constraints: &Value) -> Option<FieldConstraints> {
    let obj = constraints.as_object()?;

    let result = FieldConstraints {
        min: obj.get("min").and_then(|v| v.as_f64()),
        max: obj.get("max").and_then(|v| v.as_f64()),
        min_length: obj
            .get("minLength")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize),
        max_length: obj
            .get("maxLength")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize),
        pattern: obj.get("regex").and_then(|v| v.as_str()).map(String::from),
        format: if obj.get("email").and_then(|v| v.as_bool()).unwrap_or(false) {
            Some("email".to_string())
        } else if obj.get("url").and_then(|v| v.as_bool()).unwrap_or(false) {
            Some("uri".to_string())
        } else {
            None
        },
    };

    // Only return if any constraints are set
    if result.min.is_some()
        || result.max.is_some()
        || result.min_length.is_some()
        || result.max_length.is_some()
        || result.pattern.is_some()
        || result.format.is_some()
    {
        Some(result)
    } else {
        None
    }
}

/// Convert camelCase to Title Case
fn camel_case_to_title_case(s: &str) -> String {
    let mut result = String::new();
    let mut prev_was_lower = false;

    for (i, ch) in s.chars().enumerate() {
        if i == 0 {
            result.push(ch.to_ascii_uppercase());
            prev_was_lower = ch.is_lowercase();
        } else if ch.is_uppercase() && prev_was_lower {
            result.push(' ');
            result.push(ch);
            prev_was_lower = false;
        } else {
            result.push(ch);
            prev_was_lower = ch.is_lowercase();
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_camel_case_to_title_case() {
        assert_eq!(camel_case_to_title_case("helloWorld"), "Hello World");
        assert_eq!(camel_case_to_title_case("firstName"), "First Name");
        assert_eq!(camel_case_to_title_case("SEO"), "SEO");
    }

    #[test]
    fn test_parse_simple_json_schema() {
        let json_schema = r##"{
            "$ref": "#/definitions/blog",
            "$schema": "http://json-schema.org/draft-07/schema#",
            "definitions": {
                "blog": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "count": { "type": "integer" }
                    },
                    "required": ["title"]
                }
            }
        }"##;

        let result = parse_json_schema("blog", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        assert_eq!(schema.collection_name, "blog");
        assert_eq!(schema.fields.len(), 2);

        let title_field = schema.fields.iter().find(|f| f.name == "title").unwrap();
        assert_eq!(title_field.field_type, "string");
        assert!(title_field.required);

        let count_field = schema.fields.iter().find(|f| f.name == "count").unwrap();
        assert_eq!(count_field.field_type, "integer");
    }

    #[test]
    fn test_extract_zod_references() {
        let zod_schema = r##"{
            "type": "zod",
            "fields": [
                {
                    "name": "author",
                    "type": "Reference",
                    "optional": true,
                    "referencedCollection": "authors"
                },
                {
                    "name": "tags",
                    "type": "Array",
                    "arrayType": "Reference",
                    "optional": true,
                    "arrayReferenceCollection": "tags"
                }
            ]
        }"##;

        let result = extract_zod_enhancements(zod_schema);
        assert!(result.is_ok());

        let (reference_map, _image_fields) = result.unwrap();
        assert_eq!(reference_map.get("author"), Some(&"authors".to_string()));
        assert_eq!(reference_map.get("tags"), Some(&"tags".to_string()));
    }

    #[test]
    fn test_parse_nested_object_with_additional_properties_false() {
        // Regression test for bug where additionalProperties: false was treated as a dynamic record
        let json_schema = r##"{
            "$ref": "#/definitions/notes",
            "$schema": "http://json-schema.org/draft-07/schema#",
            "definitions": {
                "notes": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "category": { "type": "string" },
                                "priority": { "type": "number" }
                            },
                            "required": ["category"],
                            "additionalProperties": false
                        }
                    },
                    "required": ["title"]
                }
            }
        }"##;

        let result = parse_json_schema("notes", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        assert_eq!(schema.collection_name, "notes");

        // Should have 3 fields: title, metadata.category, metadata.priority
        // NOT 2 fields (title + metadata as string)
        assert_eq!(schema.fields.len(), 3);

        // Check title field
        let title_field = schema.fields.iter().find(|f| f.name == "title").unwrap();
        assert_eq!(title_field.field_type, "string");
        assert!(title_field.required);
        assert_eq!(title_field.parent_path, None);

        // Check metadata.category field
        let category_field = schema
            .fields
            .iter()
            .find(|f| f.name == "metadata.category")
            .unwrap();
        assert_eq!(category_field.field_type, "string");
        assert!(category_field.required);
        assert_eq!(category_field.parent_path, Some("metadata".to_string()));
        assert_eq!(category_field.is_nested, Some(true));

        // Check metadata.priority field
        let priority_field = schema
            .fields
            .iter()
            .find(|f| f.name == "metadata.priority")
            .unwrap();
        assert_eq!(priority_field.field_type, "number");
        assert!(!priority_field.required);
        assert_eq!(priority_field.parent_path, Some("metadata".to_string()));
        assert_eq!(priority_field.is_nested, Some(true));

        // Ensure NO field named "metadata" was created
        assert!(!schema.fields.iter().any(|f| f.name == "metadata"));
    }

    // --- INTEGRATION TESTS FOR EXISTING BEHAVIOR (BEFORE REFACTORING) ---

    #[test]
    fn test_parse_anyof_nullable_string() {
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "description": {
                            "anyOf": [
                                { "type": "string" },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let desc_field = schema
            .fields
            .iter()
            .find(|f| f.name == "description")
            .unwrap();
        assert_eq!(desc_field.field_type, "string");
        assert!(!desc_field.required);
    }

    #[test]
    fn test_parse_anyof_nullable_number() {
        // Regression test for GitHub issue #68: z.number().nullish() was incorrectly
        // typed as "string" instead of "number", causing values to be stringified on save
        let json_schema = r##"{
            "$ref": "#/definitions/locations",
            "definitions": {
                "locations": {
                    "type": "object",
                    "properties": {
                        "lat": {
                            "anyOf": [
                                { "type": "number" },
                                { "type": "null" }
                            ]
                        },
                        "lng": {
                            "anyOf": [
                                { "type": "null" },
                                { "type": "number" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("locations", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();

        let lat_field = schema.fields.iter().find(|f| f.name == "lat").unwrap();
        assert_eq!(lat_field.field_type, "number");
        assert!(!lat_field.required);

        // Also test with null first (order shouldn't matter)
        let lng_field = schema.fields.iter().find(|f| f.name == "lng").unwrap();
        assert_eq!(lng_field.field_type, "number");
    }

    #[test]
    fn test_parse_anyof_nullable_integer() {
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "priority": {
                            "anyOf": [
                                { "type": "integer" },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema.fields.iter().find(|f| f.name == "priority").unwrap();
        assert_eq!(field.field_type, "integer");
    }

    #[test]
    fn test_parse_anyof_nullable_boolean() {
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "featured": {
                            "anyOf": [
                                { "type": "boolean" },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema.fields.iter().find(|f| f.name == "featured").unwrap();
        assert_eq!(field.field_type, "boolean");
    }

    #[test]
    fn test_parse_array_of_strings() {
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "tags": {
                            "type": "array",
                            "items": { "type": "string" }
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let tags_field = schema.fields.iter().find(|f| f.name == "tags").unwrap();
        assert_eq!(tags_field.field_type, "array");
        assert_eq!(tags_field.sub_type, Some("string".to_string()));
    }

    #[test]
    fn test_parse_array_of_numbers() {
        let json_schema = r##"{
            "$ref": "#/definitions/data",
            "definitions": {
                "data": {
                    "type": "object",
                    "properties": {
                        "scores": {
                            "type": "array",
                            "items": { "type": "number" }
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("data", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let scores_field = schema.fields.iter().find(|f| f.name == "scores").unwrap();
        assert_eq!(scores_field.field_type, "array");
        assert_eq!(scores_field.sub_type, Some("number".to_string()));
    }

    #[test]
    fn test_parse_enum_field() {
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "enum": ["draft", "published", "archived"]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let status_field = schema.fields.iter().find(|f| f.name == "status").unwrap();
        assert_eq!(status_field.field_type, "enum");
        assert_eq!(
            status_field.enum_values,
            Some(vec![
                "draft".to_string(),
                "published".to_string(),
                "archived".to_string()
            ])
        );
    }

    #[test]
    fn test_parse_email_format() {
        let json_schema = r##"{
            "$ref": "#/definitions/users",
            "definitions": {
                "users": {
                    "type": "object",
                    "properties": {
                        "email": {
                            "type": "string",
                            "format": "email"
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("users", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let email_field = schema.fields.iter().find(|f| f.name == "email").unwrap();
        assert_eq!(email_field.field_type, "email");
    }

    #[test]
    fn test_parse_url_format() {
        let json_schema = r##"{
            "$ref": "#/definitions/links",
            "definitions": {
                "links": {
                    "type": "object",
                    "properties": {
                        "website": {
                            "type": "string",
                            "format": "uri"
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("links", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let website_field = schema.fields.iter().find(|f| f.name == "website").unwrap();
        assert_eq!(website_field.field_type, "url");
    }

    #[test]
    fn test_parse_boolean_field() {
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "published": { "type": "boolean" }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let published_field = schema
            .fields
            .iter()
            .find(|f| f.name == "published")
            .unwrap();
        assert_eq!(published_field.field_type, "boolean");
    }

    #[test]
    fn test_parse_integer_field() {
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "views": { "type": "integer" }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let views_field = schema.fields.iter().find(|f| f.name == "views").unwrap();
        assert_eq!(views_field.field_type, "integer");
    }

    #[test]
    fn test_parse_multiple_field_types() {
        // Complex schema with multiple field types
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "published": { "type": "boolean" },
                        "views": { "type": "integer" },
                        "rating": { "type": "number" },
                        "tags": {
                            "type": "array",
                            "items": { "type": "string" }
                        },
                        "status": {
                            "enum": ["draft", "published"]
                        }
                    },
                    "required": ["title", "published"]
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        assert_eq!(schema.fields.len(), 6);

        // Verify each field type
        let title_field = schema.fields.iter().find(|f| f.name == "title").unwrap();
        assert_eq!(title_field.field_type, "string");
        assert!(title_field.required);

        let published_field = schema
            .fields
            .iter()
            .find(|f| f.name == "published")
            .unwrap();
        assert_eq!(published_field.field_type, "boolean");
        assert!(published_field.required);

        let views_field = schema.fields.iter().find(|f| f.name == "views").unwrap();
        assert_eq!(views_field.field_type, "integer");

        let rating_field = schema.fields.iter().find(|f| f.name == "rating").unwrap();
        assert_eq!(rating_field.field_type, "number");

        let tags_field = schema.fields.iter().find(|f| f.name == "tags").unwrap();
        assert_eq!(tags_field.field_type, "array");
        assert_eq!(tags_field.sub_type, Some("string".to_string()));

        let status_field = schema.fields.iter().find(|f| f.name == "status").unwrap();
        assert_eq!(status_field.field_type, "enum");
    }

    #[test]
    fn test_parse_deeply_nested_objects() {
        let json_schema = r##"{
            "$ref": "#/definitions/articles",
            "definitions": {
                "articles": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "meta": {
                            "type": "object",
                            "properties": {
                                "author": {
                                    "type": "object",
                                    "properties": {
                                        "name": { "type": "string" },
                                        "email": { "type": "string", "format": "email" }
                                    },
                                    "required": ["name"]
                                }
                            },
                            "required": []
                        }
                    },
                    "required": ["title"]
                }
            }
        }"##;

        let result = parse_json_schema("articles", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();

        // Should have 3 fields: title, meta.author.name, meta.author.email
        assert_eq!(schema.fields.len(), 3);

        let name_field = schema
            .fields
            .iter()
            .find(|f| f.name == "meta.author.name")
            .unwrap();
        assert_eq!(name_field.field_type, "string");
        assert!(name_field.required);
        assert_eq!(name_field.is_nested, Some(true));

        let email_field = schema
            .fields
            .iter()
            .find(|f| f.name == "meta.author.email")
            .unwrap();
        assert_eq!(email_field.field_type, "email");
        assert!(!email_field.required);
    }

    #[test]
    fn test_parse_anyof_nullable_array_of_strings() {
        // Test z.array(z.string()).nullish()
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "tags": {
                            "anyOf": [
                                { "type": "array", "items": { "type": "string" } },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema.fields.iter().find(|f| f.name == "tags").unwrap();
        assert_eq!(field.field_type, "array");
        assert_eq!(field.sub_type, Some("string".to_string()));
    }

    #[test]
    fn test_parse_anyof_nullable_array_of_numbers() {
        // Test z.array(z.number()).nullish() - verify sub_type is correct
        let json_schema = r##"{
            "$ref": "#/definitions/data",
            "definitions": {
                "data": {
                    "type": "object",
                    "properties": {
                        "scores": {
                            "anyOf": [
                                { "type": "array", "items": { "type": "number" } },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("data", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema.fields.iter().find(|f| f.name == "scores").unwrap();
        assert_eq!(field.field_type, "array");
        assert_eq!(field.sub_type, Some("number".to_string()));
    }

    #[test]
    fn test_parse_anyof_nullable_array_null_first() {
        // Test with null first in the anyOf array (order shouldn't matter)
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "categories": {
                            "anyOf": [
                                { "type": "null" },
                                { "type": "array", "items": { "type": "string" } }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema
            .fields
            .iter()
            .find(|f| f.name == "categories")
            .unwrap();
        assert_eq!(field.field_type, "array");
        assert_eq!(field.sub_type, Some("string".to_string()));
    }

    #[test]
    fn test_parse_anyof_nullable_enum() {
        // Test z.enum(['draft', 'published']).nullish()
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "anyOf": [
                                { "type": "string", "enum": ["draft", "published"] },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema.fields.iter().find(|f| f.name == "status").unwrap();
        assert_eq!(field.field_type, "enum");
        assert_eq!(
            field.enum_values,
            Some(vec!["draft".to_string(), "published".to_string()])
        );
    }

    #[test]
    fn test_parse_anyof_nullable_enum_null_first() {
        // Test with null first in the anyOf array (order shouldn't matter)
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "priority": {
                            "anyOf": [
                                { "type": "null" },
                                { "type": "string", "enum": ["low", "medium", "high"] }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema.fields.iter().find(|f| f.name == "priority").unwrap();
        assert_eq!(field.field_type, "enum");
        assert_eq!(
            field.enum_values,
            Some(vec![
                "low".to_string(),
                "medium".to_string(),
                "high".to_string()
            ])
        );
    }

    #[test]
    fn test_parse_anyof_nullable_enum_with_many_values() {
        // Test enum with more values
        let json_schema = r##"{
            "$ref": "#/definitions/posts",
            "definitions": {
                "posts": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "anyOf": [
                                { "type": "string", "enum": ["news", "blog", "tutorial", "review", "opinion"] },
                                { "type": "null" }
                            ]
                        }
                    },
                    "required": []
                }
            }
        }"##;

        let result = parse_json_schema("posts", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let field = schema.fields.iter().find(|f| f.name == "category").unwrap();
        assert_eq!(field.field_type, "enum");
        assert_eq!(
            field.enum_values,
            Some(vec![
                "news".to_string(),
                "blog".to_string(),
                "tutorial".to_string(),
                "review".to_string(),
                "opinion".to_string()
            ])
        );
    }

    // --- END INTEGRATION TESTS ---
}
