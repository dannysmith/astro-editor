//! Reads and writes the files in `preferences/`: global settings, the project
//! registry, and one settings file per project.
//!
//! - Writes go through a temporary file and a rename, so a crash never leaves
//!   half a file behind.
//! - A file that doesn't parse is never overwritten. It's renamed to
//!   `<name>.broken-<timestamp>.json` and the caller gets a message to show.
//! - Project files from before version 3 aren't migrated. They're renamed to
//!   `<id>.v2.json`, so a later release could still read them, and the project
//!   starts with no settings.
//!
//! See `docs/developer/app-data.md`.

use crate::models::preferences::{
    GlobalSettings, ListedProject, ProjectMetadata, ProjectRegistry, ProjectSettingsData,
    ProjectSettingsFile, Relocation, PROJECT_SETTINGS_VERSION,
};
use log::{error, info, warn};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{path::BaseDirectory, Manager};

const GLOBAL_SETTINGS_FILE: &str = "global-settings.json";
const REGISTRY_FILE: &str = "project-registry.json";
const PROJECTS_DIR: &str = "projects";

/// Held across every read-modify-write, so two commands can't interleave
static LOCK: Mutex<()> = Mutex::new(());

/// A value read from a preferences file, and a message for the writer if the
/// file couldn't be read
pub struct Loaded<T> {
    pub value: T,
    pub problem: Option<String>,
}

/// A project as opened: its registry entry and its stored settings
pub struct OpenedProject {
    pub metadata: ProjectMetadata,
    pub settings: ProjectSettingsData,
    pub problems: Vec<String>,
}

pub struct Preferences {
    dir: PathBuf,
}

impl Preferences {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    pub fn from_app(app: &tauri::AppHandle) -> Result<Self, String> {
        let app_data = app
            .path()
            .resolve("", BaseDirectory::AppLocalData)
            .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
        Ok(Self::new(app_data.join("preferences")))
    }

    pub fn load_global_settings(&self) -> Loaded<GlobalSettings> {
        let _lock = lock();
        self.read_or_default(GLOBAL_SETTINGS_FILE)
    }

    pub fn save_global_settings(&self, settings: &GlobalSettings) -> Result<(), String> {
        let _lock = lock();
        self.write(GLOBAL_SETTINGS_FILE, settings)
    }

    pub fn load_registry(&self) -> Loaded<ProjectRegistry> {
        let _lock = lock();
        self.read_or_default(REGISTRY_FILE)
    }

    /// Registers the project at `path` if it's new, marks it as last opened, and
    /// returns it with its settings
    pub fn open_project(&self, path: &Path) -> Result<OpenedProject, String> {
        let canonical = canonical_path(path)?;
        let _lock = lock();

        let mut problems = Vec::new();
        let Loaded {
            value: mut registry,
            problem,
        } = self.read_or_default::<ProjectRegistry>(REGISTRY_FILE);
        problems.extend(problem);

        let now = now();
        let id = match find_project(&registry, &canonical) {
            Some(id) => id,
            None => {
                let metadata = new_project(&registry, &canonical, &now);
                info!(
                    "Astro Editor [PREFERENCES] Registering project {} at {canonical}",
                    metadata.id
                );
                let id = metadata.id.clone();
                registry.projects.insert(id.clone(), metadata);
                id
            }
        };
        let metadata = registry
            .projects
            .get_mut(&id)
            .expect("the project was just found or added");
        metadata.path = canonical.clone();
        metadata.last_opened = now;
        let metadata = metadata.clone();
        registry.last_opened_project = Some(id.clone());
        self.write(REGISTRY_FILE, &registry)?;

        let (stored, problem) = self.read_project_file(&id);
        problems.extend(problem);
        let settings = match stored {
            Some(file) if file.path == canonical => file.settings,
            stored => {
                let settings = stored.map(|file| file.settings).unwrap_or_default();
                self.write_project_file(&id, &canonical, &settings)?;
                settings
            }
        };

        Ok(OpenedProject {
            metadata,
            settings,
            problems,
        })
    }

