use crate::collections;
use crate::commands::files::rename_without_replacing;
use crate::content_config::pattern::{EntryPattern, MARKDOWN_EXTENSIONS};
use crate::content_config::{self, Loader};
use crate::models::collection::ProjectScan;
use crate::models::preferences::{FileType, SkippedFiles};
use crate::models::{Collection, DirectoryInfo, FileEntry};
use crate::preferences::Preferences;
use crate::utils::{normalize_path_for_serialization, validate_project_path};
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DirectoryScanResult {
    pub subdirectories: Vec<DirectoryInfo>,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RustToastEvent {
    r#type: String,
    message: String,
    description: Option<String>,
    duration: Option<u64>,
}

/// Send a toast notification to the frontend
pub(crate) fn send_toast_notification(
    app: &tauri::AppHandle,
    toast_type: &str,
    message: &str,
    description: Option<&str>,
) -> Result<(), tauri::Error> {
    let toast_event = RustToastEvent {
        r#type: toast_type.to_string(),
        message: message.to_string(),
        description: description.map(|s| s.to_string()),
        duration: None,
    };

    app.emit("rust-toast", toast_event)?;
    Ok(())
}

/// Check if a directory path is in the blocked/dangerous list
fn is_blocked_directory(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    // Normalize path for consistent comparison (handle both / and \ separators)
    let mut normalized_path = path_str.replace('\\', "/");
    // Ensure trailing slash for consistent starts_with matching
    if !normalized_path.ends_with('/') {
        normalized_path.push('/');
    }
    // Lowercase version for case-insensitive Windows path comparison
    #[allow(unused_variables)]
    let normalized_lower = normalized_path.to_lowercase();

    // Unix blocked directory patterns (matching our Tauri capabilities deny list)
    #[cfg(not(target_os = "windows"))]
    let blocked_patterns = [
        "/System/",
        "/usr/",
        "/etc/",
        "/bin/",
        "/sbin/",
        "/Library/Frameworks/",
        "/Library/Extensions/",
        "/Library/Keychains/",
        "/.ssh/",
        "/.aws/",
        "/.docker/",
    ];

    // Windows blocked directory patterns (trailing slash prevents false positives like "c:/windowsupdate")
    #[cfg(target_os = "windows")]
    let blocked_patterns = [
        "c:/windows/",
        "c:/program files/",
        "c:/program files (x86)/",
        "c:/programdata/",
        "c:/users/default/",
        "c:/users/public/",
        "c:/recovery/",
        "c:/$recycle.bin/",
    ];

    #[cfg(not(target_os = "windows"))]
    for pattern in &blocked_patterns {
        if normalized_path.starts_with(pattern) {
            return true;
        }
    }

    #[cfg(target_os = "windows")]
    for pattern in &blocked_patterns {
        if normalized_lower.starts_with(pattern) {
            return true;
        }
    }

    // Also check for home directory patterns
    if let Some(home) = std::env::home_dir() {
        let home_str = home.to_string_lossy().replace('\\', "/");

        #[cfg(not(target_os = "windows"))]
        let blocked_home_patterns = [
            format!("{home_str}/Library/Keychains/"),
            format!("{home_str}/.ssh/"),
            format!("{home_str}/.aws/"),
            format!("{home_str}/.docker/"),
        ];

        #[cfg(target_os = "windows")]
        let blocked_home_patterns = [
            format!("{}/.ssh/", home_str.to_lowercase()),
            format!("{}/.aws/", home_str.to_lowercase()),
            format!("{}/.docker/", home_str.to_lowercase()),
            format!("{}/appdata/local/microsoft/", home_str.to_lowercase()),
            format!("{}/appdata/roaming/microsoft/", home_str.to_lowercase()),
        ];

        for pattern in &blocked_home_patterns {
            #[cfg(not(target_os = "windows"))]
            if normalized_path.starts_with(pattern) {
                return true;
            }

            #[cfg(target_os = "windows")]
            if normalized_lower.starts_with(pattern) {
                return true;
            }
        }
    }

    false
}

/// The folder picked in the native dialog, with `/` on Windows too, or none if
/// it was cancelled. Blocked folders are refused with a toast.
#[tauri::command]
#[specta::specta]
pub async fn select_project_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // The dialog reports back through a callback, which the channel turns
    // into something to await
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Select Astro Project Folder")
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });
    let picked = rx
        .await
        .map_err(|e| format!("Folder dialog closed unexpectedly: {e}"))?;

    match picked {
        Some(folder) => {
            let folder_path = folder
                .into_path()
                .map_err(|e| format!("Invalid folder path: {e}"))?;
            let folder_path = folder_path.as_path();

            // Check if the selected directory is in a blocked location
            if is_blocked_directory(folder_path) {
                let path_str = folder_path.to_string_lossy();
                warn!("User attempted to open project in blocked directory: {path_str}");

                // Send toast notification to user
                let _ = send_toast_notification(
                    &app,
                    "error",
                    "Cannot open project in this directory",
                    Some("This directory is restricted for security reasons. Please choose a different location."),
                );

                return Err(format!(
                    "Cannot open project in restricted directory: {path_str}"
                ));
            }

            Ok(Some(normalize_path_for_serialization(folder_path)))
        }
        None => Ok(None),
    }
}

