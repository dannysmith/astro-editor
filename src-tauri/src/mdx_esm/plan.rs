//! Planning the imports the component builder adds with a component and the
//! images picked for its props, without saving anything, so the builder can
//! show them first.

use std::collections::HashSet;
use std::ops::Range;
use std::path::{Path, PathBuf};

use pathdiff::diff_paths;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::edit::{add_entry_load, add_import, Style};
use super::imports::{body_esm, Binding, Esm, Import};
use crate::commands::files::parse_frontmatter_internal;
use crate::mdx_components::package_dependencies;
use crate::models::MdxComponent;

/// An image picked for an image prop, which the file has to import
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct ImageImport {
    /// The picked file's name, which the import's binding is named after
    pub file_name: String,
    /// The path to import it from, as the editor writes image paths
    pub specifier: String,
}

/// A collection entry picked for an entry prop, which the file loads with
/// `getEntry`
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct EntryImport {
    pub collection: String,
    /// The entry's id in Astro
    pub id: String,
}

/// What was picked for the props whose values the file has to import or load
#[derive(Serialize, Deserialize, Clone, Debug, Default, specta::Type)]
pub struct PropImports {
    pub images: Vec<ImageImport>,
    pub entries: Vec<EntryImport>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, specta::Type)]
pub struct ImportPlan {
    /// The import block with everything added
    pub imports: String,
    /// The statements added or changed, in the order they're in the block
    pub added: Vec<String>,
    /// The statement that already imports the component, if one does. It may
    /// import something else of the same name, and then the writer's import wins.
    pub existing: Option<String>,
    /// The name each image is imported as, in the order they were given
    pub images: Vec<String>,
    /// The name each entry is loaded as, in the order they were given
    pub entries: Vec<String>,
}