    pub fn save_project_settings(
        &self,
        project_id: &str,
        settings: &ProjectSettingsData,
    ) -> Result<(), String> {
        let _lock = lock();
        let registry = self.read_or_default::<ProjectRegistry>(REGISTRY_FILE).value;
        let metadata = registry
            .projects
            .get(project_id)
            .ok_or_else(|| format!("No project with id {project_id}"))?;
        self.write_project_file(project_id, &metadata.path, settings)
    }

    /// The stored settings of the project at `path`, or none if it isn't
    /// registered. Read only: files `open_project` would move aside count as empty.
    pub fn project_settings_for_path(&self, path: &Path) -> ProjectSettingsData {
        let Ok(canonical) = canonical_path(path) else {
            return ProjectSettingsData::default();
        };
        let _lock = lock();
        let registry = self.read_or_default::<ProjectRegistry>(REGISTRY_FILE).value;
        find_project(&registry, &canonical)
            .and_then(|id| self.read_current_project_file(&id))
            .map(|file| file.settings)
            .unwrap_or_default()
    }

    /// Every registered project, most recently opened first, with whether its
    /// folder is still there
    pub fn list_projects(&self) -> Loaded<Vec<ListedProject>> {
        let Loaded { value, problem } = self.load_registry();
        let mut projects: Vec<ListedProject> = value
            .projects
            .into_values()
            .map(|project| ListedProject {
                missing: !Path::new(&project.path).is_dir(),
                project,
            })
            .collect();
        // ISO timestamps in one format, so they sort as strings
        projects.sort_by(|a, b| b.project.last_opened.cmp(&a.project.last_opened));
        Loaded {
            value: projects,
            problem,
        }
    }

    /// Forgets a project and deletes its settings. The project's own files are
    /// never touched.
    pub fn remove_project(&self, project_id: &str) -> Result<(), String> {
        let _lock = lock();
        let mut registry = self.read_or_default::<ProjectRegistry>(REGISTRY_FILE).value;
        if registry.projects.shift_remove(project_id).is_none() {
            return Err(format!("No project with id {project_id}"));
        }
        if registry.last_opened_project.as_deref() == Some(project_id) {
            registry.last_opened_project = None;
        }
        self.delete_project_files(project_id)?;
        info!("Astro Editor [PREFERENCES] Removed project {project_id}");
        self.write(REGISTRY_FILE, &registry)
    }

    /// Points a project at the folder it moved to, keeping its settings. If
    /// another registered project is already there, nothing changes unless
    /// `replace` is set, in which case that project is removed first.
    pub fn relocate_project(
        &self,
        project_id: &str,
        path: &Path,
        replace: bool,
    ) -> Result<Relocation, String> {
        let canonical = canonical_path(path)?;
        let _lock = lock();
        let mut registry = self.read_or_default::<ProjectRegistry>(REGISTRY_FILE).value;
        if !registry.projects.contains_key(project_id) {
            return Err(format!("No project with id {project_id}"));
        }

        if let Some(other) = find_project(&registry, &canonical).filter(|id| id != project_id) {
            if !replace {
                return Ok(Relocation::AlreadyRegistered);
            }
            registry.projects.shift_remove(&other);
            if registry.last_opened_project.as_deref() == Some(other.as_str()) {
                registry.last_opened_project = Some(project_id.to_string());
            }
            self.delete_project_files(&other)?;
            info!("Astro Editor [PREFERENCES] Removed project {other}, replaced by {project_id}");
        }

        let metadata = registry
            .projects
            .get_mut(project_id)
            .expect("the project was checked above");
        metadata.path = canonical.clone();
        self.write(REGISTRY_FILE, &registry)?;
        if let Some(file) = self.read_current_project_file(project_id) {
            self.write_project_file(project_id, &canonical, &file.settings)?;
        }
        info!("Astro Editor [PREFERENCES] Relocated project {project_id} to {canonical}");
        Ok(Relocation::Relocated)
    }

    fn project_file(&self, id: &str) -> PathBuf {
        self.dir.join(PROJECTS_DIR).join(format!("{id}.json"))
    }

