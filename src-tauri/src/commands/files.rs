use chrono::Local;
use indexmap::IndexMap;
use pathdiff::diff_paths;
use serde_json::Value;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use tauri::{path::BaseDirectory, Manager};

use crate::frontmatter::{
    assemble, parse_frontmatter, write_block, FrontmatterSchema, MarkdownContent,
};
use crate::utils::{normalize_path_for_serialization, validate_project_path};

/// Held while AE reads an entry for the editor or saves one, so a read never
/// lands in the middle of a save. `fs::write` empties a file before writing
/// it, and AE reloads the open entry after each save, which can overlap the
/// next save (Cmd+S during an auto-save): the reload would read an empty or
/// half-written entry into the editor, and the next save would write it back.
/// Other apps' writes aren't covered; they're theirs to make safe.
static ENTRY_IO: Mutex<()> = Mutex::new(());

fn read_entry(path: &Path) -> io::Result<String> {
    let _held = ENTRY_IO.lock().unwrap_or_else(PoisonError::into_inner);
    std::fs::read_to_string(path)
}

/// Writes the entry in place, so it keeps its inode (see `editor.md`)
fn write_entry(path: &Path, text: &str) -> io::Result<()> {
    let _held = ENTRY_IO.lock().unwrap_or_else(PoisonError::into_inner);
    std::fs::write(path, text)
}

/// Calculates the relative path from the current file to an asset
///
/// # Arguments
/// * `current_file_path` - Absolute path to the current markdown file
/// * `project_path` - Absolute path to the project root
/// * `project_relative_asset_path` - Path to the asset relative to project root (e.g., "src/assets/image.png")
///
/// # Returns
/// Relative path from the file's directory to the asset (e.g., "../../assets/image.png")
fn calculate_relative_path(
    current_file_path: &str,
    project_path: &str,
    project_relative_asset_path: &str,
) -> Result<String, String> {
    // Get directory containing the current markdown file
    let current_file = Path::new(current_file_path);
    let current_file_dir = current_file.parent().ok_or("Invalid current file path")?;

    // Get the asset's full path
    let asset_full_path = Path::new(project_path).join(project_relative_asset_path);

    // Calculate relative path from file directory to asset
    let relative_path = diff_paths(&asset_full_path, current_file_dir)
        .ok_or("Could not calculate relative path")?;

    // Convert to string with forward slashes (Markdown convention)
    let path_string = relative_path.to_string_lossy().replace('\\', "/");

    // Ensure ./ prefix for same-directory files (clearer than bare filename)
    let final_path = if path_string.starts_with("../") {
        path_string
    } else {
        format!("./{path_string}")
    };

    Ok(final_path)
}

#[tauri::command]
#[specta::specta]
pub async fn read_file(file_path: String, project_root: String) -> Result<String, String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    std::fs::read_to_string(&validated_path).map_err(|e| format!("Failed to read file: {e}"))
}

/// Creates a file holding `content`, under `frontmatter` if it's given, which
/// is written as saving writes it (so date fields come out unquoted), in
/// schema order. Returns the new file's path, with `/` on Windows too
#[tauri::command]
#[specta::specta]
pub async fn create_file(
    directory: String,
    filename: String,
    content: String,
    frontmatter: Option<IndexMap<String, Value>>,
    schema: FrontmatterSchema,
    project_root: String,
) -> Result<String, String> {
    // Validate directory is within project
    let validated_dir = validate_project_path(&directory, &project_root)?;

    // `filename` may include folders (`<name>/index.md` for folder-per-entry
    // collections), which are created, but never `..`
    if Path::new(&filename)
        .components()
        .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err(format!("Invalid file name: {filename}"));
    }
    let path = validated_dir.join(&filename);
    if let Some(parent) = path.parent() {
        // Checked first, so a symlink to outside the project can't have a
        // folder created through it
        let parent = validate_project_path(parent, &project_root)?;
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {e}"))?;
    }

    // Double-check the final path is still within project bounds
    let final_path_str = path.to_string_lossy().to_string();
    let validated_final_path = validate_project_path(&final_path_str, &project_root)?;

    if validated_final_path.exists() {
        return Err("File already exists".to_string());
    }

    let content = match frontmatter {
        Some(values) => assemble(&write_block("", &values, &schema, true)?, "", &content),
        None => content,
    };
    std::fs::write(&validated_final_path, content)
        .map_err(|e| format!("Failed to create file: {e}"))?;

    Ok(normalize_path_for_serialization(&validated_final_path))
}

