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

/// Astro Editor settings shared by everyone who edits this project. Each
/// writer's own settings in Astro Editor still take precedence.
#[derive(Deserialize, Default)]
#[cfg_attr(test, derive(schemars::JsonSchema), schemars(deny_unknown_fields))]
#[serde(default)]
struct ProjectFile {
    /// Settings for the whole project
    project: ProjectSettings,
    /// Settings for each collection, by its name in the content config
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

    /// The file's JSON Schema, which editors use to complete and check it. It's
    /// generated from the types AE reads the file into, so it can't disagree
    /// with them; Draft 7 is the version editors support best.
    fn json_schema() -> String {
        // Descriptions come from doc comments, wrapped to fit the code
        let unwrap_descriptions =
            schemars::transform::RecursiveTransform(|schema: &mut schemars::Schema| {
                if let Some(serde_json::Value::String(text)) = schema.get_mut("description") {
                    *text = text.replace('\n', " ");
                }
            });
        let mut schema = schemars::generate::SchemaSettings::draft07()
            .with_transform(unwrap_descriptions)
            .into_generator()
            .into_root_schema_for::<ProjectFile>();
        schema.insert(
            "$id".into(),
            "https://astroeditor.danny.is/astro-editor-config.schema.json".into(),
        );
        schema.insert("title".into(), FILE_NAME.into());
        // The line that points an editor at this schema, which AE ignores
        schema
            .get_mut("properties")
            .and_then(|properties| properties.as_object_mut())
            .expect("the schema has properties")
            .insert(
                "$schema".into(),
                serde_json::json!({ "type": "string", "description": "The JSON Schema for this file" }),
            );
        format!("{}\n", serde_json::to_string_pretty(&schema).unwrap())
    }

    /// The website publishes the schema. When its copy is out of date, this
    /// writes the new one and fails so it gets committed; the next run passes.
    #[test]
    fn the_published_schema_is_current() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../website/public/astro-editor-config.schema.json");
        let schema = json_schema();
        if std::fs::read_to_string(&path).ok().as_deref() != Some(schema.as_str()) {
            std::fs::write(&path, schema).unwrap();
            panic!(
                "The JSON Schema for {FILE_NAME} was out of date, and {} has been updated. Commit it.",
                path.display()
            );
        }
    }

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
