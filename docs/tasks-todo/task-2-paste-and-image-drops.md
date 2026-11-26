# Paste images and rich text, and tidy up image drops

From issue #406. Branch: `paste-and-image-drops`. One PR, one commit per phase.

Shrinking large images is out: resizing is Astro's job, not the editor's.

## How it works today

- **Drops** come through Tauri's drag-drop event as file paths (`src/lib/editor/dragdrop/`). Each is copied by `copy_file_to_assets` (`src-tauri/src/commands/files.rs`) to `<assets>/<collection>/YYYY-MM-DD-<kebab-name>.<ext>` and inserted at the cursor as `![original-name.jpg](path)`, or `[name](path)` for anything that isn't an image. The cursor ends up after the last one.
- **Frontmatter image fields and the component builder's image picker** go through the same `copy_file_to_assets`, so a change there covers all three.
- **Paste** (`src/lib/editor/paste/handlers.ts`) only handles a URL pasted over selected text. Everything else is CodeMirror's default, which reads only `text/plain`. CodeMirror's own copy writes only `text/plain`, so copying within the editor never brings HTML.
- **HEIC** isn't in `IMAGE_EXTENSIONS`, so a dropped `.heic` is copied in and inserted as a link, not an image.

## Test material

`docs/tasks-todo/temporary/paste-testing/` (gitignored) holds the sample article (HTML, `.docx`, `.rtf`) with what it should paste as, a photo in every image format, awkward file names, and some files that aren't images. Its README lists what Danny is preparing: the same content in Google Docs, Word, Pages, Notes, Notion, Gmail, Apple Mail, Slack, Obsidian and an AI chat; real iPhone HEICs (one portrait); and the clipboard sources to try.

- [x] Sample content, images and files
- [x] Danny's captures: image sources, and the sample article from Safari, Chrome, TextEdit and Word. The other rich-text sources were dropped to keep phase 4 simple.

## Phase 1: Select the alt text after inserting an image

- [x] When one image is dropped, its alt text (the original file name) is selected, so typing replaces it. One transaction, so undo removes the whole insert. `selectionAfterInsert` in `dragdrop/handlers.ts`; phase 3 reuses it for pastes.
- [x] With several, or a file that isn't an image, the cursor goes after the insert as before.
- [ ] Danny to try it in the app (native drops can't be driven by the tooling).

## Phase 2: Convert HEIC to JPEG

Astro can't use HEIC at all: it isn't in Astro's accepted input formats, Vite won't import it, and Sharp's prebuilt binaries can't decode it (HEVC patents). Only Safari shows it in an `<img>`, so the app's own preview would hide the problem. So there's no case for keeping one, and no setting: convert, always.

- [x] `copy_file_to_assets` writes a `.heic`/`.heif` as a JPEG: `IMG_1234.HEIC` becomes `2026-11-25-img-1234.jpg`. Its naming, unique-name claim and project checks are now `add_to_assets`, which takes how to fill the file, ready for phase 3's pasted bytes. It runs off the async workers.
- [x] macOS: `sips -s format jpeg -s formatOptions high` through `process.rs` (`src-tauri/src/heic.rs`). Checked in the running app: the test HEIC came out as a 1721×1147 JPEG.
- [x] `sips` fails silently when it can't reach the decoder (as in Claude's sandbox): it writes a 192-byte JPEG with no pixels and exits 0. The result is checked with `sips -g pixelWidth`. The name is claimed with an empty file, which is removed if the conversion fails, as a failed copy already was.
- [x] Windows and Linux refuse with "HEIC images can't be used by Astro. Convert it to JPEG first."
- [x] A drop that fails now shows a toast with the reason (before, it silently inserted the original path).
- [x] AVIF and TIFF added to `IMAGE_EXTENSIONS`.
- [x] `CONVERTED_IMAGE_EXTENSIONS` (heic, heif) and `ADDABLE_IMAGE_EXTENSIONS` in `lib/files/constants.ts`: the drop handler and both file pickers accept HEIC, and a HEIC is always copied (converted) even when it's already in the project. `IMAGE_EXTENSIONS` (and so image previews) leave it out.
- [x] Tests: a HEIC that can't be converted leaves nothing behind. The two that convert `test/images/photo.heic` are `#[ignore]`d, because sandboxes block the decoder; run them on a Mac with `cargo test heic -- --ignored` (both pass).
- [x] Docs: a "HEIC photos" section in `editor/images-and-files.mdx`, linked from the image field section.
- [ ] With Danny's iPhone photos: a portrait photo keeps its orientation in the JPEG, in the preview, and in Astro's built output.
- [ ] Danny to try a drop and a frontmatter image field with a HEIC.

Worth knowing: dragging from Photos usually gives a JPEG already. HEIC mostly arrives through AirDrop and Finder.

## Phase 3: Paste images

What WebKit gives, from the captures in `paste-testing/captured/images-*.json`:

