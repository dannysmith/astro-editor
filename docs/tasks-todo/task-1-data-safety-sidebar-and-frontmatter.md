# Data safety, sidebar and frontmatter groundwork

A review after shipping 1.2.0 found bugs in how the editor syncs with disk, some of which lose work. It also found the cause of the left sidebar overflow and the frontmatter flicker, and some structure worth sorting out before the frontmatter panel's UI work, which happens on this same branch.

Work through the phases in order. The data bugs come first, and the flicker fix builds on the loading code they change.

## Phase 1: Data bugs

Each fix gets a focused test that fails without it.

### 1. `post.md` and `post.mdx` are treated as the same file

**Reproduced.** `FileEntry.id` drops the extension, and the content query is keyed by it. With `post.md` open, opening `post.mdx` shows `post.md`'s content under the `.mdx` path, and the next save overwrites `post.mdx` with it. If `post.md` is dirty, the click does nothing. Both rows also highlight and share a React key.

**To reproduce:** add `twin.md` and `twin.mdx` with different bodies to the test vault, open one then the other, type a character and save.

**Fix:** use `path` as a file's identity, and keep `id` only for the Astro entry id (`lib/entry-id.ts`, `useCollectionEntriesQuery`).

- [x] Key the content query by path
- [x] Compare by path in `editorStore`, `useFileChangeHandler`, `useEditorFileContent`, `useEditorActions`, `lib/git/actions.ts`, `Editor.tsx`, `JsonField`, `ImagePicker`, `componentBuilderStore` and the drag-and-drop handlers
- [x] Use the path for the sidebar's row keys, selected row and renaming state
- [x] Make renames follow the new path, in `updateCurrentFile` and `useRenameFileMutation`

### 2. Outside edits just after a save are ignored, then overwritten

**Reproduced.** For 3 seconds after a save or file open, `useFileChangeHandler` treats every watcher event for the open file as our own save. The editor keeps the old text and shows it as clean, and the next save overwrites the outside change. A `git pull`, formatter or coding agent can all hit this.

**To reproduce:** type and save in the test vault, append to the file from a shell straight away, then type and save again. The appended text is gone from disk.

**Fix:** when the open file is clean, always refetch on a watcher event. An echo of our own save reads back identical data, structural sharing keeps the same `data` reference, and the sync effect doesn't run.

- [x] Confirm that an echo of our own save doesn't reload the editor (undo and cursor survive it)
- [x] Keep the time window only for skipping the file list refresh
- [x] Keep `reloadEntry` in `lib/git/actions.ts`, which editing waits on during a pull, and correct its comment
- [x] Update the test in `useFileChangeHandler.test.ts` that pins the current behaviour

### 3. Clicking the open file wipes undo and the cursor

**Reproduced.** `openFile` only guards re-opening a dirty file. A clean re-open blanks the store and loads the document twice, which resets undo history and moves the cursor to the top. Every route into `openFile` can do this, including the Git panel's file rows and the content linker.

**Fix:** return early from `openFile` when the path is already open, invalidating the query so disk changes are still picked up.

- [x] Add the early return
- [x] Update the "idempotently" test in `storeQueryIntegration.test.ts`, which asserts the clearing

### 4. Typing in a field holding an unrecognised value destroys it

**From the code, not yet reproduced.** A value with no schema, or an `unknown` schema type, falls through to a plain text input even when it's an object or a non-string array. An object shows as blank, an array of objects as `[object Object]`, and the first keystroke replaces the whole value with a string, which auto-save writes to disk.

**Fix:** have `fieldControl` return `json` for these values. It chooses from the current value, so the control must stay put within a file while the JSON is cleared or edited into a scalar, the way `StringField` keeps its textarea.

- [x] Reproduce with an `seo:` object that's missing from the schema
- [x] Route these values to `JsonField`, sticky per file
- [x] Check the project settings schema view, which also reads `fieldControl`

### 5. Stale loads can replace newer text

**From the code, not yet reproduced, and should be rare.** `useEditorFileContent` applies any query result whenever the file isn't dirty, but between a save finishing and its refetch landing, the cache can hold older text. Overlapping saves can briefly bring back an older version, wipe undo, and save it if a key is pressed at that moment. Two related paths:

- Renaming a dirty file: the rename's invalidation can cancel the post-save reload, so pre-save data is reapplied
- Going A → B → A during A's save: the save sees the blank placeholder as changed content and marks the file dirty, which leaves A blank and read-only

**Fix:**