#[tauri::command]
#[specta::specta]
/// Moves a file in the project to the Trash, or with `permanent`, removes it
pub async fn delete_file(
    file_path: String,
    project_root: String,
    permanent: bool,
) -> Result<(), String> {
    let path = validate_project_path(&file_path, &project_root)?;
    if permanent {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {e}"))?;
        log::info!("Astro Editor [FILES] Deleted {}", path.display());
    } else {
        move_to_trash(&path).map_err(|e| format!("Failed to move file to the Trash: {e}"))?;
        log::info!(
            "Astro Editor [FILES] Moved to the Trash: {}",
            path.display()
        );
    }
    Ok(())
}

/// On macOS the `trash` crate asks Finder by default, which needs Automation
/// permission; `NSFileManager` doesn't, and is faster
fn move_to_trash(path: &Path) -> Result<(), trash::Error> {
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        let mut context = trash::TrashContext::new();
        context.set_delete_method(DeleteMethod::NsFileManager);
        context.delete(path)
    }
    #[cfg(not(target_os = "macos"))]
    trash::delete(path)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_file(
    old_path: String,
    new_path: String,
    project_root: String,
) -> Result<(), String> {
    let validated_old_path = validate_project_path(&old_path, &project_root)?;
    // The folder is validated rather than the whole path, because resolving a
    // path that exists gives its case on disk, which would undo a change of case
    let new_path = Path::new(&new_path);
    let (Some(folder), Some(name)) = (new_path.parent(), new_path.file_name()) else {
        return Err("Invalid file path".to_string());
    };
    let validated_new_path = validate_project_path(folder, &project_root)?.join(name);
    rename_without_replacing(&validated_old_path, &validated_new_path)
}

/// Renames a file or folder, refusing if something already has the new name,
/// unless it's the same file under a name that differs only in case
pub fn rename_without_replacing(from: &Path, to: &Path) -> Result<(), String> {
    if to.symlink_metadata().is_ok() && !is_same_file(from, to) {
        let name = to.file_name().unwrap_or_default().to_string_lossy();
        return Err(format!("There's already a file named \"{name}\""));
    }
    std::fs::rename(from, to).map_err(|e| format!("Failed to rename file: {e}"))
}

#[cfg(unix)]
fn is_same_file(a: &Path, b: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    match (a.symlink_metadata(), b.symlink_metadata()) {
        (Ok(a), Ok(b)) => a.dev() == b.dev() && a.ino() == b.ino(),
        _ => false,
    }
}

#[cfg(not(unix))]
fn is_same_file(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
}