| Source                                  | Clipboard                                                        |
| --------------------------------------- | ---------------------------------------------------------------- |
| Screenshot to clipboard, Preview        | One file, `image.png` (Preview's image converted to PNG)          |
| Photos                                  | One file, a JPEG named with a UUID (`89A58956-…_1_105_c.jpeg`)    |
| Copy Image in Safari or Chrome          | A PNG `image.png`, and HTML that's only the `<img>`, with its alt |
| Finder, one or several images, or HEIC  | The files with their own names; HEIC as `image/heic`              |
| A web page selection with images        | HTML and text, no files; the images are remote URLs               |

- [x] `paste/images.ts`: when every file is an image and there's no text, or the HTML is only an `<img>` (Copy Image), the images are saved and inserted over the selection, and a single image has its alt selected. Copy Image's alt text is used. Anything else goes to the text handling. The URL-over-selection case runs first.
- [x] Names WebKit and Photos make up (`image.png`, UUIDs) become `pasted-image`; Finder's names are kept.
- [x] `save_image_to_assets` shares `add_to_assets` with `copy_file_to_assets`. A pasted HEIC is written as it came and converted in place. The bytes cross as base64: 12 MB took 0.2s, against 2.9s as a `Vec<u8>` (a JSON array of numbers). A raw-body command (`tauri::ipc::Request`) isn't possible with tauri-specta. `base64` was already in the dependency tree.
- [x] Not an image (a PDF copied in Finder): left to the default paste.
- [x] No project, or a file that isn't in a collection: a toast, nothing inserted.
- [x] Checked in the app with a synthetic Copy Image paste: saved, inserted, alt selected, one undo removes it.
- [x] Docs: "Pasting images" in `editor/images-and-files.mdx`.
- [ ] Danny to try real pastes of each source.
- [ ] Windows (WebView2) should work the same way. WebKitGTK's image paste has been unreliable and may not; that's acceptable for an unsupported platform.

## Phase 4: Paste rich text as Markdown

Kept deliberately simple: the converter reads the HTML's structure and nothing else, with no special handling for Word, Google Docs or Notion. If those paste badly, that's acceptable.

What the captures showed (`paste-testing/captured/`, and the fixtures in `src/lib/editor/paste/fixtures/`):

- **Safari and Chrome** give clean structural HTML (with inline computed styles): real headings, lists, links. Safari inlines a local image as a `data:` URL; Chrome gives its relative path.
- **TextEdit** (RTF, converted by WebKit) has real lists and links, and headings that are only big bold text.
- **Word**: WebKit strips its list markup, so lists are paragraphs starting with a typed `•`/`◦`/`1` and an indent, headings are big bold paragraphs, and (from a `.docx` textutil made) links had no URL.

- [x] `html-to-markdown.ts`, no new dependency: headings (`h1`–`h6` only), paragraphs, `br`, bold and italic (tags and `font-weight`/`font-style` styles; a `<b>` styled not bold is only a wrapper), links to web and email addresses, nested lists (including WebKit's list-inside-list from RTF), quotes, inline code as backticks, code blocks fenced, `hr`, and images with a web address as `![alt](https://…)`. Embedded images (`blob:`, `data:`) and relative links and images are dropped to their text. Tables become a paragraph per cell.
- [x] Escapes `\`, `` ` ``, `*`, `[`, `]`, `_` at word edges, and `#`, `>`, `-`, `+` and `1.` at the start of a line, only in text that came from HTML.
- [x] Pastes plain text instead when there's no HTML, when it's from VS Code (`vscode-editor-data`), when the cursor is in code, or when the conversion keeps no formatting.
- [x] **⇧⌘V** (Ctrl+Shift+V) pastes plain text, read through a Rust command (`read_text_from_clipboard`), since WebKit gives no paste event for it. An editor keymap only, not a menu item.
- [x] A URL pasted over a selection, and images, are handled first.
- [x] Tests: the four real pastes as file snapshots (`fixtures/*.md`), plus unit tests.
- [x] Checked in the app: a synthetic rich-text paste, and ⇧⌘V.
- [x] Docs: "Pasting formatted text" in `editor/markdown-formatting.mdx`, the shortcut in `reference/keyboard-shortcuts.mdx`, and "Pasting and dropping" in `docs/developer/editor.md`.
- [x] The temporary paste recorder is removed.
- [ ] Danny to try pastes from the browser and TextEdit.

## Decisions

- HEIC: always convert, no setting, macOS only (refuse elsewhere).
- Plain paste on ⇧⌘V rather than the issue's ⌥⇧⌘V.
- Rich text: no setting to turn it off.
- Pasting non-image files: not now.
- Images inside copied text: remote ones as `![alt](https://…)`, embedded ones dropped.
- Code in copied text: backticks and fenced blocks.
- Rich text sources: structural HTML only; no special handling for Word, Google Docs or Notion.