- [x] For an already-loaded file, ignore query results older than the last save
- [x] Add an open-generation counter, and have saves compare it rather than the path
- [x] Don't fire forced saves while one is in flight

### 6. A half-edited image path can carry over to the next file

**From the code, not yet reproduced.** Fields stay mounted across file switches, so `ImagePicker` keeps `isEditing` and `editValue`. If the next file has an image, its input shows the previous file's typed path, and Save writes it there.

**Fix:** hold the draft as `{ openGeneration, text } | null`, and treat it as editing only while it matches the open file. The generation survives a rename, which a path wouldn't. Don't key the panel on the file: a rename would remount it and drop focus as the writer tabs out of the title.

- [x] Scope the draft to the open file

### 7. Editing a nested value deleted the comments in its object

**Reproduced.** The writer only kept text per top-level key, so changing `seo.og.alt` rewrote all of `seo` and dropped any comments inside it.

**Fix:** splice changed block objects the same way as the top level, at any depth. Inline objects, and anything that doesn't read back correctly, are still rendered whole. Comments inside a changed list of objects are still lost.

- [x] Splice nested block objects in `write_block`
- [x] Keep new nested keys at their schema position

## Phase 2: Frontmatter flicker

`openFile` clears `frontmatter` and forces a disk read, so the mounted fields show empty values until it lands. Measured at 27–112ms per switch, with the panel's height dropping by up to 290px and growing back.

**Fix:** keep the outgoing values on screen until the new ones arrive. `updateFrontmatterField` already refuses edits while `isLoaded` is false.

- [x] Check that nothing can save or read the outgoing `frontmatter` against the new file while loading
- [x] Clear immediately when the new file is in a different collection, since old values shouldn't render under another schema
- [x] Handle a load that fails, so the old file's values don't stay on screen
- [x] Confirm in the app that switching within a collection no longer changes the panel's height until the new values land

## Phase 3: Left sidebar

### Overflow

The 200px minimum is passed as `style`, which `react-resizable-panels` puts on an inner div. At a 1000px window the panel is 150px wide while its contents lay out at 200px and spill out.

- [x] Set `minSize: '200px'` on the panel and remove the inline style and `minWidth` constant
- [x] Check that collapsing, restoring a saved layout and the minimum window size still behave

### Thin out `LeftSidebar`

It's 687 lines doing about six jobs, and the responsive work below touches most of them, so split it first.

- [x] Extract `SidebarHeader`, `CollectionList` and `CollectionFiles`, each reading the stores directly
- [x] Move the filter and sort pipeline into a plain function in `lib/files`
- [x] Move the rename flow into `useFileRename`
- [x] Extract a `RenameInput` that mounts only while renaming, replacing the refs and effects in `FileItem`
- [x] Stop sorting cached query data in place during render

### Rows that adapt to their container

Components should hold up at any sidebar width using CSS alone. Text can step down slightly when very constrained, but no fluid type.

- [x] Collection rows: let the name truncate and keep the count badge inside the row
- [x] File rows: find the badges a better place when tight, with a container query if stacking is needed
- [x] Header: breadcrumbs, status badges and buttons at minimum width
- [x] Filter bar and the Project Settings footer
- [x] Check the right sidebar's panels at their minimum width, especially the Git panel's repository strip and the frontmatter fields

## Phase 4: Frontmatter panel structure

So that visual changes land in one place.

- [x] Add `useFrontmatterValue(name)`, returning the value and setter, keeping the Direct Store Pattern
- [x] Simplify `FieldWrapper` to take `label`, `field`, `value` and `htmlFor`, with an optional `description` override for `JsonField`
- [x] Move all 11 field components onto them, including `BooleanField`, which currently rebuilds its label row by hand
- [x] Add a pure `frontmatterTree(schema, frontmatterKeys, titleField)` in `lib/`, returning the ordered fields and nested groups, with unit tests
- [x] Render the panel from it, replacing the three render blocks
- [x] Handle real nesting: `seo.og.image` currently becomes an "Og" section beside "Seo", and nested objects always render after all top-level fields

## Phase 5: Frontmatter panel UI

Danny's UI changes to the panel and its components. To be added.

## Not doing

- **Coalescing watcher events.** A branch switch triggers one folder rescan per changed file, but it isn't worth the work for now.
- **Moving Preferences' open state into `uiStore`.** It would make the dialogs consistent, but nothing is broken.

## Before finishing

- [ ] Update `docs/developer/editor.md` and `architecture-guide.md` for file identity and how disk changes are handled
- [ ] Check the UI in the app, in light and dark
- [ ] `bun run check:all`