/// Convert a string to kebab case
/// A file name without its extension in kebab case: lowercase, with spaces,
/// underscores and dots as single hyphens and anything else non-alphanumeric
/// dropped. Dots count as separators because the extension is already gone
/// (`my.photo copy` → `my-photo-copy`).
fn to_kebab_case(name_without_ext: &str) -> String {
    name_without_ext
        .to_lowercase()
        .replace([' ', '_', '.'], "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// A file copied into the project for an entry
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CopiedAsset {
    /// The path to write in the entry: relative to it, or from the project
    /// root with a leading `/`, as the project's settings say
    pub reference: String,
    /// Where it was copied, absolute, with symlinks resolved (as git reports
    /// paths)
    pub path: String,
}

/// Copies a file into `<assets_directory>/<collection>/` (the folder relative to
/// the project, as the collection's settings resolve it), named after the date
/// and the file
#[tauri::command]
#[specta::specta]
pub async fn copy_file_to_assets(
    source_path: String,
    project_path: String,
    collection: String,
    assets_directory: String,
    current_file_path: String,
    use_relative_paths: bool,
) -> Result<CopiedAsset, String> {
    use std::fs;

    // Validate project path
    let validated_project_root =
        dunce::canonicalize(&project_path).map_err(|_| "Invalid project root".to_string())?;

    // Checked before it's created, so an assets setting like `../shared`
    // can't create folders outside the project. It may not exist yet, so
    // `validate_project_path` can't check it
    let assets_dir = crate::content_config::normalize(
        &validated_project_root
            .join(assets_directory)
            .join(&collection),
    );
    if !assets_dir.starts_with(&validated_project_root) {
        return Err("File outside project directory".to_string());
    }

    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {e}"))?;

    // Get the source file info
    let source = PathBuf::from(&source_path);
    let file_name = source
        .file_name()
        .ok_or("Invalid source file path")?
        .to_string_lossy();

    // Extract extension
    let original_extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    let extension = original_extension.to_lowercase();

    // Create the base filename with date prefix
    let date_prefix = Local::now().format("%Y-%m-%d").to_string();
    let name_without_ext = file_name.trim_end_matches(&format!(".{original_extension}"));
    let kebab_name = to_kebab_case(name_without_ext);

    // Build the new filename
    let mut base_name = format!("{date_prefix}-{kebab_name}");
    if !extension.is_empty() {
        base_name.push('.');
        base_name.push_str(&extension);
    }

    // Atomically find available filename and copy file
    // This prevents TOCTOU race conditions where multiple simultaneous calls
    // could all check existence and decide to use the same filename
    let mut final_path = assets_dir.join(&base_name);
    let mut counter = 1;
    const MAX_ATTEMPTS: u32 = 100;

    let validated_final_path = loop {
        // Validate the candidate path is within project bounds
        let final_path_str = final_path.to_string_lossy().to_string();
        let validated_path = validate_project_path(&final_path_str, &project_path)?;

        // Try to create the destination file atomically using create_new()
        // This fails if the file already exists, preventing race conditions
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&validated_path)
        {
            Ok(_) => {
                // File created successfully, now copy the content
                // Note: We created an empty file, so we need to copy over it,
                // and remove it again if the copy fails
                if let Err(e) = fs::copy(&source_path, &validated_path) {
                    let _ = fs::remove_file(&validated_path);
                    return Err(format!("Failed to copy file content: {e}"));
                }
                break validated_path;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                // File exists, try with counter suffix
                if counter > MAX_ATTEMPTS {
                    return Err(format!(
                        "Could not find available filename after {MAX_ATTEMPTS} attempts"
                    ));
                }

                let name_with_counter = if extension.is_empty() {
                    format!("{date_prefix}-{kebab_name}-{counter}")
                } else {
                    format!("{date_prefix}-{kebab_name}-{counter}.{extension}")
                };
                final_path = assets_dir.join(name_with_counter);
                counter += 1; // Increment for next iteration
            }
            Err(e) => {
                // Other error (permissions, disk full, etc.)
                return Err(format!("Failed to create file: {e}"));
            }
        }
    };

    // Get the path relative to project root
    let project_relative_path = validated_final_path
        .strip_prefix(&validated_project_root)
        .map_err(|_| "Failed to create relative path")?
        .to_string_lossy()
        .to_string();

    // Convert to appropriate path style based on setting
    let reference = if use_relative_paths {
        calculate_relative_path(&current_file_path, &project_path, &project_relative_path)?
    } else {
        // From the project root, starting with `/` (the absolute image paths setting)
        format!("/{}", project_relative_path.replace('\\', "/"))
    };

    Ok(CopiedAsset {
        reference,
        path: normalize_path_for_serialization(&validated_final_path),
    })
}

#[tauri::command]
#[specta::specta]
pub async fn parse_markdown_content(
    file_path: String,
    project_root: String,
) -> Result<MarkdownContent, String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    let content = read_entry(&validated_path).map_err(|e| format!("Failed to read file: {e}"))?;

    Ok(parse_frontmatter(&content))
}

/// Saves a file from its parts. `raw_frontmatter` is a frontmatter block as
/// read (`MarkdownContent::raw_frontmatter`), written back as it is unless
/// `frontmatter` holds edited values, which are spliced into it, with the
/// keys put in schema order if `reorder_frontmatter` (the project setting).
/// Returns the frontmatter block written, so the frontend can tell its own
/// writes from changes made outside the app
// A command's arguments are its IPC payload, so there's no struct to gather
// them in that wouldn't just be this list
#[allow(clippy::too_many_arguments)]
#[tauri::command]
#[specta::specta]
pub async fn save_markdown_content(
    file_path: String,
    frontmatter: Option<IndexMap<String, Value>>,
    raw_frontmatter: String,
    content: String,
    imports: String,
    schema: FrontmatterSchema,
    reorder_frontmatter: bool,
    project_root: String,
) -> Result<String, String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;

    let block = match frontmatter {
        Some(values) => write_block(&raw_frontmatter, &values, &schema, reorder_frontmatter)?,
        None => raw_frontmatter,
    };

    write_entry(&validated_path, &assemble(&block, &imports, &content))
        .map_err(|e| format!("Failed to write file: {e}"))?;
    Ok(block)
}

