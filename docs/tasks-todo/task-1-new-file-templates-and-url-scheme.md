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
- **Key order:** the template's keys keep their order. New keys (defaults the template doesn't set) are placed as the project's reorder setting places them when saving.
- **Project Settings**, on the collection's page: when a template exists, a line saying new files start from it, with Open in IDE (when one is set) or Copy Path. When there isn't one, a short hint saying how to add one, linking to the docs.

### URL scheme

```
astro-editor://new?collection=notes&title=Great%20article&body=...
```

| Parameter    | Required | Meaning                                                                                       |
| ------------ | -------- | --------------------------------------------------------------------------------------------- |
| `collection` | yes      | The collection's name                                                                         |
| `project`    | no       | The project folder's absolute path, which must be in AE's registry. Without it, the open project |
| `folder`     | no       | A folder inside the collection, relative to its root. Without it, the root                    |
| `title`      | no       | Fills the collection's title field and names the file                                         |
| `body`       | no       | Goes after the template's body, separated by a blank line                                     |

- No other frontmatter fields. Fixed values belong in the template, which avoids type conversion, list handling and parameter names clashing with field names.
- With `title`, the file gets its final name straight away and the editor is focused. Without it, it behaves like ⌘N: placeholder title, title field focused, renamed once the title is written.
- Other parameters are ignored.
- The new file always opens and never replaces an existing file, since any web page can fire the link.
- An unknown project or collection, a folder outside the collection, or no open project and no `project` shows AE with an error toast.

### Things that will trip us up

- **Cold start without `project`.** When AE is launched by a link, `loadPersistedProject` skips reopening the last project because the deep link claims startup (`wasStartupClaimedByDeepLink`). That's right for `open`, but a `new` link without `project` needs the last project, so it mustn't claim startup. It should wait for that project to be ready instead.
- **Folder-per-entry collections** (`**/index.md`): the template is at the root, but the new file is `<name>/index.md`, so relative links and images in the template point at the wrong folder. The docs page should say so; nothing to fix.
- **`folder` from a URL** must stay inside the collection, not just the project: `validate_project_path` only checks the project.
- **The collection's root** for the template is `Collection.path` (the folder the sidebar browses: `base` plus the pattern's fixed prefix), not `base`. Several collections can share a `base` (`src/content` with patterns `blog/**` and `notes/**`), and each needs its own template.

### Not now

- Placeholders in templates (`{title}`, `{YYYY-MM-DD}`). If added, reuse the file name pattern's tokens.
- Per-folder templates.
- Setting arbitrary frontmatter fields from the URL.
- Editing the template inside AE.

## Phase 1: Templates

- [ ] Rust: find the collection's template (`.template.md` or `.template.mdx` in its root, preferring the one matching the new file type). `new_file_name` (`src-tauri/src/commands/project.rs`) already knows the collection, so it could return the template's path too, rather than a separate command.
- [ ] Rust: let `create_file` (`src-tauri/src/commands/files.rs`) start from a template's text. Parse it with `parse_frontmatter`, splice the values into its raw frontmatter with `write_block`, and `assemble` with its imports and body. Tests for: comments and unknown keys kept, template values winning over defaults, title and date overriding the template, key order kept, MDX imports kept, unreadable frontmatter copied unchanged.
- [ ] Frontend: replace `createFileInCurrentFolder` (`src/hooks/useCreateFile.ts`) with one function taking a collection, a folder and optional values (`title`, `body`). ⌘N calls it with the sidebar's collection and folder and no values. Merge the frontmatter as described above, and use the template's title as the placeholder when it has one.
- [ ] Project Settings line on `CollectionPage.tsx`, reusing what `path-menu.ts` does for Open in IDE and Copy Path.
- [ ] Add templates to `test/dummy-astro-project` (a `.template.md` in an MDX collection, a `.template.mdx` in another) and try both in the app.

## Phase 2: URL scheme

- [ ] `src/lib/deep-link.ts`: parse `new` links alongside `open`, returning the action and its parameters. Unit tests for parsing.
- [ ] `src/hooks/useDeepLink.ts`: handle `new` links, warm and cold. The launch-URL filter (`getLaunchOpenUrls`) must accept them, or cold starts ignore them, and only links that name a project claim startup (see "Things that will trip us up").
- [ ] Resolve the project (reusing `findOwningProjectPath`-style registry lookup and `waitForProjectReady` from `openFileByPath`), the collection and the folder, then call the shared create function with `title` and `body`.
- [ ] Try it from Terminal (`open "astro-editor://new?..."`) with the app running and with it quit, with and without a template, and with each error case.

## Phase 3: Review, docs and cleanup

- [ ] Review the whole diff against `docs/developer/architecture-guide.md`; remove leftovers and debug code.
- [ ] Website: a docs page for templates (probably under `file-management/`), and a `new` section in `reference/url-scheme.mdx`. Check `file-management/overview.mdx` and `reference/settings.mdx` for anything about new files that should mention templates.
- [ ] Developer docs: update any doc in `docs/developer/` the change affects (file creation, deep links).
- [ ] `bun run check:all` passes.
- [ ] Open a PR that closes #408, noting where it differs from the issue (`.template.md`, root only, file type always from the collection, minimal URL parameters).
