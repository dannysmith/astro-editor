//! Works out a project's collections: what the content config says about each
//! one, combined with the user's settings and AE's conventions. Every resolved
//! setting records where its value came from, so the settings UI can say.
//!
//! See `docs/developer/app-data.md`.

use crate::content_config::pattern::EntryPattern;
use crate::content_config::{self, normalize, ConfigCollection, GlobBase, Loader};
use crate::data_store::{self, DataStore, StoredLocation};
use crate::models::collection::{
    Collection, CollectionKind, FolderStatus, ProjectFileStatus, ProjectScan, Resolved,
    ResolvedCollectionSettings, ResolvedProjectSettings, SchemaStatus, SettingSource,
};
use crate::models::preferences::{
    CollectionSettings, FileType, GlobalSettings, ProjectSettings, ProjectSettingsData,
    SkippedFiles,
};
use crate::project_file::{self, FILE_NAME};
use crate::schema_merger::{self, SchemaDefinition};
use crate::utils::normalize_path_for_serialization;
use log::{debug, warn};
use std::path::{Path, PathBuf};

const CONTENT_DIR: &str = "src/content";
const ASSETS_DIR: &str = "src/assets";
const MDX_COMPONENTS_DIR: &str = "src/components/mdx";
/// How new files are named: today's date
const FILE_NAME_PATTERN: &str = "{YYYY-MM-DD}";

/// Field names tried, in order, for a file's published date
const PUBLISHED_DATE_FIELDS: [&str; 3] = ["pubDate", "date", "publishedDate"];

/// Reads the project's content config and resolves every collection in it.
/// `settings` are the writer's own; the project's `.astro-editor.json` fills
/// in what they leave unset, key by key, before anything is detected
pub fn scan_project(
    project: &Path,
    settings: &ProjectSettingsData,
    global: &GlobalSettings,
) -> ProjectScan {
    let file = project_file::read(project);
    let (shared, file_error) = match &file {
        Some(Ok(shared)) => (shared.clone(), None),
        Some(Err(e)) => {
            warn!("Astro Editor [PROJECT_SCAN] Ignoring {FILE_NAME}: {e}");
            (ProjectSettingsData::default(), Some(e.clone()))
        }
        None => (ProjectSettingsData::default(), None),
    };

    let project_settings = resolve_project_settings(&settings.project, &shared.project);
    let content_dir = project.join(&project_settings.content_directory.value);

    let config_path = content_config::find_config(project);
    let config = config_path.as_ref().map(|path| {
        std::fs::read_to_string(path)
            .map_err(|e| format!("Couldn't read the content config: {e}"))
            .and_then(|source| content_config::parse_config(&source, path, project))
    });

    // Only read when something needs it: with rendered HTML, a store can run
    // to megabytes
    let store = match &config {
        Some(Ok(config))
            if config.has_spread
                || config
                    .collections
                    .iter()
                    .any(|c| matches!(c.loader, Loader::Unknown | Loader::Inline)) =>
        {
            data_store::read(project)
        }
        _ => DataStore::new(),
    };

    let (defined, config_error) = match config {
        Some(Ok(config)) => {
            let mut collections = config.collections;
            // Collections spread in from another file can't be read, but the
            // data store has them if Astro has loaded them. Only then, since a
            // store Astro hasn't rewritten since the config changed can still
            // have collections that are gone.
            if config.has_spread {
                let spread: Vec<String> = store
                    .keys()
                    .filter(|name| !collections.iter().any(|c| &c.name == *name))
                    .cloned()
                    .collect();
                collections.extend(spread.into_iter().map(|name| ConfigCollection {
                    name,
                    loader: Loader::Unknown,
                    loader_name: None,
                    has_loader: true,
                    schema_source: None,
                }));
            }
            if collections.is_empty() {
                (
                    None,
                    Some("The content config has no collections".to_string()),
                )
            } else {
                (Some(collections), None)
            }
        }
        Some(Err(e)) => (None, Some(e)),
        None => (None, None),
    };
    if let Some(error) = &config_error {
        warn!("Astro Editor [PROJECT_SCAN] {error}");
    }

    let fallback = defined.is_none();
    let found: Vec<Found> = match defined {
        Some(defined) => {
            // Astro also makes collections from undefined `src/content` folders
            // when no collection has a loader
            let legacy_folders = if defined.iter().all(|c| !c.has_loader) {
                let names: Vec<_> = defined.iter().map(|c| c.name.clone()).collect();
                subfolders(&project.join(CONTENT_DIR))
                    .into_iter()
                    .filter(|name| !names.contains(name))
                    .collect()
            } else {
                Vec::new()
            };
            defined
                .into_iter()
                .map(|c| Found::from_config(c, project, &content_dir, &store))
                .chain(legacy_folders.into_iter().map(|name| Found {
                    base: project.join(CONTENT_DIR).join(&name),
                    name,
                    kind: CollectionKind::Legacy,
                    base_source: SettingSource::Convention,
                    patterns: None,
                    schema_source: None,
                    loader_name: None,
                    inline_loader: false,
                }))
                .collect()
        }
        None => subfolders(&content_dir)
            .into_iter()
            .map(|name| Found {
                base: content_dir.join(&name),
                name,
                kind: CollectionKind::Folder,
                base_source: SettingSource::Convention,
                patterns: None,
                schema_source: None,
                loader_name: None,
                inline_loader: false,
            })
            .collect(),
    };
    let mut collections: Vec<Collection> = found
        .into_iter()
        .map(|found| resolve_collection(found, project, settings, &shared, global))
        .collect();
    // Data last, after resolving, which can find a glob only matches data files
    collections.sort_by_key(|c| c.kind == CollectionKind::Data);

    let project_file = file.map(|_| ProjectFileStatus {
        path: normalize_path_for_serialization(&project.join(FILE_NAME)),
        // Without a readable config, which collections the site has isn't known
        unknown_collections: if fallback {
            Vec::new()
        } else {
            shared
                .collections
                .keys()
                .filter(|name| !collections.iter().any(|c| &c.name == *name))
                .cloned()
                .collect()
        },
        settings: shared,
        error: file_error,
    });

    ProjectScan {
        config_path: config_path.map(|path| relative_to(&path, project)),
        config_error,
        fallback,
        favicon: find_favicon(project),
        project_settings,
        collections,
        project_file,
    }
}

