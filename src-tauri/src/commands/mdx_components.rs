use crate::mdx_components::{self, starlight};
use crate::mdx_esm::{self, ImportPlan, PropImports};
use crate::models::MdxComponent;
use crate::utils::validate_project_path;
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

/// The imports the component builder would add with `component`, and with the
/// images and entries picked for its props (`props`), to the file at
/// `file_path`, whose import block and body are `imports` and `body` as the
/// editor holds them. Saves nothing. `None` when there's no import it can be
/// sure of. An error when an image isn't somewhere Astro can import it from.
#[tauri::command]
#[specta::specta]
pub async fn plan_component_import(
    project_path: String,
    collection_path: String,
    file_path: String,
    imports: String,
    body: String,
    component: MdxComponent,
    props: PropImports,
) -> Result<Option<ImportPlan>, String> {
    let file = validate_project_path(&file_path, &project_path)?;
    let collection_dir = validate_project_path(&collection_path, &project_path)?;
    let project_root = Path::new(&project_path)
        .canonicalize()
        .map_err(|_| "Invalid project root".to_string())?;
    if let Some(image) = props
        .images
        .iter()
        .find(|image| !mdx_esm::importable_image(&project_root, &file, &image.specifier))
    {
        return Err(format!(
            "{} isn't in src/, and Astro can only import images from there",
            image.file_name
        ));
    }
    Ok(mdx_esm::plan_component_import(
        &project_root,
        &collection_dir,
        &file,
        &imports,
        &body,
        &component,
        &props,
    ))
}

/// The packages in the project's `package.json` dependencies and
/// devDependencies, sorted
#[tauri::command]
#[specta::specta]
pub async fn project_dependencies(project_path: String) -> Result<Vec<String>, String> {
    let mut packages: Vec<_> = mdx_components::package_dependencies(Path::new(&project_path))
        .into_iter()
        .collect();
    packages.sort();
    Ok(packages)
}
