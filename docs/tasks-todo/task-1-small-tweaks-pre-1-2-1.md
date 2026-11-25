# Task: Small tweaks before 1.2.1

From issue #400: an emoji button for `emoji` fields, syntax highlighting in code blocks and in Markdown inside MDX components, and a component builder that matches the frontmatter panel. The issue's mention of #397 is out of scope here.

Each phase ends with `bun run check:all` passing, a check in the app in light and dark, and a commit. Screenshots and scratch files go in `docs/tasks-todo/temporary/issue-400/`. `temp-dummy-astro-project/src/content/notes/highlighting-test.mdx` is a test file with components, HTML and code blocks (recreate it after `app reset`).

## Gotchas from earlier work

- **One copy of each `@lezer/*` and `@codemirror/*` package.** `@codemirror/language-data` brings in many `@codemirror/lang-*` packages and `@codemirror/legacy-modes`. After adding it, `grep -E '"[^"]+/@(codemirror|lezer)/' bun.lock` must print nothing. A duplicate breaks highlighting with no error (seen when `@lezer/common` went to 1.5).
- **Contextual style rules don't fire.** `@lezer/markdown` maps every mark to `tags.processingInstruction`, and since `@lezer/highlight` 1.2.3 that's checked before our rules (`editor.md`). Anything contextual is styled with decorations instead.
- **HTML autocomplete when typing `<`** was an early bug. Nested languages may bring their own support (auto-close tags, completions, indentation), so check none of it appears once code blocks and JSX are parsed.
- **Extensions that walk the tree** (`harper/prose.ts`, `syntax-mark-decorations.ts`, `code-block-background.ts`, focus and copyedit modes) will see nested trees inside code blocks and, after Phase 3, a different shape for MDX components. `tree.iterate` enters mounted trees by default.
- **"Markdown inside HTML tags"** was researched in the very first build, with no notes kept on the result.

## Phase 1: Emoji button ✅

**Done:** the native palette works (`commands/emoji.rs`, `EmojiButton`). The button shows on macOS only, so Windows and Linux are unchanged; no picker package was needed. The notes collection and the `Callout` component in the test project have an `emoji` field.

A string frontmatter field or component prop named `emoji` gets a button on the right of its input that inserts the chosen emoji. It stays an ordinary text field. Not documented on the website.

Where it goes: `StringField` (`components/frontmatter/fields/`), chosen in `FrontmatterField.tsx`, and the string branch of `PropField` (`components/component-builder/`). The frontmatter frame already supports an `overlay` (used by Copy as slug), so the button can sit inside the box.

1. **Try the native picker first.** macOS: `NSApplication.orderFrontCharacterPalette` through a small Tauri command (`objc2-app-kit` with `NSApplication` is already a dependency). It inserts into whatever has focus, so the button puts focus back in the input first. Check in the app that the emoji lands in the input, that React's `onChange` fires so the store and auto-save see it, and that the palette appears in a sensible place.
2. **Windows and Linux.** Windows has its own panel (Win+.) but no clean way to open it from code, and Linux has no standard one. Decide once step 1 is known:
   - Native works: show the button only on macOS. Windows users still have Win+.
   - Native doesn't work, or we want one picker everywhere: an in-app picker. shadcn has no emoji picker of its own; the likely small option is [frimousse](https://github.com/liveblocks/frimousse), which is unstyled, renders emoji as text (no images) and takes an `emojibaseUrl`. By default it fetches its data from jsDelivr, so ship the `emojibase-data` JSON with the app and point it there. Nothing may load from a CDN.

## Phase 2: Highlighting code blocks ✅

**Done, awaiting Danny's review:** `syntax/codeLanguages.ts` (language-data, plus Astro as TSX and Svelte as HTML), the active block in `code-block-background.ts` with a test, the reset in `theme.ts`, and `editor.md`. The tree-walking extensions were never at risk: code is mounted as an overlay, which `Tree.iterate` doesn't enter. The main bundle didn't grow; each language is its own lazy chunk.

