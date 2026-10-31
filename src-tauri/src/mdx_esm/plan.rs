//! Planning the import the component builder adds with a component, without
//! saving anything, so the builder can show it first.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use pathdiff::diff_paths;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::edit::{add_import, Style};
use super::imports::{body_esm, Binding, Esm, Import};
use crate::commands::files::parse_frontmatter_internal;
use crate::mdx_components::package_dependencies;
use crate::models::MdxComponent;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ImportPlan {
    /// The new import block, and the statement added or changed in it
    Add { imports: String, statement: String },
    /// The component's name is already imported, by `statement`. It may import
    /// something else of the same name, and then the writer's import wins.
    AlreadyImported { statement: String },
}

/// Plans the import for inserting `component` into `file`, whose import block
/// and body are `imports` and `body`. `None` when there's no import we can be
/// sure of, such as when the block isn't only imports and exports.
///
/// Paths are absolute and canonical. `collection_dir` is the file's collection,
/// whose other files show how the site writes imports.
pub fn plan_component_import(
    project_root: &Path,
    collection_dir: &Path,
    file: &Path,
    imports: &str,
    body: &str,
    component: &MdxComponent,
) -> Option<ImportPlan> {
    let block = Esm::parse(imports)?;
    let file_esm: Vec<Esm> = std::iter::once(block).chain(body_esm(body)).collect();
    let imported = |name: &str| file_esm.iter().find_map(|e| e.statement_importing(name));

    let missing: Vec<&str> = std::iter::once(component.name.as_str())
        .chain(slot_components(component))
        .filter(|name| imported(name).is_none())
        .collect();
    if missing.is_empty() {
        return Some(ImportPlan::AlreadyImported {
            statement: imported(&component.name)?.to_string(),
        });
    }

    let current_dir = file.parent()?;
    let collection = collection_files(collection_dir, file);
    let style = style_of(file_esm.iter().flat_map(|e| e.imports()).map(|(_, i)| i))
        .or_else(|| {
            style_of(
                collection
                    .iter()
                    .flat_map(|f| &f.esm)
                    .flat_map(|e| e.imports())
                    .map(|(_, i)| i),
            )
        })
        .unwrap_or_default();

    let mut text = imports.to_string();
    let mut changed = 0..0;
    for name in missing {
        let (source, binding) = if name != component.name {
            // Slot templates only come with a package's components
            (
                component.import_source.clone()?,
                Binding::Named(name.to_string()),
            )
        } else if let Some(source) = &component.import_source {
            (source.clone(), binding_of(component))
        } else {
            let packages = package_dependencies(project_root);
            copied_import(name, &collection, current_dir, &packages).or_else(|| {
                let path = diff_paths(project_root.join(&component.file_path), current_dir)?;
                Some((relative_specifier(&path), binding_of(component)))
            })?
        };
        (text, changed) = add_import(&Esm::parse(&text)?, name, &binding, &source, style);
    }

    Some(ImportPlan::Add {
        statement: text[changed].to_string(),
        imports: text,
    })
}

/// Other components a package component's slot template inserts, like the
/// `TabItem`s inside `Tabs`, which need importing too
fn slot_components(component: &MdxComponent) -> Vec<&str> {
    let Some(template) = &component.slot_template else {
        return Vec::new();
    };
    let mut names = Vec::new();
    for (i, _) in template.match_indices('<') {
        let rest = &template[i + 1..];
        let name = &rest[..rest
            .find(|c: char| !c.is_ascii_alphanumeric())
            .unwrap_or(rest.len())];
        if name.starts_with(|c: char| c.is_ascii_uppercase())
            && name != component.name
            && !names.contains(&name)
        {
            names.push(name);
        }
    }
    names
}

fn binding_of(component: &MdxComponent) -> Binding {
    if component.named_export {
        Binding::Named(component.name.clone())
    } else {
        Binding::Default
    }
}

/// An MDX file in the collection, other than the one being edited
struct CollectionFile {
    dir: PathBuf,
    esm: Vec<Esm>,
}

