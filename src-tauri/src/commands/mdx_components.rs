use crate::mdx_components::{self, starlight};
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
