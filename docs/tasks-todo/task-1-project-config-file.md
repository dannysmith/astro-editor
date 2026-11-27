# Project settings in a committed `.astro-editor.json`

Issue: #415.

Project settings live only in AE's app data, so on a site several people edit with AE, each of them sets up the same file name patterns, field mappings and folders by hand. A `.astro-editor.json` committed to the project lets the site carry them. It's an advanced feature, documented but not advertised in the app.

## Decisions

- **The file** is `.astro-editor.json` at the project root: plain JSON, no comments. The dot marks it as tool config rather than part of the site. AE only reads it, never creates or writes it.
- **The shape** is the stored project settings file without `version` and `path`: `{ "project": {…}, "collections": { "<name>": {…} } }`, with the same keys and paths relative to the project root. Every setting is allowed, `gitPanel` included; anyone can override it.
- **Precedence:** the file is merged under the writer's own settings key by key, then everything resolves as now. So it's: the writer's setting › the file › detected (schema, content config, data store) › convention. A collection value from the file beats a project-level value the writer set.
- **A new `SettingSource`** marks values from the file, so Project Settings can say where they came from.
- **Unknown keys are ignored silently,** including `$schema`. Everything else is a warning in Project Settings:
  - A file that doesn't parse, or has a value of the wrong type, is ignored entirely, with the error (key and line).
  - Settings for a collection the content config doesn't have.
- **Changes apply straight away:** the watcher watches the file and rescans, as for the content config.
- **A JSON Schema** for the file, generated from the Rust structs with `schemars` (doc comments become descriptions), is published at `https://astroeditor.danny.is/astro-editor-config.schema.json`, so editors autocomplete and check it. It sets `additionalProperties: false`, so editors flag typos even though AE ignores unknown keys. Not used to validate AE's own settings files: serde already does that.
- **The Rust settings types are the one source of truth** for which settings exist: serde reads both files with them, specta generates the TypeScript from them, and the schema is generated from them too, with a test that fails when the published schema is out of date. Nothing is maintained by hand.

## Phase 1: Reading and resolving

- [x] `project_file.rs` reads `.astro-editor.json` (a lenient wrapper, so either section can be left out) during `collections::scan_project`. Unknown keys are ignored.
- [x] `layered` merges it under the stored settings key by key, with `SettingSource::ProjectFile`. At each level of `collection_or_project` the writer beats the file, so a collection value from the file beats a project value the writer set. The new file type: the pattern, then the writer, then the file, then the global preference.
- [x] `ProjectScan.projectFile` gives its path, its settings (for the UI), its error and collections the config doesn't have. `projectProblems` shows them as warnings.
- [x] The watcher watches the project root (not recursively) and treats the file like the content config, so changes apply as soon as it's saved.
- [x] Tests: precedence for each kind of setting, a broken file ignored with its error, unknown keys ignored, unknown collections reported.
- [x] `test/unusual-structure/.astro-editor.json`, described in its README.

## Phase 2: Project Settings

- [x] Values from the file are labelled "From .astro-editor.json", except where a dropdown's first choice already says so (`controlNamesFile`). Reset tooltips name the file when it gives the setting (`resetTarget`). Sort now shows the writer's choice rather than the resolved one, so a sort from the file isn't shown as chosen.
- [x] A Shared Settings group on the Project page, with Copy Path and Open in IDE (`FileButtons`, shared with the Template row), and its problems at the top.
- [x] Check each setting's control, since text settings show their resolved values differently from dropdowns.

## Phase 3: The JSON Schema

- [ ] Derive `JsonSchema` for the settings types (`indexmap2` feature for `IndexMap`), with `additionalProperties: false`.
- [ ] An ignored test writes `website/public/astro-editor-config.schema.json`, and a normal test fails when the committed file doesn't match the structs.
- [ ] Check it autocompletes and flags a typo in VS Code.

## Phase 4: Docs, review and PR

- [ ] Website: a reference page for the file (shape, precedence, the `$schema` line, an example), linked from Project Settings' page and the advanced preferences docs.
- [ ] Developer docs: `app-data.md` (the model, the settings table's "When unset", sources) and anything else the change affects.
- [ ] Review the diff against the architecture guide, `bun run check:all`, and open a PR that closes #415.
