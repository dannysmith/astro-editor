use crate::models::{Collection, DirectoryInfo, FileEntry};
use crate::parser::parse_astro_config;
use crate::schema_merger;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};
use tauri::Emitter;

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
fn send_toast_notification(
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
    if let Some(home) = dirs::home_dir() {
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

#[tauri::command]
#[specta::specta]
pub async fn select_project_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file_dialog = rfd::AsyncFileDialog::new()
        .set_title("Select Astro Project Folder")
        .pick_folder()
        .await;

    match file_dialog {
        Some(folder) => {
            let folder_path = folder.path();

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

            Ok(Some(folder_path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn scan_project(project_path: String) -> Result<Vec<Collection>, String> {
    info!("Astro Editor [PROJECT_SCAN] Scanning project at path: {project_path}");
    scan_project_with_content_dir(project_path, None).await
}

#[tauri::command]
#[specta::specta]
pub async fn scan_project_with_content_dir(
    project_path: String,
    content_directory: Option<String>,
) -> Result<Vec<Collection>, String> {
    info!("Astro Editor [PROJECT_SCAN] Scanning project at path: {project_path}");
    info!(
        "Astro Editor [PROJECT_SCAN] Content directory: {:?}",
        content_directory.as_deref().unwrap_or("src/content")
    );

    let path = PathBuf::from(&project_path);

    // Try to parse Astro config first
    debug!("Astro Editor [PROJECT_SCAN] Attempting to parse Astro config");
    match parse_astro_config(&path, content_directory.as_deref()) {
        Ok(mut collections) if !collections.is_empty() => {
            info!(
                "Astro Editor [PROJECT_SCAN] Found {} collections from Astro config",
                collections.len()
            );

            // Try to load JSON schemas for each collection
            for collection in &mut collections {
                if let Ok(json_schema) =
                    load_json_schema_for_collection(&project_path, &collection.name)
                {
                    debug!(
                        "Astro Editor [PROJECT_SCAN] Loaded JSON schema for collection: {}",
                        collection.name
                    );
                    collection.json_schema = Some(json_schema);
                }
            }

            // Generate complete schema for each collection
            for collection in &mut collections {
                generate_complete_schema(collection);
            }

            Ok(collections)
        }
        Ok(_) => {
            debug!("Astro Editor [PROJECT_SCAN] Astro config returned empty collections, falling back to directory scan");
            let mut collections =
                scan_content_directories_with_override(path.as_path(), content_directory)?;

            // Try to load JSON schemas for directory-scanned collections
            for collection in &mut collections {
                if let Ok(json_schema) =
                    load_json_schema_for_collection(&project_path, &collection.name)
                {
                    debug!(
                        "Astro Editor [PROJECT_SCAN] Loaded JSON schema for collection: {}",
                        collection.name
                    );
                    collection.json_schema = Some(json_schema);
                }
            }

            // Generate complete schema for each collection
            for collection in &mut collections {
                generate_complete_schema(collection);
            }

            Ok(collections)
        }
        Err(err) => {
            debug!("Astro Editor [PROJECT_SCAN] Astro config parsing failed: {err}, falling back to directory scan");
            let mut collections =
                scan_content_directories_with_override(path.as_path(), content_directory)?;

            // Try to load JSON schemas for directory-scanned collections
            for collection in &mut collections {
                if let Ok(json_schema) =
                    load_json_schema_for_collection(&project_path, &collection.name)
                {
                    debug!(
                        "Astro Editor [PROJECT_SCAN] Loaded JSON schema for collection: {}",
                        collection.name
                    );
                    collection.json_schema = Some(json_schema);
                }
            }

            // Generate complete schema for each collection
            for collection in &mut collections {
                generate_complete_schema(collection);
            }

            Ok(collections)
        }
    }
}

fn load_json_schema_for_collection(
    project_path: &str,
    collection_name: &str,
) -> Result<String, String> {
    let schema_path = PathBuf::from(project_path)
        .join(".astro")
        .join("collections")
        .join(format!("{collection_name}.schema.json"));

    if !schema_path.exists() {
        return Err(format!("JSON schema not found: {}", schema_path.display()));
    }

    std::fs::read_to_string(&schema_path).map_err(|e| format!("Failed to read JSON schema: {e}"))
}

/// Generate complete schema by merging JSON schema and Zod schema
fn generate_complete_schema(collection: &mut Collection) {
    match schema_merger::create_complete_schema(
        &collection.name,
        collection.json_schema.as_deref(),
        collection.schema.as_deref(),
    ) {
        Ok(complete_schema) => match serde_json::to_string(&complete_schema) {
            Ok(serialized) => {
                debug!(
                    "Astro Editor [SCHEMA_MERGER] Generated complete schema for collection: {}",
                    collection.name
                );
                collection.complete_schema = Some(serialized);
            }
            Err(e) => {
                warn!(
                    "Astro Editor [SCHEMA_MERGER] Failed to serialize complete schema for {}: {}",
                    collection.name, e
                );
            }
        },
        Err(e) => {
            warn!(
                "Astro Editor [SCHEMA_MERGER] Failed to create complete schema for {}: {}",
                collection.name, e
            );
        }
    }
}

fn scan_content_directories_with_override(
    project_path: &Path,
    content_directory_override: Option<String>,
) -> Result<Vec<Collection>, String> {
    let mut collections = Vec::new();

    // Use override if provided, otherwise default to src/content
    let content_dir = if let Some(override_path) = &content_directory_override {
        debug!("Astro Editor [PROJECT_SCAN] Using content directory override: {override_path}");
        project_path.join(override_path)
    } else {
        debug!("Astro Editor [PROJECT_SCAN] Using default content directory: src/content");
        project_path.join("src").join("content")
    };

    if content_dir.exists() {
        info!(
            "Astro Editor [PROJECT_SCAN] Content directory found: {}",
            content_dir.display()
        );

        // Look for common collection directories
        for entry in std::fs::read_dir(&content_dir).map_err(|e| {
            let err_msg = format!("Failed to read content directory: {e}");
            error!("Astro Editor [PROJECT_SCAN] {err_msg}");
            err_msg
        })? {
            let entry = entry.map_err(|e| {
                let err_msg = format!("Failed to read directory entry: {e}");
                error!("Astro Editor [PROJECT_SCAN] {err_msg}");
                err_msg
            })?;
            let path = entry.path();

            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    debug!("Astro Editor [PROJECT_SCAN] Found collection directory: {name}");
                    collections.push(Collection::new(name.to_string(), path));
                }
            }
        }

        info!(
            "Astro Editor [PROJECT_SCAN] Found {} collections via directory scan",
            collections.len()
        );
    } else {
        error!(
            "Astro Editor [PROJECT_SCAN] Content directory does not exist: {}",
            content_dir.display()
        );
    }

    Ok(collections)
}

#[tauri::command]
#[specta::specta]
pub async fn scan_collection_files(collection_path: String) -> Result<Vec<FileEntry>, String> {
    let path = PathBuf::from(&collection_path);
    let mut files = Vec::new();

    // Get collection name from path
    let collection_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Use path as collection root (flat scan, no subdirectories)
    let collection_root = path.clone();

    // Scan for markdown and MDX files
    for entry in
        std::fs::read_dir(&path).map_err(|e| format!("Failed to read collection directory: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();

        if path.is_file() {
            if let Some(extension) = path.extension().and_then(|ext| ext.to_str()) {
                if matches!(extension, "md" | "mdx") {
                    let mut file_entry = FileEntry::new(
                        path.clone(),
                        collection_name.clone(),
                        collection_root.clone(),
                    );

                    // Parse frontmatter for basic metadata
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(parsed) =
                            crate::commands::files::parse_frontmatter_internal(&content)
                        {
                            file_entry = file_entry.with_frontmatter(parsed.frontmatter);
                        }
                    }

                    files.push(file_entry);
                }
            }
        }
    }

    Ok(files)
}

#[tauri::command]
#[specta::specta]
pub async fn load_file_based_collection(
    project_path: String,
    collection_name: String,
) -> Result<Vec<FileEntry>, String> {
    use regex::Regex;

    debug!("Astro Editor [FILE_COLLECTION] Loading file-based collection: {collection_name}");

    // Read content.config.ts to find the file path
    let project = PathBuf::from(&project_path);
    let config_paths = [
        project.join("src").join("content.config.ts"),
        project.join("src").join("content").join("config.ts"),
    ];

    let mut file_path: Option<PathBuf> = None;

    for config_path in &config_paths {
        if config_path.exists() {
            let content = std::fs::read_to_string(config_path)
                .map_err(|e| format!("Failed to read config: {e}"))?;

            // Look for: const/let/var collectionName = defineCollection({ loader: file('./path/to/file.json')
            // or: collectionName: defineCollection({ loader: file('./path/to/file.json')
            // Handles exported variables too: export const collectionName = defineCollection...
            let pattern = format!(
                r#"(?:(?:const|let|var)\s+)?{collection_name}\s*[=:]\s*defineCollection\s*\(\s*\{{\s*loader:\s*file\s*\(\s*['"]([^'"]+)['"]"#
            );

            debug!("Astro Editor [FILE_COLLECTION] Regex pattern: {pattern}");
            debug!(
                "Astro Editor [FILE_COLLECTION] Config content (first 500 chars): {}",
                &content.chars().take(500).collect::<String>()
            );

            if let Ok(re) = Regex::new(&pattern) {
                if let Some(cap) = re.captures(&content) {
                    let path_str = cap.get(1).unwrap().as_str();
                    let cleaned_path = path_str.trim_start_matches("./");
                    file_path = Some(project.join(cleaned_path));
                    debug!("Astro Editor [FILE_COLLECTION] Matched! File path: {cleaned_path}");
                    break;
                } else {
                    debug!("Astro Editor [FILE_COLLECTION] Regex did not match in content");
                }
            } else {
                debug!("Astro Editor [FILE_COLLECTION] Failed to compile regex pattern");
            }
        }
    }

    let file_path = file_path.ok_or_else(|| {
        format!("File-based collection '{collection_name}' not found in content.config")
    })?;

    debug!(
        "Astro Editor [FILE_COLLECTION] Found file path: {}",
        file_path.display()
    );

    // Read and parse the JSON file
    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read collection file: {e}"))?;

    let json_data: serde_json::Value =
        serde_json::from_str(&json_content).map_err(|e| format!("Failed to parse JSON: {e}"))?;

    // Convert JSON array to FileEntry objects
    let mut files = Vec::new();

    if let Some(array) = json_data.as_array() {
        for item in array {
            if let Some(obj) = item.as_object() {
                // Extract unique identifier - try 'id' first, then 'slug'
                let item_id = obj
                    .get("id")
                    .and_then(|v| v.as_str())
                    .or_else(|| obj.get("slug").and_then(|v| v.as_str()))
                    .ok_or_else(|| {
                        "Missing unique identifier: collection items must have either 'id' or 'slug' field".to_string()
                    })?
                    .to_string();

                // Convert JSON object to IndexMap for FileEntry frontmatter
                let frontmatter: indexmap::IndexMap<String, serde_json::Value> =
                    obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect();

                // Create FileEntry with the JSON data as frontmatter
                // For file-based collections, we need to manually set the id to use the item's id
                // instead of deriving it from the file path
                // Use the file's parent directory as collection root for file-based collections
                let collection_root = file_path.parent().unwrap_or(&file_path).to_path_buf();
                let mut file_entry =
                    FileEntry::new(file_path.clone(), collection_name.clone(), collection_root)
                        .with_frontmatter(frontmatter);

                // Override the auto-generated id with the item's unique identifier from JSON
                file_entry.id = format!("{collection_name}/{item_id}");

                files.push(file_entry);
            }
        }
    } else {
        return Err("Collection file must contain a JSON array".to_string());
    }

    debug!(
        "Astro Editor [FILE_COLLECTION] Loaded {} items from {}",
        files.len(),
        collection_name
    );

    Ok(files)
}

#[tauri::command]
#[specta::specta]
pub async fn read_json_schema(
    project_path: String,
    collection_name: String,
) -> Result<String, String> {
    let schema_path = PathBuf::from(&project_path)
        .join(".astro")
        .join("collections")
        .join(format!("{collection_name}.schema.json"));

    debug!(
        "Astro Editor [JSON_SCHEMA] Reading JSON schema at: {}",
        schema_path.display()
    );

    if !schema_path.exists() {
        let err_msg = format!("JSON schema file not found: {}", schema_path.display());
        debug!("Astro Editor [JSON_SCHEMA] {err_msg}");
        return Err(err_msg);
    }

    std::fs::read_to_string(&schema_path).map_err(|e| {
        let err_msg = format!("Failed to read JSON schema file: {e}");
        error!("Astro Editor [JSON_SCHEMA] {err_msg}");
        err_msg
    })
}

/// Scan a single directory (non-recursive) for subdirectories and markdown/mdx files
#[tauri::command]
#[specta::specta]
pub async fn scan_directory(
    directory_path: String,
    collection_name: String,
    collection_root: String,
) -> Result<DirectoryScanResult, String> {
    let dir_path = PathBuf::from(&directory_path);
    let collection_root_path = PathBuf::from(&collection_root);

    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path.display()));
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path.display()));
    }

    let mut subdirectories = Vec::new();
    let mut files = Vec::new();

    // Read directory entries
    for entry in
        std::fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();

        // Get file name for filtering
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Skip hidden files/directories (starting with . or _)
        if file_name.starts_with('.') || file_name.starts_with('_') {
            continue;
        }

        // Skip symbolic links
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {e}"))?;

        if metadata.file_type().is_symlink() {
            continue;
        }

        if path.is_dir() {
            // Add subdirectory
            if let Ok(dir_info) = DirectoryInfo::new(path, &collection_root_path) {
                subdirectories.push(dir_info);
            }
        } else if path.is_file() {
            // Check if it's a markdown or MDX file
            if let Some(extension) = path.extension().and_then(|ext| ext.to_str()) {
                if matches!(extension, "md" | "mdx") {
                    let mut file_entry = FileEntry::new(
                        path.clone(),
                        collection_name.clone(),
                        collection_root_path.clone(),
                    );

                    // Parse frontmatter for basic metadata
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(parsed) =
                            crate::commands::files::parse_frontmatter_internal(&content)
                        {
                            file_entry = file_entry.with_frontmatter(parsed.frontmatter);
                        }
                    }

                    files.push(file_entry);
                }
            }
        }
    }

    Ok(DirectoryScanResult {
        subdirectories,
        files,
    })
}

