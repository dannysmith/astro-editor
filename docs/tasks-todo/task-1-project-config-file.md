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

- [ ] Read `.astro-editor.json` during the scan (`collections::scan_project`), into the same `ProjectSettingsData` types, ignoring unknown keys.
- [ ] Merge it under the stored settings key by key in `resolve_project_settings` and `resolve_collection_settings`, with the new source. Check `collection_or_project` and the new file type's order.
- [ ] Report problems (unreadable file, wrong types, unknown collections) in the scan, where Project Settings' status can show them.
- [ ] Watch the file and rescan when it changes.
- [ ] Tests: precedence for each kind of setting, a broken file ignored with its error, unknown keys ignored, unknown collections reported.
- [ ] A test project with a `.astro-editor.json` in `test/`.

## Phase 2: Project Settings

- [ ] Values from the file show as detected values do: a dropdown's first choice reads "From .astro-editor.json: …", and resetting the writer's setting goes back to the file's value.
- [ ] The Project page says when the file is in use, with Copy Path and Open in IDE (as the Template row does), and shows its problems.
- [ ] Check each setting's control, since text settings show their resolved values differently from dropdowns.

## Phase 3: The JSON Schema

- [ ] Derive `JsonSchema` for the settings types (`indexmap2` feature for `IndexMap`), with `additionalProperties: false`.
- [ ] An ignored test writes `website/public/astro-editor-config.schema.json`, and a normal test fails when the committed file doesn't match the structs.
- [ ] Check it autocompletes and flags a typo in VS Code.

## Phase 4: Docs, review and PR

- [ ] Website: a reference page for the file (shape, precedence, the `$schema` line, an example), linked from Project Settings' page and the advanced preferences docs.
- [ ] Developer docs: `app-data.md` (the model, the settings table's "When unset", sources) and anything else the change affects.
- [ ] Review the diff against the architecture guide, `bun run check:all`, and open a PR that closes #415.