/// The site's icon, if it's where Astro's starter templates put it
pub fn find_favicon(project: &Path) -> Option<String> {
    ["svg", "png", "ico"]
        .into_iter()
        .map(|extension| project.join("public").join(format!("favicon.{extension}")))
        .find(|path| path.is_file())
        .map(|path| normalize_path_for_serialization(&path))
}

/// A collection as found in the config or on disk, before settings apply
struct Found {
    name: String,
    kind: CollectionKind,
    base: PathBuf,
    base_source: SettingSource,
    patterns: Option<Vec<String>>,
    schema_source: Option<String>,
    loader_name: Option<String>,
    inline_loader: bool,
}

impl Found {
    fn from_config(
        collection: ConfigCollection,
        project: &Path,
        content_dir: &Path,
        store: &DataStore,
    ) -> Self {
        let name = collection.name;
        let by_convention = |dir: &Path| (dir.join(&name), SettingSource::Convention);
        let loader_name = collection.loader_name;
        let inline_loader = matches!(collection.loader, Loader::Inline);

        let (kind, (base, base_source), patterns) = match collection.loader {
            Loader::Glob { base, patterns } => {
                let base = match base {
                    GlobBase::Root => (project.to_path_buf(), SettingSource::Config),
                    GlobBase::Path(path) => (normalize(&project.join(path)), SettingSource::Config),
                    GlobBase::Unreadable => by_convention(content_dir),
                };
                (CollectionKind::Glob, base, patterns)
            }
            Loader::Legacy => (
                CollectionKind::Legacy,
                by_convention(&project.join(CONTENT_DIR)),
                None,
            ),
            Loader::Data { file } => {
                let base = file.map_or_else(
                    || by_convention(content_dir),
                    |file| (normalize(&project.join(file)), SettingSource::Config),
                );
                (CollectionKind::Data, base, None)
            }
            // Where Astro last loaded its entries from, or else the convention
            Loader::Unknown | Loader::Inline => match store
                .get(&name)
                .and_then(|entries| data_store::location(entries, project))
            {
                Some(StoredLocation::Folder(folder)) => (
                    CollectionKind::Unknown,
                    (folder, SettingSource::DataStore),
                    None,
                ),
                Some(StoredLocation::Data(path)) => {
                    (CollectionKind::Data, (path, SettingSource::DataStore), None)
                }
                None => (CollectionKind::Unknown, by_convention(content_dir), None),
            },
        };

        Self {
            name,
            kind,
            base,
            base_source,
            patterns,
            schema_source: collection.schema_source,
            loader_name,
            inline_loader,
        }
    }
}

