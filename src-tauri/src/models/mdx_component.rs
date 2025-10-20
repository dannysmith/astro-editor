use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum ComponentFramework {
    Astro,
    React,
    Vue,
    Svelte,
}

#[derive(Serialize, Clone, Debug)]
pub struct PropInfo {
    pub name: String,
    pub prop_type: String, // e.g., "'warning' | 'info'", "string", "boolean"
    pub is_optional: bool,
    pub default_value: Option<String>, // For optional props with defaults
}

#[derive(Serialize, Clone, Debug)]
pub struct MdxComponent {
    pub name: String,      // e.g., "Callout"
    pub file_path: String, // Relative path from project root
    pub props: Vec<PropInfo>,
    pub has_slot: bool,
    pub description: Option<String>, // Extracted from JSDoc comments if available
    pub framework: ComponentFramework, // Framework type
}
