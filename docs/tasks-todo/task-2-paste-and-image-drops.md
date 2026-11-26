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
- [ ] Danny's sources and photos

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

WebKit turns whatever image is on the pasteboard into a file in the `paste` event's `clipboardData.files`: a screenshot (PNG), an image copied in Preview or Photos (TIFF, which WebKit converts to PNG), Safari's and Chrome's Copy Image, and real files copied in Finder (⌘C). That's more reliable than Tauri's `readImage()`, which only reads TIFF on macOS and re-encodes to raw RGBA.

- [ ] In the paste handler, if `clipboardData.files` has images, handle them as a drop: save into the collection's assets folder, insert the Markdown, select the alt (phase 1). A file copied in Finder keeps its name; a screenshot or copied image (WebKit calls it `image.png`) becomes `YYYY-MM-DD-pasted-image.png`.
- [ ] A new Rust command that writes the bytes through the same naming, unique-name and HEIC logic as `copy_file_to_assets`, sharing its code rather than copying it. Passing the bytes as `Vec<u8>` through tauri-specta sends them as a JSON array of numbers. Try that first with a full-screen retina screenshot; if it's noticeably slow, use a raw-body command (`tauri::ipc::Request`) for this one.
- [ ] Not an image (a copied PDF in Finder): leave it to the default paste for now. Drops already handle other files; paste can follow if anyone asks.
- [ ] The same fallbacks as drops: no project or file open, or an `.astro`/other file that isn't in a collection.
- [ ] Windows (WebView2) should work the same way. WebKitGTK's image paste has been unreliable and may not; that's acceptable for an unsupported platform.
- [ ] Docs: `editor/images-and-files.mdx`.

## Phase 4: Paste rich text as Markdown

Keep it small and predictable. Convert only what's clearly meant; everything else is plain text.

**Approach: a small DOMParser walker in `src/lib/editor/paste/`, no new dependency.** The libraries don't buy much here. Turndown (4 KB) and the unified pipeline (28–80 KB) both read only tags, not inline styles, so both get Google Docs wrong (it wraps everything in `<b style="font-weight:normal">` and marks real bold with styled spans), and neither understands Word's lists, which are paragraphs with `mso-list` styles. We'd be patching around either one for the sources that matter most.

What it keeps:

- [ ] Headings (`h1`–`h6`) and paragraphs, with a blank line between blocks. A Word or Pages document whose plain text has single line breaks comes out as proper paragraphs.
- [ ] Bold and italic: `b`/`strong`/`i`/`em`, and spans styled `font-weight` 600 or more or `font-style: italic`. A `b` styled `font-weight: normal` (Google Docs' wrapper) is only a wrapper.
- [ ] Links with an `href`. Relative and `javascript:` links become their text.
- [ ] Lists, bulleted and numbered, nested by indenting. Word's `MsoListParagraph` paragraphs with `mso-list: lN levelN` become list items, with the bullet spans (`mso-list: Ignore`) dropped.
- [ ] Blockquotes.
- [ ] `br` as a line break inside a paragraph; a `div` with no block children as a line (Gmail and Apple Mail use one per line).
- [ ] Everything else (tables, code, colours, fonts) becomes its text.

Images inside copied text: WebKit reads a copied document's web archive or RTFD (Pages, Notes, TextEdit, Word) and replaces each image's source with a `blob:` URL, partly so pasted content can't reveal local file paths ([WebKit r223440](https://trac.webkit.org/r223440), [bug 49141](https://bugs.webkit.org/show_bug.cgi?id=49141)). A `blob:` URL belongs to the page, so the paste handler can `fetch()` it and get the bytes. So:

- [ ] An `<img>` with a `blob:` or `data:` source is saved like a pasted image (phase 3) and inserted as `![alt](path)`, with the image's `alt` if it has one. The fixtures will show whether these images also arrive in `clipboardData.files`.
- [ ] An `<img>` with an `http(s):` source (web pages, Google Docs, Notion) is left out for now. Google Docs' and Notion's image URLs are signed and expire, so keeping the URL leaves a broken image later, and downloading them is a bigger feature.

When to use the plain text instead:

- [ ] The clipboard has `vscode-editor-data`, or the HTML is mostly `pre`/monospace (copying from a code editor or Terminal, which put highlighted HTML on the clipboard).
- [ ] The cursor is in a code block, frontmatter, or a JSX/HTML tag.
- [ ] The conversion has no formatting and only one paragraph: then the plain text is the same and safer.
- [ ] The paste is a single paragraph going into the middle of a line: insert it inline, without blank lines around it.

Escaping: only escape Markdown characters in text that came from HTML, and only where they'd change the meaning (`*`, `_`, `` ` ``, `[`, `]`, and `#`, `>`, `-`, `+` or `1.` at the start of a line). Plain-text pastes are never escaped.

- [ ] **Paste as Plain Text: ⇧⌘V** (Ctrl+Shift+V elsewhere), in the Edit menu and the command palette. Obsidian, Typora, Chrome and Google Docs all use ⇧⌘V; macOS's own Paste and Match Style is ⌥⇧⌘V, which suits rich-text apps rather than Markdown editors. It reads the text through the clipboard plugin we already have (Rust), since `navigator.clipboard.readText()` shows a permission bubble in WKWebView.
- [ ] No setting to turn conversion off. ⇧⌘V covers the times you don't want it.
- [ ] URL pasted over a selection keeps working as it does, and runs first.
- [ ] Docs: a short "Pasting" section in `editor/overview.mdx` (or its own page), and the shortcut and command in the reference pages.

### Fixtures

Fixtures are the clipboard exactly as the webview receives it. A temporary dev-only log in the paste handler records `clipboardData.types`, the `text/html` and `text/plain`, any files and every `<img>` source. Danny pastes from each source in `paste-testing/README.md` into the dev app, the output is saved in `paste-testing/captured/`, and trimmed copies become the unit tests' fixtures. Then the logging comes out.

## Decisions for Danny

- HEIC: always convert, no setting, macOS only (refuse elsewhere).
- Plain paste on ⇧⌘V rather than the issue's ⌥⇧⌘V.
- Rich text: no setting to turn it off.
- Pasting non-image files: not now.
- Images inside copied text: save the ones the clipboard carries (`blob:`/`data:`), leave out remote ones.
