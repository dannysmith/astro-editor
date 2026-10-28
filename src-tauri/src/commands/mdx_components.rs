use crate::mdx_components;
use crate::models::MdxComponent;
use std::path::Path;

#[tauri::command]
#[specta::specta]
pub async fn scan_mdx_components(
    project_path: String,
    mdx_directory: Option<String>,
) -> Result<Vec<MdxComponent>, String> {
    let mdx_directory = mdx_directory.unwrap_or_else(|| "src/components/mdx".to_string());
    Ok(mdx_components::scan(
        Path::new(&project_path),
        &mdx_directory,
    ))
}