/// Plans the imports for inserting `component` into `file`, with `props` for
/// the images and entries picked for its props. `imports` and `body` are the
/// file's import block and body. `None` when there's no import we can be sure
/// of, such as when the block isn't only imports and exports.
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
    props: &PropImports,
) -> Option<ImportPlan> {
    let block = Esm::parse(imports)?;
    let file_esm: Vec<Esm> = std::iter::once(block).chain(body_esm(body)).collect();
    let imported = |name: &str| file_esm.iter().find_map(|e| e.statement_importing(name));

    let names: Vec<&str> = std::iter::once(component.name.as_str())
        .chain(slot_components(component))
        .collect();
    let missing: Vec<&str> = names
        .iter()
        .copied()
        .filter(|name| imported(name).is_none())
        .collect();
    let existing = if missing.is_empty() {
        imported(&component.name).map(str::to_string)
    } else {
        None
    };
    if missing.is_empty() && props.images.is_empty() && props.entries.is_empty() {
        return Some(ImportPlan {
            imports: imports.to_string(),
            added: Vec::new(),
            existing,
            images: Vec::new(),
            entries: Vec::new(),
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
    let mut added = Vec::new();
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
        let change = add_import(&Esm::parse(&text)?, name, &binding, &source, style);
        record(&mut text, &mut added, change);
    }

    // Images and entries can be picked twice, or already be in the file for
    // something else, and then their existing name is used
    let body_esm = &file_esm[1..];
    let mut taken: HashSet<String> = file_esm
        .iter()
        .flat_map(|e| e.bindings())
        .chain(names)
        .chain(["getEntry"])
        .map(String::from)
        .collect();

    let mut image_names = Vec::new();
    for image in &props.images {
        let block = Esm::parse(&text)?;
        let already = std::iter::once(&block)
            .chain(body_esm)
            .flat_map(|e| e.imports())
            .filter(|(_, import)| import.source == image.specifier && !import.type_only)
            .flat_map(|(_, import)| &import.specifiers)
            .find(|s| s.binding == Binding::Default)
            .map(|s| s.local.clone());
        let name = match already {
            Some(name) => name,
            None => {
                let name = unique_name(
                    &variable_name(&file_stem(&image.file_name), "image"),
                    &taken,
                );
                let change = add_import(&block, &name, &Binding::Default, &image.specifier, style);
                record(&mut text, &mut added, change);
                taken.insert(name.clone());
                name
            }
        };
        image_names.push(name);
    }

    let mut entry_names = Vec::new();
    for entry in &props.entries {
        let block = Esm::parse(&text)?;
        let already = std::iter::once(&block)
            .chain(body_esm)
            .find_map(|e| e.name_loading(&entry.collection, &entry.id))
            .map(String::from);
        let name = match already {
            Some(name) => name,
            None => {
                let has_get_entry = std::iter::once(&block)
                    .chain(body_esm)
                    .any(|e| e.statement_importing("getEntry").is_some());
                if !has_get_entry {
                    let get_entry = Binding::Named("getEntry".to_string());
                    let change = add_import(&block, "getEntry", &get_entry, "astro:content", style);
                    record(&mut text, &mut added, change);
                }
                // The last part of the id: `2024/first-post` gives `firstPost`
                let last = entry.id.rsplit('/').next().unwrap_or_default();
                let name = unique_name(&variable_name(last, "entry"), &taken);
                let change = add_entry_load(
                    &Esm::parse(&text)?,
                    &name,
                    &entry.collection,
                    &entry.id,
                    style,
                );
                record(&mut text, &mut added, change);
                taken.insert(name.clone());
                name
            }
        };
        entry_names.push(name);
    }

    Some(ImportPlan {
        added: added
            .into_iter()
            .map(|range| text[range].to_string())
            .collect(),
        imports: text,
        existing,
        images: image_names,
        entries: entry_names,
    })
}

/// Takes `change`, the new text and the statement added or changed in it, and
/// keeps `added` (where the statements added or changed so far are) up to date
/// as the text around them moves
fn record(text: &mut String, added: &mut Vec<Range<usize>>, change: (String, Range<usize>)) {
    let (new_text, range) = change;
    let grew = new_text.len() - text.len();
    // A statement that was joined is replaced by its new range
    added.retain(|r| r.start != range.start);
    for r in added.iter_mut().filter(|r| r.start > range.start) {
        *r = r.start + grew..r.end + grew;
    }
    added.push(range);
    added.sort_by_key(|r| r.start);
    *text = new_text;
}

/// Whether the image at `specifier`, a path the editor wrote for `file`, is
/// inside `src/`. Astro can't import images from anywhere else, like `public/`.
pub fn importable_image(project_root: &Path, file: &Path, specifier: &str) -> bool {
    let path = match specifier.strip_prefix('/') {
        Some(from_root) => project_root.join(from_root),
        None => match file.parent() {
            Some(dir) => dir.join(specifier),
            None => return false,
        },
    };
    path.canonicalize()
        .is_ok_and(|path| path.starts_with(project_root.join("src")))
}

fn file_stem(file_name: &str) -> String {
    Path::new(file_name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// A variable name for an image or entry (`kind`), from its file name or id:
/// `hero-image` gives `heroImage`. Leading numbers, like the date the editor
/// puts on copied files, are dropped. Falls back to `kind` when nothing's left.
fn variable_name(text: &str, kind: &str) -> String {
    let mut name = String::new();
    let words = text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .skip_while(|word| word.chars().all(char::is_numeric));
    for word in words {
        let mut chars = word.chars();
        let first = chars.next().unwrap_or_default();
        if name.is_empty() {
            // `IMG_1234` gives `img1234`, `heroImage` stays as it is
            if word.chars().all(|c| !c.is_lowercase()) {
                name.push_str(&word.to_lowercase());
            } else {
                name.extend(first.to_lowercase());
                name.push_str(chars.as_str());
            }
        } else {
            name.extend(first.to_uppercase());
            name.push_str(chars.as_str());
        }
    }
    if name.is_empty() {
        kind.to_string()
    } else if name.starts_with(char::is_numeric) {
        format!("{kind}{name}")
    } else if RESERVED_WORDS.contains(&name.as_str()) {
        let (first, rest) = kind.split_at(1);
        format!("{name}{}{rest}", first.to_uppercase())
    } else {
        name
    }
}

/// Words that can't be variable names in a module, and globals best not hidden
const RESERVED_WORDS: &[&str] = &[
    "arguments",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "eval",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "undefined",
    "var",
    "void",
    "while",
    "with",
    "yield",
];

/// `name`, or `name2`, `name3`… when it's taken
fn unique_name(name: &str, taken: &HashSet<String>) -> String {
    if !taken.contains(name) {
        return name.to_string();
    }
    (2..)
        .map(|n| format!("{name}{n}"))
        .find(|candidate| !taken.contains(candidate))
        .unwrap()
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

    /// Plans for a file in an empty collection, with images picked by their
    /// file name and path
    fn plan(
        imports: &str,
        body: &str,
        component: &MdxComponent,
        images: &[(&str, &str)],
    ) -> Option<ImportPlan> {
        let images = images
            .iter()
            .map(|(file_name, specifier)| ImageImport {
                file_name: file_name.to_string(),
                specifier: specifier.to_string(),
            })
            .collect();
        plan_props(
            imports,
            body,
            component,
            PropImports {
                images,
                entries: Vec::new(),
            },
        )
    }

    /// Plans with entries picked by their collection and id
    fn plan_entries(imports: &str, entries: &[(&str, &str)]) -> ImportPlan {
        let entries = entries
            .iter()
            .map(|(collection, id)| EntryImport {
                collection: collection.to_string(),
                id: id.to_string(),
            })
            .collect();
        let props = PropImports {
            images: Vec::new(),
            entries,
        };
        plan_props(imports, "", &starlight("Aside"), props).unwrap()
    }

    fn plan_props(
        imports: &str,
        body: &str,
        component: &MdxComponent,
        props: PropImports,
    ) -> Option<ImportPlan> {
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
            &props,
        )
    }

    #[test]
    fn loads_entries_with_get_entry() {
        let plan = plan_entries(
            "import { Aside } from '@astrojs/starlight/components'",
            &[("articles", "2024/first-post"), ("authors", "jane")],
        );
        assert_eq!(plan.entries, ["firstPost", "jane"]);
        assert_eq!(
            plan.imports,
            "import { Aside } from '@astrojs/starlight/components'\nimport { getEntry } from 'astro:content'\nexport const firstPost = await getEntry('articles', '2024/first-post')\nexport const jane = await getEntry('authors', 'jane')"
        );
        assert_eq!(
            plan.added,
            [
                "import { getEntry } from 'astro:content'",
                "export const firstPost = await getEntry('articles', '2024/first-post')",
                "export const jane = await getEntry('authors', 'jane')"
            ]
        );
    }

    #[test]
    fn joins_an_astro_content_import_and_reuses_loaded_entries() {
        let block = "import { Aside } from '@astrojs/starlight/components';\nimport { getCollection } from 'astro:content';\nexport const post = await getEntry('articles', 'a');";
        let plan = plan_entries(block, &[("articles", "a"), ("articles", "get-entry")]);
        assert_eq!(plan.entries, ["post", "getEntry2"]);
        assert_eq!(
            plan.added,
            [
                "import { getCollection, getEntry } from 'astro:content';",
                "export const getEntry2 = await getEntry('articles', 'get-entry');"
            ]
        );
    }

    #[test]
    fn shows_the_statement_it_adds_or_changes() {
        let block = "import { Steps } from '@astrojs/starlight/components'\nimport A from './a'";
        assert_eq!(
            plan(block, "", &starlight("Tabs"), &[]),
            Some(ImportPlan {
                imports: "import { Steps, Tabs, TabItem } from '@astrojs/starlight/components'\nimport A from './a'".into(),
                added: vec!["import { Steps, Tabs, TabItem } from '@astrojs/starlight/components'".into()],
                existing: None,
                images: vec![],
                entries: vec![],
            })
        );
    }

    #[test]
    fn shows_the_import_that_already_has_the_name() {
        let card = "import { Card } from '@astrojs/starlight/components';";
        let expected = |imports: &str| ImportPlan {
            imports: imports.into(),
            added: vec![],
            existing: Some(card.into()),
            images: vec![],
            entries: vec![],
        };
        assert_eq!(
            plan(card, "", &starlight("Card"), &[]),
            Some(expected(card))
        );
        // Further down the body
        assert_eq!(
            plan(
                "",
                &format!("Text.\n\n{card}\n\n<Card />"),
                &starlight("Card"),
                &[]
            ),
            Some(expected(""))
        );
    }

    #[test]
    fn plans_nothing_for_a_block_that_isnt_only_imports_and_exports() {
        assert_eq!(
            plan(
                "import a from 'a'\nconst b = 1",
                "",
                &starlight("Aside"),
                &[]
            ),
            None
        );
    }

    #[test]
    fn imports_images_under_names_from_their_files() {
        let plan = plan(
            "import { Aside } from '@astrojs/starlight/components';",
            "",
            &starlight("Aside"),
            &[
                ("rocket.png", "../../assets/docs/rocket.png"),
                ("Hero Image.jpg", "../../assets/docs/hero-image.jpg"),
            ],
        )
        .unwrap();
        assert_eq!(plan.images, ["rocket", "heroImage"]);
        assert_eq!(
            plan.added,
            [
                "import rocket from '../../assets/docs/rocket.png';",
                "import heroImage from '../../assets/docs/hero-image.jpg';"
            ]
        );
        assert_eq!(
            plan.existing.as_deref(),
            Some("import { Aside } from '@astrojs/starlight/components';")
        );
    }

    #[test]
    fn lists_every_statement_it_adds_or_changes() {
        let plan = plan(
            "import { Steps } from '@astrojs/starlight/components'",
            "",
            &starlight("Tabs"),
            &[("rocket.png", "./rocket.png")],
        )
        .unwrap();
        assert_eq!(
            plan.added,
            [
                "import { Steps, Tabs, TabItem } from '@astrojs/starlight/components'",
                "import rocket from './rocket.png'"
            ]
        );
    }

    #[test]
    fn image_names_avoid_names_the_file_uses() {
        let block = "import rocket from './other.png'\nexport const rocket2 = 1";
        let plan = plan(
            block,
            "",
            &starlight("Aside"),
            &[("rocket.png", "./rocket.png"), ("aside.png", "./aside.png")],
        )
        .unwrap();
        assert_eq!(plan.images, ["rocket3", "aside"]);
    }

    #[test]
    fn reuses_an_image_already_imported() {
        let block = "import launch from './rocket.png'";
        let plan = plan(
            block,
            "",
            &starlight("Aside"),
            &[
                ("rocket.png", "./rocket.png"),
                ("rocket.png", "./rocket.png"),
            ],
        )
        .unwrap();
        assert_eq!(plan.images, ["launch", "launch"]);
        assert_eq!(
            plan.added,
            ["import { Aside } from '@astrojs/starlight/components'"]
        );
    }

    #[test]
    fn names_images_and_entries_after_their_files() {
        assert_eq!(
            variable_name(&file_stem("hero-image.png"), "image"),
            "heroImage"
        );
        assert_eq!(
            variable_name(&file_stem("heroImage.png"), "image"),
            "heroImage"
        );
        assert_eq!(
            variable_name(&file_stem("2026-10-31-rocket.webp"), "image"),
            "rocket"
        );
        assert_eq!(
            variable_name(&file_stem("IMG_1234.JPG"), "image"),
            "img1234"
        );
        assert_eq!(variable_name(&file_stem("2x.png"), "image"), "image2x");
        assert_eq!(
            variable_name(&file_stem("class.png"), "image"),
            "classImage"
        );
        assert_eq!(
            variable_name(&file_stem("2026-10-31.png"), "image"),
            "image"
        );
        assert_eq!(
            variable_name(&file_stem("café au lait.png"), "image"),
            "caféAuLait"
        );
        assert_eq!(
            variable_name("1709876543210-timestamp-filename-format", "entry"),
            "timestampFilenameFormat"
        );
        assert_eq!(variable_name("default", "entry"), "defaultEntry");
        assert_eq!(variable_name("2024", "entry"), "entry");
    }

    #[test]
    fn only_images_in_src_can_be_imported() {
        let project = tempfile::TempDir::new().unwrap();
        let root = project.path().canonicalize().unwrap();
        for dir in ["src/content/docs", "src/assets", "public"] {
            fs::create_dir_all(root.join(dir)).unwrap();
        }
        fs::write(root.join("src/assets/a.png"), "").unwrap();
        fs::write(root.join("public/b.png"), "").unwrap();
        let file = root.join("src/content/docs/page.mdx");

        assert!(importable_image(&root, &file, "../../assets/a.png"));
        assert!(importable_image(&root, &file, "/src/assets/a.png"));
        assert!(!importable_image(&root, &file, "/public/b.png"));
        assert!(!importable_image(&root, &file, "../../../public/b.png"));
        assert!(!importable_image(&root, &file, "./missing.png"));
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
                    &PropImports::default(),
                );
                let actual = plan
                    .filter(|plan| !plan.added.is_empty())
                    .map(|plan| plan.imports);
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
