//! Works out a project's collections: what the content config says about each
//! one, combined with the user's settings and AE's conventions. Every resolved
//! setting records where its value came from, so the settings UI can say.
//!
//! See `docs/developer/app-data.md`.

use crate::content_config::pattern::EntryPattern;
use crate::content_config::{self, normalize, GlobBase, Loader};
use crate::models::collection::{
    Collection, CollectionKind, FolderStatus, ProjectScan, Resolved, ResolvedCollectionSettings,
    ResolvedProjectSettings, SchemaStatus, SettingSource,
};
use crate::models::preferences::{
    CollectionSettings, FileType, GlobalSettings, ProjectSettings, ProjectSettingsData,
    SkippedFiles,
};
use crate::schema_merger::{self, SchemaDefinition};
use log::{debug, warn};
use std::path::{Path, PathBuf};

const CONTENT_DIR: &str = "src/content";
const ASSETS_DIR: &str = "src/assets";
const MDX_COMPONENTS_DIR: &str = "src/components/mdx";
/// How new files are named: today's date
const FILE_NAME_PATTERN: &str = "{YYYY-MM-DD}";

/// Field names tried, in order, for a file's published date
const PUBLISHED_DATE_FIELDS: [&str; 3] = ["pubDate", "date", "publishedDate"];

/// Reads the project's content config and resolves every collection in it
pub fn scan_project(
    project: &Path,
    settings: &ProjectSettingsData,
    global: &GlobalSettings,
) -> ProjectScan {
    let project_settings = resolve_project_settings(&settings.project);
    let content_dir = project.join(&project_settings.content_directory.value);

    let config_path = content_config::find_config(project);
    let config = config_path.as_ref().map(|path| {
        std::fs::read_to_string(path)
            .map_err(|e| format!("Couldn't read the content config: {e}"))
            .and_then(|source| content_config::parse_config(&source, path, project))
    });

    let (defined, config_error) = match config {
        Some(Ok(collections)) if !collections.is_empty() => (Some(collections), None),
        Some(Ok(_)) => (
            None,
            Some("The content config has no collections".to_string()),
        ),
        Some(Err(e)) => (None, Some(e)),
        None => (None, None),
    };
    if let Some(error) = &config_error {
        warn!("Astro Editor [PROJECT_SCAN] {error}");
    }

    let fallback = defined.is_none();
    let mut found: Vec<Found> = match defined {
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
                .map(|c| Found::from_config(c, project, &content_dir))
                .chain(legacy_folders.into_iter().map(|name| Found {
                    base: project.join(CONTENT_DIR).join(&name),
                    name,
                    kind: CollectionKind::Legacy,
                    base_source: SettingSource::Convention,
                    patterns: None,
                    schema_source: None,
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
            })
            .collect(),
    };
    found.sort_by_key(|c| c.kind == CollectionKind::Data);

    let collections = found
        .into_iter()
        .map(|found| resolve_collection(found, project, settings, global))
        .collect();

    ProjectScan {
        config_path: config_path.map(|path| relative_to(&path, project)),
        config_error,
        fallback,
        project_settings,
        collections,
    }
}

/// A collection as found in the config or on disk, before settings apply
struct Found {
    name: String,
    kind: CollectionKind,
    base: PathBuf,
    base_source: SettingSource,
    patterns: Option<Vec<String>>,
    schema_source: Option<String>,
}

impl Found {
    fn from_config(
        collection: content_config::ConfigCollection,
        project: &Path,
        content_dir: &Path,
    ) -> Self {
        let name = collection.name;
        let by_convention = |dir: &Path| (dir.join(&name), SettingSource::Convention);

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
            Loader::Unknown => (CollectionKind::Unknown, by_convention(content_dir), None),
        };

        Self {
            name,
            kind,
            base,
            base_source,
            patterns,
            schema_source: collection.schema_source,
        }
    }
}

