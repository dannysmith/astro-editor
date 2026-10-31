//! Planning the imports the component builder adds with a component and the
//! images and entries picked for its props, without saving anything, so the
//! builder can show them first.

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

use pathdiff::diff_paths;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::edit::{add_entry_load, add_import, Style};
use super::imports::{body_esm, Binding, Esm, Import};
use crate::mdx_components::package_dependencies;
use crate::models::MdxComponent;

/// An image picked for an image prop, which the file has to import
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct ImageImport {
    /// The prop it was picked for
    pub prop: String,
    /// The picked file's name, which the import's binding is named after
    pub file_name: String,
    /// The path to import it from, as the editor writes image paths
    pub specifier: String,
}

/// A collection entry picked for an entry prop, which the file loads with
/// `getEntry`
#[derive(Serialize, Deserialize, Clone, Debug, specta::Type)]
pub struct EntryImport {
    /// The prop it was picked for
    pub prop: String,
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
    /// The statement that already has the component's name, if one does. It may
    /// be something else of the same name, and then the writer's import wins.
    pub existing: Option<String>,
    /// The name each picked image or entry is imported or loaded as, by the
    /// prop it was picked for
    pub names: BTreeMap<String, String>,
}

/// Plans the imports for inserting `component` into `file`, with `props` for
/// the images and entries picked for its props. `imports` and `body` are the
/// file's import block and body. `None` when there's no import we can be sure
/// of: the component's name isn't one an import can bind, or the block doesn't
/// parse.
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
    if !is_component_name(&component.name) {
        return None;
    }
    let block = Esm::parse(imports)?;
    let file_esm: Vec<Esm> = std::iter::once(block).chain(body_esm(body)).collect();
    // Imported, or declared in the file like `export const Callout = …`
    let bound = |name: &str| file_esm.iter().find_map(|e| e.statement_binding(name));

    let component_names: Vec<&str> = std::iter::once(component.name.as_str())
        .chain(slot_components(component))
        .collect();
    let missing: Vec<&str> = component_names
        .iter()
        .copied()
        .filter(|name| bound(name).is_none())
        .collect();
    let existing = if missing.is_empty() {
        bound(&component.name).map(str::to_string)
    } else {
        None
    };
    if missing.is_empty() && props.images.is_empty() && props.entries.is_empty() {
        return Some(ImportPlan {
            imports: imports.to_string(),
            added: Vec::new(),
            existing,
            names: BTreeMap::new(),
        });
    }

    let current_dir = file.parent()?;
    let style = style_of(file_esm.iter().flat_map(|e| e.imports()).map(|(_, i)| i))
        .or_else(|| {
            let collection: Vec<_> = mdx_files(collection_dir, file).map(|f| f.esm()).collect();
            style_of(
                collection
                    .iter()
                    .flatten()
                    .flat_map(|e| e.imports())
                    .map(|(_, i)| i),
            )
        })
        .unwrap_or_default();

    let mut text = imports.to_string();
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
            copied_import(project_root, collection_dir, file, component).or_else(|| {
                let path = diff_paths(project_root.join(&component.file_path), current_dir)?;
                Some((relative_specifier(&path), binding_of(component)))
            })?
        };
        text = add_import(&Esm::parse(&text)?, name, &binding, &source, style);
    }

    // Images and entries can be picked twice, or already be in the file for
    // something else, and then their existing name is used
    let further_down = &file_esm[1..];
    let mut taken: HashSet<String> = file_esm
        .iter()
        .flat_map(|e| e.bindings())
        .chain(component_names)
        .chain(["getEntry"])
        .map(String::from)
        .collect();

    let mut names = BTreeMap::new();
    for image in &props.images {
        let block = Esm::parse(&text)?;
        let already = std::iter::once(&block)
            .chain(further_down)
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
                text = add_import(&block, &name, &Binding::Default, &image.specifier, style);
                taken.insert(name.clone());
                name
            }
        };
        names.insert(image.prop.clone(), name);
    }

    for entry in &props.entries {
        let block = Esm::parse(&text)?;
        let already = std::iter::once(&block)
            .chain(further_down)
            .find_map(|e| e.name_loading(&entry.collection, &entry.id))
            .map(String::from);
        let name = match already {
            Some(name) => name,
            None => {
                let has_get_entry = std::iter::once(&block)
                    .chain(further_down)
                    .any(|e| e.statement_binding("getEntry").is_some());
                if !has_get_entry {
                    let get_entry = Binding::Named("getEntry".to_string());
                    text = add_import(&block, "getEntry", &get_entry, "astro:content", style);
                }
                // The last part of the id: `2024/first-post` gives `firstPost`
                let last = entry.id.rsplit('/').next().unwrap_or_default();
                let name = unique_name(&variable_name(last, "entry"), &taken);
                text = add_entry_load(
                    &Esm::parse(&text)?,
                    &name,
                    &entry.collection,
                    &entry.id,
                    style,
                );
                taken.insert(name.clone());
                name
            }
        };
        names.insert(entry.prop.clone(), name);
    }

    Some(ImportPlan {
        added: changed_statements(imports, &text)?,
        imports: text,
        existing,
        names,
    })
}

