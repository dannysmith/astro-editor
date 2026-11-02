use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Clone, Debug, Type)]
#[serde(rename_all = "lowercase")]
pub enum ComponentFramework {
    Astro,
    React,
    Vue,
    Svelte,
}

/// What kind of value a prop takes, resolved from its TypeScript type.
/// The component builder picks a control for each kind; `Unknown` gets a text field.
#[derive(Serialize, Deserialize, Clone, Debug, Type, PartialEq)]
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

#[derive(Serialize, Deserialize, Clone, Debug, Type)]
pub struct PropInfo {
    pub name: String,
    pub prop_type: String, // The type as written in source, e.g. "'warning' | 'info'"
    pub kind: PropKind,
    pub is_optional: bool,
    /// The default from destructuring, as source: strings unquoted, anything else verbatim
    pub default_value: Option<String>,
    pub description: Option<String>, // The prop's JSDoc comment
}

#[derive(Serialize, Deserialize, Clone, Debug, Type)]
pub struct MdxComponent {
    pub name: String, // e.g., "Callout"
    /// Relative path from project root; empty for components from a package
    pub file_path: String,
    pub props: Vec<PropInfo>,
    pub has_slot: bool,
    pub description: Option<String>, // Extracted from JSDoc comments if available
    pub framework: ComponentFramework, // Framework type
    /// The module a package's components are imported from, e.g. `@astrojs/starlight/components`;
    /// `None` for the project's own components
    pub import_source: Option<String>,
    /// Imported by name (`import { Aside } from …`) rather than as its module's default export
    pub named_export: bool,
    /// Content inserted inside the tag instead of an empty slot, as a CodeMirror snippet,
    /// e.g. the `TabItem`s inside `Tabs`
    pub slot_template: Option<String>,
}