/// The project's collections, resolved with its stored settings
#[tauri::command]
#[specta::specta]
pub async fn scan_project(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<ProjectScan, String> {
    info!("Astro Editor [PROJECT_SCAN] Scanning project at path: {project_path}");
    let project = canonical_project(&project_path)?;
    let preferences = Preferences::from_app(&app)?;
    let settings = preferences.project_settings_for_path(&project);
    let global = preferences.global_settings();
    Ok(collections::scan_project(&project, &settings, &global))
}

fn canonical_project(project_path: &str) -> Result<PathBuf, String> {
    dunce::canonicalize(project_path).map_err(|e| format!("Invalid project path: {e}"))
}

/// A `file()` collection's entries, read from its JSON file as reference targets
#[tauri::command]
#[specta::specta]
pub async fn load_file_based_collection(
    project_path: String,
    collection_name: String,
) -> Result<Vec<FileEntry>, String> {
    debug!("Astro Editor [FILE_COLLECTION] Loading file-based collection: {collection_name}");

    let project = PathBuf::from(&project_path);
    let config_path = content_config::find_config(&project)
        .ok_or_else(|| "The project has no content config".to_string())?;
    let source =
        std::fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {e}"))?;
    let collections = content_config::parse_config(&source, &config_path, &project)?;

    let file_path = collections
        .into_iter()
        .find_map(|collection| match collection.loader {
            Loader::Data { file: Some(file) } if collection.name == collection_name => {
                Some(project.join(file))
            }
            _ => None,
        })
        .ok_or_else(|| {
            format!("File-based collection '{collection_name}' not found in content.config")
        })?;

    debug!(
        "Astro Editor [FILE_COLLECTION] Found file path: {}",
        file_path.display()
    );

    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read collection file: {e}"))?;
    let json_data: serde_json::Value =
        serde_json::from_str(&json_content).map_err(|e| format!("Failed to parse JSON: {e}"))?;

    let array = json_data
        .as_array()
        .ok_or_else(|| "Collection file must contain a JSON array".to_string())?;

    let collection_root = file_path.parent().unwrap_or(&file_path).to_path_buf();
    let mut files = Vec::new();
    for obj in array.iter().filter_map(|item| item.as_object()) {
        // The entry's id is its `id`, or its `slug`
        let item_id = obj
            .get("id")
            .and_then(|v| v.as_str())
            .or_else(|| obj.get("slug").and_then(|v| v.as_str()))
            .ok_or_else(|| {
                "Missing unique identifier: collection items must have either 'id' or 'slug' field"
                    .to_string()
            })?
            .to_string();

        let frontmatter: indexmap::IndexMap<String, serde_json::Value> =
            obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
        let mut file_entry = FileEntry::new(
            file_path.clone(),
            collection_name.clone(),
            collection_root.clone(),
        )
        .with_frontmatter(frontmatter);
        file_entry.id = format!("{collection_name}/{item_id}");
        files.push(file_entry);
    }

    debug!(
        "Astro Editor [FILE_COLLECTION] Loaded {} items from {}",
        files.len(),
        collection_name
    );

    Ok(files)
}

/// A collection folder's subfolders and Markdown files (not recursive). Files
/// the collection's pattern leaves out are skipped, or marked as not entries if
/// the collection shows them dimmed, and so are folders with nothing to show.
#[tauri::command]
#[specta::specta]
pub async fn scan_directory(
    directory_path: String,
    collection: Collection,
) -> Result<DirectoryScanResult, String> {
    let dir_path = PathBuf::from(&directory_path);
    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path.display()));
    }

    let listing = CollectionListing::new(&collection);
    let mut subdirectories = Vec::new();
    let mut files = Vec::new();

    for entry in
        std::fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read metadata: {e}"))?;
        if file_type.is_symlink() || is_ignored_name(&path) {
            continue;
        }

        if file_type.is_dir() {
            if listing.has_visible_files(&path) {
                if let Ok(dir_info) = DirectoryInfo::new(path, &collection.path) {
                    subdirectories.push(dir_info);
                }
            }
        } else if let Some(file_entry) = listing.file_entry(&path, true) {
            files.push(file_entry);
        }
    }

    Ok(DirectoryScanResult {
        subdirectories,
        files,
    })
}

/// How many entries a collection has, in all its folders
#[tauri::command]
#[specta::specta]
pub async fn count_collection_files_recursive(collection: Collection) -> Result<u32, String> {
    let listing = CollectionListing::new(&collection);
    let mut count = 0;
    walk_markdown(&collection.path, &mut |path| {
        if listing.is_entry(path) {
            count += 1;
        }
        false
    });
    Ok(count)
}

/// Every entry in a collection, in all its folders, for the reference pickers and
/// the Content Finder. Files the pattern leaves out aren't entries, so they're
/// never included, whatever the collection's skipped files setting.
#[tauri::command]
#[specta::specta]
pub async fn scan_collection_files_recursive(
    collection: Collection,
) -> Result<Vec<FileEntry>, String> {
    let listing = CollectionListing::new(&collection);
    let mut files = Vec::new();
    walk_markdown(&collection.path, &mut |path| {
        // Checked before reading the file, which skipped files aren't worth
        if listing.is_entry(path) {
            files.extend(listing.file_entry(path, true));
        }
        false
    });
    Ok(files)
}

