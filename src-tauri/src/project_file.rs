//! A project's own settings, in `.astro-editor.json` at its root. It's
//! committed with the site, so everyone who edits it with AE starts from the
//! same settings, and each writer's own settings still win (see
//! `collections::scan_project`). AE only reads it, never creates or writes it.
//!
//! It has the shape of a stored project settings file without `version` and
//! `path`. Keys AE doesn't know, like `$schema`, are ignored. A file that
//! can't be read, or has a value of the wrong type, is ignored entirely, and
//! the scan says why.

use std::path::Path;

use indexmap::IndexMap;
use serde::Deserialize;

use crate::models::preferences::{CollectionSettings, ProjectSettings, ProjectSettingsData};

pub const FILE_NAME: &str = ".astro-editor.json";

/// The file as written, where either section can be left out
#[derive(Deserialize, Default)]
#[serde(default)]
struct ProjectFile {
    project: ProjectSettings,
    collections: IndexMap<String, CollectionSettings>,
}

/// The project's file: `None` when it has none, or why it can't be used
pub fn read(project: &Path) -> Option<Result<ProjectSettingsData, String>> {
    let content = match std::fs::read_to_string(project.join(FILE_NAME)) {
        Ok(content) => content,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return None,
        Err(e) => return Some(Err(format!("Couldn't read it: {e}"))),
    };
    Some(
        serde_json::from_str::<ProjectFile>(&content)
            .map(|file| ProjectSettingsData {
                project: file.project,
                collections: file.collections,
            })
            .map_err(|e| e.to_string()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read_json(json: &str) -> Option<Result<ProjectSettingsData, String>> {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(FILE_NAME), json).unwrap();
        read(dir.path())
    }

    #[test]
    fn missing_file_is_none() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read(dir.path()).is_none());
    }

    #[test]
    fn unknown_keys_and_missing_sections_are_fine() {
        let settings = read_json(
            r#"{
                "$schema": "https://astroeditor.danny.is/astro-editor-config.schema.json",
                "collections": { "notes": { "fileNamePattern": "{slug}", "colour": "red" } }
            }"#,
        )
        .unwrap()
        .unwrap();
        assert_eq!(
            settings.collections["notes"].file_name_pattern.as_deref(),
            Some("{slug}")
        );
        assert_eq!(settings.project, Default::default());
    }

    #[test]
    fn wrong_types_and_broken_json_say_where() {
        let error = read_json(r#"{ "project": { "reorderFrontmatter": "yes" } }"#)
            .unwrap()
            .unwrap_err();
        assert!(error.contains("line 1"), "{error}");

        let error = read_json("{ \"project\": {\n}").unwrap().unwrap_err();
        assert!(error.contains("line 2"), "{error}");
    }
}