fn resolve_collection(
    found: Found,
    project: &Path,
    settings: &ProjectSettingsData,
    shared: &ProjectSettingsData,
    global: &GlobalSettings,
) -> Collection {
    let collection_settings = |settings: &ProjectSettingsData| {
        settings
            .collections
            .get(&found.name)
            .cloned()
            .unwrap_or_default()
    };
    let set = collection_settings(settings);
    let file = collection_settings(shared);
    let folder = layered(&set.folder, &file.folder);

    let (pattern, patterns, pattern_error) = match &found.patterns {
        Some(patterns) => match EntryPattern::new(patterns) {
            Ok(pattern) => (pattern, Some(patterns.clone()), None),
            Err(e) => (EntryPattern::legacy(), None, Some(e)),
        },
        // Built at run time, say. Without a warning, the legacy pattern would
        // quietly list every Markdown file under the base
        None if found.kind == CollectionKind::Glob => (
            EntryPattern::legacy(),
            None,
            Some("The pattern isn't a string or a list of strings.".to_string()),
        ),
        None => (EntryPattern::legacy(), None, None),
    };

    let mut kind = found.kind;
    if kind == CollectionKind::Glob && patterns.is_some() && !pattern.can_match_markdown() {
        kind = CollectionKind::Data;
    }
    // A folder the user chose beats the data store's guess that it's data
    if kind == CollectionKind::Data
        && found.base_source == SettingSource::DataStore
        && folder.is_some()
    {
        kind = CollectionKind::Unknown;
    }

    // A folder override replaces `base`, and the pattern's prefix with it, so the
    // pattern applies inside the folder
    let patterns = match (&folder, patterns) {
        (Some(_), Some(patterns)) if !pattern.prefix().is_empty() => Some(
            crate::content_config::pattern::without_prefix(&patterns, pattern.prefix()),
        ),
        (_, patterns) => patterns,
    };
    let (base, path, folder_source) = match folder {
        Some(folder) => {
            let base = normalize(&project.join(&folder.value));
            (base.clone(), base, folder.source)
        }
        None => {
            let path = if pattern.prefix().is_empty() {
                found.base.clone()
            } else {
                found.base.join(pattern.prefix())
            };
            (found.base, path, found.base_source)
        }
    };

    let folder_status = folder_status(&path, project);

    let json_schema = std::fs::read_to_string(
        project
            .join(".astro")
            .join("collections")
            .join(format!("{}.schema.json", found.name)),
    )
    .ok();
    let helpers = found
        .schema_source
        .as_deref()
        .and_then(crate::parser::extract_helpers);
    // Data collections too, so Project Settings can show their fields
    let merged = schema_merger::create_complete_schema(
        &found.name,
        json_schema.as_deref(),
        helpers.as_deref(),
        found.schema_source.is_some(),
    );
    let (schema, schema_status, schema_error) = (merged.schema, merged.status, merged.error);

    // Fields are detected in a complete schema only. Without the generated
    // JSON, the schema is just the config's image() and reference() fields, so
    // the conventional names apply, as with no schema
    let resolved = resolve_collection_settings(
        [&set, &file],
        [&settings.project, &shared.project],
        global,
        schema
            .as_ref()
            .filter(|_| schema_status == SchemaStatus::Complete),
        &pattern,
        patterns.is_some(),
    );

    debug!(
        "Astro Editor [PROJECT_SCAN] Collection {}: {kind:?} at {} ({folder_status:?}), schema {schema_status:?}",
        found.name,
        path.display()
    );

    Collection {
        name: found.name,
        kind,
        path,
        base,
        patterns,
        pattern_error,
        folder_source,
        folder_status,
        loader_name: found.loader_name,
        inline_loader: found.inline_loader,
        schema_status,
        schema_error,
        complete_schema: schema.and_then(|schema| serde_json::to_string(&schema).ok()),
        settings: resolved,
    }
}

/// The pattern that decides which of a collection's files are entries
pub fn entry_pattern(collection: &Collection) -> EntryPattern {
    collection
        .patterns
        .as_deref()
        .and_then(|patterns| EntryPattern::new(patterns).ok())
        .unwrap_or_else(EntryPattern::legacy)
}

fn folder_status(path: &Path, project: &Path) -> FolderStatus {
    let inside = match (dunce::canonicalize(path), dunce::canonicalize(project)) {
        (Ok(folder), Ok(project)) => folder.starts_with(project),
        _ => normalize(path).starts_with(normalize(project)),
    };
    if !inside {
        FolderStatus::OutsideProject
    } else if path.is_dir() {
        FolderStatus::Ok
    } else {
        FolderStatus::Missing
    }
}

/// `set` is the writer's, `file` the project file's
fn resolve_project_settings(
    set: &ProjectSettings,
    file: &ProjectSettings,
) -> ResolvedProjectSettings {
    ResolvedProjectSettings {
        content_directory: set_or(
            &set.content_directory,
            &file.content_directory,
            CONTENT_DIR.to_string(),
        ),
        mdx_components_directories: set_or(
            &set.mdx_components_directories,
            &file.mdx_components_directories,
            vec![MDX_COMPONENTS_DIR.to_string()],
        ),
        add_component_imports: set_or(
            &set.add_component_imports,
            &file.add_component_imports,
            false,
        ),
        reorder_frontmatter: set_or(&set.reorder_frontmatter, &file.reorder_frontmatter, false),
        git_panel: set_or(&set.git_panel, &file.git_panel, false),
        assets_directory: set_or(
            &set.assets_directory,
            &file.assets_directory,
            ASSETS_DIR.to_string(),
        ),
        use_absolute_asset_paths: set_or(
            &set.use_absolute_asset_paths,
            &file.use_absolute_asset_paths,
            false,
        ),
    }
}

/// The writer's value if they set one, else the project file's
fn layered<T: Clone>(set: &Option<T>, file: &Option<T>) -> Option<Resolved<T>> {
    match (set, file) {
        (Some(value), _) => Some(Resolved::new(value.clone(), SettingSource::Set)),
        (None, Some(value)) => Some(Resolved::new(value.clone(), SettingSource::ProjectFile)),
        (None, None) => None,
    }
}

fn set_or<T: Clone>(set: &Option<T>, file: &Option<T>, convention: T) -> Resolved<T> {
    layered(set, file).unwrap_or_else(|| Resolved::new(convention, SettingSource::Convention))
}

/// A setting with no value by convention
fn set_or_none<T: Clone>(set: &Option<T>, file: &Option<T>) -> Resolved<Option<T>> {
    match layered(set, file) {
        Some(resolved) => Resolved::new(Some(resolved.value), resolved.source),
        None => Resolved::new(None, SettingSource::Convention),
    }
}

/// A collection setting that falls back to the project's, then a convention.
/// At each level, the writer's value beats the project file's
fn collection_or_project<T: Clone>(
    [collection, collection_file]: [&Option<T>; 2],
    [project, project_file]: [&Option<T>; 2],
    convention: T,
) -> Resolved<T> {
    layered(collection, collection_file)
        .or_else(|| {
            layered(project, project_file).map(|resolved| match resolved.source {
                SettingSource::Set => Resolved::new(resolved.value, SettingSource::Project),
                _ => resolved,
            })
        })
        .unwrap_or_else(|| Resolved::new(convention, SettingSource::Convention))
}

