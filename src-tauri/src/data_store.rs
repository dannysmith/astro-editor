//! Reads where Astro last loaded each collection's entries from, out of its
//! data store. Used for collections AE can't follow in the content config
//! (custom loaders, imported or spread definitions), to find their files.
//!
//! Astro writes the store each time it loads content: `astro dev` to
//! `.astro/data-store.json`, `astro sync` and `astro build` to
//! `node_modules/.astro/data-store.json` (its default `cacheDir`). It's
//! serialized with devalue: a flat JSON array of values that refer to each
//! other by index, with the root, a `Map` of collection names to `Map`s of
//! entry ids to entries, at index 0. Entries from files have a `filePath`
//! relative to the project root. Astro clears the store when the content config
//! changes, so it only holds collections the config had when Astro last ran.
//! Collections with no entries, or whose loader failed, aren't in it.
//!
//! See `docs/developer/app-data.md`.

use crate::content_config::normalize;
use crate::content_config::pattern::MARKDOWN_EXTENSIONS;
use log::debug;
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const STORE_FILES: [&str; 2] = [
    ".astro/data-store.json",
    "node_modules/.astro/data-store.json",
];

/// Data files, which AE doesn't edit
const DATA: [&str; 4] = ["json", "yaml", "yml", "toml"];

/// Each collection in the store, by name, with each entry's `filePath`
pub type DataStore = BTreeMap<String, Vec<Option<String>>>;

/// Where a collection's entries were loaded from
#[derive(Debug, PartialEq)]
pub enum StoredLocation {
    /// Markdown or MDX files, in this folder or below it
    Folder(PathBuf),
    /// Data files: one file every entry comes from, or a folder of them
    Data(PathBuf),
}

/// The project's data stores combined: each collection from the most recently
/// written store that has it. Empty when there isn't one.
pub fn read(project: &Path) -> DataStore {
    let mut stores: Vec<(SystemTime, PathBuf)> = STORE_FILES
        .iter()
        .map(|file| project.join(file))
        .filter_map(|path| Some((path.metadata().ok()?.modified().ok()?, path)))
        .collect();
    stores.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));

    let mut combined = DataStore::new();
    for (_, path) in stores {
        let Some(store) = std::fs::read_to_string(&path)
            .ok()
            .and_then(|json| parse(&json))
        else {
            debug!(
                "Astro Editor [PROJECT_SCAN] Couldn't read the data store {}",
                path.display()
            );
            continue;
        };
        for (name, entries) in store {
            combined.entry(name).or_insert(entries);
        }
    }
    combined
}

/// Reads a devalue-serialized store. `None` when it isn't one.
fn parse(json: &str) -> Option<DataStore> {
    let values: Vec<Value> = serde_json::from_str(json).ok()?;
    let at = |index: &Value| values.get(usize::try_from(index.as_u64()?).ok()?);

    let collections = map_pairs(values.first()?)?
        .into_iter()
        .filter_map(|(name, entries)| Some((at(name)?.as_str()?, at(entries)?)))
        // Astro's own records, like `meta::meta`
        .filter(|(name, _)| !name.starts_with("meta:"))
        .filter_map(|(name, entries)| {
            let file_paths = map_pairs(entries)?
                .into_iter()
                .map(|(_, entry)| {
                    let file_path = at(entry)?.get("filePath")?;
                    at(file_path)?.as_str().map(str::to_string)
                })
                .collect();
            Some((name.to_string(), file_paths))
        })
        .collect();
    Some(collections)
}

/// A devalue `Map`'s keys and values, as indexes: `["Map", key, value, …]`
fn map_pairs(map: &Value) -> Option<Vec<(&Value, &Value)>> {
    let [tag, pairs @ ..] = map.as_array()?.as_slice() else {
        return None;
    };
    (tag.as_str()? == "Map").then(|| {
        pairs
            .as_chunks::<2>()
            .0
            .iter()
            .map(|[key, value]| (key, value))
            .collect()
    })
}

/// Where a collection's entries came from, if every one came from a file in
/// the project and they're all Markdown or MDX, each in its own file, or all
/// data. The Markdown files' folder is the deepest one holding them all, and
/// never the project root.
pub fn location(file_paths: &[Option<String>], project: &Path) -> Option<StoredLocation> {
    let paths: Vec<PathBuf> = file_paths
        .iter()
        .map(|path| path.as_deref().map(|path| normalize(&project.join(path))))
        .collect::<Option<_>>()?;
    if paths.is_empty() || !paths.iter().all(|path| path.starts_with(project)) {
        return None;
    }
    let all_of = |extensions: &[&str]| {
        paths.iter().all(|path| {
            path.extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| extensions.contains(&e.to_lowercase().as_str()))
        })
    };

    let folder = paths
        .iter()
        .filter_map(|path| path.parent())
        .map(Path::to_path_buf)
        .reduce(|common, parent| {
            common
                .ancestors()
                .find(|ancestor| parent.starts_with(ancestor))
                .map(Path::to_path_buf)
                .unwrap_or_default()
        })?;

    if all_of(&MARKDOWN_EXTENSIONS) {
        // Entries that share a file (a loader that splits one into several)
        // can't each be edited as a file
        let one_file_each = paths.iter().collect::<HashSet<_>>().len() == paths.len();
        (one_file_each && folder != project).then_some(StoredLocation::Folder(folder))
    } else if all_of(&DATA) {
        let single = paths.iter().all(|path| *path == paths[0]);
        Some(StoredLocation::Data(if single {
            paths[0].clone()
        } else {
            folder
        }))
    } else {
        None
    }
}