    /// A project's settings file if it's a current one. Read only: unlike
    /// `read_project_file`, old and broken files are left where they are.
    fn read_current_project_file(&self, id: &str) -> Option<ProjectSettingsFile> {
        let content = std::fs::read_to_string(self.project_file(id)).ok()?;
        serde_json::from_str::<ProjectSettingsFile>(&content)
            .ok()
            .filter(|file| file.version >= PROJECT_SETTINGS_VERSION)
    }

    /// Deletes a project's settings file and the version 2 file kept beside it
    fn delete_project_files(&self, id: &str) -> Result<(), String> {
        let projects = self.dir.join(PROJECTS_DIR);
        for name in [format!("{id}.json"), format!("{id}.v2.json")] {
            match std::fs::remove_file(projects.join(&name)) {
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => {
                    return Err(format!("Failed to delete {name}: {e}"));
                }
                _ => {}
            }
        }
        Ok(())
    }

    /// A project's settings file. `None` when there isn't a current one: it's
    /// missing, from before version 3 (renamed aside), or broken (renamed aside,
    /// with a message).
    fn read_project_file(&self, id: &str) -> (Option<ProjectSettingsFile>, Option<String>) {
        let path = self.project_file(id);
        let Ok(content) = std::fs::read_to_string(&path) else {
            return (None, None);
        };

        let version = serde_json::from_str::<serde_json::Value>(&content)
            .ok()
            .map(|value| value.get("version").and_then(|v| v.as_u64()).unwrap_or(0));
        if version.is_some_and(|v| v < PROJECT_SETTINGS_VERSION as u64) {
            let old = path.with_file_name(format!("{id}.v2.json"));
            info!(
                "Astro Editor [PREFERENCES] Moving old project settings aside: {}",
                old.display()
            );
            if let Err(e) = std::fs::rename(&path, &old) {
                warn!("Astro Editor [PREFERENCES] Couldn't move old project settings aside: {e}");
            }
            return (None, None);
        }

        match serde_json::from_str(&content) {
            Ok(file) => (Some(file), None),
            Err(e) => (None, Some(set_aside_broken(&path, &e.to_string()))),
        }
    }

    fn write_project_file(
        &self,
        id: &str,
        path: &str,
        settings: &ProjectSettingsData,
    ) -> Result<(), String> {
        let file = ProjectSettingsFile {
            version: PROJECT_SETTINGS_VERSION,
            path: path.to_string(),
            settings: settings.clone(),
        };
        self.write(&format!("{PROJECTS_DIR}/{id}.json"), &file)
    }

    /// A file read over the defaults, so settings added since it was written get
    /// their default values
    fn read_or_default<T: DeserializeOwned + Serialize + Default>(&self, name: &str) -> Loaded<T> {
        let path = self.dir.join(name);
        let Ok(content) = std::fs::read_to_string(&path) else {
            return Loaded {
                value: T::default(),
                problem: None,
            };
        };
        let parsed = serde_json::from_str(&content).and_then(|stored| {
            let mut value = serde_json::to_value(T::default())?;
            merge(&mut value, stored);
            serde_json::from_value(value)
        });
        match parsed {
            Ok(value) => Loaded {
                value,
                problem: None,
            },
            Err(e) => Loaded {
                value: T::default(),
                problem: Some(set_aside_broken(&path, &e.to_string())),
            },
        }
    }

    fn write<T: Serialize>(&self, name: &str, value: &T) -> Result<(), String> {
        let path = self.dir.join(name);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create preferences folder: {e}"))?;
        }
        let json = serde_json::to_string_pretty(value)
            .map_err(|e| format!("Failed to serialize {name}: {e}"))?;
        let temp = path.with_extension("json.tmp");
        std::fs::write(&temp, json).map_err(|e| format!("Failed to write {name}: {e}"))?;
        std::fs::rename(&temp, &path).map_err(|e| format!("Failed to write {name}: {e}"))
    }
}

/// Copies `stored` over `defaults`, object by object
fn merge(defaults: &mut serde_json::Value, stored: serde_json::Value) {
    match (defaults, stored) {
        (serde_json::Value::Object(defaults), serde_json::Value::Object(stored)) => {
            for (key, value) in stored {
                match defaults.get_mut(&key) {
                    Some(default) => merge(default, value),
                    None => {
                        defaults.insert(key, value);
                    }
                }
            }
        }
        (defaults, stored) => *defaults = stored,
    }
}

