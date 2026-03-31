# Fix: Editor scroll jump on auto-save

## Problem

When editing a document, the editor viewport "jumps" away from where the user is typing approximately every 5 seconds. The cursor position remains correct, but the viewport scrolls up (often to near the middle of the document). The issue is worse when editing near the bottom of the document.

A secondary issue: in typewriter mode, double-clicking to select a word causes a scroll during the selection, disrupting the selection. This is likely related but through a different mechanism.

The user reports this appeared between v1.0.10 and v1.0.11.

## Root Cause

### Trailing newline loss in the save-reload round-trip

The Rust `parse_frontmatter` function (`src-tauri/src/commands/files.rs:400`) uses `content.lines().collect()` to split a file into lines. Rust's `str::lines()` treats a final `\n` as a **line terminator**, not as creating an empty line:

- `"text\n".lines()` -> `["text"]` (trailing `\n` silently dropped)
- `"text\n\n".lines()` -> `["text", ""]` (only the LAST `\n` is dropped)

Then `extract_imports_from_content` (`files.rs:595`) joins the content lines back with `content_lines.join("\n")`. But `["text", ""].join("\n")` produces `"text\n"`, NOT `"text\n\n"`. **One trailing newline is always lost.**

The compensation code at lines 452-455 only adds a `\n` when the body doesn't already end with `\n`:

```rust
if original_ends_with_newline && !body_content.is_empty() && !body_content.ends_with('\n') {
    body_content.push('\n');
}
```

So `"text\n"` round-trips correctly (lost then restored), but `"text\n\n"` becomes `"text\n"` (already ends with `\n`, no restoration). **The round-trip is lossy for content with 2+ trailing newlines.**

### How this triggers the scroll jump

1. User presses Enter at end of document -> content ends with `\n\n`
2. Auto-save fires (2s debounce) -> `saveFile()` writes to disk, sets `isDirty: false`, invalidates file content query
3. TanStack Query refetches -> `parse_frontmatter` re-reads file -> loses one trailing `\n` -> returns different content
4. `useEditorFileContent` effect fires (`src/hooks/useEditorFileContent.ts:29-46`) - `isDirty` is false, so it sets `editorContent` to the re-parsed (different) content
5. Editor.tsx subscription (`src/components/editor/Editor.tsx:276-317`) detects store content != CM doc -> dispatches **full document replacement** (`changes: { from: 0, to: length, insert: newContent }`)
6. The full doc replacement destroys CM's scroll position mapping. With **typewriter mode on**, the transaction extender (`src/lib/editor/extensions/typewriter-mode.ts:65-84`) sees `docChanged` and adds `EditorView.scrollIntoView(head, { y: 'center' })`, explicitly re-centering -> visible jump

### Why it repeats (~5 seconds matches writing cadence)

1. Type content -> auto-save -> content ends with `\n` -> round-trip lossless -> **no jump**
2. Press Enter (new paragraph) -> content ends with `\n\n` -> auto-save -> loses a `\n` -> **JUMP**
3. Start typing on the new line -> content now has no trailing `\n` -> auto-save -> adds `\n` back -> **JUMP**
4. Continue typing (cursor before the `\n`) -> content ends with `\n` -> lossless -> **no jump**
5. Press Enter again -> back to step 2

Steps 2-3 happen in quick succession within the writing flow, creating the "every ~5 seconds" pattern.

### Why it's worse near the bottom

- New lines are most commonly created at the bottom of the document
- The `scrollIntoView(head, { y: 'center' })` centering effect displaces the viewport most when the cursor is far from the document center

### Why it appeared between v1.0.10 and v1.0.11

The trailing newline bug and the auto-save -> query invalidation -> reload path existed before v1.0.10 (the code didn't change). However, CodeMirror was upgraded: `@codemirror/view` 6.39.14->6.40.0, `@codemirror/state` 6.5.4->6.6.0. The CM6 upgrade likely changed how viewport position is handled during full document replacements, making the scroll disruption visible where it was previously absorbed.

## Key Files

- `src-tauri/src/commands/files.rs` - `parse_frontmatter()` (line 397), `extract_imports_from_content()` (line 533)
- `src/components/editor/Editor.tsx` - Store subscription and full doc replacement (lines 276-317)
- `src/hooks/useEditorFileContent.ts` - Syncs query data to store (lines 29-46)
- `src/hooks/editor/useEditorActions.ts` - `saveFile()` with query invalidation (line 113)
- `src/lib/editor/extensions/typewriter-mode.ts` - Transaction extender adding scrollIntoView (lines 65-84)

## Fix Strategy

### Primary fix (Rust - content round-trip fidelity)

Fix `parse_frontmatter` to preserve trailing newlines accurately. Options:

**Option A**: Count trailing newlines in the original content (after frontmatter + imports section) and ensure the returned body has the same count. This is the most robust approach.

**Option B**: Change `extract_imports_from_content` to not use `lines()` + `join("\n")` for the body. Instead, calculate the byte offset where the body starts and use a string slice. This avoids the `lines()` lossyness entirely.

**Option C**: After the `join("\n")`, count how many trailing newlines the original content had vs the joined content, and add the difference back. This is a patch on the existing approach.

Option B is cleanest - it avoids `lines()` entirely for the body content and preserves exact fidelity.

### Secondary defence (Frontend - avoid unnecessary full doc replacement)

The `saveFile()` function invalidates `queryKeys.fileContent` after saving (`useEditorActions.ts:113`). Since we just saved the content that's already in the editor, this refetch is unnecessary for the editor (it's useful for the file list UI showing timestamps etc). Consider:

- Not invalidating the file content query in `saveFile` (the watcher will handle external changes)
- OR: having `useEditorFileContent` compare `data.content` with the current store `editorContent` before calling `setState`

### Typewriter mode fix (separate issue)

The transaction extender at `typewriter-mode.ts:65-84` fires on ALL `docChanged` transactions, including programmatic replacements. It should skip transactions that are programmatic/non-user-initiated. Options:

- Add a custom annotation to programmatic dispatches and check for it in the extender
- Check for `tr.isUserEvent()` to only fire on user-initiated transactions
- Filter out transactions where the entire document is replaced (from: 0, to: length)

## Typewriter double-click issue

The typewriter ViewPlugin (`typewriter-mode.ts:110-134`) defers pointer-click centering to `mouseup`. During double-click word selection, the mouseup handler fires and dispatches `scrollIntoView` in a `requestAnimationFrame`, which scrolls during the selection operation and can disrupt the selection geometry. This needs the deferred scroll to be cancelled or delayed when a double-click/triple-click selection is in progress.