#[tauri::command]
#[specta::specta]
pub async fn save_recovery_data(app: tauri::AppHandle, data: Value) -> Result<(), String> {
    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let filename = data
        .get("fileName")
        .and_then(|v| v.as_str())
        .unwrap_or("untitled");

    // Create recovery directory
    let recovery_dir = app
        .path()
        .resolve("recovery", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve recovery directory: {e}"))?;

    std::fs::create_dir_all(&recovery_dir)
        .map_err(|e| format!("Failed to create recovery directory: {e}"))?;

    // Save JSON file with complete state
    let json_filename = format!("{timestamp}-{filename}.recovery.json");
    let json_path = recovery_dir.join(&json_filename);
    let json_content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize recovery data: {e}"))?;

    std::fs::write(&json_path, json_content)
        .map_err(|e| format!("Failed to write recovery JSON: {e}"))?;

    // Save Markdown file with just the content
    let md_filename = format!("{timestamp}-{filename}.recovery.md");
    let md_path = recovery_dir.join(&md_filename);
    let md_content = data
        .get("editorContent")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    std::fs::write(&md_path, md_content)
        .map_err(|e| format!("Failed to write recovery Markdown: {e}"))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn save_crash_report(app: tauri::AppHandle, report: Value) -> Result<(), String> {
    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();

    // Create crash-reports directory
    let crash_dir = app
        .path()
        .resolve("crash-reports", BaseDirectory::AppLocalData)
        .map_err(|e| format!("Failed to resolve crash reports directory: {e}"))?;

    std::fs::create_dir_all(&crash_dir)
        .map_err(|e| format!("Failed to create crash reports directory: {e}"))?;

    // Save crash report
    let filename = format!("{timestamp}-crash.json");
    let file_path = crash_dir.join(&filename);
    let content = serde_json::to_string_pretty(&report)
        .map_err(|e| format!("Failed to serialize crash report: {e}"))?;

    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write crash report: {e}"))?;

    Ok(())
}

/// Checks if a file path is within the project directory
///
/// # Arguments
/// * `file_path` - The absolute path to check
/// * `project_path` - The absolute path to the project root
///
/// # Returns
/// True if the file is within the project, false otherwise
#[tauri::command]
#[specta::specta]
pub async fn is_path_in_project(file_path: String, project_path: String) -> bool {
    let file = Path::new(&file_path);
    let project = Path::new(&project_path);

    dunce::canonicalize(file)
        .ok()
        .and_then(|f| dunce::canonicalize(project).ok().map(|p| f.starts_with(p)))
        .unwrap_or(false)
}

/// The path to write in `current_file_path` for the file at `file_path`: relative
/// to the current file's folder when `use_relative_paths`, otherwise from the
/// project root, starting with `/`. An error if the file isn't in the project.
#[tauri::command]
#[specta::specta]
pub async fn get_relative_path(
    file_path: String,
    project_path: String,
    current_file_path: String,
    use_relative_paths: bool,
) -> Result<String, String> {
    let file = dunce::canonicalize(&file_path).map_err(|e| format!("Invalid file path: {e}"))?;
    let project =
        dunce::canonicalize(&project_path).map_err(|e| format!("Invalid project path: {e}"))?;

    let project_relative_path = file
        .strip_prefix(&project)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|_| "Path not in project".to_string())?;

    // Convert to appropriate path style based on setting
    let final_path = if use_relative_paths {
        calculate_relative_path(&current_file_path, &project_path, &project_relative_path)?
    } else {
        // From the project root, starting with `/` (the absolute image paths setting)
        format!("/{}", project_relative_path.replace('\\', "/"))
    };

    Ok(final_path)
}

/// Resolves an image path from markdown to an absolute filesystem path
///
/// Handles both absolute paths (starting with /) and relative paths (starting with ./ or ../)
/// For absolute paths: treats them as relative to project root
/// For relative paths: resolves relative to the current file's directory
///
/// # Arguments
/// * `image_path` - The image path from markdown (e.g., "/src/assets/image.png" or "./image.png")
/// * `project_root` - The absolute path to the project root directory
/// * `current_file_path` - Optional absolute path to the current file being edited
///
/// # Returns
/// The validated absolute filesystem path that can be used with convertFileSrc
#[tauri::command]
#[specta::specta]
pub async fn resolve_image_path(
    image_path: String,
    project_root: String,
    current_file_path: Option<String>,
) -> Result<String, String> {
    let project_root_path = Path::new(&project_root);

    // Determine the absolute path based on the image path format
    let absolute_path = if image_path.starts_with('/') {
        // Absolute path from project root - strip leading slash and join with project root
        let relative_path = image_path.trim_start_matches('/');
        project_root_path.join(relative_path)
    } else if image_path.starts_with("./") || image_path.starts_with("../") {
        // Relative path - need current file path to resolve
        let current_file = current_file_path
            .ok_or_else(|| "Cannot resolve relative path without current file path".to_string())?;
        let current_file_path = Path::new(&current_file);
        let current_dir = current_file_path
            .parent()
            .ok_or_else(|| "Invalid current file path".to_string())?;
        current_dir.join(&image_path)
    } else {
        // Ambiguous path (no leading / or ./) - try as absolute from project root first
        project_root_path.join(&image_path)
    };

    // Validate the path is within project bounds and exists. The asset protocol scope
    // in `tauri.conf.json` is `**`, because projects can live anywhere on disk, so this
    // check is the only thing keeping image lookups (and the `asset:` URLs built from
    // them) inside the project.
    let validated_path =
        validate_project_path(absolute_path.to_string_lossy().as_ref(), &project_root)?;

    // Check if file exists
    if !validated_path.exists() {
        return Err(format!(
            "Image file not found: {}",
            validated_path.display()
        ));
    }

    // Return the absolute path as a string
    Ok(validated_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    #[test]
    fn reading_an_entry_never_sees_a_save_half_done() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("entry.md");
        let texts = ["a".repeat(1 << 20), "b".repeat(1 << 20)];
        fs::write(&path, &texts[0]).unwrap();
        std::thread::scope(|scope| {
            scope.spawn(|| {
                for i in 0..50 {
                    write_entry(&path, &texts[i % 2]).unwrap();
                }
            });
            for _ in 0..200 {
                let read = read_entry(&path).unwrap();
                assert!(texts.contains(&read), "read {} bytes", read.len());
            }
        });
    }

    #[test]
    fn test_validate_project_path_valid() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("content").join("test.md");

        // Create test structure
        fs::create_dir_all(test_file.parent().unwrap()).unwrap();
        fs::write(&test_file, "test content").unwrap();

        let result = validate_project_path(&test_file, &project_root);

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[test]
    fn test_validate_project_path_traversal_attack() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_path = project_root.join("../../../etc/passwd");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = validate_project_path(&malicious_path, &project_root);

        // Should fail due to path traversal
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[test]
    fn test_validate_project_path_nonexistent_file() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let nonexistent_file = project_root.join("nonexistent.md");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = validate_project_path(&nonexistent_file, &project_root);

        // Should succeed now that we allow non-existent files
        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_read_file_success() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test_read.md");
        let test_content = "# Test Content\n\nThis is a test file.";

        // Create test file
        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, test_content).unwrap();

        let result = read_file(
            test_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        assert_eq!(result.unwrap(), test_content);

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_read_file_path_traversal() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_file = project_root.join("../../../etc/passwd");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = read_file(
            malicious_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_create_file_success() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let content_dir = project_root.join("content");
        let test_content = "# New File\n\nThis is a newly created file.";

        // Create project structure - ensure project_root exists first
        fs::create_dir_all(&project_root).unwrap();
        fs::create_dir_all(&content_dir).unwrap();

        let result = create_file(
            content_dir.to_string_lossy().to_string(),
            "test_create.md".to_string(),
            test_content.to_string(),
            None,
            FrontmatterSchema::default(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        let created_path = result.unwrap();
        assert!(Path::new(&created_path).exists());

        // Verify content
        let written_content = fs::read_to_string(&created_path).unwrap();
        assert_eq!(written_content, test_content);

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_create_file_with_frontmatter() {
        let dir = tempfile::tempdir().unwrap();
        let project_root = dir.path().to_string_lossy().to_string();
        // Keys arrive sorted, as they do over IPC, with the order alongside
        let frontmatter: IndexMap<String, Value> = serde_json::from_value(serde_json::json!({
            "title": "Say \"hi\": now",
            "pubDate": "2026-11-10",
            "sponsor": { "name": "Acme" },
            "tags": [],
            "featured": false,
        }))
        .unwrap();
        let schema = FrontmatterSchema {
            fields: ["title", "pubDate", "sponsor.name", "tags", "featured"]
                .map(String::from)
                .to_vec(),
            date_fields: vec!["pubDate".to_string()],
        };

        let path = create_file(
            project_root.clone(),
            "new.md".to_string(),
            String::new(),
            Some(frontmatter.clone()),
            schema,
            project_root,
        )
        .await
        .unwrap();

        // In schema order, with the date unquoted so Astro reads it as a date
        let written = fs::read_to_string(&path).unwrap();
        assert_eq!(
            written,
            "---\ntitle: \"Say \\\"hi\\\": now\"\npubDate: 2026-11-10\nsponsor:\n  name: Acme\ntags: []\nfeatured: false\n---\n"
        );
        let parsed = parse_frontmatter(&written);
        assert_eq!(parsed.frontmatter, frontmatter);
        assert_eq!(parsed.content, "");
        let expected = dunce::canonicalize(dir.path()).unwrap().join("new.md");
        assert_eq!(path, normalize_path_for_serialization(&expected));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn test_create_file_folder_per_entry_and_symlinks() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = temp_dir.join(format!("test_create_nested_{timestamp}"));
        let project_root = root.join("project");
        let content_dir = project_root.join("content");
        let outside = root.join("outside");
        fs::create_dir_all(&content_dir).unwrap();
        fs::create_dir_all(&outside).unwrap();
        std::os::unix::fs::symlink(&outside, content_dir.join("linked")).unwrap();

        let create = |filename: &str| {
            create_file(
                content_dir.to_string_lossy().to_string(),
                filename.to_string(),
                String::new(),
                None,
                FrontmatterSchema::default(),
                project_root.to_string_lossy().to_string(),
            )
        };

        // A new folder for the entry is created
        assert!(create("post/index.md").await.is_ok());
        assert!(content_dir.join("post/index.md").exists());

        // No folder is created through a symlink to outside the project
        let result = create("linked/post/index.md").await;
        assert!(result.is_err());
        assert!(!outside.join("post").exists());

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn test_create_file_path_traversal() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_dir = project_root.join("../../../tmp");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = create_file(
            malicious_dir.to_string_lossy().to_string(),
            "malicious.md".to_string(),
            "malicious content".to_string(),
            None,
            FrontmatterSchema::default(),
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_delete_file_success() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test_delete.md");

        // Create file to delete
        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, "content to delete").unwrap();
        assert!(test_file.exists());

        let result = delete_file(
            test_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
            true,
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        assert!(!test_file.exists());

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_delete_file_path_traversal() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let malicious_file = project_root.join("../../../tmp/should_not_delete.txt");

        // Create project directory
        fs::create_dir_all(&project_root).unwrap();

        let result = delete_file(
            malicious_file.to_string_lossy().to_string(),
            project_root.to_string_lossy().to_string(),
            false,
        )
        .await;

        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(
            error.contains("File outside project directory") || error.contains("Invalid file path")
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }

    #[tokio::test]
    async fn test_save_markdown_content() {
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test_save_markdown.md");

        // Create project structure
        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, "initial").unwrap(); // Create file first

        let mut frontmatter = IndexMap::new();
        frontmatter.insert(
            "title".to_string(),
            Value::String("Test Article".to_string()),
        );
        frontmatter.insert("draft".to_string(), Value::Bool(false));

        let content = "# Test Article\n\nThis is the article content.";

        let result = save_markdown_content(
            test_file.to_string_lossy().to_string(),
            Some(frontmatter), // Frontmatter was edited
            String::new(),     // The file had no frontmatter
            content.to_string(),
            String::new(), // No imports for this test
            FrontmatterSchema::default(),
            false,
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Verify the saved file
        let saved_content = fs::read_to_string(&test_file).unwrap();
        assert!(saved_content.starts_with("---\n"));
        // Simple strings are written unquoted
        assert!(saved_content.contains("title: Test Article"));
        assert!(saved_content.contains("draft: false"));
        assert!(saved_content.contains("# Test Article"));
        assert!(saved_content.contains("This is the article content."));

        // Clean up
        let _ = fs::remove_dir_all(&project_root);
    }

    #[test]
    fn test_to_kebab_case() {
        assert_eq!(to_kebab_case("My Image"), "my-image");
        assert_eq!(to_kebab_case("some_file_name"), "some-file-name");
        assert_eq!(to_kebab_case("UPPERCASE"), "uppercase");
        assert_eq!(to_kebab_case("already-kebab-case"), "already-kebab-case");
        assert_eq!(to_kebab_case("file with   spaces"), "file-with-spaces");
        assert_eq!(
            to_kebab_case("file___with___underscores"),
            "file-with-underscores"
        );
        // Dots in the name aren't an extension: it's already been removed
        assert_eq!(
            to_kebab_case("mdx-builder-imports.C8C_tUAK_gNwzF copy"),
            "mdx-builder-imports-c8c-tuak-gnwzf-copy"
        );
    }

    #[tokio::test]
    async fn rename_file_never_replaces_another_file() {
        let project = tempfile::TempDir::new().unwrap();
        let root = dunce::canonicalize(project.path()).unwrap();
        fs::write(root.join("a.md"), "a").unwrap();
        fs::write(root.join("b.md"), "b").unwrap();
        let path = |name: &str| root.join(name).to_string_lossy().to_string();
        let project_root = root.to_string_lossy().to_string();

        let result = rename_file(path("a.md"), path("b.md"), project_root.clone()).await;
        assert!(result.is_err());
        assert_eq!(fs::read_to_string(root.join("b.md")).unwrap(), "b");

        rename_file(path("a.md"), path("A.md"), project_root)
            .await
            .unwrap();
        let names: Vec<String> = fs::read_dir(&root)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        assert!(names.contains(&"A.md".to_string()));
    }

    #[tokio::test]
    async fn test_copy_file_to_assets_kebab_cases_dotted_names() {
        use std::fs;
        use tempfile::TempDir;

        let source_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();
        let test_file_path = source_dir.path().join("Screen.Shot_2 copy.PNG");
        fs::write(&test_file_path, b"fake image data").unwrap();

        let relative_path = copy_file_to_assets(
            test_file_path.to_str().unwrap().to_string(),
            project_dir.path().to_str().unwrap().to_string(),
            "blog".to_string(),
            "src/assets".to_string(),
            project_dir
                .path()
                .join("src/content/blog/post.md")
                .to_str()
                .unwrap()
                .to_string(),
            false,
        )
        .await
        .unwrap()
        .reference;

        // Every dot, space and underscore before the extension becomes a hyphen
        assert!(
            relative_path.ends_with("-screen-shot-2-copy.png"),
            "Unexpected name: {relative_path}"
        );
    }

    #[tokio::test]
    async fn test_copy_file_to_assets() {
        use std::fs;
        use tempfile::TempDir;

        // Create temporary directories
        let source_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();

        // Create a test file
        let test_file_path = source_dir.path().join("Test Image.png");
        fs::write(&test_file_path, b"fake image data").unwrap();

        // Copy file to assets
        let result = copy_file_to_assets(
            test_file_path.to_str().unwrap().to_string(),
            project_dir.path().to_str().unwrap().to_string(),
            "blog".to_string(),
            "src/assets".to_string(),
            project_dir
                .path()
                .join("src/content/blog/post.md")
                .to_str()
                .unwrap()
                .to_string(),
            false, // Use absolute paths for test assertions
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        let copied = result.unwrap();
        let relative_path = copied.reference;

        // Check the returned path format (absolute from project root with leading /)
        assert!(relative_path.starts_with("/src/assets/blog/"));
        assert!(relative_path.contains("-test-image.png"));

        // Its real path: macOS's temp folder is behind a symlink
        let real_project = dunce::canonicalize(project_dir.path()).unwrap();
        assert_eq!(
            copied.path,
            normalize_path_for_serialization(
                &real_project.join(relative_path.trim_start_matches('/'))
            )
        );

        // Check file was actually copied (strip leading / for path construction)
        let dest_path = project_dir
            .path()
            .join(relative_path.trim_start_matches('/'));
        assert!(dest_path.exists());

        let content = fs::read(&dest_path).unwrap();
        assert_eq!(content, b"fake image data");
    }

    #[tokio::test]
    async fn test_copy_file_to_assets_with_conflict() {
        use chrono::Local;
        use std::fs;
        use tempfile::TempDir;

        // Create temporary directories
        let source_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();

        // Create assets directory
        let assets_dir = project_dir.path().join("src/assets/posts");
        fs::create_dir_all(&assets_dir).unwrap();

        // Create an existing file with today's date
        let date_prefix = Local::now().format("%Y-%m-%d").to_string();
        let existing_file = assets_dir.join(format!("{date_prefix}-test-file.md"));
        fs::write(&existing_file, b"existing").unwrap();

        // Create source file
        let test_file_path = source_dir.path().join("Test File.md");
        fs::write(&test_file_path, b"new content").unwrap();

        // Copy file - should add -1 suffix
        let result = copy_file_to_assets(
            test_file_path.to_str().unwrap().to_string(),
            project_dir.path().to_str().unwrap().to_string(),
            "posts".to_string(),
            "src/assets".to_string(),
            project_dir
                .path()
                .join("src/content/posts/post.md")
                .to_str()
                .unwrap()
                .to_string(),
            false, // Use absolute paths for test assertions
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());
        let relative_path = result.unwrap().reference;

        // Should have -1 suffix
        assert!(relative_path.contains(&format!("{date_prefix}-test-file-1.md")));

        // Both files should exist
        assert!(existing_file.exists());
        let new_file = project_dir
            .path()
            .join(relative_path.trim_start_matches('/'));
        assert!(new_file.exists());
    }

    #[tokio::test]
    async fn copy_file_to_assets_refuses_folders_outside_the_project() {
        let root = tempfile::TempDir::new().unwrap();
        let project = root.path().join("site");
        fs::create_dir_all(&project).unwrap();
        let image = root.path().join("photo.png");
        fs::write(&image, b"png").unwrap();

        let result = copy_file_to_assets(
            image.to_string_lossy().to_string(),
            project.to_string_lossy().to_string(),
            "blog".to_string(),
            "../shared".to_string(),
            project.join("post.md").to_string_lossy().to_string(),
            true,
        )
        .await;

        assert!(result.is_err());
        assert!(!root.path().join("shared").exists());
    }

    #[tokio::test]
    async fn test_copy_file_to_assets_creates_directory() {
        use std::fs;
        use tempfile::TempDir;

        // Create temporary directories
        let source_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();

        // Create a test file
        let test_file_path = source_dir.path().join("document.pdf");
        fs::write(&test_file_path, b"pdf content").unwrap();

        // Assets directory doesn't exist yet
        let assets_dir = project_dir.path().join("src/assets/newsletters");
        assert!(!assets_dir.exists());

        // Copy file - should create directory
        let result = copy_file_to_assets(
            test_file_path.to_str().unwrap().to_string(),
            project_dir.path().to_str().unwrap().to_string(),
            "newsletters".to_string(),
            "src/assets".to_string(),
            project_dir
                .path()
                .join("src/content/newsletters/post.md")
                .to_str()
                .unwrap()
                .to_string(),
            false, // Use absolute paths for test assertions
        )
        .await;

        assert!(result.is_ok(), "Failed with error: {:?}", result.err());

        // Directory should now exist
        assert!(assets_dir.exists());

        // File should be copied (strip leading / for path construction)
        let relative_path = result.unwrap().reference;
        let dest_path = project_dir
            .path()
            .join(relative_path.trim_start_matches('/'));
        assert!(dest_path.exists());
    }

    #[tokio::test]
    async fn test_frontmatter_edit_preserves_mdx_imports() {
        // Regression test: editing frontmatter must not delete MDX imports
        let temp_dir = std::env::temp_dir();
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let thread_id = std::thread::current().id();
        let project_root = temp_dir.join(format!("test_project_{timestamp}_{thread_id:?}"));
        let test_file = project_root.join("test.mdx");

        // Create test file with MDX imports and frontmatter
        let original_content = r#"---
title: Original Title
draft: false
---

import { Component } from './Component'
import { AnotherComponent } from './AnotherComponent'

# Content

This is the main content."#;

        fs::create_dir_all(&project_root).unwrap();
        fs::write(&test_file, original_content).unwrap();

        // Update frontmatter
        let mut new_frontmatter = IndexMap::new();
        new_frontmatter.insert(
            "title".to_string(),
            Value::String("Updated Title".to_string()),
        );
        new_frontmatter.insert("draft".to_string(), Value::Bool(true));

        // Save as the editor does after a frontmatter edit: the imports and body
        // come separately from the parsed file
        let parsed = parse_frontmatter(original_content);
        let result = save_markdown_content(
            test_file.to_string_lossy().to_string(),
            Some(new_frontmatter),
            parsed.raw_frontmatter,
            parsed.content,
            parsed.imports,
            FrontmatterSchema::default(),
            false,
            project_root.to_string_lossy().to_string(),
        )
        .await;

        assert!(
            result.is_ok(),
            "Failed to update frontmatter: {:?}",
            result.err()
        );

        // Read the file back and verify imports are preserved
        let updated_content = fs::read_to_string(&test_file).unwrap();

        // Check that imports are still present
        assert!(
            updated_content.contains("import { Component } from './Component'"),
            "First import was lost! Content:\n{updated_content}"
        );
        assert!(
            updated_content.contains("import { AnotherComponent } from './AnotherComponent'"),
            "Second import was lost! Content:\n{updated_content}"
        );

        // Check that frontmatter was updated
        assert!(
            updated_content.contains("title: Updated Title"),
            "Frontmatter title was not updated! Content:\n{updated_content}"
        );
        assert!(
            updated_content.contains("draft: true"),
            "Frontmatter draft was not updated! Content:\n{updated_content}"
        );

        // Check that content is still present
        assert!(
            updated_content.contains("# Content"),
            "Main content was lost! Content:\n{updated_content}"
        );

        // Cleanup
        let _ = fs::remove_dir_all(&project_root);
    }
}