fn lock() -> std::sync::MutexGuard<'static, ()> {
    LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Renames a file that doesn't parse out of the way, so it's never overwritten,
/// and returns a message for the writer
fn set_aside_broken(path: &Path, parse_error: &str) -> String {
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("settings");
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let aside = path.with_file_name(format!("{stem}.broken-{timestamp}.json"));
    error!(
        "Astro Editor [PREFERENCES] {} couldn't be read ({parse_error}); moving it to {}",
        path.display(),
        aside.display()
    );
    if let Err(e) = std::fs::rename(path, &aside) {
        error!("Astro Editor [PREFERENCES] Couldn't move the broken file aside: {e}");
    }
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("A settings file");
    format!(
        "{name} couldn't be read, so its settings were reset. The old file was kept as {}.",
        aside
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
    )
}

/// A project folder's path with symlinks resolved, so one folder is always
/// registered once
pub fn canonical_path(path: &Path) -> Result<String, String> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("Couldn't open {}: {e}", path.display()))?;
    Ok(canonical.to_string_lossy().to_string())
}

/// The id of the project registered at `canonical`. Older entries may not have
/// stored a canonical path, so those are canonicalised to compare.
fn find_project(registry: &ProjectRegistry, canonical: &str) -> Option<String> {
    registry
        .projects
        .values()
        .find(|project| {
            project.path == canonical
                || canonical_path(Path::new(&project.path)).is_ok_and(|p| p == canonical)
        })
        .map(|project| project.id.clone())
}