/// Count all markdown/mdx files recursively in a collection
#[tauri::command]
#[specta::specta]
pub async fn count_collection_files_recursive(collection_path: String) -> Result<u32, String> {
    let path = PathBuf::from(&collection_path);

    if !path.exists() {
        return Ok(0);
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }

    fn count_files_recursive(dir_path: &Path) -> Result<u32, String> {
        let mut count: u32 = 0;

        for entry in
            std::fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {e}"))?
        {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
            let path = entry.path();

            // Get file name for filtering
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Skip hidden files/directories (starting with . or _)
            if file_name.starts_with('.') || file_name.starts_with('_') {
                continue;
            }

            // Skip symbolic links
            let metadata = entry
                .metadata()
                .map_err(|e| format!("Failed to read metadata: {e}"))?;

            if metadata.file_type().is_symlink() {
                continue;
            }

            if path.is_dir() {
                // Recursively count files in subdirectory
                count += count_files_recursive(&path)?;
            } else if path.is_file() {
                // Check if it's a markdown or MDX file
                if let Some(extension) = path.extension().and_then(|ext| ext.to_str()) {
                    if matches!(extension, "md" | "mdx") {
                        count += 1;
                    }
                }
            }
        }

        Ok(count)
    }

    count_files_recursive(&path)
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
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy();

            // These paths under AppData/*/Microsoft should be blocked
            let blocked_local = PathBuf::from(format!(
                r"{}\AppData\Local\Microsoft\Credentials",
                home_str
            ));
            assert!(
                is_blocked_directory(&blocked_local),
                "AppData/Local/Microsoft should be blocked"
            );

            let blocked_roaming = PathBuf::from(format!(
                r"{}\AppData\Roaming\Microsoft\Windows",
                home_str
            ));
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
}