fn resolve_collection(
    found: Found,
    project: &Path,
    settings: &ProjectSettingsData,
    global: &GlobalSettings,
) -> Collection {
    let set = settings
        .collections
        .get(&found.name)
        .cloned()
        .unwrap_or_default();

    let (pattern, patterns, pattern_error) = match &found.patterns {
        Some(patterns) => match EntryPattern::new(patterns) {
            Ok(pattern) => (pattern, Some(patterns.clone()), None),
            Err(e) => (EntryPattern::legacy(), None, Some(e)),
        },
        None => (EntryPattern::legacy(), None, None),
    };

    let mut kind = found.kind;
    if kind == CollectionKind::Glob && patterns.is_some() && !pattern.can_match_markdown() {
        kind = CollectionKind::Data;
    }

    // A folder override replaces `base`, and the pattern's prefix with it
    let (base, path, folder_source) = match &set.folder {
        Some(folder) => {
            let base = normalize(&project.join(folder));
            (base.clone(), base, SettingSource::Set)
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
    let merged = if kind == CollectionKind::Data {
        None
    } else {
        Some(schema_merger::create_complete_schema(
            &found.name,
            json_schema.as_deref(),
            helpers.as_deref(),
            found.schema_source.is_some(),
        ))
    };
    let (schema, schema_status, schema_error) = match merged {
        Some(merged) => (merged.schema, merged.status, merged.error),
        None => (None, SchemaStatus::None, None),
    };

    // Fields are detected in a complete schema only. Without the generated
    // JSON, the schema is just the config's image() and reference() fields, so
    // the conventional names apply, as with no schema
    let resolved = resolve_collection_settings(
        &set,
        &settings.project,
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

fn resolve_project_settings(set: &ProjectSettings) -> ResolvedProjectSettings {
    ResolvedProjectSettings {
        content_directory: set_or(set.content_directory.clone(), CONTENT_DIR.to_string()),
        mdx_components_directory: set_or(
            set.mdx_components_directory.clone(),
            MDX_COMPONENTS_DIR.to_string(),
        ),
        add_component_imports: set_or(set.add_component_imports, false),
        assets_directory: set_or(set.assets_directory.clone(), ASSETS_DIR.to_string()),
        use_absolute_asset_paths: set_or(set.use_absolute_asset_paths, false),
    }
}

fn set_or<T>(set: Option<T>, convention: T) -> Resolved<T> {
    match set {
        Some(value) => Resolved::new(value, SettingSource::Set),
        None => Resolved::new(convention, SettingSource::Convention),
    }
}

/// A collection setting that falls back to the project's, then a convention
fn collection_or_project<T>(
    collection: Option<T>,
    project: Option<T>,
    convention: T,
) -> Resolved<T> {
    match (collection, project) {
        (Some(value), _) => Resolved::new(value, SettingSource::Set),
        (None, Some(value)) => Resolved::new(value, SettingSource::Project),
        (None, None) => Resolved::new(convention, SettingSource::Convention),
    }
}

fn resolve_collection_settings(
    set: &CollectionSettings,
    project: &ProjectSettings,
    global: &GlobalSettings,
    schema: Option<&SchemaDefinition>,
    pattern: &EntryPattern,
    has_pattern: bool,
) -> ResolvedCollectionSettings {
    // A field the schema defines with this name and type, if there's a schema
    let detect = |set: &Option<String>, names: &[&str], field_type: &str| {
        if let Some(field) = set {
            return Resolved::new(vec![field.clone()], SettingSource::Set);
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
    let new_file_type = match (allowed.as_slice(), set.default_file_type) {
        (["md"], _) => Resolved::new(FileType::Md, SettingSource::Config),
        (["mdx"], _) => Resolved::new(FileType::Mdx, SettingSource::Config),
        (_, Some(file_type)) => Resolved::new(file_type, SettingSource::Set),
        (_, None) => Resolved::new(global.general.default_file_type, SettingSource::Global),
    };

    ResolvedCollectionSettings {
        skipped_files: set_or(set.skipped_files, SkippedFiles::Hide),
        title_field: single(detect(&set.title_field, &["title"], "string")),
        description_field: single(detect(&set.description_field, &["description"], "string")),
        published_date_field: detect(&set.published_date_field, &PUBLISHED_DATE_FIELDS, "date"),
        draft_field: single(detect(&set.draft_field, &["draft"], "boolean")),
        default_sort: set_or(set.default_sort.clone().map(Some), None),
        new_file_type,
        file_name_pattern: set_or(set.file_name_pattern.clone(), FILE_NAME_PATTERN.to_string()),
        url_pattern: set_or(set.url_pattern.clone().map(Some), None),
        assets_directory: collection_or_project(
            set.assets_directory.clone(),
            project.assets_directory.clone(),
            ASSETS_DIR.to_string(),
        ),
        use_absolute_asset_paths: collection_or_project(
            set.use_absolute_asset_paths,
            project.use_absolute_asset_paths,
            false,
        ),
    }
}

/// A folder's subfolders, as Astro lists them for legacy collections: not
/// starting with `_` or `.`
fn subfolders(dir: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
        .filter(|name| !name.starts_with(['_', '.']))
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
            .dir("src/content/.hidden");
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
}
