//! What AE stores in `preferences/`: global settings, the project registry, and
//! each project's settings. Project and collection settings are sparse: a missing
//! value means unset, so its resolved value comes from the project, the config,
//! the schema or a convention (`crate::collections`).
//!
//! See `docs/developer/app-data.md`.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use specta::Type;

/// The version of project settings files this build writes
pub const PROJECT_SETTINGS_VERSION: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    Md,
    Mdx,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettings {
    pub general: GeneralSettings,
    pub appearance: AppearanceSettings,
    pub version: u32,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            general: GeneralSettings::default(),
            appearance: AppearanceSettings::default(),
            version: 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub ide_command: String,
    pub theme: Theme,
    pub highlights: Highlights,
    /// Seconds after typing stops before saving
    pub auto_save_delay: u32,
    /// For new files when a collection allows both and doesn't set one
    pub default_file_type: FileType,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            ide_command: String::new(),
            theme: Theme::System,
            highlights: Highlights::default(),
            auto_save_delay: 2,
            default_file_type: FileType::Md,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
pub struct Highlights {
    pub nouns: bool,
    pub verbs: bool,
    pub adjectives: bool,
    pub adverbs: bool,
    pub conjunctions: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    pub heading_color: HeadingColor,
    /// 1-30; the editor uses 18 when unset
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor_base_font_size: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct HeadingColor {
    pub light: String,
    pub dark: String,
}

impl Default for HeadingColor {
    fn default() -> Self {
        Self {
            light: "#191919".to_string(),
            dark: "#cccccc".to_string(),
        }
    }
}

/// Every project AE has opened
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRegistry {
    pub projects: IndexMap<String, ProjectMetadata>,
    pub last_opened_project: Option<String>,
    pub version: u32,
}

impl Default for ProjectRegistry {
    fn default() -> Self {
        Self {
            projects: IndexMap::new(),
            last_opened_project: None,
            version: 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetadata {
    /// Names the project's settings file. Never changes, even if the project moves.
    pub id: String,
    pub name: String,
    /// Canonical path to the project folder
    pub path: String,
    /// ISO timestamps
    pub last_opened: String,
    pub created: String,
}

/// A registered project, as the project list shows it
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ListedProject {
    pub project: ProjectMetadata,
    /// Its folder isn't there, usually because it was moved or renamed
    pub missing: bool,
    /// The site's icon, `public/favicon.{svg,png,ico}`, as an absolute path
    pub favicon: Option<String>,
}

/// What relocating a project did
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Relocation {
    Relocated,
    /// Another registered project is at the new folder, so nothing changed
    AlreadyRegistered,
}

/// A project's settings file, `projects/{id}.json`
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsFile {
    pub version: u32,
    /// Where the project was last seen, so a lost registry can be rebuilt
    pub path: String,
    #[serde(flatten)]
    pub settings: ProjectSettingsData,
}

/// A project's stored settings, as the frontend reads and edits them
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsData {
    pub project: ProjectSettings,
    /// Keyed by the collection's name in the content config
    pub collections: IndexMap<String, CollectionSettings>,
}

/// Settings for the whole project. Paths are relative to the project root.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ProjectSettings {
    /// Where collections are looked for when their loader doesn't say, and the
    /// folder whose subfolders become collections when there's no readable config
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_directory: Option<String>,
    /// Images go in `<assets>/<collection>/`. Collections can override it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets_directory: Option<String>,
    /// Write image paths from the project root rather than relative to the file.
    /// Collections can override it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_absolute_asset_paths: Option<bool>,
    /// The folders the component builder offers components from
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mdx_components_directories: Option<Vec<String>>,
    /// Experimental: the component builder adds the import a component needs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add_component_imports: Option<bool>,
}

/// Settings for one collection. Paths are relative to the project root.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct CollectionSettings {
    /// The folder to browse, replacing the loader's `base`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped_files: Option<SkippedFiles>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_date_field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub draft_field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_sort: Option<DefaultSort>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_file_type: Option<FileType>,
    /// How files are named, like `{YYYY-MM-DD}-{title}`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name_pattern: Option<String>,
    /// A template for links to this collection's entries, like `/blog/{slug}`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url_pattern: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets_directory: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_absolute_asset_paths: Option<bool>,
}

/// What the file list does with Markdown files the collection's pattern leaves out
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum SkippedFiles {
    Hide,
    Dim,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DefaultSort {
    /// A sidebar sort mode: `title`, `filename`, `date-<field>`, `order`, `modified`
    pub mode: String,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum SortDirection {
    Asc,
    Desc,
}