/// `[set, file]` are the writer's settings and the project file's, for the
/// collection and for the project
fn resolve_collection_settings(
    [set, file]: [&CollectionSettings; 2],
    [project, project_file]: [&ProjectSettings; 2],
    global: &GlobalSettings,
    schema: Option<&SchemaDefinition>,
    pattern: &EntryPattern,
    has_pattern: bool,
) -> ResolvedCollectionSettings {
    // A field the schema defines with this name and type, if there's a schema
    let detect = |set: &Option<String>, file: &Option<String>, names: &[&str], field_type: &str| {
        if let Some(field) = layered(set, file) {
            return Resolved::new(vec![field.value], field.source);
        }
        let Some(schema) = schema else {
            let names = names.iter().map(|n| n.to_string()).collect();
            return Resolved::new(names, SettingSource::Convention);
        };
        let found = names.iter().find(|name| {
            schema
                .fields
                .iter()
                .any(|f| f.name == **name && f.field_type == field_type)
        });
        match found {
            Some(name) => Resolved::new(vec![name.to_string()], SettingSource::Schema),
            None => Resolved::new(Vec::new(), SettingSource::Missing),
        }
    };
    let single = |resolved: Resolved<Vec<String>>| Resolved {
        value: resolved.value.into_iter().next(),
        source: resolved.source,
    };

    let allowed = if has_pattern {
        pattern.new_file_extensions()
    } else {
        Vec::new()
    };
    let new_file_type = match allowed.as_slice() {
        ["md"] => Resolved::new(FileType::Md, SettingSource::Config),
        ["mdx"] => Resolved::new(FileType::Mdx, SettingSource::Config),
        _ => layered(&set.default_file_type, &file.default_file_type).unwrap_or_else(|| {
            Resolved::new(global.general.default_file_type, SettingSource::Global)
        }),
    };

    ResolvedCollectionSettings {
        skipped_files: set_or(&set.skipped_files, &file.skipped_files, SkippedFiles::Hide),
        title_field: single(detect(
            &set.title_field,
            &file.title_field,
            &["title"],
            "string",
        )),
        description_field: single(detect(
            &set.description_field,
            &file.description_field,
            &["description"],
            "string",
        )),
        published_date_field: detect(
            &set.published_date_field,
            &file.published_date_field,
            &PUBLISHED_DATE_FIELDS,
            "date",
        ),
        draft_field: single(detect(
            &set.draft_field,
            &file.draft_field,
            &["draft"],
            "boolean",
        )),
        default_sort: set_or_none(&set.default_sort, &file.default_sort),
        new_file_type,
        file_name_pattern: set_or(
            &set.file_name_pattern,
            &file.file_name_pattern,
            FILE_NAME_PATTERN.to_string(),
        ),
        url_pattern: set_or_none(&set.url_pattern, &file.url_pattern),
        assets_directory: collection_or_project(
            [&set.assets_directory, &file.assets_directory],
            [&project.assets_directory, &project_file.assets_directory],
            ASSETS_DIR.to_string(),
        ),
        use_absolute_asset_paths: collection_or_project(
            [
                &set.use_absolute_asset_paths,
                &file.use_absolute_asset_paths,
            ],
            [
                &project.use_absolute_asset_paths,
                &project_file.use_absolute_asset_paths,
            ],
            false,
        ),
    }
}

/// A folder's subfolders, as Astro lists them for legacy collections: not
/// starting with `_` or `.`. `node_modules` is left out too, for a content
/// folder set to the project root
fn subfolders(dir: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
        .filter(|name| !name.starts_with(['_', '.']) && name != "node_modules")
        .collect();
    names.sort();
    names
}