/// A store as Astro writes it, for the collections given as name and entries'
/// file paths
#[cfg(test)]
pub fn serialize(collections: &[(&str, &[Option<&str>])]) -> String {
    let mut values: Vec<Value> = vec![Value::Null];
    let mut push = |value: Value| {
        values.push(value);
        Value::from(values.len() - 1)
    };
    let mut root = vec![Value::from("Map")];
    for (name, entries) in collections {
        let mut map = vec![Value::from("Map")];
        for (i, file_path) in entries.iter().enumerate() {
            let id = push(Value::from(format!("entry-{i}")));
            let mut entry = serde_json::json!({ "id": id, "data": -1 });
            if let Some(file_path) = file_path {
                entry["filePath"] = push(Value::from(*file_path));
            }
            map.push(id);
            map.push(push(entry));
        }
        root.push(push(Value::from(*name)));
        root.push(push(Value::Array(map)));
    }
    values[0] = Value::Array(root);
    serde_json::to_string(&values).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_each_entrys_file_path() {
        let json = serialize(&[
            (
                "blog",
                &[
                    Some("src/content/blog/a.md"),
                    Some("src/content/blog/2024/b.md"),
                ],
            ),
            ("scrobbles", &[None, None]),
            ("meta::meta", &[None]),
        ]);
        let parsed = parse(&json).unwrap();
        assert_eq!(
            parsed.keys().collect::<Vec<_>>(),
            ["blog", "scrobbles"],
            "Astro's meta records are left out"
        );
        assert_eq!(
            parsed["blog"],
            [
                Some("src/content/blog/a.md".to_string()),
                Some("src/content/blog/2024/b.md".to_string())
            ]
        );
        assert_eq!(parsed["scrobbles"], [None, None]);
    }

    #[test]
    fn reads_a_store_astro_wrote() {
        let json = std::fs::read_to_string(
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../test/loaders/.astro/data-store.json"),
        )
        .unwrap();
        let parsed = parse(&json).unwrap();
        assert_eq!(parsed["guides"].len(), 2);
        assert_eq!(
            parsed["talks"],
            [
                Some("talks/2024/writing-in-public.md".to_string()),
                Some("talks/2025/calm-tools.mdx".to_string())
            ]
        );
        assert_eq!(
            parsed["team"],
            vec![Some("src/data/team.json".to_string()); 2]
        );
        assert!(parsed["scrobbles"].iter().all(Option::is_none));
    }

    #[test]
    fn rejects_what_isnt_a_store() {
        assert_eq!(parse("not json"), None);
        assert_eq!(parse(r#"[{"a":1}]"#), None);
        assert_eq!(parse("[]"), None);
    }

    #[test]
    fn prefers_the_newest_store_for_each_collection() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path();
        std::fs::create_dir_all(project.join(".astro")).unwrap();
        std::fs::create_dir_all(project.join("node_modules/.astro")).unwrap();
        let old = project.join("node_modules/.astro/data-store.json");
        let new = project.join(".astro/data-store.json");
        std::fs::write(
            &old,
            serialize(&[("a", &[Some("old/a.md")]), ("b", &[Some("old/b.md")])]),
        )
        .unwrap();
        std::fs::write(&new, serialize(&[("a", &[Some("new/a.md")])])).unwrap();
        let earlier = SystemTime::now() - std::time::Duration::from_secs(60);
        std::fs::File::options()
            .write(true)
            .open(&old)
            .unwrap()
            .set_modified(earlier)
            .unwrap();

        let combined = read(project);
        assert_eq!(combined["a"], [Some("new/a.md".to_string())]);
        assert_eq!(combined["b"], [Some("old/b.md".to_string())]);
    }

    fn paths(paths: &[&str]) -> Vec<Option<String>> {
        paths.iter().map(|p| Some(p.to_string())).collect()
    }

    #[test]
    fn finds_the_folder_holding_markdown_entries() {
        let project = Path::new("/site");
        assert_eq!(
            location(&paths(&["talks/2024/a.md", "talks/2025/b.mdx"]), project),
            Some(StoredLocation::Folder(project.join("talks")))
        );
        assert_eq!(
            location(&paths(&["writing/journal/a.md"]), project),
            Some(StoredLocation::Folder(project.join("writing/journal")))
        );
        // Spread across the project, so no folder is a good guess
        assert_eq!(location(&paths(&["a/one.md", "b/two.md"]), project), None);
        assert_eq!(location(&paths(&["../elsewhere/a.md"]), project), None);
    }

    #[test]
    fn finds_data_files() {
        let project = Path::new("/site");
        assert_eq!(
            location(
                &paths(&["src/data/team.json", "src/data/team.json"]),
                project
            ),
            Some(StoredLocation::Data(project.join("src/data/team.json")))
        );
        assert_eq!(
            location(
                &paths(&["src/data/links/a.yaml", "src/data/links/b.yml"]),
                project
            ),
            Some(StoredLocation::Data(project.join("src/data/links")))
        );
    }

    #[test]
    fn has_no_location_without_files_for_every_entry() {
        let project = Path::new("/site");
        assert_eq!(location(&[], project), None);
        assert_eq!(location(&[Some("notes/a.md".into()), None], project), None);
        assert_eq!(
            location(&paths(&["notes/a.md", "notes/b.json"]), project),
            None
        );
        assert_eq!(location(&paths(&["notes/a.mdoc"]), project), None);
        // One Markdown file split into several entries
        assert_eq!(
            location(&paths(&["notes/all.md", "notes/all.md"]), project),
            None
        );
    }
}
