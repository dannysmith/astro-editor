# Project model and settings storage

GitHub: #82, #361

The first of four tasks reworking project and collection settings: this one, then the project list (task 2), the project settings dialog (task 3) and new file naming (task 4). This one changes what AE reads from a project and what it stores. Tasks 2 and 3 build the UI on it.

## Problem

- **AE's collections aren't Astro's.** `parse_collection_definitions` (`src-tauri/src/parser.rs`) takes collection names from the config, ignores each loader's `base` and `pattern`, and looks for `<content dir>/<name>`. Collections without that folder vanish silently, and if none match, every subfolder of the content dir becomes a collection. Sites with content elsewhere (#81) show nothing.
- **Only the project content dir override works.** The collection one is saved but never read (#361).
- **Unset can't be told from default.** New project files are seeded with `DEFAULT_PROJECT_SETTINGS`.
- **The fallback chain is written out five times:** `collection-settings.ts`, `effective-settings.ts`, `path-resolution.ts`, `default-file-type.ts` and `ProjectRegistryManager.getEffectiveSettings`.
- **Projects are identified by their `package.json` name,** with a moved-project guess behind both matching bugs in #361.
- **Schema problems are invisible.** The frontend gets `complete_schema` or nothing, and the reason is only in the logs.
- **The file list ignores the pattern.** `scan_directory` shows every `.md` and `.mdx` file except those starting with `_` or `.`.

## The model

There are two kinds of thing: **what Astro says**, read on every scan and never stored, and **what the user chose**, stored only when they set something.

### What Astro says

- **Project:** a folder containing an Astro site, identified by its path.
- **Content config:** the first of `src/content.config.{mjs,js,mts,ts}` that exists, else the legacy `src/content/config.{ts,js,mjs,mts}`, in Astro's own order. `src/live.config.*` is ignored, because live collections aren't files.
- **Collection:** a key in the config's `collections` export, with a loader and maybe a schema. The key is the name (`{ posts: blog }` is `posts`), and it names the generated `.astro/collections/<name>.schema.json`.
- **Loader:**
  - `glob({ base, pattern })` loads entries from files. `base` is a path relative to the project root (default `.`) or a URL. A URL like `new URL('./content/blog', import.meta.url)` is relative to the config file. `pattern` is a string or an array, and array items starting with `!` (but not `!(`) exclude files.
  - **No loader** (`defineCollection({})`, `type: 'content'`) is a legacy collection. Astro 5 loads it as `glob` on `src/content/<name>` with every content file except `_`-prefixed files and folders, and so do Astro 6 and 7 with `legacy.collectionsBackwardsCompat`. `type: 'data'` is data. When no collection has a loader, Astro also makes a collection from each undefined subfolder of `src/content` (except `_` and `.` ones), and so does AE.
  - **Starlight's `docsLoader()`** is `glob` on `src/content/docs` with `**/[^_]*.{markdown,mdown,mkdn,mkd,mdwn,md,mdx}`.
  - **Data:** `file()`, Starlight's `i18nLoader()`, and globs whose pattern can only match data files (JSON, YAML, TOML). These aren't shown as collections, and `file()` JSON stays a reference target as now.
  - **Unknown:** anything else, such as custom loaders, a `base` built from variables, or collections imported from another file. AE looks for these in `<content folder>/<name>`.
- **Collection folder:** what the sidebar browses: `base` plus the pattern's fixed prefix (`base: 'src/content', pattern: 'blog/**/*.md'` is `src/content/blog`). Entry ids stay relative to `base`, so a collection keeps both.
- **Outside the project:** Astro accepts a `base` outside the project root, and follows symlinks. AE only reads and writes inside the project (`validate_project_path`) and its scans skip symlinks, so such a collection gets a status saying so and stays out of the sidebar.
- **Entry:** a file under `base` that matches the pattern. Its Astro id is its `slug`, or its slugified path from `base` (`astroEntryId`).
- **Schema:** the JSON schema plus the Zod helpers (`schema-system.md`). Its status is complete, helpers only (no JSON, usually because `astro sync` hasn't run), unreadable (with the error), or none.

### What the user chose

A project record (path, name, last opened), plus sparse project and collection settings. A missing key means unset, and nothing is seeded.

### The resolved collection

One resolver combines Astro's facts, the user's settings and the conventions. Every value carries its source: **set** by the user, **config**, **schema**, **convention**, or **missing** (for example, no boolean field that could be the draft field). The app uses the value, and task 3's dialog shows the source.

## Settings

Each setting has one home. Only the asset settings and the new file type have two levels.

| Setting | Home | When unset |
| --- | --- | --- |
| Collection folder | Collection | From the loader; else `<content folder>/<name>` |
| Files the pattern skips | Collection | Hide |
| Title field | Collection | A string field named `title` |
| Description field | Collection | A string field named `description` |
| Published date field | Collection | The first date field named `pubDate`, `date` or `publishedDate` |
| Draft field | Collection | A boolean field named `draft`; else missing, so there's no draft badge or filter |
| Default sort | Collection | Published date, newest first; else title |
| New file type | Collection → global | The global preference (default `md`) |
| Link URL pattern | Collection | A relative file path |
| Assets folder | Project → collection | `src/assets`; images go in `<assets>/<collection>/` as now |
| Absolute or relative image paths | Project → collection | Relative |
| MDX components folder | Project | `src/components/mdx` |
| Add component imports | Project | Off |
| Content folder | Project | `src/content` |

- **A folder override is the folder you browse.** It's used as `base` too, with the pattern's fixed prefix dropped.
- **The content folder** is only used where the loader doesn't say: unknown loaders look in `<content folder>/<name>`, and the folder fallback lists its subfolders. It's today's project content directory, narrowed, so anyone whose loaders AE can't read still has a one-setting fix.
- **The pattern wins over the file type setting.** If a collection's pattern only matches `.md`, new files are `.md` whatever the settings say. Most patterns allow both, which is why the global preference stays.
- **Field detection with no schema** uses the same names, read from the files' frontmatter.
- **Default sort** sets a collection's starting sort mode. The sidebar's sort controls stay per session (`collectionViewState` in `uiStore`).
- **No ignore list** (suggested in #82). The pattern says which files are entries, and the next setting covers the rest.

### Files the pattern skips

A per-collection setting: **Hide** (the default) or **Show dimmed**. It depends on how the site uses Astro: a `README.md` the pattern excludes should never show, but drafts kept out of the build as `_draft.md` should.

- Dimmed files open and edit like any other file, but aren't entries: `FileEntry` says which it is, and the reference pickers and Content Finder only offer entries.
- The blanket `_` rule in `scan_directory` goes, and the pattern decides. Files starting with `.` stay hidden.
- With Hide, folders that contain no entries are hidden too. Work out the entries once per collection scan, not by walking each folder on every listing.
- **New files must match the pattern,** or with Hide they'd be written and never shown (`useCreateFile` finds the new file by rescanning). Folder-per-entry patterns (`**/index.{md,mdx}`) get `<name>/index.md`. If no name can match, for example a top-level-only `*.md` while you're in a subfolder, AE says so and creates nothing.
- Collections with no readable pattern (unknown loaders and the folder fallback) use the legacy pattern above, which leaves out `_`-prefixed files and folders as today.

## No readable config

With no config, or no collections AE can read in it, every subfolder of the content folder becomes a schemaless collection, as now and as Astro 4 and earlier did. This is deliberate (#81): pointing the content folder anywhere keeps AE useful as an editor for Markdown files on disk. Task 3's dialog says clearly when this is happening, and why.

A config collection whose folder doesn't exist is reported, shown in the settings, and left out of the sidebar.

## Project identity

- Projects are identified by their canonical path (symlinks resolved, no trailing slash), so one folder can't register twice.
- New projects get a generated settings file id that doesn't depend on the package name, and existing registry entries keep theirs. Each project file records its path, so a lost registry can be rebuilt from them.
- `findMovedProject` and `isSameProject` go, which fixes both #361 matching bugs. A moved project shows as missing, and task 2 gives it Locate… and Remove.

## Storage

Rust owns the three files in `preferences/` and the resolver:

- The folder and pattern have to be applied where scanning and watching happen, which is Rust. Pattern matching (`globset`) has to be there anyway, for `scan_directory`.
- serde types and tauri-specta bindings replace the hand-written TS persistence: `persistence.ts`, `migrations.ts`, and the generic `readAppDataFile` and `writeAppDataFile` commands.
- One command can return the project with its resolved collections, sources included, so the frontend only displays and edits them.

`projectStore` keeps the settings in state. Global settings move to Rust with the other two files, so there's one persistence layer, but their shape and values don't change.

Project files (`projects/{id}.json`) go to version 3, roughly:

```json
{
  "version": 3,
  "path": "/Users/me/sites/blog",
  "project": { "assetsDirectory": "src/images" },
  "collections": {
    "blog": { "folder": "content/posts", "draftField": "unpublished", "skippedFiles": "dim" }
  }
}
```

Collections are keyed by their Astro name. Settings for a collection that's no longer in the config do no harm, and task 3 lists them.

**No migration.** A version 2 project file is renamed to `{id}.v2.json` when it's first read, so a later release could still migrate it. The release notes say projects may need setting up again. Most won't, because folders and fields are now detected. The pre-1.0 migrations from version 1 are deleted.

**Broken files are never overwritten (#361).** Rename the file to `*.broken-<timestamp>.json`, log it, show a toast, and carry on with defaults.

## Work

### Reading the project (Rust)

- [ ] Find the config using Astro's names and order, in one place used by the scan, the watcher (`watcher.rs` has its own list) and `load_file_based_collection` (which also needs `loader: file(` to come first). Watch every candidate path, so a config created or renamed later is picked up.
- [ ] Read every form of the `collections` export: shorthand (`{ blog }`), keyed (`{ posts: blog }`, `{ 'my-blog': blog }`), inline `defineCollection`, and mixtures of these. Follow identifiers to `const x = defineCollection(...)`, and to `const loader = glob(...)` if it's cheap.
- [ ] Parse loaders as above: the folder, its source, and whether it exists.
- [ ] Replace `complete_schema` with a collection status: the loader kind, the folder and its source, and the schema status with any error. Report config-level problems too.
- [ ] Filter `scan_directory`, the recursive scans and the file counts by the pattern. Match Astro's matcher: turn on `globset`'s `literal_separator` so `*` doesn't cross `/`, strip `./` prefixes and trailing slashes from patterns, and skip dot folders. Treat patterns `globset` can't parse, such as extglobs like `@(md|mdx)`, as unreadable.
- [ ] Make entry ids relative to `base` (`FileEntry.id` and `astroEntryId`).
- [ ] Make `resolve_file_entry` (deep links) pick the owning collection by pattern, not just folder.
- [ ] Make new file names match the pattern, as above.
- [ ] Watch each collection folder, plus the config and `.astro/collections/`. Skip `node_modules`, `.git`, `dist` and `.astro` when a folder is the project root.
- [ ] Keep the folder fallback, and report it as such.

### Settings

- [ ] Move the preferences files and the resolver to Rust: version 3 project files, with version 2 files renamed aside.
- [ ] Detect field mappings by name and type, and constrain the new file type by the pattern.
- [ ] Delete the TS fallback files (`collection-settings.ts`, `effective-settings.ts`, `path-resolution.ts`, `default-file-type.ts`) and the TS persistence.
- [ ] Give every settings change the same side effects: save and close the open file if its folder moved, invalidate the queries, and restart the watcher (#361).
- [ ] Identify projects by path, and remove moved-project matching.

### Existing UI

- [ ] Adapt the Project Settings and Collections panes so everything keeps working until task 3 replaces them, including the collection folder override. Showing sources can wait for task 3.

### Tests and fixtures

- [ ] Rust tests: config file names, every `collections` form, string and URL bases, array and negated patterns, pattern prefixes, legacy collections, Starlight, data globs, and unknown loaders.
- [ ] A test project with an unusual structure to try in the app: content outside `src/content`, a URL base, an array pattern, a legacy collection and a custom loader.
- [ ] Resolver tests for every source of every setting.

### Docs

- [ ] Rewrite `docs/developer/app-data.md` around this model, which is where it lives once this task is done. Update `schema-system.md`.
- [ ] Update the user guide enough to stay true until task 3: `getting-started/introduction.mdx` (its requirements say collections must use `glob` and live in `src/content/`), `reference/overrides.mdx` and `preferences.mdx`.
- [ ] Release notes: projects may need setting up again.

## Known gaps

- **A custom `srcDir`.** AE assumes `src/` for the config and the conventions. Supporting it means reading `astro.config`, which we're avoiding. Globs don't need it, because `base` is relative to the project root.
- **Entry ids from a `generateId`, or from legacy collections** (which use path-based ids), differ from what AE works out.
- **Starlight's other Markdown extensions** (`.markdown`, `.mdown` and so on) and Markdoc aren't shown. AE edits `.md` and `.mdx` only.
- **Glob collections of JSON or YAML** aren't reference targets. Only `file()` JSON is.
- **`.astro/data-store.json` can't tell us file paths.** Astro only writes it there in dev, and builds and `astro sync` write it to the cache dir.
- **Content outside the project or behind a symlink** (a monorepo package, an Obsidian vault) gets a status but can't be edited. Allowing it would mean widening `validate_project_path`, which is a security boundary.