fn relative_to(path: &Path, project: &Path) -> String {
    path.strip_prefix(project)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::preferences::DefaultSort;

    struct Site(tempfile::TempDir);

    impl Site {
        fn new(config: &str) -> Self {
            let dir = tempfile::tempdir().unwrap();
            std::fs::create_dir_all(dir.path().join("src")).unwrap();
            if !config.is_empty() {
                std::fs::write(dir.path().join("src/content.config.ts"), config).unwrap();
            }
            Self(dir)
        }

        fn dir(self, path: &str) -> Self {
            std::fs::create_dir_all(self.0.path().join(path)).unwrap();
            self
        }

        fn file(self, path: &str, content: &str) -> Self {
            let path = self.0.path().join(path);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, content).unwrap();
            self
        }

        fn root(&self) -> PathBuf {
            dunce::canonicalize(self.0.path()).unwrap()
        }

        fn scan(&self) -> ProjectScan {
            self.scan_with(&ProjectSettingsData::default())
        }

        fn scan_with(&self, settings: &ProjectSettingsData) -> ProjectScan {
            scan_project(&self.root(), settings, &GlobalSettings::default())
        }
    }

    fn named<'a>(scan: &'a ProjectScan, name: &str) -> &'a Collection {
        scan.collections.iter().find(|c| c.name == name).unwrap()
    }

    fn with_collection(name: &str, settings: CollectionSettings) -> ProjectSettingsData {
        let mut data = ProjectSettingsData::default();
        data.collections.insert(name.to_string(), settings);
        data
    }

    const BLOG_SCHEMA: &str = r#"{
        "type": "object",
        "properties": {
            "title": { "type": "string" },
            "pubDate": { "type": "string", "format": "date-time" },
            "draft": { "type": "boolean" }
        },
        "required": ["title"]
    }"#;

    #[test]
    fn finds_the_favicon_preferring_svg() {
        assert_eq!(Site::new("").scan().favicon, None);

        let site = Site::new("")
            .file("public/favicon.ico", "")
            .file("public/favicon.svg", "");
        let svg = normalize_path_for_serialization(&site.root().join("public/favicon.svg"));
        assert_eq!(site.scan().favicon, Some(svg));
    }

    #[test]
    fn finds_folders_from_the_loader() {
        let site = Site::new(
            r#"export const collections = {
                posts: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/posts' }) }),
                docs: defineCollection({ loader: glob({ pattern: 'docs/**/*.mdx', base: 'src/content' }) }),
            };"#,
        )
        .dir("src/posts")
        .dir("src/content/docs");
        let scan = site.scan();

        assert!(!scan.fallback);
        assert_eq!(scan.config_path.as_deref(), Some("src/content.config.ts"));
        let posts = named(&scan, "posts");
        assert_eq!(posts.kind, CollectionKind::Glob);
        assert_eq!(posts.path, site.root().join("src/posts"));
        assert_eq!(posts.folder_source, SettingSource::Config);
        assert_eq!(posts.folder_status, FolderStatus::Ok);

        let docs = named(&scan, "docs");
        assert_eq!(docs.path, site.root().join("src/content/docs"));
        assert_eq!(docs.base, site.root().join("src/content"));
        assert_eq!(docs.settings.new_file_type.value, FileType::Mdx);
        assert_eq!(docs.settings.new_file_type.source, SettingSource::Config);
    }

    #[test]
    fn reports_missing_and_outside_folders() {
        let site = Site::new(
            r#"export const collections = {
                gone: defineCollection({ loader: glob({ pattern: '*.md', base: './src/gone' }) }),
                elsewhere: defineCollection({ loader: glob({ pattern: '*.md', base: '../shared' }) }),
            };"#,
        );
        let scan = site.scan();
        assert_eq!(named(&scan, "gone").folder_status, FolderStatus::Missing);
        assert_eq!(
            named(&scan, "elsewhere").folder_status,
            FolderStatus::OutsideProject
        );
        assert!(scan.collections.iter().all(|c| !c.is_browsable()));
    }

    #[test]
    fn unreadable_loaders_use_the_content_folder() {
        let site = Site::new(
            r#"export const collections = {
                feed: defineCollection({ loader: customLoader() }),
            };"#,
        )
        .dir("content/feed");
        let scan = site.scan_with(&ProjectSettingsData {
            project: ProjectSettings {
                content_directory: Some("content".to_string()),
                ..Default::default()
            },
            ..Default::default()
        });
        let feed = named(&scan, "feed");
        assert_eq!(feed.kind, CollectionKind::Unknown);
        assert_eq!(feed.path, site.root().join("content/feed"));
        assert_eq!(feed.folder_source, SettingSource::Convention);
        assert!(feed.is_browsable());
    }

    #[test]
    fn finds_unreadable_loaders_files_in_the_data_store() {
        let project =
            dunce::canonicalize(Path::new(env!("CARGO_MANIFEST_DIR")).join("../test/loaders"))
                .unwrap();
        let scan = scan_project(
            &project,
            &ProjectSettingsData::default(),
            &GlobalSettings::default(),
        );
        let folder = |name: &str| {
            let collection = named(&scan, name);
            (
                collection.kind,
                collection.path.clone(),
                collection.folder_source,
            )
        };
        let unknown_in = |path: &str| {
            (
                CollectionKind::Unknown,
                project.join(path),
                SettingSource::DataStore,
            )
        };

        assert_eq!(folder("talks"), unknown_in("talks"));
        assert_eq!(folder("journal"), unknown_in("writing/journal"));
        assert_eq!(folder("recipes"), unknown_in("src/content/recipes"));
        assert_eq!(folder("podcasts"), unknown_in("src/podcasts"));
        assert_eq!(
            folder("team"),
            (
                CollectionKind::Data,
                project.join("src/data/team.json"),
                SettingSource::DataStore
            )
        );
        // Spread into the export from another file
        assert_eq!(folder("guides"), unknown_in("src/guides"));
        assert!(named(&scan, "guides").is_browsable());
        // No files, or not in the store, so the convention
        for name in ["scrobbles", "bookmarks"] {
            assert_eq!(named(&scan, name).folder_source, SettingSource::Convention);
        }
    }

    #[test]
    fn adds_collections_from_the_data_store_only_when_the_config_spreads_some_in() {
        let store = crate::data_store::serialize(&[
            ("blog", &[Some("src/content/blog/a.md")]),
            ("renamed", &[Some("src/renamed/a.md")]),
        ]);
        let config = |collections: &str| {
            format!(
                "const blog = defineCollection({{ loader: glob({{ pattern: '*.md', base: 'src/content/blog' }}) }});
                export const collections = {{ {collections} }};"
            )
        };
        let names = |site: Site| -> Vec<String> {
            site.file(".astro/data-store.json", &store)
                .dir("src/renamed")
                .scan()
                .collections
                .into_iter()
                .map(|c| c.name)
                .collect()
        };
        assert_eq!(names(Site::new(&config("blog"))), ["blog"]);
        assert_eq!(
            names(Site::new(&config("blog, ...more"))),
            ["blog", "renamed"]
        );
    }

    #[test]
    fn a_chosen_folder_beats_the_data_store() {
        let site = Site::new(
            r#"export const collections = {
                feed: defineCollection({ loader: customLoader() }),
            };"#,
        )
        .file(
            ".astro/data-store.json",
            &crate::data_store::serialize(&[("feed", &[Some("src/feed/a.md")])]),
        )
        .dir("src/feed")
        .dir("elsewhere");
        let scan = site.scan_with(&with_collection(
            "feed",
            CollectionSettings {
                folder: Some("elsewhere".to_string()),
                ..Default::default()
            },
        ));
        let feed = named(&scan, "feed");
        assert_eq!(feed.path, site.root().join("elsewhere"));
        assert_eq!(feed.folder_source, SettingSource::Set);

        // Even when the store says its entries are data
        let site = site.file(
            ".astro/data-store.json",
            &crate::data_store::serialize(&[("feed", &[Some("src/feed.json")])]),
        );
        let scan = site.scan_with(&with_collection(
            "feed",
            CollectionSettings {
                folder: Some("elsewhere".to_string()),
                ..Default::default()
            },
        ));
        let feed = named(&scan, "feed");
        assert_eq!(feed.kind, CollectionKind::Unknown);
        assert!(feed.is_browsable());
        assert_eq!(site.scan().collections[0].kind, CollectionKind::Data);
    }

    #[test]
    fn folder_override_replaces_the_base() {
        let site = Site::new(
            r#"export const collections = {
                blog: defineCollection({ loader: glob({ pattern: 'blog/**/*.md', base: 'src/content' }) }),
            };"#,
        )
        .dir("content/posts");
        let scan = site.scan_with(&with_collection(
            "blog",
            CollectionSettings {
                folder: Some("content/posts".to_string()),
                ..Default::default()
            },
        ));
        let blog = named(&scan, "blog");
        assert_eq!(blog.path, site.root().join("content/posts"));
        assert_eq!(blog.base, blog.path);
        assert_eq!(blog.folder_source, SettingSource::Set);
        // The pattern's `blog/` prefix is the folder it replaces
        let pattern = entry_pattern(blog);
        assert!(pattern.is_match("post.md"));
        assert!(pattern.is_match("2024/post.md"));
    }

    #[test]
    fn a_glob_pattern_that_cant_be_read_is_reported() {
        let site = Site::new(
            r#"import { patterns } from './patterns';
            export const collections = {
                blog: defineCollection({ loader: glob({ pattern: patterns, base: 'src/content/blog' }) }),
            };"#,
        )
        .dir("src/content/blog");
        let scan = site.scan();
        assert!(named(&scan, "blog").pattern_error.is_some());
    }

    #[test]
    fn legacy_collections_and_their_undefined_neighbours() {
        let site = Site::new(
            r#"export const collections = { blog: defineCollection({ schema: z.object({}) }) };"#,
        )
        .dir("src/content/blog")
        .dir("src/content/docs")
        .dir("src/content/_drafts");
        let scan = site.scan();
        let names: Vec<_> = scan.collections.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, ["blog", "docs"]);
        assert!(scan
            .collections
            .iter()
            .all(|c| c.kind == CollectionKind::Legacy));
        assert!(scan.collections.iter().all(|c| c.patterns.is_none()));
    }

    #[test]
    fn falls_back_to_folders_without_a_config() {
        let site = Site::new("")
            .dir("src/content/notes")
            .dir("src/content/.hidden")
            .dir("src/content/node_modules");
        let scan = site.scan();
        assert!(scan.fallback);
        assert_eq!(scan.config_error, None);
        assert_eq!(scan.collections.len(), 1);
        assert_eq!(scan.collections[0].kind, CollectionKind::Folder);

        let broken = Site::new("export const collections = {").dir("src/content/notes");
        let scan = broken.scan();
        assert!(scan.fallback);
        assert!(scan.config_error.is_some());
        assert_eq!(scan.collections.len(), 1);
    }

    #[test]
    fn data_collections_arent_browsable() {
        let site = Site::new(
            r#"export const collections = {
                authors: defineCollection({ loader: file('src/data/authors.json') }),
                tags: defineCollection({ loader: glob({ pattern: '**/*.json', base: 'src/data/tags' }) }),
            };"#,
        )
        .dir("src/data/tags");
        let scan = site.scan();
        assert!(scan
            .collections
            .iter()
            .all(|c| c.kind == CollectionKind::Data));
        assert!(scan.collections.iter().all(|c| !c.is_browsable()));
    }

    #[test]
    fn reads_data_collections_schemas() {
        let site = Site::new(
            r#"export const collections = {
                authors: defineCollection({
                    loader: file('src/data/authors.json'),
                    schema: z.object({ name: z.string() }),
                }),
            };"#,
        )
        .file(
            ".astro/collections/authors.schema.json",
            r#"{ "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] }"#,
        );
        let authors = named(&site.scan(), "authors").clone();
        assert_eq!(authors.kind, CollectionKind::Data);
        assert_eq!(authors.schema_status, SchemaStatus::Complete);
        assert!(authors.complete_schema.is_some());
    }

    #[test]
    fn bad_patterns_fall_back_to_the_legacy_pattern() {
        let site = Site::new(
            r#"export const collections = {
                blog: defineCollection({ loader: glob({ pattern: '**/*.@(md|mdx)', base: 'src/blog' }) }),
            };"#,
        )
        .dir("src/blog");
        let blog = &site.scan().collections[0];
        assert_eq!(blog.patterns, None);
        assert!(blog.pattern_error.is_some());
        assert!(blog.is_browsable());
    }

    #[test]
    fn detects_fields_from_the_schema() {
        let site = Site::new(
            r#"export const collections = {
                blog: defineCollection({ loader: glob({ pattern: '**/*.md', base: 'src/blog' }) }),
                notes: defineCollection({ loader: glob({ pattern: '**/*.md', base: 'src/notes' }) }),
            };"#,
        )
        .dir("src/blog")
        .dir("src/notes")
        .file(".astro/collections/blog.schema.json", BLOG_SCHEMA);
        let scan = site.scan();

        let blog = named(&scan, "blog");
        assert_eq!(blog.schema_status, SchemaStatus::Complete);
        let s = &blog.settings;
        assert_eq!(s.title_field.value.as_deref(), Some("title"));
        assert_eq!(s.title_field.source, SettingSource::Schema);
        assert_eq!(s.published_date_field.value, ["pubDate"]);
        assert_eq!(s.draft_field.value.as_deref(), Some("draft"));
        assert_eq!(s.description_field.value, None);
        assert_eq!(s.description_field.source, SettingSource::Missing);

        // No schema: the conventional names, read from the files
        let notes = named(&scan, "notes");
        assert_eq!(notes.schema_status, SchemaStatus::None);
        assert_eq!(notes.settings.draft_field.value.as_deref(), Some("draft"));
        assert_eq!(notes.settings.draft_field.source, SettingSource::Convention);
        assert_eq!(
            notes.settings.published_date_field.value,
            PUBLISHED_DATE_FIELDS
        );
    }

    #[test]
    fn reports_schemas_it_cant_read() {
        let site = Site::new(
            r#"export const collections = {
                blog: defineCollection({
                    loader: glob({ pattern: '**/*.md', base: 'src/blog' }),
                    schema: ({ image }) => z.object({ cover: image() }),
                }),
            };"#,
        )
        .dir("src/blog");
        let blog = &site.scan().collections[0];
        assert_eq!(blog.schema_status, SchemaStatus::NotGenerated);
        // The helpers alone don't say which field is the title
        assert_eq!(blog.settings.title_field.source, SettingSource::Convention);

        let site = site.file(".astro/collections/blog.schema.json", "{ nope");
        let blog = &site.scan().collections[0];
        assert_eq!(blog.schema_status, SchemaStatus::Unreadable);
        assert!(blog.schema_error.is_some());
        assert!(blog.complete_schema.is_some(), "falls back to the helpers");
    }

    #[test]
    fn reports_a_schema_without_helpers_that_astro_hasnt_generated() {
        let site = Site::new(
            r#"export const collections = {
                blog: defineCollection({
                    loader: glob({ pattern: '**/*.md', base: 'src/blog' }),
                    schema: z.object({ title: z.string() }),
                }),
            };"#,
        )
        .dir("src/blog");
        let blog = &site.scan().collections[0];
        assert_eq!(blog.schema_status, SchemaStatus::NotGenerated);
        assert!(blog.complete_schema.is_none());
    }

    #[test]
    fn settings_override_detection_and_project_defaults_apply() {
        let site = Site::new(
            r#"export const collections = {
                blog: defineCollection({ loader: glob({ pattern: '**/*.{md,mdx}', base: 'src/blog' }) }),
            };"#,
        )
        .dir("src/blog")
        .file(".astro/collections/blog.schema.json", BLOG_SCHEMA);
        let mut settings = with_collection(
            "blog",
            CollectionSettings {
                draft_field: Some("unpublished".to_string()),
                default_file_type: Some(FileType::Mdx),
                use_absolute_asset_paths: Some(false),
                default_sort: Some(DefaultSort {
                    mode: "title".to_string(),
                    direction: crate::models::preferences::SortDirection::Asc,
                }),
                ..Default::default()
            },
        );
        settings.project.assets_directory = Some("src/images".to_string());
        settings.project.use_absolute_asset_paths = Some(true);

        let s = &site.scan_with(&settings).collections[0].settings;
        assert_eq!(s.draft_field.value.as_deref(), Some("unpublished"));
        assert_eq!(s.draft_field.source, SettingSource::Set);
        assert_eq!(s.new_file_type.value, FileType::Mdx);
        assert_eq!(s.new_file_type.source, SettingSource::Set);
        assert_eq!(s.assets_directory.value, "src/images");
        assert_eq!(s.assets_directory.source, SettingSource::Project);
        assert!(!s.use_absolute_asset_paths.value);
        assert_eq!(s.use_absolute_asset_paths.source, SettingSource::Set);
        assert!(s.default_sort.value.is_some());
        assert_eq!(s.default_sort.source, SettingSource::Set);
        let project = &site.scan_with(&settings).project_settings;
        assert_eq!(project.assets_directory.value, "src/images");
        assert_eq!(project.assets_directory.source, SettingSource::Set);
        assert!(project.use_absolute_asset_paths.value);

        // Unset, the file type comes from the global preference
        let scan = site.scan();
        let s = &scan.collections[0].settings;
        assert_eq!(s.new_file_type.source, SettingSource::Global);
        assert_eq!(s.assets_directory.value, ASSETS_DIR);
        assert_eq!(s.assets_directory.source, SettingSource::Convention);
        let project = &scan.project_settings;
        assert_eq!(project.assets_directory.source, SettingSource::Convention);
        assert!(!project.use_absolute_asset_paths.value);
    }

    const BLOG_CONFIG: &str = r#"export const collections = {
        blog: defineCollection({ loader: glob({ pattern: '**/*.{md,mdx}', base: 'src/blog' }) }),
    };"#;

    #[test]
    fn the_project_file_fills_in_what_the_writer_leaves_unset() {
        let site = Site::new(BLOG_CONFIG)
            .dir("src/blog")
            .dir("content/posts")
            .file(".astro/collections/blog.schema.json", BLOG_SCHEMA)
            .file(
                FILE_NAME,
                r#"{
                    "$schema": "https://astroeditor.danny.is/astro-editor-config.schema.json",
                    "project": { "assetsDirectory": "src/images", "reorderFrontmatter": true },
                    "collections": {
                        "blog": {
                            "folder": "content/posts",
                            "fileNamePattern": "{slug}",
                            "draftField": "hidden",
                            "urlPattern": "/blog/{slug}",
                            "useAbsoluteAssetPaths": true
                        }
                    }
                }"#,
            );

        let scan = site.scan();
        let blog = &scan.collections[0];
        assert!(blog.path.ends_with("content/posts"));
        assert_eq!(blog.folder_source, SettingSource::ProjectFile);
        let s = &blog.settings;
        assert_eq!(s.file_name_pattern.value, "{slug}");
        assert_eq!(s.file_name_pattern.source, SettingSource::ProjectFile);
        // Beats what's detected in the schema
        assert_eq!(s.draft_field.value.as_deref(), Some("hidden"));
        assert_eq!(s.draft_field.source, SettingSource::ProjectFile);
        assert_eq!(s.url_pattern.value.as_deref(), Some("/blog/{slug}"));
        assert_eq!(s.assets_directory.value, "src/images");
        assert_eq!(s.assets_directory.source, SettingSource::ProjectFile);
        assert!(scan.project_settings.reorder_frontmatter.value);
        assert_eq!(
            scan.project_settings.reorder_frontmatter.source,
            SettingSource::ProjectFile
        );
        let file = scan.project_file.as_ref().unwrap();
        assert!(file.path.ends_with(FILE_NAME));
        assert_eq!(file.error, None);
        assert!(file.unknown_collections.is_empty());

        // The writer's settings win, key by key, and a collection value from the
        // file beats a project value the writer set
        let mut settings = with_collection(
            "blog",
            CollectionSettings {
                file_name_pattern: Some("{YYYY}-{slug}".to_string()),
                ..Default::default()
            },
        );
        settings.project.assets_directory = Some("src/pictures".to_string());
        settings.project.use_absolute_asset_paths = Some(false);
        settings.project.reorder_frontmatter = Some(false);
        let scan = site.scan_with(&settings);
        let s = &scan.collections[0].settings;
        assert_eq!(s.file_name_pattern.value, "{YYYY}-{slug}");
        assert_eq!(s.file_name_pattern.source, SettingSource::Set);
        assert_eq!(s.draft_field.source, SettingSource::ProjectFile);
        assert!(s.use_absolute_asset_paths.value);
        assert_eq!(
            s.use_absolute_asset_paths.source,
            SettingSource::ProjectFile
        );
        assert_eq!(s.assets_directory.value, "src/pictures");
        assert_eq!(s.assets_directory.source, SettingSource::Project);
        assert!(!scan.project_settings.reorder_frontmatter.value);
        assert_eq!(scan.project_settings.assets_directory.value, "src/pictures");
    }

    #[test]
    fn a_project_file_with_a_wrong_value_is_ignored_with_its_error() {
        let site = Site::new(BLOG_CONFIG).dir("src/blog").file(
            FILE_NAME,
            r#"{ "collections": { "blog": { "fileNamePattern": "{slug}", "draftField": 3 } } }"#,
        );
        let scan = site.scan();
        assert_eq!(
            scan.collections[0].settings.file_name_pattern.source,
            SettingSource::Convention
        );
        let error = scan.project_file.unwrap().error.unwrap();
        assert!(error.contains("line 1"), "{error}");
    }

    #[test]
    fn the_project_file_names_collections_the_config_does_not_have() {
        let site = Site::new(BLOG_CONFIG).dir("src/blog").file(
            FILE_NAME,
            r#"{ "collections": { "blog": {}, "notes": {} } }"#,
        );
        let file = site.scan().project_file.unwrap();
        assert_eq!(file.unknown_collections, vec!["notes".to_string()]);

        // Without a readable config, which collections there are isn't known
        let site = Site::new("")
            .dir("src/content/blog")
            .file(FILE_NAME, r#"{ "collections": { "notes": {} } }"#);
        assert!(site
            .scan()
            .project_file
            .unwrap()
            .unknown_collections
            .is_empty());
    }
}
