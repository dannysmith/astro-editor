# Project settings in a committed `.astro-editor.json`

Issue: #415.

Project settings live only in AE's app data, so on a site several people edit with AE, each of them sets up the same file name patterns, field mappings and folders by hand. A `.astro-editor.json` committed to the project lets the site carry them. It's an advanced feature, documented but not advertised in the app.

## Decisions

- **The file** is `.astro-editor.json` at the project root: plain JSON, no comments. The dot marks it as tool config rather than part of the site. AE only reads it, never creates or writes it.
- **The shape** is the stored project settings file without `version` and `path`: `{ "project": {…}, "collections": { "<name>": {…} } }`, with the same keys and paths relative to the project root. Every setting is allowed, `gitPanel` included; anyone can override it.
- **Precedence:** the file is merged under the writer's own settings key by key, then everything resolves as now. So it's: the writer's setting › the file › detected (schema, content config, data store) › convention. A collection value from the file beats a project-level value the writer set.
- **A new `SettingSource`** marks values from the file, so Project Settings can say where they came from.
- **Unknown keys are ignored silently,** including `$schema`. Everything else is a warning on the Project page only: without the file AE still reads the site fully, so its problems don't mark the project in the sidebar or trigger the review toast.
  - A file that doesn't parse, or has a value of the wrong type, is ignored entirely, with the error (key and line).
  - Settings for a collection the content config doesn't have.
- **Changes apply straight away:** the watcher watches the file and rescans, as for the content config.
- **A JSON Schema** for the file, generated from the Rust structs with `schemars` (doc comments become descriptions), is published at `https://astroeditor.danny.is/astro-editor-config.schema.json`, so editors autocomplete and check it. It sets `additionalProperties: false`, so editors flag typos even though AE ignores unknown keys. Not used to validate AE's own settings files: serde already does that.
- **The Rust settings types are the one source of truth** for which settings exist: serde reads both files with them, specta generates the TypeScript from them, and the schema is generated from them too, with a test that fails when the published schema is out of date. Nothing is maintained by hand.

## Phase 1: Reading and resolving

- [x] `project_file.rs` reads `.astro-editor.json` (a lenient wrapper, so either section can be left out) during `collections::scan_project`. Unknown keys are ignored.
- [x] `layered` merges it under the stored settings key by key, with `SettingSource::ProjectFile`. At each level of `collection_or_project` the writer beats the file, so a collection value from the file beats a project value the writer set. The new file type: the pattern, then the writer, then the file, then the global preference.
- [x] `ProjectScan.projectFile` gives its settings (for the UI), its error and collections the config doesn't have. `projectFileProblems` shows them as warnings on the Project page, apart from `projectProblems`.
- [x] The watcher watches the project root (not recursively) and treats the file like the content config, so changes apply as soon as it's saved.
- [x] Tests: precedence for each kind of setting, a broken file ignored with its error, unknown keys ignored, unknown collections reported. They build their projects in temp folders; nothing automated reads the projects in `test/`, and this branch doesn't change them (try it by hand with a `.astro-editor.json` in a `temp-test-projects` copy).

## Phase 2: Project Settings

- [x] Values from the file are labelled "From .astro-editor.json", except where a dropdown's first choice already says so (`controlNamesFile`). Reset tooltips name the file when it gives the setting (`resetTarget`). Sort now shows the writer's choice rather than the resolved one, so a sort from the file isn't shown as chosen.
- [x] A note at the top of the Project page says the project has the file, its settings take precedence over the defaults and don't affect what the writer sets, with a docs link. No copy or IDE buttons: it's an advanced feature. A file with an error shows the error instead.
- [x] Check each setting's control, since text settings show their resolved values differently from dropdowns.

## Phase 3: The JSON Schema

- [x] Derive `JsonSchema` for the settings types (test-only, `schemars` as a dev-dependency), Draft 7, with `additionalProperties: false` and `$schema` allowed at the root.
- [x] One normal test keeps `website/public/astro-editor-config.schema.json` current: when it's out of date, the test writes it and fails, so it gets committed. The website's Prettier ignores it.
- [x] Checked with ajv (good files pass; typos, wrong types and bad values fail) and in VS Code (autocomplete, hover text, typos flagged).

## Phase 4: Docs, review and PR

- [x] Website: a reference page for the file (shape, precedence, the `$schema` line, an example), linked from Project Settings' page and the advanced preferences docs. The website should make it abundantly clear that in the vast majority of cases there is no need to include a file like this because AE is able to read and understand most projects from their content. We should also be very clear about the fact that it is **counterproductive** to excplicitly configure things which AE gets right by reading your site (eg if the project settings shows the correct inferred value for something, do not explicitly set it in the project settings or `.astro-editor.json`.). This page should also be clear that This feature is primarily intended for astro projects where multiple people are using Astro Editor And there's some shared values having a shared basic config. If you are using Astor Editor As an individual, it's almost certainly unnecessary to include any convict committed in your repository, and you're better off just setting these settings in Astro Editor itself. Als: it's best practice with committed config files is to include the minimal amount of config necessary for AE to function properly And consistently between different people.
- [x] Developer docs: `app-data.md` (the model, the settings table's "When unset", sources) and anything else the change affects.
- [x] Review the diff against the architecture guide, `bun run check:all`, and open a PR that closes #415.