fn collection_files(collection_dir: &Path, current: &Path) -> Vec<CollectionFile> {
    WalkDir::new(collection_dir)
        .sort_by_file_name()
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "mdx"))
        .filter(|entry| entry.path() != current)
        .filter_map(|entry| {
            let parsed =
                parse_frontmatter_internal(&std::fs::read_to_string(entry.path()).ok()?).ok()?;
            let esm = Esm::parse(&parsed.imports)
                .into_iter()
                .chain(body_esm(&parsed.content))
                .collect();
            Some(CollectionFile {
                dir: entry.path().parent()?.to_path_buf(),
                esm,
            })
        })
        .collect()
}

/// How another file in the collection imports `name`, if one does and its path
/// works from `current_dir`: aliases, root paths, barrels and packages work from
/// anywhere, relative paths only from the same folder. Imports from the
/// project's `packages` are skipped: those are other components with the same
/// name, like Starlight's `Card`, or an embed imported as `Video`.
fn copied_import(
    name: &str,
    collection: &[CollectionFile],
    current_dir: &Path,
    packages: &HashSet<String>,
) -> Option<(String, Binding)> {
    collection.iter().find_map(|file| {
        file.esm
            .iter()
            .flat_map(|e| e.imports())
            .find_map(|(_, import)| {
                if import.type_only
                    || packages.contains(package_name(&import.source))
                    || import.source.starts_with('.') && file.dir != current_dir
                {
                    return None;
                }
                let specifier = import.specifiers.iter().find(|s| s.local == name)?;
                (specifier.binding != Binding::Namespace)
                    .then(|| (import.source.clone(), specifier.binding.clone()))
            })
    })
}

/// The package a module is in, if it's in one: `@scope/name` or `name`
fn package_name(source: &str) -> &str {
    let segments = if source.starts_with('@') { 2 } else { 1 };
    let end = source
        .match_indices('/')
        .nth(segments - 1)
        .map_or(source.len(), |(i, _)| i);
    &source[..end]
}

/// A path relative to the file, with `/` and the component's extension, which
/// Astro needs for `.astro`, `.vue` and `.svelte` files
fn relative_specifier(path: &Path) -> String {
    let path = path.to_string_lossy().replace('\\', "/");
    if path.starts_with("../") {
        path
    } else {
        format!("./{path}")
    }
}