/// A free name, relative to `directory`, for a new file the collection's pattern
/// includes: `<stem>.<ext>`, or `<stem>/index.<ext>` for folder-per-entry
/// patterns, with `-1`, `-2`… added on a clash (see `free_entry`). `None` when no
/// name in `directory` would match, so a new file would be left out of the
/// collection.
#[tauri::command]
#[specta::specta]
pub async fn new_file_name(
    directory: String,
    collection: Collection,
    stem: String,
) -> Result<Option<String>, String> {
    let directory = PathBuf::from(directory);
    let extension = match collection.settings.new_file_type.value {
        FileType::Md => "md",
        FileType::Mdx => "mdx",
    };
    let listing = CollectionListing::new(&collection);
    let file = free_entry(&listing, &directory, &stem, None, &|name| {
        vec![
            directory.join(format!("{name}.{extension}")),
            directory.join(name).join(format!("index.{extension}")),
        ]
    })?;
    Ok(file.and_then(|file| {
        let relative = file.strip_prefix(&directory).ok()?;
        Some(relative.to_string_lossy().replace('\\', "/"))
    }))
}

/// Renames an entry's file to `stem`, or the first free name after it (`-1`,
/// `-2`…, as for new files), in the same folder and keeping its extension. Only
/// the file is renamed, never a folder. Returns the file's new path, its path
/// unchanged if it already has that name, or `None` if no such name would match
/// the collection's pattern. Never replaces anything.
///
/// `index` files are refused: Astro names them by their folder, so renaming one
/// would change its id, and in a folder-per-entry collection take it out of the
/// collection.
#[tauri::command]
#[specta::specta]
pub async fn rename_entry(
    file_path: String,
    collection: Collection,
    stem: String,
    project_root: String,
) -> Result<Option<String>, String> {
    let file = validate_project_path(&file_path, &project_root)?;
    let Some(directory) = file.parent() else {
        return Err("Invalid file path".to_string());
    };
    if file.file_stem().is_some_and(|stem| stem == "index") {
        return Err(INDEX_FILES_KEEP_THEIR_NAME.to_string());
    }
    let extension = file.extension().unwrap_or_default().to_string_lossy();

    let listing = CollectionListing::new(&collection);
    let found = free_entry(&listing, directory, &stem, Some(&file), &|name| {
        vec![directory.join(format!("{name}.{extension}"))]
    })?;
    let Some(new_file) = found else {
        return Ok(None);
    };
    if new_file != file {
        rename_without_replacing(&file, &new_file)?;
    }
    Ok(Some(normalize_path_for_serialization(&new_file)))
}

const INDEX_FILES_KEEP_THEIR_NAME: &str =
    "Files named index take their name from their folder, so Astro Editor doesn't rename them.";

/// The entry file for the first of `<stem>`, `<stem>-1`, `<stem>-2`… that's free
/// in `directory`: the first of the paths `shapes` gives for the name that the
/// collection's pattern includes. `None` if none of them is.
///
/// A name is taken, ignoring case as macOS does, by anything in the folder with
/// that name, hidden files included; by a Markdown file with it before the
/// extension (`post.mdx` takes `post`, as Astro would give both the id `post`);
/// or by an entry elsewhere in the collection with it as its `slug`. `renaming`,
/// the file being renamed, takes nothing.
fn free_entry(
    listing: &CollectionListing,
    directory: &Path,
    stem: &str,
    renaming: Option<&Path>,
    shapes: &dyn Fn(&str) -> Vec<PathBuf>,
) -> Result<Option<PathBuf>, String> {
    if stem.is_empty() || stem.starts_with('.') || stem.contains(['/', '\\']) {
        return Err(format!("\"{stem}\" isn't a file name"));
    }
    let is_renaming = |path: &Path| renaming == Some(path);

    let mut taken = HashSet::new();
    for entry in std::fs::read_dir(directory)
        .map_err(|e| format!("Failed to read directory: {e}"))?
        .filter_map(|entry| entry.ok())
    {
        let path = entry.path();
        if is_renaming(&path) {
            continue;
        }
        if is_markdown(&path) {
            if let Some(stem) = path.file_stem() {
                taken.insert(stem.to_string_lossy().to_lowercase());
            }
        }
        taken.insert(entry.file_name().to_string_lossy().to_lowercase());
    }

    let mut slugs = HashSet::new();
    walk_markdown(&listing.collection.path, &mut |path| {
        let slug = listing
            .file_entry(path, true)
            .filter(|entry| entry.is_entry && !is_renaming(path))
            .and_then(|entry| {
                entry
                    .frontmatter?
                    .get("slug")?
                    .as_str()
                    .map(str::to_lowercase)
            });
        slugs.extend(slug);
        false
    });

    for attempt in 0..1000 {
        let name = match attempt {
            0 => stem.to_string(),
            n => format!("{stem}-{n}"),
        };
        let Some(file) = shapes(&name)
            .into_iter()
            .find(|file| listing.is_entry(file))
        else {
            return Ok(None);
        };
        let clashes = taken.contains(&name.to_lowercase())
            || entry_id(&listing.collection.base, &file).is_some_and(|id| slugs.contains(&id));
        if !clashes {
            return Ok(Some(file));
        }
    }
    Err("Couldn't find a free file name".to_string())
}

/// The id Astro gives the entry at `file`, lowercased: its path from the
/// collection's base, without the extension or a final `/index`
fn entry_id(base: &Path, file: &Path) -> Option<String> {
    let relative = file.strip_prefix(base).ok()?.with_extension("");
    let id = relative.to_string_lossy().replace('\\', "/").to_lowercase();
    Some(id.strip_suffix("/index").map(str::to_string).unwrap_or(id))
}

