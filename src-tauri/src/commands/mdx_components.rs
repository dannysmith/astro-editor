use crate::mdx_components::{self, starlight};
use crate::mdx_esm::{self, ImportPlan, PropImports};
use crate::models::MdxComponent;
use crate::utils::validate_project_path;
use std::path::Path;

/// The project's MDX components from each of `mdx_directories` (relative to the
/// project root), plus Starlight's built-in ones in Starlight projects. A
/// component in two of the folders (one inside another) is listed once.
#[tauri::command]
#[specta::specta]
pub async fn scan_mdx_components(
    project_path: String,
    mdx_directories: Vec<String>,
) -> Result<Vec<MdxComponent>, String> {
    let project_root = Path::new(&project_path);
    let mut components: Vec<MdxComponent> = Vec::new();
    for directory in &mdx_directories {
        for component in mdx_components::scan(project_root, directory) {
            if !components
                .iter()
                .any(|c| c.file_path == component.file_path)
            {
                components.push(component);
            }
        }
    }
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
    let project_root =
        dunce::canonicalize(&project_path).map_err(|_| "Invalid project root".to_string())?;
    if let Some(image) = props
        .images
        .iter()
        .find(|image| !mdx_esm::importable_image(&project_root, &file, &image.specifier))
    {
        return Err(format!(
            "{} can't be imported: it needs to be in the project, outside public/",
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn scans_each_folder_listing_a_component_once() {
        let dir = tempfile::tempdir().unwrap();
        let component = "---\ninterface Props { label: string }\n---\n<slot />\n";
        for path in [
            "src/components/mdx/Callout.astro",
            "src/components/unique/Map.astro",
        ] {
            let path = dir.path().join(path);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, component).unwrap();
        }

        let folders = [
            "src/components/mdx",
            "src/components/unique",
            "src/components",
        ];
        let components = scan_mdx_components(
            dir.path().to_string_lossy().to_string(),
            folders.map(String::from).to_vec(),
        )
        .await
        .unwrap();

        let mut names: Vec<_> = components.iter().map(|c| c.name.as_str()).collect();
        names.sort();
        assert_eq!(names, ["Callout", "Map"]);
    }
}
