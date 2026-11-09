//! A collection as the app uses it: what the content config says about it,
//! combined with the user's settings and AE's conventions by
//! `crate::collections`. Every resolved setting carries where its value came from.

use super::preferences::{DefaultSort, FileType, SkippedFiles};
use crate::utils::serialize_path;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;

/// Everything AE knows about a project's content
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScan {
    /// The content config, relative to the project root, if there is one
    pub config_path: Option<String>,
    /// Why the config couldn't be read
    pub config_error: Option<String>,
    /// There's no readable config, so the collections are the content folder's subfolders
    pub fallback: bool,
    pub project_settings: ResolvedProjectSettings,
    pub collections: Vec<Collection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    /// Its key in the content config's `collections` export, or its folder's name
    pub name: String,
    pub kind: CollectionKind,
    /// The folder the sidebar browses: `base` plus the pattern's fixed prefix
    #[specta(type = String)]
    #[serde(serialize_with = "serialize_path")]
    pub path: PathBuf,
    /// Where the pattern and entry ids are relative to
    #[specta(type = String)]
    #[serde(serialize_with = "serialize_path")]
    pub base: PathBuf,
    /// The loader's pattern. `None` when there isn't a readable one, and AE uses
    /// Astro's legacy pattern: everything except `_`-prefixed files and folders.
    pub patterns: Option<Vec<String>>,
    /// Why the loader's pattern couldn't be used
    pub pattern_error: Option<String>,
    pub folder_source: SettingSource,
    pub folder_status: FolderStatus,
    pub schema_status: SchemaStatus,
    /// Why the generated JSON schema couldn't be read
    pub schema_error: Option<String>,
    /// Serialized `SchemaDefinition`
    pub complete_schema: Option<String>,
    pub settings: ResolvedCollectionSettings,
}

impl Collection {
    /// Whether it belongs in the sidebar: editable content in a folder AE can use
    pub fn is_browsable(&self) -> bool {
        self.kind != CollectionKind::Data && self.folder_status == FolderStatus::Ok
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CollectionKind {
    /// `glob()`, or a loader that wraps it
    Glob,
    /// No loader, so loaded from `src/content/<name>`
    Legacy,
    /// A loader AE doesn't know
    Unknown,
    /// A subfolder of the content folder, because there's no readable config
    Folder,
    /// Data files (JSON, YAML…), not editable content
    Data,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FolderStatus {
    Ok,
    Missing,
    /// AE only reads and writes inside the project
    OutsideProject,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SchemaStatus {
    /// From the generated JSON schema, with the config's helpers
    Complete,
    /// The config has a schema but there's no generated JSON for it, usually
    /// because `astro sync` hasn't run. Only the config's `image()` and
    /// `reference()` helpers are known.
    NotGenerated,
    /// The JSON schema couldn't be read (see `schema_error`)
    Unreadable,
    /// The collection has no schema
    None,
}

/// Where a resolved setting's value came from
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SettingSource {
    /// Set on the collection (or, for project settings, the project)
    Set,
    /// Set on the project, for a collection setting
    Project,
    /// The global preference
    Global,
    /// Read from the content config
    Config,
    /// Detected in the schema
    Schema,
    /// Astro's or AE's convention
    Convention,
    /// Nothing to go on
    Missing,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Resolved<T> {
    pub value: T,
    pub source: SettingSource,
}

impl<T> Resolved<T> {
    pub fn new(value: T, source: SettingSource) -> Self {
        Self { value, source }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedCollectionSettings {
    pub skipped_files: Resolved<SkippedFiles>,
    pub title_field: Resolved<Option<String>>,
    pub description_field: Resolved<Option<String>>,
    /// Fields to try for a file's published date, in order
    pub published_date_field: Resolved<Vec<String>>,
    pub draft_field: Resolved<Option<String>>,
    pub default_sort: Option<DefaultSort>,
    pub new_file_type: Resolved<FileType>,
    pub url_pattern: Option<String>,
    /// Relative to the project root. Images go in `<assets>/<collection>/`.
    pub assets_directory: Resolved<String>,
    pub use_absolute_asset_paths: Resolved<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedProjectSettings {
    /// Relative to the project root
    pub content_directory: Resolved<String>,
    pub mdx_components_directory: Resolved<String>,
    pub add_component_imports: Resolved<bool>,
    /// The project's default for collections. Relative to the project root.
    pub assets_directory: Resolved<String>,
    /// The project's default for collections
    pub use_absolute_asset_paths: Resolved<bool>,
}