/// Lists a collection's files: which are entries, and which to show
struct CollectionListing<'a> {
    collection: &'a Collection,
    pattern: EntryPattern,
    show_skipped: bool,
}

impl<'a> CollectionListing<'a> {
    fn new(collection: &'a Collection) -> Self {
        Self {
            collection,
            pattern: collections::entry_pattern(collection),
            show_skipped: collection.settings.skipped_files.value == SkippedFiles::Dim,
        }
    }

    /// Whether a Markdown file under the collection matches its pattern
    fn is_entry(&self, path: &Path) -> bool {
        path.strip_prefix(&self.collection.base)
            .ok()
            .map(|relative| relative.to_string_lossy().replace('\\', "/"))
            .is_some_and(|relative| self.pattern.is_match(&relative))
    }

    /// The file's entry, if it's a Markdown file the list shows. With
    /// `frontmatter`, its frontmatter is read for the sidebar.
    fn file_entry(&self, path: &Path, frontmatter: bool) -> Option<FileEntry> {
        if !is_markdown(path) {
            return None;
        }
        let is_entry = self.is_entry(path);
        if !is_entry && !self.show_skipped {
            return None;
        }
        let mut entry = FileEntry::new(
            path.to_path_buf(),
            self.collection.name.clone(),
            self.collection.base.clone(),
        );
        entry.is_entry = is_entry;
        if frontmatter {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(parsed) = crate::commands::files::parse_frontmatter_internal(&content) {
                    entry = entry.with_frontmatter(parsed.frontmatter);
                }
            }
        }
        Some(entry)
    }

    /// Whether a folder holds any file the list would show, at any depth
    fn has_visible_files(&self, dir: &Path) -> bool {
        walk_markdown(dir, &mut |path| self.show_skipped || self.is_entry(path))
    }
}

/// Calls `visit` with every Markdown file under `dir`, skipping symlinks and
/// ignored folders, until it returns true. Returns whether it did.
fn walk_markdown(dir: &Path, visit: &mut dyn FnMut(&Path) -> bool) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() || is_ignored_name(&path) {
            continue;
        }
        let found = if file_type.is_dir() {
            walk_markdown(&path, visit)
        } else {
            is_markdown(&path) && visit(&path)
        };
        if found {
            return true;
        }
    }
    false
}

