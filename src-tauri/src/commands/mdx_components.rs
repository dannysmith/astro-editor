use crate::commands::files::validate_project_path;
use crate::mdx_components::{self, starlight};
use crate::mdx_esm::{self, ImportPlan};
use crate::models::MdxComponent;
use std::path::Path;

/// The project's MDX components, plus Starlight's built-in ones in Starlight projects
#[tauri::command]
#[specta::specta]
pub async fn scan_mdx_components(
    project_path: String,
    mdx_directory: Option<String>,
) -> Result<Vec<MdxComponent>, String> {
    let project_root = Path::new(&project_path);
    let mdx_directory = mdx_directory.unwrap_or_else(|| "src/components/mdx".to_string());
    let mut components = mdx_components::scan(project_root, &mdx_directory);
    if starlight::uses_starlight(project_root) {
        components.extend(starlight::components());
    }
    Ok(components)
}

/// The import the component builder would add with `component` to the file at
/// `file_path`, whose import block and body are `imports` and `body` as the
/// editor holds them. Saves nothing. `None` when there's no import it can be sure of.
#[tauri::command]
#[specta::specta]
pub async fn plan_component_import(
    project_path: String,
    collection_path: String,
    file_path: String,
    imports: String,
    body: String,
    component: MdxComponent,
) -> Result<Option<ImportPlan>, String> {
    let file = validate_project_path(&file_path, &project_path)?;
    let collection_dir = validate_project_path(&collection_path, &project_path)?;
    let project_root = Path::new(&project_path)
        .canonicalize()
        .map_err(|_| "Invalid project root".to_string())?;
    Ok(mdx_esm::plan_component_import(
        &project_root,
        &collection_dir,
        &file,
        &imports,
        &body,
        &component,
    ))
}