/// The statements in `after` that aren't in `before`: the ones added, and the
/// ones a name was joined into
fn changed_statements(before: &str, after: &str) -> Option<Vec<String>> {
    let before = Esm::parse(before)?;
    let unchanged: HashSet<&str> = before
        .statements
        .iter()
        .map(|s| &before.text[s.range.clone()])
        .collect();
    let after = Esm::parse(after)?;
    Some(
        after
            .statements
            .iter()
            .map(|s| &after.text[s.range.clone()])
            .filter(|s| !unchanged.contains(s))
            .map(String::from)
            .collect(),
    )
}

/// Whether `name` can be imported and used as a component: an identifier
/// starting with a capital, as MDX treats lowercase tags as HTML
fn is_component_name(name: &str) -> bool {
    name.starts_with(|c: char| c.is_ascii_uppercase())
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '$')
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

/// Words that can't be variable names in a module, globals best not hidden, and
/// names Astro defines in every MDX file (`frontmatter`, `getHeadings`, `url`,
/// `file`, and `components` for the component mapping)
const RESERVED_WORDS: &[&str] = &[
    "arguments",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "components",
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
    "file",
    "finally",
    "for",
    "frontmatter",
    "function",
    "getHeadings",
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
    "url",
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

/// Another MDX file, whose imports show how the site writes them
struct MdxFile {
    dir: PathBuf,
    text: String,
}

impl MdxFile {
    /// The file's ESM: the block after its frontmatter and any further down
    fn esm(&self) -> Vec<Esm> {
        body_esm(after_frontmatter(&self.text))
    }
}

/// The MDX files under `dir` other than `current`, in a stable order, each read
/// only when it's reached
fn mdx_files<'a>(dir: &'a Path, current: &'a Path) -> impl Iterator<Item = MdxFile> + 'a {
    WalkDir::new(dir)
        .sort_by_file_name()
        .into_iter()
        .filter_map(Result::ok)
        .filter(move |entry| {
            entry.path().extension().is_some_and(|ext| ext == "mdx") && entry.path() != current
        })
        .filter_map(|entry| {
            Some(MdxFile {
                dir: entry.path().parent()?.to_path_buf(),
                text: fs::read_to_string(entry.path()).ok()?.replace("\r\n", "\n"),
            })
        })
}

/// The text after a file's frontmatter, without parsing the YAML
fn after_frontmatter(text: &str) -> &str {
    let Some(rest) = text.strip_prefix("---\n") else {
        return text;
    };
    let mut pos = 0;
    for line in rest.split_inclusive('\n') {
        pos += line.len();
        if line.trim_end() == "---" {
            return &rest[pos..];
        }
    }
    text
}

/// How another file imports `component`, if one does with a path that works
/// from `file`, looking through the collection first and then the folder the
/// collections are in. Aliases, root paths and barrels are copied as written,
/// which is how a site's aliases get used without reading tsconfig. A relative
/// path is only copied from the same folder. Paths that can be followed must
/// lead to the component, and imports from Astro's own modules (`astro:assets`)
/// or the project's packages are skipped, as those are other components with
/// the same name: Astro's `Image`, Starlight's `Card`, an embed imported as
/// `Video`.
fn copied_import(
    project_root: &Path,
    collection_dir: &Path,
    file: &Path,
    component: &MdxComponent,
) -> Option<(String, Binding)> {
    let name = component.name.as_str();
    let current_dir = file.parent()?;
    let component_file = project_root.join(&component.file_path);
    let packages = package_dependencies(project_root);
    // The folder the collections are in, unless that's the whole project
    let content_dir = collection_dir
        .parent()
        .filter(|dir| dir.starts_with(project_root) && *dir != project_root);

    let copies = |from: &MdxFile, import: &Import| {
        if import.type_only || import.source.contains(':') {
            return false;
        }
        if import.source.starts_with('.') {
            from.dir == current_dir && leads_to(&from.dir.join(&import.source), &component_file)
        } else if let Some(from_root) = import.source.strip_prefix('/') {
            leads_to(&project_root.join(from_root), &component_file)
        } else {
            !packages.contains(package_name(&import.source))
        }
    };

    let files = mdx_files(collection_dir, file).chain(
        content_dir
            .into_iter()
            .flat_map(|dir| mdx_files(dir, file))
            .filter(|f| !f.dir.starts_with(collection_dir)),
    );
    files.filter(|f| f.text.contains(name)).find_map(|f| {
        f.esm()
            .iter()
            .flat_map(|e| e.imports())
            .find_map(|(_, import)| {
                let specifier = import.specifiers.iter().find(|s| s.local == name)?;
                (specifier.binding != Binding::Namespace && copies(&f, import))
                    .then(|| (import.source.clone(), specifier.binding.clone()))
            })
    })
}

/// Whether an import of `path` gets the component at `component_file`: the file
/// itself, the file without its extension, or a folder (or its `index`) the
/// component is in, which is a barrel
fn leads_to(path: &Path, component_file: &Path) -> bool {
    let path = normalise(path);
    let folder = if path.file_stem().is_some_and(|stem| stem == "index") {
        path.parent().map(Path::to_path_buf)
    } else {
        Some(path.clone())
    };
    path == component_file
        || path == component_file.with_extension("")
        || folder.is_some_and(|dir| component_file.starts_with(dir))
}

/// `path` with `.` and `..` worked out, without touching the file system
fn normalise(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for part in path.components() {
        match part {
            Component::ParentDir => {
                result.pop();
            }
            Component::CurDir => {}
            other => result.push(other),
        }
    }
    result
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
    use crate::commands::files::parse_frontmatter_internal;
    use crate::mdx_components::{self, starlight};

    #[derive(Deserialize)]
    struct Cases {
        components_dir: Option<String>,
        case: Vec<Case>,
    }

    /// One case in a site's `cases.toml`: the whole block expected after the
    /// insert, or the import that already has the name
    #[derive(Deserialize)]
    struct Case {
        name: String,
        file: String,
        component: String,
        package: Option<String>,
        expected: Option<String>,
        existing: Option<String>,
    }

    fn starlight(name: &str) -> MdxComponent {
        starlight::components()
            .into_iter()
            .find(|c| c.name == name)
            .unwrap()
    }

    fn images(images: &[(&str, &str)]) -> PropImports {
        PropImports {
            images: images
                .iter()
                .enumerate()
                .map(|(i, (file_name, specifier))| ImageImport {
                    prop: format!("p{i}"),
                    file_name: file_name.to_string(),
                    specifier: specifier.to_string(),
                })
                .collect(),
            entries: Vec::new(),
        }
    }

    fn entries(entries: &[(&str, &str)]) -> PropImports {
        PropImports {
            images: Vec::new(),
            entries: entries
                .iter()
                .enumerate()
                .map(|(i, (collection, id))| EntryImport {
                    prop: format!("e{i}"),
                    collection: collection.to_string(),
                    id: id.to_string(),
                })
                .collect(),
        }
    }

    /// The names the picks got, in the order they were picked
    fn names(plan: &ImportPlan) -> Vec<&str> {
        plan.names.values().map(String::as_str).collect()
    }

    /// Plans for a file in an empty collection
    fn plan(
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
    fn shows_every_statement_it_adds_or_changes() {
        let block = "import { Steps } from '@astrojs/starlight/components'\nimport A from './a'";
        assert_eq!(
            plan(block, "", &starlight("Tabs"), images(&[("rocket.png", "./rocket.png")])),
            Some(ImportPlan {
                imports: "import { Steps, Tabs, TabItem } from '@astrojs/starlight/components'\nimport A from './a'\nimport rocket from './rocket.png'".into(),
                added: vec![
                    "import { Steps, Tabs, TabItem } from '@astrojs/starlight/components'".into(),
                    "import rocket from './rocket.png'".into()
                ],
                existing: None,
                names: BTreeMap::from([("p0".into(), "rocket".into())]),
            })
        );
    }

    #[test]
    fn lists_a_joined_import_above_new_lines_in_block_order() {
        let block = "import { getCollection } from 'astro:content'";
        let mut props = images(&[("rocket.png", "./rocket.png")]);
        props.entries = entries(&[("articles", "a")]).entries;
        let plan = plan(block, "", &starlight("Aside"), props).unwrap();
        assert_eq!(
            plan.added,
            [
                "import { getCollection, getEntry } from 'astro:content'",
                "import { Aside } from '@astrojs/starlight/components'",
                "import rocket from './rocket.png'",
                "export const a = await getEntry('articles', 'a')"
            ]
        );
    }

    #[test]
    fn shows_what_already_has_the_name() {
        let card = "import { Card } from '@astrojs/starlight/components';";
        let expected = |imports: &str, existing: &str| ImportPlan {
            imports: imports.into(),
            added: vec![],
            existing: Some(existing.into()),
            names: BTreeMap::new(),
        };
        assert_eq!(
            plan(card, "", &starlight("Card"), PropImports::default()),
            Some(expected(card, card))
        );
        // Further down the body
        assert_eq!(
            plan(
                "",
                &format!("Text.\n\n{card}\n\n<Card />"),
                &starlight("Card"),
                PropImports::default()
            ),
            Some(expected("", card))
        );
        // Written in the file, which another import would clash with
        let inline = "export const Card = (props) => <div>{props.children}</div>";
        assert_eq!(
            plan(inline, "", &starlight("Card"), PropImports::default()),
            Some(expected(inline, inline))
        );
    }

    #[test]
    fn plans_nothing_it_cant_be_sure_of() {
        // A block that doesn't parse
        assert_eq!(
            plan(
                "import a from 'a'\nconst b = 1",
                "",
                &starlight("Aside"),
                PropImports::default()
            ),
            None
        );
        // A name an import can't bind, or that MDX would read as an HTML tag
        for name in ["my-callout", "index"] {
            let mut component = starlight("Aside");
            component.name = name.to_string();
            assert_eq!(
                plan("", "", &component, PropImports::default()),
                None,
                "{name}"
            );
        }
    }

    #[test]
    fn imports_images_under_names_from_their_files() {
        let plan = plan(
            "import { Aside } from '@astrojs/starlight/components';",
            "",
            &starlight("Aside"),
            images(&[
                ("rocket.png", "../../assets/docs/rocket.png"),
                ("Hero Image.jpg", "../../assets/docs/hero-image.jpg"),
            ]),
        )
        .unwrap();
        assert_eq!(names(&plan), ["rocket", "heroImage"]);
        assert_eq!(
            plan.added,
            [
                "import rocket from '../../assets/docs/rocket.png';",
                "import heroImage from '../../assets/docs/hero-image.jpg';"
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
            images(&[("rocket.png", "./rocket.png"), ("aside.png", "./aside.png")]),
        )
        .unwrap();
        assert_eq!(names(&plan), ["rocket3", "aside"]);
    }

    #[test]
    fn reuses_an_image_already_imported() {
        let plan = plan(
            "import launch from './rocket.png'",
            "",
            &starlight("Aside"),
            images(&[
                ("rocket.png", "./rocket.png"),
                ("rocket.png", "./rocket.png"),
            ]),
        )
        .unwrap();
        assert_eq!(names(&plan), ["launch", "launch"]);
        assert_eq!(
            plan.added,
            ["import { Aside } from '@astrojs/starlight/components'"]
        );
    }

    #[test]
    fn loads_entries_with_get_entry() {
        let plan = plan(
            "import { Aside } from '@astrojs/starlight/components'",
            "",
            &starlight("Aside"),
            entries(&[("articles", "2024/first-post"), ("authors", "jane")]),
        )
        .unwrap();
        assert_eq!(names(&plan), ["firstPost", "jane"]);
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
        let plan = plan(
            block,
            "",
            &starlight("Aside"),
            entries(&[("articles", "a"), ("articles", "get-entry")]),
        )
        .unwrap();
        assert_eq!(names(&plan), ["post", "getEntry2"]);
        assert_eq!(
            plan.added,
            [
                "import { getCollection, getEntry } from 'astro:content';",
                "export const getEntry2 = await getEntry('articles', 'get-entry');"
            ]
        );
    }

    #[test]
    fn names_images_and_entries_after_their_files() {
        for (file_name, name) in [
            ("hero-image.png", "heroImage"),
            ("heroImage.png", "heroImage"),
            ("2026-10-31-rocket.webp", "rocket"),
            ("IMG_1234.JPG", "img1234"),
            ("2x.png", "image2x"),
            ("2026-10-31.png", "image"),
            ("café au lait.png", "caféAuLait"),
            // Reserved words, and names MDX defines
            ("class.png", "classImage"),
            ("file.png", "fileImage"),
        ] {
            assert_eq!(variable_name(&file_stem(file_name), "image"), name);
        }
        assert_eq!(
            variable_name("1709876543210-timestamp-filename-format", "entry"),
            "timestampFilenameFormat"
        );
        assert_eq!(variable_name("frontmatter", "entry"), "frontmatterEntry");
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
    fn follows_an_import_to_the_component() {
        let component = Path::new("/site/src/components/mdx/Callout.astro");
        let posts = Path::new("/site/src/content/posts");
        for specifier in [
            "../../components/mdx/Callout.astro",
            "../../components/mdx/Callout",
            "../../components/mdx",
            "../../components/mdx/index.ts",
        ] {
            assert!(leads_to(&posts.join(specifier), component), "{specifier}");
        }
        assert!(!leads_to(
            &posts.join("../../components/blog/Callout.astro"),
            component
        ));
    }

    #[test]
    fn reads_what_follows_the_frontmatter() {
        assert_eq!(
            after_frontmatter("---\ntitle: A\n---\n\nimport a from 'a'"),
            "\nimport a from 'a'"
        );
        assert_eq!(after_frontmatter("import a from 'a'"), "import a from 'a'");
        assert_eq!(after_frontmatter("---\nunclosed"), "---\nunclosed");
    }

    #[test]
    fn finds_the_package_of_a_module() {
        assert_eq!(
            package_name("@astrojs/starlight/components"),
            "@astrojs/starlight"
        );
        assert_eq!(package_name("astro-embed"), "astro-embed");
        assert_eq!(
            package_name("@components/mdx/Card.astro"),
            "@components/mdx"
        );
        assert_eq!(package_name("~/components/Card.astro"), "~");
    }

    #[test]
    fn style_ties_go_to_single_quotes_and_semicolons() {
        let esm = Esm::parse("import a from \"a\"\nimport b from 'b';").unwrap();
        assert_eq!(
            style_of(esm.imports().map(|(_, i)| i)),
            Some(Style::default())
        );
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
                let actual = plan.map(|plan| {
                    if plan.added.is_empty() {
                        format!("existing: {}", plan.existing.unwrap_or_default())
                    } else {
                        plan.imports.trim_end().to_string()
                    }
                });
                let expected = match (&case.expected, &case.existing) {
                    (Some(block), _) => block.trim_end().to_string(),
                    (None, Some(existing)) => format!("existing: {existing}"),
                    (None, None) => panic!("{label}: needs `expected` or `existing`"),
                };
                if actual.as_deref() != Some(expected.as_str()) {
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
