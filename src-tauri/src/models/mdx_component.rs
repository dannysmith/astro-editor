use serde::Serialize;
use specta::Type;

#[derive(Serialize, Clone, Debug, Type)]
#[serde(rename_all = "lowercase")]
pub enum ComponentFramework {
    Astro,
    React,
    Vue,
    Svelte,
}

/// What kind of value a prop takes, resolved from its TypeScript type.
/// The component builder picks a control for each kind; `Unknown` gets a text field.
#[derive(Serialize, Clone, Debug, Type, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PropKind {
    String,
    Number,
    Boolean,
    /// A union of string literals, e.g. `'sm' | 'md' | 'lg'`, or a string enum
    Literals {
        values: Vec<String>,
    },
    Array {
        items: Box<PropKind>,
    },
    Date,
    /// Astro's `ImageMetadata`
    Image,
    /// `CollectionEntry<'blog'>` from `astro:content`
    CollectionEntry {
        collection: String,
    },
    Unknown,
}

#[derive(Serialize, Clone, Debug, Type)]
pub struct PropInfo {
    pub name: String,
    pub prop_type: String, // The type as written in source, e.g. "'warning' | 'info'"
    pub kind: PropKind,
    pub is_optional: bool,
    /// The default from destructuring, as source: strings unquoted, anything else verbatim
    pub default_value: Option<String>,
    pub description: Option<String>, // The prop's JSDoc comment
}

#[derive(Serialize, Clone, Debug, Type)]
pub struct MdxComponent {
    pub name: String,      // e.g., "Callout"
    pub file_path: String, // Relative path from project root
    pub props: Vec<PropInfo>,
    pub has_slot: bool,
    pub description: Option<String>, // Extracted from JSDoc comments if available
    pub framework: ComponentFramework, // Framework type
}
