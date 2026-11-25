# Release 1.2.1

Screenshots, website docs and release notes for 1.2.1, which covers everything on `main` since `v1.2.0`: #399, #401, the Copyedit word count, #411 and #412. The test build is `v1.2.1-test.1`.

Merging website changes to `main` publishes them straight away (`deploy-website.yml`). Everything goes on `main` just before the release.

## Screenshots

All 23 shots in `scripts/app-shots.ts` were retaken into `docs/tasks-todo/temporary/shots-1.2.1/` and diffed against `website/src/assets/`. Everything in the shot list except `frontmatter-sidebar-overview` was taken before #399.

### Changed: copy over from the retake

- [x] `main-demo-image-light`, `main-demo-image-dark` (homepage): frontmatter footers, required edges, Copy as slug icon, left sidebar rows
- [x] `frontmatter-sidebar-overview`, `ai-intro-screenshot`, `pane-overview`: frontmatter panel and MDX highlighting
- [x] `file-manager-3`, `file-manager-drafts-filter`, `file-manager-sort`: left sidebar rows
- [x] `copyedit-panel`, `copyedit-checks`, `copyedit-issue-popover`: the word count footer
- [x] `project-settings-project`, `-collection`, `-frontmatter`, `-git`: only the sidebars behind the dialog
- [x] `public/og-image.png`: rebuild from `raw/og-window.png` with `website/scripts/compose-og-image.ts`

### No real change: keep the committed ones

- `command-palette`, `prefs-copyedit`, `git-files`, `git-repository-strip`: pixel-identical
- `git-tab`, `git-commit-card`: only the relative commit time
- `prefs-general`: only the dev app's own New file type preference

### Not in the shot list, out of date

All now in the shot list and retaken:

- [x] `nested-field-example`, `nested-image-field` (`frontmatter/field-types`): old asterisk and constraint text. The demo's Atomic Habits quote note now has a cover image for the second.
- [x] `file-manager-1`, `file-manager-2`, `file-manager-filter` (`file-management/`): the old left sidebar.
- [x] `mdx-builder-fields`, `mdx-builder-imports` (`editor/mdx-components`): the old builder form. `BookCard.astro` and a copy of the Atomic Habits cover are now in `test/demo-project`. The 1.1.0 release page keeps the old images as `release-1.1.0-mdx-builder-*`.
- [x] `mdx-builder-1` (homepage and `editor/mdx-components`): the list hadn't changed, but the editor behind it had.

- [x] New homepage-only shots, `home-frontmatter`, `home-copyedit`, `home-git` and `home-mdx-builder`: cropped to the panel or the builder form, since the feature sections show them at about 640px wide. The docs keep the full-window shots.

Left as they are:

- `mdx-builder-starlight`: the list is unchanged; the icons only show in a prop's dropdown. Retaking it would need a Starlight project in the shot tooling, which only opens the demo repo.
- `project-list` (`file-management/overview`): old sidebars dimmed behind the dialog, and it lists real project paths.

### Still current

Editor-only shots with no sidebars: `clean-editor-view`, `editor-*-full`, `editor-narrow`, `focus-mode`, `typewriter-mode`, `copyedit-highlights`, `content-linker`, `image-preview-demo`, the homepage's distractionless and VS Code shots.

`website/public/` has seven old screenshots nothing on the site references (`dark-mode`, `editor-mode`, `focus-mode`, `image-field-in-sidebar`, `image-preview-hover`, `mdx-insert-panel`, `overview`). They may be linked from outside the site, so leave them unless Danny wants them gone.

## Website docs

The PRs updated the docs for the frontmatter footers and required edges, Copy as slug, JSON editing, loaders and the data store, and the builder form. Still missing:

- [x] `getting-started/philosophy.mdx`: code blocks aren't highlighted unless the cursor is inside them.
- [x] `editor/overview.mdx`: code blocks highlighted in their language while the cursor is in them; Markdown inside MDX components.
- [x] `frontmatter/field-types.mdx`: tag fields suggest the collection's tags (most used first, ↓ on an empty field, a different case takes the collection's spelling).
- [x] `frontmatter/field-types.mdx` and `editor/mdx-components.mdx`: the emoji button on fields and props named `emoji`, macOS only.
- [x] `editor/copyediting.mdx`: the word count and reading time at the bottom of the panel.
- [x] `bun run check` and a build in `website/`.
- [ ] Danny to check the changed pages in the website's dev server.

## Release

- [ ] Danny to read and edit the notes below.
- [ ] Merge the screenshots and docs.
- [ ] `bun run prepare-release` on an up-to-date `main` (proposes 1.2.1), paste the notes into the draft and publish.
- [ ] Delete the test build: `gh release delete v1.2.1-test.1 --cleanup-tag`.

## Release notes for v1.2.1

````markdown
The frontmatter panel now shows your schema's limits on each field, tag fields suggest the tags you've already used, code and MDX are highlighted, and several ways to lose work when syncing with disk are fixed.

### Frontmatter panel

Fields show your schema's limits in a footer attached to the field, like `46 / 100` or `1–5`, and say so in amber when a value is outside them. Nothing is blocked. Empty required fields have a red edge instead of an asterisk, and **Copy as slug** is now an icon in the title field. See [Field Types](https://astroeditor.danny.is/frontmatter/field-types/#descriptions-defaults--constraints). (#399)

### Tag suggestions

Tag fields suggest the tags the collection's other entries use, most used first. Press <kbd>↓</kbd> in an empty field to see them all. A tag typed in another case is added in the spelling the collection already uses, so `javascript` and `JavaScript` don't drift apart. See [Field Types](https://astroeditor.danny.is/frontmatter/field-types/#basic-fields). (#411)

### Code and MDX highlighting

Code in a fenced code block is highlighted in its language while your cursor is in the block. In `.mdx` files, Markdown inside a component is read as Markdown, as MDX renders it, and JSX attributes like `date={new Date()}` are highlighted. (#412)

### Other improvements

- **Word count** – The [Copyedit panel](https://astroeditor.danny.is/editor/copyediting/) shows the word count and reading time.
- **Emoji fields** – A frontmatter field or component prop named `emoji` gets a button that opens the macOS emoji picker.
- **Custom loaders** – Collections with custom, inline or third-party loaders find their files from what Astro recorded the last time it ran, and Project Settings names each collection's loader. See [Project Settings](https://astroeditor.danny.is/project-settings/). (#401)
- **Component builder** – Its form matches the frontmatter panel, and Starlight's icon props show each icon beside its name. (#412)
- **Left sidebar** – Fits narrow widths.

### Bug fixes

- **`post.md` and `post.mdx`** – With both in a collection, they could overwrite each other. (#399)
- **Outside edits** – An edit made in another app just after Astro Editor saved could be overwritten.
- **Comments in objects** – Editing a value inside an object deleted the comments in that object.
- **Objects the schema doesn't describe** – These are now edited as JSON. Before, typing in one could replace it with text.
- **Reopening the open file** – Undo history and the cursor position are now kept.
- **Switching files** – The frontmatter panel no longer flickers.
````