/// The quotes and semicolons most of `imports` use, ties going to the default
fn style_of<'a>(imports: impl Iterator<Item = &'a Import>) -> Option<Style> {
    let (mut total, mut double, mut semicolons) = (0, 0, 0);
    for import in imports {
        total += 1;
        double += usize::from(import.quote == '"');
        semicolons += usize::from(import.semicolon);
    }
    (total > 0).then(|| Style {
        quote: if double * 2 > total { '"' } else { '\'' },
        semicolons: semicolons * 2 >= total,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mdx_components::{self, starlight};
    use std::fs;

    #[derive(Deserialize)]
    struct Cases {
        components_dir: Option<String>,
        case: Vec<Case>,
    }

    #[derive(Deserialize)]
    struct Case {
        name: String,
        file: String,
        component: String,
        package: Option<String>,
        expected: Option<String>,
        #[serde(default)]
        unchanged: bool,
    }

    fn starlight(name: &str) -> MdxComponent {
        starlight::components()
            .into_iter()
            .find(|c| c.name == name)
            .unwrap()
    }

    /// Plans for a file in an empty collection
    fn plan(imports: &str, body: &str, component: &MdxComponent) -> Option<ImportPlan> {
        let project = tempfile::TempDir::new().unwrap();
        let root = project.path().canonicalize().unwrap();
        let collection = root.join("src/content/docs");
        fs::create_dir_all(&collection).unwrap();
        plan_component_import(
            &root,
            &collection,
            &collection.join("page.mdx"),
            imports,
            body,
            component,
        )
    }

    #[test]
    fn shows_the_statement_it_adds_or_changes() {
        let block = "import { Steps } from '@astrojs/starlight/components'\nimport A from './a'";
        assert_eq!(
            plan(block, "", &starlight("Tabs")),
            Some(ImportPlan::Add {
                imports: "import { Steps, Tabs, TabItem } from '@astrojs/starlight/components'\nimport A from './a'".into(),
                statement: "import { Steps, Tabs, TabItem } from '@astrojs/starlight/components'".into(),
            })
        );
    }

    #[test]
    fn shows_the_import_that_already_has_the_name() {
        let card = "import { Card } from '@astrojs/starlight/components';";
        let expected = Some(ImportPlan::AlreadyImported {
            statement: card.into(),
        });
        assert_eq!(plan(card, "", &starlight("Card")), expected);
        // Further down the body
        assert_eq!(
            plan(
                "",
                &format!("Text.\n\n{card}\n\n<Card />"),
                &starlight("Card")
            ),
            expected
        );
    }

    #[test]
    fn plans_nothing_for_a_block_that_isnt_only_imports_and_exports() {
        assert_eq!(
            plan("import a from 'a'\nconst b = 1", "", &starlight("Aside")),
            None
        );
    }

    #[test]
    fn finds_the_package_of_a_module() {
        assert_eq!(
            package_name("@astrojs/starlight/components"),
            "@astrojs/starlight"
        );
        assert_eq!(package_name("astro-embed"), "astro-embed");
        assert_eq!(package_name("astro:content"), "astro:content");
        assert_eq!(
            package_name("@components/mdx/Card.astro"),
            "@components/mdx"
        );
        assert_eq!(package_name("~/components/Card.astro"), "~");
    }

    /// Runs every case in `test/mdx-imports/sites/*/cases.toml`
    #[test]
    fn cases_in_test_sites() {
        let sites = Path::new(env!("CARGO_MANIFEST_DIR")).join("../test/mdx-imports/sites");
        let mut site_dirs: Vec<_> = fs::read_dir(&sites)
            .unwrap()
            .map(|entry| entry.unwrap().path().canonicalize().unwrap())
            .filter(|dir| dir.join("cases.toml").exists())
            .collect();
        site_dirs.sort();

        let mut count = 0;
        let mut failures = Vec::new();
        for site in site_dirs {
            let cases: Cases =
                toml::from_str(&fs::read_to_string(site.join("cases.toml")).unwrap()).unwrap();
            let components_dir = cases
                .components_dir
                .as_deref()
                .unwrap_or("src/components/mdx");
            let mut components = mdx_components::scan(&site, components_dir);
            components.extend(starlight::components());

            for case in cases.case {
                count += 1;
                let label = format!("{}: {}", site.file_name().unwrap().display(), case.name);
                let component = components
                    .iter()
                    .find(|c| c.name == case.component && c.import_source == case.package)
                    .unwrap_or_else(|| panic!("{label}: no component {}", case.component));
                let file = site.join(&case.file);
                let parsed =
                    parse_frontmatter_internal(&fs::read_to_string(&file).unwrap()).unwrap();
                // src/content/<collection>/…
                let collection = file
                    .ancestors()
                    .find(|dir| dir.parent().is_some_and(|p| p.ends_with("src/content")))
                    .unwrap();

                let plan = plan_component_import(
                    &site,
                    collection,
                    &file,
                    &parsed.imports,
                    &parsed.content,
                    component,
                );
                let actual = match plan {
                    Some(ImportPlan::Add { imports, .. }) => Some(imports),
                    _ => None,
                };
                let expected = (!case.unchanged).then(|| case.expected.clone().unwrap());
                if actual.as_deref().map(str::trim_end) != expected.as_deref().map(str::trim_end) {
                    failures.push(format!(
                        "{label}\n  expected: {expected:?}\n  actual:   {actual:?}"
                    ));
                }
            }
        }
        assert!(count > 0);
        assert!(failures.is_empty(), "\n{}\n", failures.join("\n"));
    }
}