Code in fenced blocks is highlighted only while the cursor is inside that block; elsewhere it stays as it is now.

- Pass `codeLanguages: languages` from `@codemirror/language-data` to `markdown()` in `createExtensions.ts`. Languages load lazily, so they don't enlarge the main bundle (`vite.config.ts` has no manual chunks).
- `highlightStyle.ts` already styles the standard code tags (keywords, strings, comments…), with colours from `editor-styles.md`. Check these look right with real languages, and that `astro` fences get something sensible (language-data may not know Astro; mapping it to HTML or JSX is fine).
- `code-block-background.ts` marks each fenced block's lines. Add a class for the block holding the cursor; it must also update on selection changes, not just document changes. Without that class, the code's colours are reset to the normal text colour in CSS (`theme.ts`).
- Check Harper still skips code, and that the other tree-walking extensions ignore nested nodes.
- Update `editor.md` (Highlighting) with how nested languages and the active block work.

## Phase 3: Markdown inside MDX components

In MDX, a component's children are Markdown, but the editor parses `<Callout>` on its own line as a CommonMark HTML block, which runs to the next blank line, so the Markdown in it isn't highlighted. With blank lines around the content it already works. In `.md` files, the current behaviour is right: Astro doesn't render Markdown inside raw HTML either.

- No CodeMirror MDX package exists. Write a `@lezer/markdown` block parser for MDX JSX: a line starting with a tag takes just the tag (which may span lines, like `<BookmarkCard … />`, and contain `{…}` expressions with `>` in them), and the lines after it parse as Markdown. Use micromark's MDX JSX rules as the reference (flow vs text JSX).
- Parse the tag as JSX rather than HTML if it's straightforward, so attributes like `date={new Date()}` highlight properly.
- Only for `.mdx` files: put the Markdown language in a `Compartment` and reconfigure it in `loadDocument` (`lib/editor/load-document.ts`) along with the history.
- Inline JSX in a paragraph already parses as `HTMLTag`; check it still does.
- Revisit `harper/prose.ts`: some of its text patterns exist because the tree read components as one HTML block. Keep what's still needed.
- Tests for the parser: a single-line tag, a multi-line self-closing tag, nested components, Markdown directly inside, expressions containing `>`, and that `.md` is unchanged.
- Update `editor.md`.

## Phase 4: Component builder

Make the builder's form look and behave like the frontmatter panel (#399).

- **Shared field frame.** `FormField` is a separate, lighter copy of `FieldWrapper`. Pull the frame and footer out of `FieldWrapper` so both use them, rather than copying the styles again.
- **What props can show.** Props have no schema constraints, only their TypeScript type. So: required shown with the coloured left edge (not an asterisk), the default in the footer while empty (not beside the label), the description below, and type hints where useful ("Whole number" isn't known, but "Number" is). `bindingHint` text stays.
- **Labels.** Capitalise prop names with `camelCaseToTitleCase` (`lib/utils.ts`), as the frontmatter panel does. Keep the real prop name visible somewhere (the preview shows it, which may be enough).
- **Highlighted previews.** The tag preview and import lines: use `highlightCode` from `@lezer/highlight` with the JSX parser from `@codemirror/lang-javascript`, producing spans coloured with the same `--editor-color-*` tokens as the editor. No CodeMirror view.
- **Layout.** The dialog is `sm:max-w-lg`. Once the above is in, try a wider dialog with two columns when a component has many props, or another two-column arrangement. Danny decides from screenshots.
- Update the styleguide section for the builder, `ui-patterns.md` if the shared frame changes a pattern, and the website's component builder page and screenshot if they no longer match.

## Phase 5: Exploration (maybe never)

Richer pickers for props, such as showing the icons behind an `icon` enum. This depends on how each site is built, so it's probably only feasible for Starlight's built-in icons. Note what we learn; don't build without agreeing first.