/// Hidden files and folders, and `node_modules`, are never content
fn is_ignored_name(path: &Path) -> bool {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    name.starts_with('.') || name == "node_modules"
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| MARKDOWN_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

/// Resolves an absolute file path to a `FileEntry` within the given project, if the
/// file is a Markdown/MDX file in one of the project's collections.
///
/// Used by the deep-link handler (`astro-editor://open?path=...`). `file_path` is
/// untrusted input, so we canonicalize and verify it lives inside `project_path`
/// before touching collections, guarding against `../` traversal.
///
/// Returns `Ok(None)` when the path is valid and inside the project but isn't a
/// Markdown file in a collection (the caller opens the project and shows a
/// "couldn't find that file" toast).
#[tauri::command]
#[specta::specta]
pub async fn resolve_file_entry(
    app: tauri::AppHandle,
    file_path: String,
    project_path: String,
) -> Result<Option<FileEntry>, String> {
    let project = canonical_project(&project_path)?;
    let preferences = Preferences::from_app(&app)?;
    let scan = collections::scan_project(
        &project,
        &preferences.project_settings_for_path(&project),
        &preferences.global_settings(),
    );
    resolve_file_in_scan(&file_path, &project, &scan)
}

fn resolve_file_in_scan(
    file_path: &str,
    project: &Path,
    scan: &ProjectScan,
) -> Result<Option<FileEntry>, String> {
    // A missing file resolves to None (not an error)
    let Ok(file_canon) = dunce::canonicalize(file_path) else {
        return Ok(None);
    };

    // Security: the file must live inside the project root
    if !file_canon.starts_with(project) {
        return Err("File is not inside the project".to_string());
    }

    if !is_markdown(&file_canon) {
        return Ok(None);
    }

    // The collection whose pattern matches the file, preferring the most specific
    // base. Failing that, one whose folder holds it, if it shows skipped files.
    let containing = |collection: &&Collection| {
        collection.is_browsable() && file_canon.starts_with(&collection.path)
    };
    let mut candidates: Vec<&Collection> = scan.collections.iter().filter(containing).collect();
    candidates.sort_by_key(|collection| std::cmp::Reverse(collection.base.as_os_str().len()));

    let entry = candidates
        .iter()
        .find_map(|collection| {
            CollectionListing::new(collection)
                .file_entry(&file_canon, false)
                .filter(|entry| entry.is_entry)
        })
        .or_else(|| {
            candidates.iter().find_map(|collection| {
                CollectionListing::new(collection).file_entry(&file_canon, false)
            })
        });
    Ok(entry)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_is_blocked_directory_unix_system_paths() {
        // System paths should be blocked
        assert!(is_blocked_directory(&PathBuf::from("/System/Library")));
        assert!(is_blocked_directory(&PathBuf::from("/usr/bin")));
        assert!(is_blocked_directory(&PathBuf::from("/etc/passwd")));
        assert!(is_blocked_directory(&PathBuf::from("/bin/bash")));
        assert!(is_blocked_directory(&PathBuf::from("/sbin/mount")));
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_is_blocked_directory_unix_library_paths() {
        assert!(is_blocked_directory(&PathBuf::from(
            "/Library/Frameworks/Python.framework"
        )));
        assert!(is_blocked_directory(&PathBuf::from(
            "/Library/Extensions/SomeKext"
        )));
        assert!(is_blocked_directory(&PathBuf::from(
            "/Library/Keychains/System.keychain"
        )));
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_is_blocked_directory_unix_sensitive_dotfiles() {
        assert!(is_blocked_directory(&PathBuf::from("/.ssh/id_rsa")));
        assert!(is_blocked_directory(&PathBuf::from("/.aws/credentials")));
        assert!(is_blocked_directory(&PathBuf::from("/.docker/config.json")));
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_is_blocked_directory_unix_allowed_paths() {
        // User directories should be allowed
        assert!(!is_blocked_directory(&PathBuf::from(
            "/Users/danny/projects"
        )));
        assert!(!is_blocked_directory(&PathBuf::from(
            "/Users/danny/Desktop/myproject"
        )));
        assert!(!is_blocked_directory(&PathBuf::from(
            "/home/user/development"
        )));
        assert!(!is_blocked_directory(&PathBuf::from("/tmp/astro-project")));
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_is_blocked_directory_normalized_backslashes() {
        // Paths with backslashes should be normalized and still blocked
        // This simulates a path that might come from Windows-formatted input

        // The function normalizes backslashes to forward slashes
        // So /System\Library becomes /System/Library which is blocked
        let path_with_backslash = PathBuf::from("/System\\Library");
        assert!(
            is_blocked_directory(&path_with_backslash),
            "Normalized path /System/Library should be blocked"
        );

        // A safe path with backslash should still be safe after normalization
        let safe_path_with_backslash = PathBuf::from("/Users\\danny\\projects");
        assert!(
            !is_blocked_directory(&safe_path_with_backslash),
            "Normalized user path should not be blocked"
        );
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_validate_project_path_basic_unix() {
        // Test that basic Unix paths work
        let path = PathBuf::from("/Users/danny/projects/astro-site");
        assert!(!is_blocked_directory(&path));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_validate_project_path_basic_windows() {
        // Test that basic Windows paths work
        let path = PathBuf::from(r"C:\Users\danny\projects\astro-site");
        assert!(!is_blocked_directory(&path));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_is_blocked_directory_windows_system_paths() {
        // System paths should be blocked (case-insensitive)
        assert!(is_blocked_directory(&PathBuf::from(r"C:\Windows\System32")));
        assert!(is_blocked_directory(&PathBuf::from("c:/windows/system32")));
        assert!(is_blocked_directory(&PathBuf::from(
            r"C:\Program Files\App"
        )));
        assert!(is_blocked_directory(&PathBuf::from(
            r"C:\ProgramData\Config"
        )));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_is_blocked_directory_windows_case_insensitive() {
        // Windows paths should be case-insensitive
        assert!(is_blocked_directory(&PathBuf::from(r"C:\WINDOWS\System32")));
        assert!(is_blocked_directory(&PathBuf::from(r"c:\windows\system32")));
        assert!(is_blocked_directory(&PathBuf::from(
            r"C:\PROGRAM FILES\App"
        )));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_is_blocked_directory_windows_allowed_paths() {
        // User project directories should be allowed
        assert!(!is_blocked_directory(&PathBuf::from(
            r"C:\Users\danny\projects"
        )));
        assert!(!is_blocked_directory(&PathBuf::from(
            r"D:\Development\astro-site"
        )));
        assert!(!is_blocked_directory(&PathBuf::from(
            r"C:\Users\danny\Documents\Code"
        )));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_is_blocked_directory_windows_no_false_positives() {
        // Paths that start similarly to blocked paths but aren't blocked
        // e.g., "c:/windowsupdate" should NOT match "c:/windows/"
        assert!(!is_blocked_directory(&PathBuf::from(r"C:\WindowsUpdate")));
        assert!(!is_blocked_directory(&PathBuf::from(
            r"C:\Program Files Custom\App"
        )));
        // MicrosoftEdge should NOT match "microsoft/" pattern
        assert!(!is_blocked_directory(&PathBuf::from(
            r"C:\Users\danny\AppData\Local\MicrosoftEdge"
        )));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_is_blocked_directory_windows_appdata_microsoft() {
        // Test home-based AppData/Microsoft blocking rules
        if let Some(home) = std::env::home_dir() {
            let home_str = home.to_string_lossy();

            // These paths under AppData/*/Microsoft should be blocked
            let blocked_local =
                PathBuf::from(format!(r"{}\AppData\Local\Microsoft\Credentials", home_str));
            assert!(
                is_blocked_directory(&blocked_local),
                "AppData/Local/Microsoft should be blocked"
            );

            let blocked_roaming =
                PathBuf::from(format!(r"{}\AppData\Roaming\Microsoft\Windows", home_str));
            assert!(
                is_blocked_directory(&blocked_roaming),
                "AppData/Roaming/Microsoft should be blocked"
            );

            // But MicrosoftEdge (without trailing slash match) should be allowed
            let allowed_edge = PathBuf::from(format!(
                r"{}\AppData\Local\MicrosoftEdge\User Data",
                home_str
            ));
            assert!(
                !is_blocked_directory(&allowed_edge),
                "MicrosoftEdge should NOT be blocked (no trailing slash match)"
            );
        }
    }

    // --- resolve_file_entry tests ---

    fn resolve(file_path: String, project_path: String) -> Result<Option<FileEntry>, String> {
        let project = canonical_project(&project_path)?;
        let scan = collections::scan_project(&project, &Default::default(), &Default::default());
        resolve_file_in_scan(&file_path, &project, &scan)
    }

    /// Creates a temp project with a `src/content/<collection>/<relative>` markdown
    /// file and returns the temp dir plus the absolute file path.
    fn make_project_with_file(relative: &str) -> (tempfile::TempDir, PathBuf) {
        let temp = tempfile::TempDir::new().unwrap();
        let file_path = temp.path().join("src").join("content").join(relative);
        std::fs::create_dir_all(file_path.parent().unwrap()).unwrap();
        std::fs::write(&file_path, "# Hello\n").unwrap();
        (temp, file_path)
    }

    #[tokio::test]
    async fn test_resolve_file_entry_happy_path() {
        let (temp, file_path) = make_project_with_file("blog/post.md");

        let result = resolve(
            file_path.to_string_lossy().to_string(),
            temp.path().to_string_lossy().to_string(),
        )
        .unwrap();

        let entry = result.expect("expected the file to resolve");
        assert_eq!(entry.collection, "blog");
        assert_eq!(entry.name, "post");
        assert_eq!(entry.extension, "md");
        assert_eq!(entry.id, "blog/post");
    }

    #[tokio::test]
    async fn resolves_overlapping_collections_to_the_most_specific_one() {
        let (temp, post) = make_project_with_file("blog/post.md");
        let draft = temp.path().join("src/content/blog/draft.mdx");
        let about = temp.path().join("src/content/about.md");
        std::fs::write(&draft, "# Draft\n").unwrap();
        std::fs::write(&about, "# About\n").unwrap();
        std::fs::write(
            temp.path().join("src/content.config.ts"),
            r#"export const collections = {
                pages: defineCollection({ loader: glob({ base: 'src/content', pattern: '**/*.{md,mdx}' }) }),
                blog: defineCollection({ loader: glob({ base: 'src/content/blog', pattern: '*.md' }) }),
            };"#,
        )
        .unwrap();

        let collection = |file: &PathBuf| {
            resolve(
                file.to_string_lossy().to_string(),
                temp.path().to_string_lossy().to_string(),
            )
            .unwrap()
            .expect("expected the file to resolve")
            .collection
        };
        assert_eq!(collection(&post), "blog");
        assert_eq!(collection(&about), "pages");
        // Not one of blog's entries, so it's the collection whose pattern takes it
        assert_eq!(collection(&draft), "pages");
    }

    #[tokio::test]
    async fn test_resolve_file_entry_nested_path() {
        let (temp, file_path) = make_project_with_file("blog/2024/january/post.mdx");

        let result = resolve(
            file_path.to_string_lossy().to_string(),
            temp.path().to_string_lossy().to_string(),
        )
        .unwrap();

        let entry = result.expect("expected the nested file to resolve");
        assert_eq!(entry.collection, "blog");
        assert_eq!(entry.extension, "mdx");
        assert_eq!(entry.id, "blog/2024/january/post");
    }

    #[tokio::test]
    async fn test_resolve_file_entry_outside_project_is_rejected() {
        // File lives in a completely separate directory.
        let other = tempfile::TempDir::new().unwrap();
        let outside_file = other.path().join("secret.md");
        std::fs::write(&outside_file, "secret").unwrap();

        let project = tempfile::TempDir::new().unwrap();

        let result = resolve(
            outside_file.to_string_lossy().to_string(),
            project.path().to_string_lossy().to_string(),
        );

        assert!(result.is_err(), "file outside the project must be rejected");
    }

    #[tokio::test]
    async fn test_resolve_file_entry_traversal_is_rejected() {
        // A `..` path that escapes the project root must be rejected after canonicalization.
        let parent = tempfile::TempDir::new().unwrap();
        let project_dir = parent.path().join("project");
        std::fs::create_dir_all(&project_dir).unwrap();
        let secret = parent.path().join("secret.md");
        std::fs::write(&secret, "secret").unwrap();

        let traversal = project_dir.join("..").join("secret.md");

        let result = resolve(
            traversal.to_string_lossy().to_string(),
            project_dir.to_string_lossy().to_string(),
        );

        assert!(result.is_err(), "path traversal must be rejected");
    }

    #[tokio::test]
    async fn test_resolve_file_entry_non_markdown_returns_none() {
        let temp = tempfile::TempDir::new().unwrap();
        let file_path = temp
            .path()
            .join("src")
            .join("content")
            .join("blog")
            .join("data.json");
        std::fs::create_dir_all(file_path.parent().unwrap()).unwrap();
        std::fs::write(&file_path, "{}").unwrap();

        let result = resolve(
            file_path.to_string_lossy().to_string(),
            temp.path().to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(
            result.is_none(),
            "non-markdown files should resolve to None"
        );
    }

    #[tokio::test]
    async fn test_resolve_file_entry_nonexistent_returns_none() {
        let temp = tempfile::TempDir::new().unwrap();
        let missing = temp
            .path()
            .join("src")
            .join("content")
            .join("blog")
            .join("ghost.md");

        let result = resolve(
            missing.to_string_lossy().to_string(),
            temp.path().to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(result.is_none(), "missing files should resolve to None");
    }

    #[tokio::test]
    async fn test_resolve_file_entry_not_in_collection_returns_none() {
        // A markdown file inside the project but outside any content collection.
        let temp = tempfile::TempDir::new().unwrap();
        std::fs::create_dir_all(temp.path().join("src").join("content").join("blog")).unwrap();
        let readme = temp.path().join("README.md");
        std::fs::write(&readme, "# Readme").unwrap();

        let result = resolve(
            readme.to_string_lossy().to_string(),
            temp.path().to_string_lossy().to_string(),
        )
        .unwrap();

        assert!(
            result.is_none(),
            "markdown outside a collection should resolve to None"
        );
    }
    // --- listing collections by their pattern ---

    /// A project whose `blog` collection is `src/blog` with the given pattern,
    /// holding `post.md`, `_draft.md`, `README.md`, `2024/old.md` and `images/a.png`
    fn blog_collection(pattern: &str, skipped: SkippedFiles) -> (tempfile::TempDir, Collection) {
        let temp = tempfile::TempDir::new().unwrap();
        let root = dunce::canonicalize(temp.path()).unwrap();
        std::fs::create_dir_all(root.join("src/blog/2024")).unwrap();
        std::fs::create_dir_all(root.join("src/blog/images")).unwrap();
        for file in [
            "post.md",
            "_draft.md",
            "README.md",
            "2024/old.md",
            "images/a.png",
        ] {
            std::fs::write(root.join("src/blog").join(file), "---\ntitle: Hi\n---\n").unwrap();
        }
        std::fs::write(
            root.join("src/content.config.ts"),
            format!(
                "export const collections = {{ blog: defineCollection({{ loader: glob({{ pattern: {pattern}, base: 'src/blog' }}) }}) }};"
            ),
        )
        .unwrap();

        let mut settings = crate::models::preferences::ProjectSettingsData::default();
        settings.collections.insert(
            "blog".to_string(),
            crate::models::preferences::CollectionSettings {
                skipped_files: Some(skipped),
                ..Default::default()
            },
        );
        let scan = collections::scan_project(&root, &settings, &Default::default());
        (temp, scan.collections.into_iter().next().unwrap())
    }

    fn listed(collection: &Collection, dir: &str) -> (Vec<String>, Vec<(String, bool)>) {
        let result = tauri::async_runtime::block_on(scan_directory(
            collection.path.join(dir).to_string_lossy().to_string(),
            collection.clone(),
        ))
        .unwrap();
        let mut dirs: Vec<_> = result.subdirectories.into_iter().map(|d| d.name).collect();
        let mut files: Vec<_> = result
            .files
            .into_iter()
            .map(|f| (format!("{}.{}", f.name, f.extension), f.is_entry))
            .collect();
        dirs.sort();
        files.sort();
        (dirs, files)
    }

    #[test]
    fn hides_files_and_folders_the_pattern_leaves_out() {
        let (_temp, blog) = blog_collection("['*.md', '!README.md']", SkippedFiles::Hide);
        let (dirs, files) = listed(&blog, "");
        assert!(dirs.is_empty(), "no folder holds an entry");
        assert_eq!(
            files,
            [
                ("_draft.md".to_string(), true),
                ("post.md".to_string(), true)
            ]
        );
    }

    #[test]
    fn dims_skipped_files_when_asked() {
        let (_temp, blog) = blog_collection("'**/[^_]*.md'", SkippedFiles::Dim);
        let (dirs, files) = listed(&blog, "");
        assert_eq!(dirs, ["2024"]);
        assert_eq!(
            files,
            [
                ("README.md".to_string(), true),
                ("_draft.md".to_string(), false),
                ("post.md".to_string(), true),
            ]
        );
    }

    #[test]
    fn counts_and_collects_only_entries() {
        let (_temp, blog) = blog_collection("'**/[^_]*.md'", SkippedFiles::Dim);
        let count =
            tauri::async_runtime::block_on(count_collection_files_recursive(blog.clone())).unwrap();
        assert_eq!(count, 3);
        let files =
            tauri::async_runtime::block_on(scan_collection_files_recursive(blog.clone())).unwrap();
        let mut ids: Vec<_> = files.into_iter().map(|f| f.id).collect();
        ids.sort();
        assert_eq!(ids, ["blog/2024/old", "blog/README", "blog/post"]);
    }

    #[test]
    fn ids_are_relative_to_the_base() {
        let temp = tempfile::TempDir::new().unwrap();
        let root = dunce::canonicalize(temp.path()).unwrap();
        std::fs::create_dir_all(root.join("src/content/blog")).unwrap();
        std::fs::write(root.join("src/content/blog/post.md"), "# Hi").unwrap();
        std::fs::write(
            root.join("src/content.config.ts"),
            "export const collections = { posts: defineCollection({ loader: glob({ pattern: 'blog/**/*.md', base: 'src/content' }) }) };",
        )
        .unwrap();
        let scan = collections::scan_project(&root, &Default::default(), &Default::default());
        let posts = &scan.collections[0];
        assert_eq!(posts.path, root.join("src/content/blog"));

        let (_, files) = listed(posts, "");
        assert_eq!(files, [("post.md".to_string(), true)]);
        let entry = resolve(
            root.join("src/content/blog/post.md")
                .to_string_lossy()
                .to_string(),
            root.to_string_lossy().to_string(),
        )
        .unwrap()
        .unwrap();
        assert_eq!(entry.id, "posts/blog/post");
    }
    fn new_name(collection: &Collection, dir: &str, stem: &str) -> Option<String> {
        tauri::async_runtime::block_on(new_file_name(
            collection.path.join(dir).to_string_lossy().to_string(),
            collection.clone(),
            stem.to_string(),
        ))
        .unwrap()
    }

    #[test]
    fn new_file_names_avoid_clashes_ignoring_case() {
        let (_temp, blog) = blog_collection("'**/*.md'", SkippedFiles::Hide);
        assert_eq!(new_name(&blog, "", "today").as_deref(), Some("today.md"));
        assert_eq!(new_name(&blog, "", "POST").as_deref(), Some("POST-1.md"));
        assert_eq!(new_name(&blog, "2024", "old").as_deref(), Some("old-1.md"));
    }

    #[test]
    fn new_file_names_follow_the_pattern() {
        let (_temp, blog) = blog_collection("'**/index.md'", SkippedFiles::Hide);
        assert_eq!(
            new_name(&blog, "", "today").as_deref(),
            Some("today/index.md")
        );

        let (_temp, top_level) = blog_collection("'*.md'", SkippedFiles::Hide);
        assert_eq!(
            new_name(&top_level, "", "today").as_deref(),
            Some("today.md")
        );
        assert_eq!(new_name(&top_level, "2024", "today"), None);
    }

    #[test]
    fn new_file_names_avoid_names_astro_would_give_the_same_id() {
        let (_temp, blog) = blog_collection("'**/*.md'", SkippedFiles::Hide);
        std::fs::write(blog.path.join("notes.mdx"), "").unwrap();
        std::fs::write(blog.path.join("2024/moved.md"), "---\nslug: taken\n---\n").unwrap();
        assert_eq!(new_name(&blog, "", "notes").as_deref(), Some("notes-1.md"));
        assert_eq!(new_name(&blog, "", "taken").as_deref(), Some("taken-1.md"));
    }

    fn rename(collection: &Collection, file: &str, stem: &str) -> Result<Option<String>, String> {
        let root = collection.path.parent().unwrap().parent().unwrap();
        tauri::async_runtime::block_on(rename_entry(
            collection.path.join(file).to_string_lossy().to_string(),
            collection.clone(),
            stem.to_string(),
            root.to_string_lossy().to_string(),
        ))
        .map(|path| {
            path.map(|path| {
                path.strip_prefix(&format!("{}/", collection.path.display()))
                    .unwrap_or(&path)
                    .to_string()
            })
        })
    }

    #[test]
    fn renames_entries_without_replacing_anything() {
        let (_temp, blog) = blog_collection("'**/*.md'", SkippedFiles::Hide);
        assert_eq!(
            rename(&blog, "post.md", "hello"),
            Ok(Some("hello.md".to_string()))
        );
        assert!(!blog.path.join("post.md").exists());
        assert_eq!(
            rename(&blog, "hello.md", "readme"),
            Ok(Some("readme-1.md".to_string()))
        );
        assert_eq!(
            rename(&blog, "readme-1.md", "readme"),
            Ok(Some("readme-1.md".to_string()))
        );
        assert!(rename(&blog, "2024/old.md", "../escape").is_err());
    }

    #[test]
    fn renames_an_entry_to_its_own_name_in_another_case() {
        let (_temp, blog) = blog_collection("'**/*.md'", SkippedFiles::Hide);
        assert_eq!(
            rename(&blog, "post.md", "Post"),
            Ok(Some("Post.md".to_string()))
        );
        let names: Vec<String> = std::fs::read_dir(&blog.path)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        assert!(names.contains(&"Post.md".to_string()));
    }

    #[test]
    fn returns_the_new_path_as_file_entries_give_it() {
        // The frontend compares it with the open file's path, which has `/`
        // separators on every platform
        let (_temp, blog) = blog_collection("'**/*.md'", SkippedFiles::Hide);
        let root = blog.path.parent().unwrap().parent().unwrap();
        let renamed = tauri::async_runtime::block_on(rename_entry(
            blog.path.join("2024/old.md").to_string_lossy().to_string(),
            blog.clone(),
            "new".to_string(),
            root.to_string_lossy().to_string(),
        ))
        .unwrap()
        .unwrap();

        let entry = FileEntry::new(
            blog.path.join("2024/new.md"),
            blog.name.clone(),
            blog.base.clone(),
        );
        assert_eq!(
            serde_json::json!(renamed),
            serde_json::to_value(entry).unwrap()["path"]
        );
    }

    #[test]
    fn never_renames_index_files_or_their_folders() {
        // A folder of entries with an index page, and a folder per entry
        for pattern in ["'**/*.md'", "'**/index.md'"] {
            let (_temp, blog) = blog_collection(pattern, SkippedFiles::Hide);
            std::fs::write(blog.path.join("2024/index.md"), "").unwrap();
            assert_eq!(
                rename(&blog, "2024/index.md", "lake"),
                Err(INDEX_FILES_KEEP_THEIR_NAME.to_string())
            );
            assert!(blog.path.join("2024/index.md").exists());
            assert!(blog.path.join("2024/old.md").exists());
        }
    }

    #[test]
    fn renames_nothing_when_no_name_would_be_an_entry() {
        let (_temp, top_level) = blog_collection("'*.md'", SkippedFiles::Hide);
        assert_eq!(rename(&top_level, "2024/old.md", "new"), Ok(None));
        assert!(top_level.path.join("2024/old.md").exists());
    }
}
