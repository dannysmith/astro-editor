# New file templates and `astro-editor://new`

Issue: #408 (which absorbed #410).

Many collections have a recurring shape, so a new file should be able to start from a template rather than a placeholder title and empty fields. Separately, nothing outside AE can create a file: a `new` action on the URL scheme lets Raycast, Shortcuts or a bookmarklet capture straight into a collection. Both create a file the way ⌘N does, so they're built on one function.

This is an advanced feature few people will use, so each part is the simplest version that's useful. Everything below "Not now" can be added later without breaking anything.

## Decisions

### Templates

- **The file is `.template.md` or `.template.mdx` in the collection's root folder.** Astro's `glob()` loader lists files with tinyglobby's defaults, which skip dotfiles, so it's never an entry, whatever the pattern (Starlight's `docsLoader` and the watcher's picomatch check skip them too). No setting and no config change needed. The cost is that AE and Finder hide it, so writers edit it in another tool.
- **One template per collection, at its root.** Templates in subfolders are ignored.
- **The template's text is copied as written**, keeping comments, MDX imports, the body and fields the schema doesn't list. Its frontmatter is then edited as AE edits any file (`write_block` splices values into the existing block).
- **Frontmatter, from lowest priority to highest:**
  1. AE's values for required fields (`newFileFrontmatter`: off, an empty list, today), only where the template doesn't set the field
  2. The template's values
  3. The placeholder title and today as the published date, since a date in a template is always stale. If the template sets a title, that's the placeholder instead of "New Book".
  4. The title from the URL
- **Frontmatter that can't be read** is copied as it is, with nothing added.
- **File type always follows the collection's new file type**, whatever the template's extension. A `.template.md` with just headings and frontmatter is the common case even in MDX collections. An MDX template used for `.md` files carries its imports and components over as they are, and the writer fixes them. If both exist, the one matching the new file type is used. The file is named by the collection's pattern, as now.
- **Key order:** the template's keys keep their order, and new keys (defaults the template doesn't set) go where the schema puts them among them. The project's reorder setting doesn't apply, since the template's author chose its order.
- **Project Settings**, on the collection's page: when a template exists, a line saying new files start from it, with Open in IDE (when one is set) or Copy Path. When there isn't one, a short hint saying how to add one, linking to the docs.

### URL scheme

```
astro-editor://new?project=%2FUsers%2Fyou%2Fsite&collection=notes&title=Great%20article&body=...
```

| Parameter    | Required | Meaning                                                                         |
| ------------ | -------- | ------------------------------------------------------------------------------- |
| `project`    | yes      | The project folder's absolute path, which must be in AE's registry              |
| `collection` | yes      | The collection's name                                                           |
| `folder`     | no       | A folder inside the collection, relative to its root. Without it, the root      |
| `title`      | no       | Fills the collection's title field and names the file                           |
| `body`       | no       | Goes after the template's body, separated by a blank line                       |

- **`project` is required,** so a link set up for one site never creates a file in whichever project happens to be open. A full path is unambiguous; project names can repeat.
- No other frontmatter fields. Fixed values belong in the template, which avoids type conversion, list handling and parameter names clashing with field names.
- With `title`, the file gets its final name straight away and the editor is focused. Without it, it behaves like ⌘N: placeholder title, title field focused, renamed once the title is written.
- Other parameters are ignored.
- The new file always opens and never replaces an existing file, since any web page can fire the link.
- An unknown project or collection, a missing folder, a folder outside the collection, or a link missing `project` or `collection` shows AE with an error toast.

### Things that will trip us up

- **Folder-per-entry collections** (`**/index.md`): the template is at the root, but the new file is `<name>/index.md`, so relative links and images in the template point at the wrong folder. The docs page should say so; nothing to fix.
- **`folder` from a URL** must stay inside the collection, not just the project: `validate_project_path` only checks the project.
- **The collection's root** for the template is `Collection.path` (the folder the sidebar browses: `base` plus the pattern's fixed prefix), not `base`. Several collections can share a `base` (`src/content` with patterns `blog/**` and `notes/**`), and each needs its own template.

### Not now

- Placeholders in templates (`{title}`, `{YYYY-MM-DD}`). If added, reuse the file name pattern's tokens.
- Per-folder templates.
- Setting arbitrary frontmatter fields from the URL.
- Editing the template inside AE.

## Phase 1: Templates

- [x] Rust: `new_file_template` (`src-tauri/src/commands/project.rs`) finds the collection's template in `Collection.path`, preferring the new file type. A separate command because Project Settings needs it too.
- [x] Rust: `create_file` (`src-tauri/src/commands/files.rs`) takes the same parts as `save_markdown_content` (values, raw frontmatter, body, imports). The frontend reads the template with `parse_markdown_content` and passes its parts; the values are spliced into its raw block with `reorder` off. Tests for keeping comments, order, unknown keys, imports and body, and copying unreadable frontmatter unchanged.
- [x] Frontend: `createFileIn(createFile, collectionName, subdirectory)` in `src/hooks/useCreateFile.ts`; ⌘N calls it with the sidebar's collection and folder. `newFileFrontmatter` takes the template's values and layers the defaults, title and date over them. The template's title is the placeholder when it has one. Phase 2 adds `title` and `body` to it.
- [x] Project Settings: a Template row under New Files on `CollectionPage.tsx`, only when there's a template, giving its path with Copy Path and Open in IDE buttons and a docs link (`DOCS_URLS.templates`, the page Phase 3 writes). Checking the template against the schema there was left out: the page only knows the template's path.
- [x] Templates in `test/dummy-astro-project`: `notes/.template.md` and `articles/.template.mdx` (in a Markdown collection). Both tried in the app.

## Phase 2: URL scheme

- [x] `src/lib/deep-link.ts`: `parseDeepLink` reads `open` and `new` links into a `DeepLink`, refusing links missing a required parameter or with a folder outside the collection. Unit tests.
- [x] `src/hooks/useDeepLink.ts`: dispatches each link, warm and cold, and toasts links it can't use. Every link names its project, so any link it understands claims startup. In dev, `window.__openUrl(url)` handles a URL as the scheme would (dev builds don't register it), from `bun run app eval` or the Web Inspector.
- [x] `openProjectForLink` (`src/lib/projects/actions.ts`), moved out of `openFileByPath`: finds the registered project, switches to it and waits until it's ready. Both actions use it.
- [x] `createFileFromLink` (`src/hooks/useCreateFile.ts`): opens the project, waits for its scan, then `createFileIn` with `title` and `body`.
- [x] Tried through `window.__openUrl` in the dev app: template, title and body; naming from the title; switching projects; a subfolder; and each error case. `open` links still work.
- [ ] In a signed pre-release build: the scheme from Terminal, with AE running and with it quit.

## Phase 3: Review, docs and cleanup

- [ ] Review the whole diff against `docs/developer/architecture-guide.md`; remove leftovers and debug code.
- [ ] Website: a docs page for templates (probably under `file-management/`), and a `new` section in `reference/url-scheme.mdx`. Check `file-management/overview.mdx` and `reference/settings.mdx` for anything about new files that should mention templates. Add Cmd+Enter in the title field (focuses the editor) to `reference/keyboard-shortcuts.mdx`.
- [ ] Developer docs: update any doc in `docs/developer/` the change affects (file creation, deep links).
- [ ] `bun run check:all` passes.
- [ ] Open a PR that closes #408, noting where it differs from the issue (`.template.md`, root only, file type always from the collection, minimal URL parameters).
