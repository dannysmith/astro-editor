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
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldConstraints {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    /// `min` itself isn't allowed (`z.number().gt(min)`)
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub min_exclusive: bool,
    /// `max` itself isn't allowed (`z.number().lt(max)`)
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub max_exclusive: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<usize>,
    /// The fewest items an array takes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_items: Option<usize>,
    /// The most items an array takes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_items: Option<usize>,
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
    /// `z.discriminatedUnion`
    #[serde(default)]
    one_of: Option<Vec<JsonSchemaProperty>>,
    /// Strings or numbers (`z.enum({ A: 1 })`)
    #[serde(rename = "enum", default)]
    enum_: Option<Vec<Value>>,
    /// A `z.literal`, string or number
    #[serde(rename = "const", default)]
    const_: Option<Value>,
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

/// Array items: one schema for every item, or a tuple. Draft-07 tuples list the
/// item schemas here; Zod 4 puts them in `prefixItems` and sets `items: false`.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
enum ItemsType {
    Single(Box<JsonSchemaProperty>),
    #[allow(dead_code)]
    Tuple(Vec<JsonSchemaProperty>),
    #[allow(dead_code)]
    Bool(bool),
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

    log::debug!("[Schema] No schema available for collection: {collection_name}");
    Err("No schema available".to_string())
}

/// Parse Astro JSON schema (supports both Astro 5 and Astro 6+ formats). Only
/// folder collections get here: `file()` collections are read as reference
/// targets from their data file instead (`load_file_based_collection`).
fn parse_json_schema(collection_name: &str, json_schema: &str) -> Result<SchemaDefinition, String> {
    log::debug!("[Schema] Parsing JSON schema for collection: {collection_name}");

    // Try Astro 5 format first: { "$ref": "#/definitions/name", "definitions": { ... } }
    if let Ok(schema) = serde_json::from_str::<AstroJsonSchema>(json_schema) {
        log::debug!("[Schema] Detected Astro 5 format (ref+definitions)");
        let collection_name_from_ref = schema.ref_.replace("#/definitions/", "");
        log::debug!("[Schema] Looking for definition: {collection_name_from_ref}");

        let collection_def = schema
            .definitions
            .get(&collection_name_from_ref)
            .ok_or_else(|| format!("Collection definition not found: {collection_name}"))?;

        return parse_entry_schema(collection_name, collection_def);
    }

    // Try Astro 6 format: flat schema with properties at root
    // { "$schema": "...", "type": "object", "properties": { ... }, "required": [...] }
    if let Ok(schema) = serde_json::from_str::<JsonSchemaDefinition>(json_schema) {
        log::debug!("[Schema] Detected Astro 6 format (flat schema)");
        return parse_entry_schema(collection_name, &schema);
    }

    Err(format!(
        "Failed to parse JSON schema for {collection_name} in either Astro 5 or Astro 6 format"
    ))
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

    // A nullable field's type, properties and constraints are on its non-null branch
    let value_schema = field_schema
        .any_of
        .as_deref()
        .and_then(nullable_inner)
        .unwrap_or(field_schema);

    // Handle nested objects - recursively flatten
    if field_type_info.field_type == "unknown"
        && non_null_type(&value_schema.type_) == Some("object")
    {
        if let Some(properties) = value_schema.properties.as_ref() {
            // Flatten nested object
            let mut nested_fields = Vec::new();
            let nested_required: HashSet<String> = value_schema
                .required
                .as_ref()
                .map(|r| r.iter().cloned().collect())
                .unwrap_or_default();

            for (nested_name, nested_schema) in properties {
                let is_nested_required = nested_required.contains(nested_name);
                let parsed =
                    parse_field(nested_name, nested_schema, is_nested_required, &full_path)?;
                nested_fields.extend(parsed);
            }

            return Ok(nested_fields);
        }
    }

    let constraints = extract_constraints(value_schema, &field_type_info.field_type);

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

impl FieldTypeInfo {
    /// A field type with no sub-type, enum values or reference
    fn plain(field_type: &str) -> Self {
        Self {
            field_type: field_type.to_string(),
            sub_type: None,
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        }
    }
}

/// The type for a field that takes one of a set of literal values (`enum`, or a
/// union of `z.literal`s): a dropdown for strings, a number input for numbers
/// (the dropdown would save them as strings), a text input for a mix
fn literal_values_type(values: &[&Value]) -> FieldTypeInfo {
    if let Some(strings) = values
        .iter()
        .map(|v| v.as_str().map(str::to_string))
        .collect::<Option<Vec<_>>>()
    {
        return FieldTypeInfo {
            enum_values: Some(strings),
            ..FieldTypeInfo::plain("enum")
        };
    }
    if values.iter().all(|v| v.is_number()) {
        return FieldTypeInfo::plain("number");
    }
    FieldTypeInfo::plain("string")
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
    // Nullable fields (`z.number().nullish()` → anyOf: [number, null]) take the
    // type of their non-null branch. A nullable object is flattened by parse_field
    if let Some(inner) = nullable_inner(any_of) {
        return determine_field_type(inner);
    }
    // A union of literals (`z.union([z.literal('a'), z.literal('b')])`), maybe nullable
    let literals: Option<Vec<&Value>> = any_of
        .iter()
        .filter(|branch| !is_null_schema(branch))
        .map(|branch| branch.const_.as_ref())
        .collect();
    if let Some(literals) = literals.filter(|l| !l.is_empty()) {
        return Ok(literal_values_type(&literals));
    }
    // Other unions - treat as string for now
    Ok(FieldTypeInfo::plain("string"))
}

fn is_null_schema(schema: &JsonSchemaProperty) -> bool {
    matches!(&schema.type_, Some(StringOrArray::String(t)) if t == "null")
}

/// The non-null branch of a nullable field (`anyOf: [T, null]`), which has the
/// field's type and constraints
fn nullable_inner(any_of: &[JsonSchemaProperty]) -> Option<&JsonSchemaProperty> {
    let [a, b] = any_of else {
        return None;
    };
    match (is_null_schema(a), is_null_schema(b)) {
        (false, true) => Some(a),
        (true, false) => Some(b),
        _ => None,
    }
}

/// Handle array types
fn handle_array_type(field_schema: &JsonSchemaProperty) -> Result<FieldTypeInfo, String> {
    if let Some(items) = &field_schema.items {
        let item_type_info = match &**items {
            ItemsType::Single(item_schema) => determine_field_type(item_schema)?,
            // Tuples: items of different types, edited as YAML
            ItemsType::Tuple(_) | ItemsType::Bool(_) => {
                return Ok(FieldTypeInfo {
                    sub_type: Some("unknown".to_string()),
                    ..FieldTypeInfo::plain("array")
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
    // Records (with additionalProperties: true or schema) have no fixed fields to
    // flatten, so they're edited whole, as YAML
    // Note: additionalProperties: false means "strict object", not a dynamic record
    if matches!(
        &field_schema.additional_properties,
        Some(PropertyAdditionalProperties::Boolean(true))
            | Some(PropertyAdditionalProperties::Schema(_))
    ) {
        return Ok(FieldTypeInfo::plain("object"));
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

/// The single non-null JSON type of a field: `"number"` for both `"type": "number"` and
/// Zod 4.5+'s nullable form `"type": ["number", "null"]`. None if there's no type or
/// it's a union of several types.
fn non_null_type(type_: &Option<StringOrArray>) -> Option<&str> {
    match type_.as_ref()? {
        StringOrArray::String(s) => Some(s.as_str()),
        StringOrArray::Array(types) => match types.as_slice() {
            [t, n] | [n, t] if n == "null" && t != "null" => Some(t.as_str()),
            _ => None,
        },
    }
}

/// Handle primitive types (string, integer, number, boolean)
fn handle_primitive_type(type_: &str) -> Result<FieldTypeInfo, String> {
    match type_ {
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
    }
}

/// Determine field type from JSON schema property
fn determine_field_type(field_schema: &JsonSchemaProperty) -> Result<FieldTypeInfo, String> {
    // Handle anyOf (dates, references, unions)
    if let Some(any_of) = &field_schema.any_of {
        return handle_anyof_type(any_of);
    }

    // A discriminated union of objects: no fixed fields to flatten, so edited as
    // YAML. Other oneOfs fall through to the field's own type
    if let Some(one_of) = &field_schema.one_of {
        if one_of
            .iter()
            .all(|branch| non_null_type(&branch.type_) == Some("object"))
        {
            return Ok(FieldTypeInfo::plain("object"));
        }
    }

    // Handle enum
    if let Some(enum_values) = &field_schema.enum_ {
        return Ok(literal_values_type(&enum_values.iter().collect::<Vec<_>>()));
    }

    // A single literal: a number, toggle or text input
    if let Some(value) = &field_schema.const_ {
        return Ok(FieldTypeInfo::plain(match value {
            Value::Number(_) => "number",
            Value::Bool(_) => "boolean",
            _ => "string",
        }));
    }

    let single_type = non_null_type(&field_schema.type_);

    // Handle arrays
    if single_type == Some("array") {
        return handle_array_type(field_schema);
    }

    // Handle objects
    if single_type == Some("object") {
        return handle_object_type(field_schema);
    }

    // Handle primitives with special formats (email, url, date-time, date)
    if single_type == Some("string") {
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
                // Astro 6 uses simple format instead of anyOf for dates
                "date-time" | "date" => {
                    return Ok(FieldTypeInfo {
                        field_type: "date".to_string(),
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

    if let Some(type_) = single_type {
        return handle_primitive_type(type_);
    }

    // Unions of several types - treat as string for now
    if field_schema.type_.is_some() {
        return Ok(FieldTypeInfo {
            field_type: "string".to_string(),
            sub_type: None,
            enum_values: None,
            reference_collection: None,
            array_reference_collection: None,
        });
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
    let mut constraints = FieldConstraints::default();

    // Numeric constraints. `z.number().int()` adds the safe integer range as
    // bounds, which say nothing useful, so they're left out
    const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;
    let is_integer = non_null_type(&field_schema.type_) == Some("integer");
    if let Some(min) = field_schema
        .minimum
        .filter(|&m| !(is_integer && m == -MAX_SAFE_INTEGER))
    {
        constraints.min = Some(min);
    }
    if let Some(max) = field_schema
        .maximum
        .filter(|&m| !(is_integer && m == MAX_SAFE_INTEGER))
    {
        constraints.max = Some(max);
    }
    // `gt(0)` on an integer is `min(1)` (the next whole number, so `gt(0.5)`
    // is also `min(1)`); on a number it stays exclusive
    if let Some(exclusive_min) = field_schema.exclusive_minimum {
        if is_integer {
            constraints.min = Some(exclusive_min.floor() + 1.0);
        } else {
            constraints.min = Some(exclusive_min);
            constraints.min_exclusive = true;
        }
    }
    if let Some(exclusive_max) = field_schema.exclusive_maximum {
        if is_integer {
            constraints.max = Some(exclusive_max.ceil() - 1.0);
        } else {
            constraints.max = Some(exclusive_max);
            constraints.max_exclusive = true;
        }
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
            constraints.min_items = Some(min_items);
        }
        if let Some(max_items) = field_schema.max_items {
            constraints.max_items = Some(max_items);
        }
    }

    // Only return constraints if any are set
    (constraints != FieldConstraints::default()).then_some(constraints)
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
        ..Default::default()
    };

    // Only return if any constraints are set
    (result != FieldConstraints::default()).then_some(result)
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
    fn array_limits_are_item_counts() {
        let field: JsonSchemaProperty =
            serde_json::from_value(serde_json::json!({ "type": "array", "maxItems": 3 })).unwrap();
        let constraints = extract_constraints(&field, "array").unwrap();
        assert_eq!(constraints.max_items, Some(3));
        assert_eq!(constraints.max_length, None);
    }

    #[test]
    fn nullable_fields_keep_their_constraints() {
        let field: JsonSchemaProperty = serde_json::from_value(serde_json::json!({
            "anyOf": [{ "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 3 }, { "type": "null" }]
        }))
        .unwrap();
        let parsed = parse_field("tags", &field, false, "").unwrap();
        let constraints = parsed[0].constraints.as_ref().unwrap();
        assert_eq!(
            (constraints.min_items, constraints.max_items),
            (Some(1), Some(3))
        );
    }

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
        // Regression test: z.number().nullish() was once wrongly
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
    fn test_parse_type_array_nullable_primitives() {
        // Zod 4.5+ emits bare nullable primitives as a type array instead of anyOf
        // (e.g., z.number().nullish() → "type": ["number", "null"])
        let json_schema = r##"{
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "lat": { "type": ["number", "null"] },
                "lng": { "type": ["null", "number"] },
                "featured": { "type": ["boolean", "null"] },
                "subtitle": { "type": ["string", "null"] },
                "mixed": { "type": ["string", "number", "null"] },
                "scores": { "type": ["array", "null"], "items": { "type": "number" } },
                "meta": {
                    "type": ["null", "object"],
                    "properties": { "category": { "type": "string" } },
                    "additionalProperties": false
                }
            },
            "required": []
        }"##;

        let schema = parse_json_schema("locations", json_schema).unwrap();
        let field = |name: &str| {
            let field = schema.fields.iter().find(|f| f.name == name).unwrap();
            assert!(!field.required);
            field
        };

        assert_eq!(field("lat").field_type, "number");
        assert_eq!(field("lng").field_type, "number");
        assert_eq!(field("featured").field_type, "boolean");
        assert_eq!(field("subtitle").field_type, "string");
        // Unions of several types still fall back to string
        assert_eq!(field("mixed").field_type, "string");
        // Nullable arrays keep their item type
        assert_eq!(field("scores").field_type, "array");
        assert_eq!(field("scores").sub_type.as_deref(), Some("number"));
        // Nullable nested objects are still flattened
        assert_eq!(field("meta.category").field_type, "string");
        assert!(!schema.fields.iter().any(|f| f.name == "meta"));
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

    // --- ASTRO 6 FORMAT TESTS ---

    #[test]
    fn test_parse_astro6_flat_json_schema() {
        // Astro 6 generates flat schemas without $ref/definitions
        let json_schema = r##"{
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "title": { "type": "string" },
                "draft": { "default": false, "type": "boolean" },
                "$schema": { "type": "string" }
            },
            "required": ["title"]
        }"##;

        let result = parse_json_schema("notes", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        assert_eq!(schema.collection_name, "notes");
        // $schema property should be skipped
        assert_eq!(schema.fields.len(), 2);

        let title = schema.fields.iter().find(|f| f.name == "title").unwrap();
        assert_eq!(title.field_type, "string");
        assert!(title.required);

        let draft = schema.fields.iter().find(|f| f.name == "draft").unwrap();
        assert_eq!(draft.field_type, "boolean");
        assert!(!draft.required); // has default
    }

    #[test]
    fn test_parse_astro6_date_time_format() {
        // Astro 6 uses simple format: "date-time" instead of anyOf with three formats
        let json_schema = r##"{
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "pubDate": { "type": "string", "format": "date-time" },
                "updatedDate": { "type": "string", "format": "date-time" }
            },
            "required": ["pubDate"]
        }"##;

        let result = parse_json_schema("articles", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let pub_date = schema.fields.iter().find(|f| f.name == "pubDate").unwrap();
        assert_eq!(pub_date.field_type, "date");
        assert!(pub_date.required);

        let updated_date = schema
            .fields
            .iter()
            .find(|f| f.name == "updatedDate")
            .unwrap();
        assert_eq!(updated_date.field_type, "date");
    }

    #[test]
    fn test_parse_astro6_real_world_notes_schema() {
        // Based on actual Astro 6 generated schema from dannyis-astro
        let json_schema = r##"{
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "title": { "type": "string" },
                "sourceURL": {
                    "description": "Original URL for link posts",
                    "type": "string",
                    "format": "uri"
                },
                "slug": {
                    "description": "Custom URL slug (defaults to filename)",
                    "type": "string"
                },
                "draft": { "default": false, "type": "boolean" },
                "description": { "type": "string" },
                "pubDate": { "type": "string", "format": "date-time" },
                "tags": { "type": "array", "items": { "type": "string" } },
                "styleguide": {
                    "description": "Styleguide page; excluded from RSS and indexes",
                    "type": "boolean"
                },
                "$schema": { "type": "string" }
            },
            "required": ["title", "pubDate"]
        }"##;

        let result = parse_json_schema("notes", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        assert_eq!(schema.collection_name, "notes");
        // 8 fields (excluding $schema)
        assert_eq!(schema.fields.len(), 8);

        // Verify key field types
        let source_url = schema
            .fields
            .iter()
            .find(|f| f.name == "sourceURL")
            .unwrap();
        assert_eq!(source_url.field_type, "url");
        assert_eq!(
            source_url.description,
            Some("Original URL for link posts".to_string())
        );

        let pub_date = schema.fields.iter().find(|f| f.name == "pubDate").unwrap();
        assert_eq!(pub_date.field_type, "date");
        assert!(pub_date.required);

        let tags = schema.fields.iter().find(|f| f.name == "tags").unwrap();
        assert_eq!(tags.field_type, "array");
        assert_eq!(tags.sub_type, Some("string".to_string()));

        let draft = schema.fields.iter().find(|f| f.name == "draft").unwrap();
        assert_eq!(draft.field_type, "boolean");
        assert!(!draft.required); // has default value
    }

    #[test]
    fn test_parse_astro6_enum_and_uri_fields() {
        let json_schema = r##"{
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["medium", "external"]
                },
                "redirectURL": {
                    "type": "string",
                    "format": "uri"
                }
            },
            "required": []
        }"##;

        let result = parse_json_schema("articles", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let platform = schema.fields.iter().find(|f| f.name == "platform").unwrap();
        assert_eq!(platform.field_type, "enum");
        assert_eq!(
            platform.enum_values,
            Some(vec!["medium".to_string(), "external".to_string()])
        );

        let redirect = schema
            .fields
            .iter()
            .find(|f| f.name == "redirectURL")
            .unwrap();
        assert_eq!(redirect.field_type, "url");
    }

    #[test]
    fn catchall_collections_keep_their_fields() {
        // `z.object({...}).catchall(z.string())` adds a root additionalProperties
        let json_schema = r##"{
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "title": { "type": "string" },
                "$schema": { "type": "string" }
            },
            "required": ["title"],
            "additionalProperties": { "type": "string" }
        }"##;

        let schema = parse_json_schema("posts", json_schema).unwrap();
        let names: Vec<_> = schema.fields.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, ["title"]);
    }

    /// Zod 4.6's `toJSONSchema` output (with Astro 7's options) for shapes beyond
    /// plain strings, numbers, enums and objects
    const ZOD4_SHAPES_SCHEMA: &str = r##"{
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "tuple": {
                "type": "array",
                "prefixItems": [{ "type": "string" }, { "type": "number" }],
                "items": false, "minItems": 2, "maxItems": 2
            },
            "numLiteral": { "type": "number", "const": 5 },
            "strLiteral": { "type": "string", "const": "fixed" },
            "numEnum": { "type": "number", "enum": [1, 2] },
            "numLiteralUnion": { "anyOf": [
                { "type": "number", "const": 1 }, { "type": "number", "const": 2 }
            ] },
            "literalUnion": { "anyOf": [
                { "type": "string", "const": "a" }, { "type": "string", "const": "b" }
            ] },
            "nullableLiteralUnion": { "anyOf": [
                { "type": "string", "const": "a" }, { "type": "string", "const": "b" }, { "type": "null" }
            ] },
            "mixedLiteralUnion": { "anyOf": [
                { "type": "string", "const": "a" }, { "type": "number", "const": 1 }
            ] },
            "discriminated": { "oneOf": [
                { "type": "object", "properties": { "kind": { "type": "string", "const": "video" }, "url": { "type": "string" } }, "required": ["kind", "url"] },
                { "type": "object", "properties": { "kind": { "type": "string", "const": "image" }, "src": { "type": "string" } }, "required": ["kind", "src"] }
            ] },
            "record": { "type": "object", "propertyNames": { "type": "string" }, "additionalProperties": { "type": "string" } },
            "nullableObject": { "anyOf": [
                { "type": "object", "properties": { "name": { "type": "string" }, "age": { "type": "number" } }, "required": ["name"] },
                { "type": "null" }
            ] },
            "nullableEmail": { "anyOf": [{ "type": "string", "format": "email" }, { "type": "null" }] },
            "boolLiteral": { "type": "boolean", "const": true },
            "scalarOneOf": { "oneOf": [{ "type": "string" }, { "type": "number" }] },
            "$schema": { "type": "string" }
        },
        "required": ["tuple", "numLiteral", "strLiteral", "numEnum", "numLiteralUnion", "literalUnion", "mixedLiteralUnion", "discriminated", "record", "nullableObject"]
    }"##;

    #[test]
    fn zod4_shapes_parse_without_failing_the_collection() {
        let schema = parse_json_schema("posts", ZOD4_SHAPES_SCHEMA).unwrap();
        let field = |name: &str| schema.fields.iter().find(|f| f.name == name).unwrap();
        let kind = |name: &str| {
            let f = field(name);
            (f.field_type.as_str(), f.sub_type.as_deref())
        };

        // Tuples are edited as YAML (an array of unknown items)
        assert_eq!(kind("tuple"), ("array", Some("unknown")));
        // Numeric literals and enums take a number, so the YAML stays a number
        assert_eq!(kind("numLiteral"), ("number", None));
        assert_eq!(kind("numEnum"), ("number", None));
        assert_eq!(kind("numLiteralUnion"), ("number", None));
        assert_eq!(kind("strLiteral"), ("string", None));
        assert_eq!(kind("mixedLiteralUnion"), ("string", None));
        // Unions of string literals are dropdowns, nullable or not
        for name in ["literalUnion", "nullableLiteralUnion"] {
            assert_eq!(kind(name), ("enum", None));
            assert_eq!(
                field(name).enum_values,
                Some(vec!["a".to_string(), "b".to_string()])
            );
        }
        // Objects without fixed fields are edited whole, as YAML
        assert_eq!(kind("discriminated"), ("object", None));
        // Only a oneOf of objects is edited whole
        assert_ne!(kind("scalarOneOf").0, "object");
        assert_eq!(kind("boolLiteral"), ("boolean", None));
        assert_eq!(kind("record"), ("object", None));
        // Nullable fields take their inner type, and nullable objects flatten
        assert_eq!(kind("nullableEmail"), ("email", None));
        assert_eq!(kind("nullableObject.name"), ("string", None));
        assert_eq!(kind("nullableObject.age"), ("number", None));
        assert!(field("nullableObject.name").required);
        assert!(!field("nullableObject.age").required);
    }

    #[test]
    fn exclusive_bounds_stay_exclusive_for_decimals() {
        let constraints = |schema: serde_json::Value| {
            let field: JsonSchemaProperty = serde_json::from_value(schema).unwrap();
            extract_constraints(&field, "number").unwrap_or_default()
        };

        // z.number().gt(0).lt(10): 0.5 is valid, so the bounds stay 0 and 10
        let decimal = constraints(serde_json::json!({
            "type": "number", "exclusiveMinimum": 0, "exclusiveMaximum": 10
        }));
        assert_eq!((decimal.min, decimal.max), (Some(0.0), Some(10.0)));
        assert!(decimal.min_exclusive && decimal.max_exclusive);

        // z.number().int().gt(0): the smallest valid value is 1
        let integer = constraints(serde_json::json!({
            "type": "integer", "exclusiveMinimum": 0, "maximum": 9007199254740991_i64
        }));
        assert_eq!((integer.min, integer.max), (Some(1.0), None));
        assert!(!integer.min_exclusive);

        // z.number().int().gt(0.5): still the next whole number
        let fractional = constraints(serde_json::json!({
            "type": "integer", "exclusiveMinimum": 0.5, "exclusiveMaximum": 9.5
        }));
        assert_eq!((fractional.min, fractional.max), (Some(1.0), Some(9.0)));

        // z.number().int() alone: Zod's safe-integer bounds aren't constraints
        let plain_int = constraints(serde_json::json!({
            "type": "integer", "minimum": -9007199254740991_i64, "maximum": 9007199254740991_i64
        }));
        assert_eq!(plain_int, FieldConstraints::default());
    }

    #[test]
    fn test_astro5_format_still_works() {
        // Ensure existing Astro 5 format continues to work
        let json_schema = r##"{
            "$ref": "#/definitions/blog",
            "$schema": "http://json-schema.org/draft-07/schema#",
            "definitions": {
                "blog": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "pubDate": {
                            "anyOf": [
                                { "type": "string", "format": "date-time" },
                                { "type": "string", "format": "date" },
                                { "type": "string", "format": "unix-time" }
                            ]
                        }
                    },
                    "required": ["title", "pubDate"]
                }
            }
        }"##;

        let result = parse_json_schema("blog", json_schema);
        assert!(result.is_ok());

        let schema = result.unwrap();
        let pub_date = schema.fields.iter().find(|f| f.name == "pubDate").unwrap();
        assert_eq!(pub_date.field_type, "date");
        assert!(pub_date.required);
    }

    // --- END ASTRO 6 FORMAT TESTS ---
}