fn new_project(registry: &ProjectRegistry, canonical: &str, now: &str) -> ProjectMetadata {
    let path = Path::new(canonical);
    let folder = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project")
        .to_string();
    let name = std::fs::read_to_string(path.join("package.json"))
        .ok()
        .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok())
        .and_then(|json| json.get("name")?.as_str().map(str::to_string))
        .filter(|name| !name.is_empty())
        .unwrap_or(folder.clone());

    let slug: String = folder
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let id = loop {
        let suffix = &uuid::Uuid::new_v4().simple().to_string()[..8];
        let id = format!("{slug}-{suffix}");
        if !registry.projects.contains_key(&id) {
            break id;
        }
    };

    ProjectMetadata {
        id,
        name,
        path: canonical.to_string(),
        last_opened: now.to_string(),
        created: now.to_string(),
    }
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::preferences::{CollectionSettings, ProjectSettings};

    fn setup() -> (tempfile::TempDir, Preferences, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let prefs = Preferences::new(dir.path().join("preferences"));
        let project = dir.path().join("my-site");
        std::fs::create_dir_all(&project).unwrap();
        (dir, prefs, project)
    }

    #[test]
    fn registers_a_project_once_by_path() {
        let (_dir, prefs, project) = setup();
        std::fs::write(project.join("package.json"), r#"{ "name": "astro-blog" }"#).unwrap();

        let first = prefs.open_project(&project).unwrap();
        assert_eq!(first.metadata.name, "astro-blog");
        assert!(first.metadata.id.starts_with("my-site-"));

        let again = prefs.open_project(&project.join(".")).unwrap();
        assert_eq!(again.metadata.id, first.metadata.id);

        let registry = prefs.load_registry().value;
        assert_eq!(registry.projects.len(), 1);
        assert_eq!(registry.last_opened_project, Some(first.metadata.id));
    }

    #[test]
    fn two_copies_of_a_template_are_separate_projects() {
        let (dir, prefs, project) = setup();
        let copy = dir.path().join("copy");
        std::fs::create_dir_all(&copy).unwrap();
        for folder in [&project, &copy] {
            std::fs::write(folder.join("package.json"), r#"{ "name": "template" }"#).unwrap();
        }

        let a = prefs.open_project(&project).unwrap().metadata;
        let b = prefs.open_project(&copy).unwrap().metadata;
        assert_ne!(a.id, b.id);
        assert_eq!(prefs.load_registry().value.projects.len(), 2);
    }

    #[test]
    fn saves_sparse_project_settings() {
        let (_dir, prefs, project) = setup();
        let id = prefs.open_project(&project).unwrap().metadata.id;

        let mut settings = ProjectSettingsData {
            project: ProjectSettings {
                assets_directory: Some("src/images".to_string()),
                ..Default::default()
            },
            ..Default::default()
        };
        settings.collections.insert(
            "blog".to_string(),
            CollectionSettings {
                draft_field: Some("unpublished".to_string()),
                ..Default::default()
            },
        );
        prefs.save_project_settings(&id, &settings).unwrap();

        let json = std::fs::read_to_string(prefs.project_file(&id)).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["version"], 3);
        assert_eq!(
            value["project"],
            serde_json::json!({ "assetsDirectory": "src/images" })
        );
        assert_eq!(
            value["collections"],
            serde_json::json!({ "blog": { "draftField": "unpublished" } })
        );

        assert_eq!(prefs.open_project(&project).unwrap().settings, settings);
        assert_eq!(prefs.project_settings_for_path(&project), settings);
    }

    #[test]
    fn moves_version_2_project_files_aside() {
        let (_dir, prefs, project) = setup();
        let id = prefs.open_project(&project).unwrap().metadata.id;
        let v2 = r#"{ "settings": { "pathOverrides": { "contentDirectory": "content" } }, "version": 2 }"#;
        std::fs::write(prefs.project_file(&id), v2).unwrap();

        let opened = prefs.open_project(&project).unwrap();
        assert_eq!(opened.settings, ProjectSettingsData::default());
        assert!(opened.problems.is_empty());
        let aside = prefs.dir.join(PROJECTS_DIR).join(format!("{id}.v2.json"));
        assert_eq!(std::fs::read_to_string(aside).unwrap(), v2);
    }

    #[test]
    fn never_overwrites_a_broken_file() {
        let (_dir, prefs, project) = setup();
        std::fs::create_dir_all(&prefs.dir).unwrap();
        std::fs::write(prefs.dir.join(GLOBAL_SETTINGS_FILE), "{ not json").unwrap();

        let loaded = prefs.load_global_settings();
        assert_eq!(loaded.value, GlobalSettings::default());
        assert!(loaded.problem.is_some());
        assert!(!prefs.dir.join(GLOBAL_SETTINGS_FILE).exists());
        let broken: Vec<_> = std::fs::read_dir(&prefs.dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".broken-"))
            .collect();
        assert_eq!(broken.len(), 1);
        assert_eq!(
            std::fs::read_to_string(broken[0].path()).unwrap(),
            "{ not json"
        );

        // Projects still open
        assert!(prefs.open_project(&project).is_ok());
    }

    /// Settings with one collection setting, to tell a project's settings apart
    fn settings_with_draft_field(field: &str) -> ProjectSettingsData {
        let mut settings = ProjectSettingsData::default();
        settings.collections.insert(
            "blog".to_string(),
            CollectionSettings {
                draft_field: Some(field.to_string()),
                ..Default::default()
            },
        );
        settings
    }

    #[test]
    fn lists_projects_newest_first_and_flags_missing_ones() {
        let (dir, prefs, project) = setup();
        let other = dir.path().join("other");
        std::fs::create_dir_all(&other).unwrap();
        let first = prefs.open_project(&project).unwrap().metadata;
        std::thread::sleep(std::time::Duration::from_millis(5));
        let second = prefs.open_project(&other).unwrap().metadata;
        std::fs::remove_dir_all(&other).unwrap();

        let listed = prefs.list_projects().value;
        let ids: Vec<_> = listed.iter().map(|p| p.project.id.as_str()).collect();
        assert_eq!(ids, [second.id.as_str(), first.id.as_str()]);
        assert!(listed[0].missing);
        assert!(!listed[1].missing);
    }

    #[test]
    fn removes_a_project_and_its_settings() {
        let (_dir, prefs, project) = setup();
        let id = prefs.open_project(&project).unwrap().metadata.id;
        prefs
            .save_project_settings(&id, &settings_with_draft_field("hidden"))
            .unwrap();
        let v2 = prefs.dir.join(PROJECTS_DIR).join(format!("{id}.v2.json"));
        std::fs::write(&v2, "{}").unwrap();

        prefs.remove_project(&id).unwrap();

        let registry = prefs.load_registry().value;
        assert!(registry.projects.is_empty());
        assert_eq!(registry.last_opened_project, None);
        assert!(!prefs.project_file(&id).exists());
        assert!(!v2.exists());
        assert!(project.exists());
        assert!(prefs.remove_project(&id).is_err());
    }

    #[test]
    fn relocates_a_moved_project_keeping_its_settings() {
        let (dir, prefs, project) = setup();
        let id = prefs.open_project(&project).unwrap().metadata.id;
        let settings = settings_with_draft_field("hidden");
        prefs.save_project_settings(&id, &settings).unwrap();
        let moved = dir.path().join("moved");
        std::fs::rename(&project, &moved).unwrap();

        assert_eq!(
            prefs.relocate_project(&id, &moved, false).unwrap(),
            Relocation::Relocated
        );

        let canonical = canonical_path(&moved).unwrap();
        assert_eq!(prefs.load_registry().value.projects[&id].path, canonical);
        assert_eq!(
            prefs.read_current_project_file(&id).unwrap().path,
            canonical
        );
        let reopened = prefs.open_project(&moved).unwrap();
        assert_eq!(reopened.metadata.id, id);
        assert_eq!(reopened.settings, settings);
    }

    #[test]
    fn relocating_onto_a_registered_folder_replaces_it_only_when_asked() {
        let (dir, prefs, project) = setup();
        let id = prefs.open_project(&project).unwrap().metadata.id;
        let moved_settings = settings_with_draft_field("hidden");
        prefs.save_project_settings(&id, &moved_settings).unwrap();
        let moved = dir.path().join("moved");
        std::fs::rename(&project, &moved).unwrap();
        // Opened at its new place first, so it registered as a new project
        let other = prefs.open_project(&moved).unwrap().metadata.id;
        prefs
            .save_project_settings(&other, &settings_with_draft_field("draft"))
            .unwrap();

        assert_eq!(
            prefs.relocate_project(&id, &moved, false).unwrap(),
            Relocation::AlreadyRegistered
        );
        assert_eq!(prefs.load_registry().value.projects.len(), 2);

        assert_eq!(
            prefs.relocate_project(&id, &moved, true).unwrap(),
            Relocation::Relocated
        );
        let registry = prefs.load_registry().value;
        assert_eq!(registry.projects.keys().collect::<Vec<_>>(), [&id]);
        assert_eq!(registry.last_opened_project, Some(id.clone()));
        assert!(!prefs.project_file(&other).exists());
        assert_eq!(prefs.open_project(&moved).unwrap().settings, moved_settings);
    }

    #[test]
    fn reads_existing_global_settings_and_registry() {
        let (_dir, prefs, _project) = setup();
        std::fs::create_dir_all(&prefs.dir).unwrap();
        std::fs::write(
            prefs.dir.join(GLOBAL_SETTINGS_FILE),
            r##"{ "general": { "ideCommand": "code", "theme": "dark", "highlights": { "nouns": true }, "autoSaveDelay": 5 }, "appearance": { "headingColor": { "light": "#111111", "dark": "#eeeeee" } }, "version": 2 }"##,
        )
        .unwrap();
        std::fs::write(
            prefs.dir.join(REGISTRY_FILE),
            r#"{ "projects": { "blog": { "id": "blog", "name": "blog", "path": "/nowhere/blog", "lastOpened": "2026-01-01T00:00:00.000Z", "created": "2026-01-01T00:00:00.000Z" } }, "lastOpenedProject": "blog", "version": 2 }"#,
        )
        .unwrap();

        let global = prefs.load_global_settings();
        assert!(global.problem.is_none());
        assert_eq!(global.value.general.ide_command, "code");
        assert!(global.value.general.highlights.nouns);
        assert_eq!(global.value.general.auto_save_delay, 5);
        assert_eq!(global.value.appearance.heading_color.light, "#111111");

        let registry = prefs.load_registry();
        assert!(registry.problem.is_none());
        assert_eq!(registry.value.projects["blog"].path, "/nowhere/blog");
    }
}
