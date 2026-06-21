# Fix: Editor scroll jump on auto-save

## Problem

When editing a document, the editor viewport "jumps" away from where the user is typing approximately every 5 seconds. The cursor position remains correct, but the viewport scrolls up (often to near the middle of the document). The issue is worse when editing near the bottom of the document.

A secondary issue: in typewriter mode, double-clicking to select a word causes a scroll during the selection, disrupting the selection. This is likely related but through a different mechanism.

The user reports this appeared between v1.0.10 and v1.0.11, likely surfaced by the CodeMirror upgrade (`@codemirror/view` 6.39.14->6.40.0, `@codemirror/state` 6.5.4->6.6.0) which changed how viewport position is handled during full document replacements.

## Root Cause

The save-reload round-trip produces content that differs from what was in the editor. This triggers a full document replacement in CodeMirror, which destroys the scroll position (and with typewriter mode on, explicitly re-centers via `scrollIntoView`).

There are **two sources** of content mismatch:

### Source A: Save adds trailing newline that wasn't there

The `rebuild_markdown_*` functions (`files.rs:765`, similar at lines 725 and 794) add a trailing `\n` for POSIX compliance when the content doesn't end with one:

```rust
if !result.is_empty() && !result.ends_with('\n') {
    result.push('\n');
}
```

When the user is typing on the last (empty) line of a document, the editor content doesn't end with `\n`. Save adds one. Reload returns content WITH the `\n`. Mismatch -> jump.

### Source B: Parse loses a trailing newline

The `parse_frontmatter` function (`files.rs:400`) uses `content.lines().collect()`. Rust's `str::lines()` treats a final `\n` as a line terminator, silently dropping it. Then `extract_imports_from_content` (`files.rs:595`) reconstructs the body with `content_lines.join("\n")`, which doesn't add a trailing `\n`.

The compensation code at lines 452-455 only adds a `\n` back when the body doesn't already end with one:

```rust
if original_ends_with_newline && !body_content.is_empty() && !body_content.ends_with('\n') {
    body_content.push('\n');
}
```

This handles single trailing newlines but fails for two or more. Example: `"text\n\n"` -> `lines()` produces `["text", ""]` -> `join("\n")` produces `"text\n"` (already ends with `\n`, so no restoration) -> lost one `\n`.

When the user presses Enter at the end of a document, content ends with `\n\n`. Save preserves it. Reload loses one `\n`. Mismatch -> jump.

### How the mismatch triggers the scroll jump

1. Auto-save fires -> `saveFile()` writes to disk, sets `isDirty: false`, invalidates file content query (`useEditorActions.ts:113`)
2. TanStack Query refetches -> `parse_frontmatter` re-reads file -> returns different content
3. `useEditorFileContent` effect fires (`useEditorFileContent.ts:29-46`) - `isDirty` is false, so it sets `editorContent` to the re-parsed (different) content
4. Editor.tsx subscription (`Editor.tsx:276-317`) detects store content != CM doc -> dispatches full document replacement
5. With typewriter mode on, the transaction extender (`typewriter-mode.ts:65-84`) sees `docChanged` and adds `EditorView.scrollIntoView(head, { y: 'center' })` -> viewport jumps

### Why it repeats during normal writing

1. Type content -> auto-save -> content ends with `\n` -> round-trip lossless -> **no jump**
2. Press Enter (new paragraph) -> content ends with `\n\n` -> auto-save -> Source B loses a `\n` -> **JUMP**
3. Start typing on the new line -> content has no trailing `\n` -> auto-save -> Source A adds `\n` -> **JUMP**
4. Continue typing (cursor before the `\n`) -> content ends with `\n` -> lossless -> **no jump**
5. Press Enter again -> back to step 2

## Fix

Two small changes in `src-tauri/src/commands/files.rs`, both needed:

### 1. Save side: stop adding trailing newlines

Remove the POSIX trailing newline addition from all three rebuild functions. The editor should preserve the user's content exactly as-is.

**`rebuild_markdown_with_raw_frontmatter`** (~line 765), **`rebuild_markdown_with_frontmatter_and_imports_ordered`** (~line 725), and **`rebuild_markdown_content_only`** (~line 794) — delete or comment out:

```rust
// REMOVE from all three functions:
if !result.is_empty() && !result.ends_with('\n') {
    result.push('\n');
}
```

### 2. Parse side: fix trailing newline compensation

In `parse_frontmatter`, remove the `!body_content.ends_with('\n')` guard from the compensation code. `lines()` always drops exactly one trailing `\n`; the compensation should always add exactly one back.

**Line ~407** (no-frontmatter path) and **line ~453** (frontmatter path):

```rust
// BEFORE (buggy — skips compensation when body already ends with \n):
if original_ends_with_newline && !body_content.is_empty() && !body_content.ends_with('\n') {

// AFTER (always compensate for the \n that lines() dropped):
if original_ends_with_newline && !body_content.is_empty() {
```

### 3. Tests

Add round-trip tests for:
- Content with single trailing `\n` (should preserve)
- Content with double trailing `\n` (currently broken by Source B)
- Content with no trailing `\n` (currently broken by Source A)
- Content with triple trailing `\n` (edge case)

### Not needed

- **Frontend changes** (query invalidation, content comparison, typewriter mode annotation): With the Rust fix making the round-trip lossless, TanStack Query's structural sharing keeps the same `data` reference and the `useEditorFileContent` effect never fires. The full doc replacement never happens. These would only be defence-in-depth.

## Separate: Typewriter double-click issue

The typewriter ViewPlugin (`typewriter-mode.ts:110-134`) defers pointer-click centering to `mouseup`. During double-click word selection, the mouseup handler fires and dispatches `scrollIntoView` in a `requestAnimationFrame`, which scrolls during the selection operation and can disrupt the selection geometry. This needs its own fix (not blocking this task).

## Key Files

- `src-tauri/src/commands/files.rs` - `parse_frontmatter()` (line 397), `extract_imports_from_content()` (line 533), rebuild functions (lines 679, 733, 773)
- `src/components/editor/Editor.tsx` - Store subscription and full doc replacement (lines 276-317)
- `src/hooks/useEditorFileContent.ts` - Syncs query data to store (lines 29-46)
- `src/hooks/editor/useEditorActions.ts` - `saveFile()` with query invalidation (line 113)
- `src/lib/editor/extensions/typewriter-mode.ts` - Transaction extender adding scrollIntoView (lines 65-84)

## Background Research

<details>
<summary>How the auto-save -> reload pipeline works</summary>

The auto-save path: user types -> `handleChange` updates `editorContent` in Zustand store -> `scheduleAutoSave()` sets a 2s debounce timer -> timer fires `autoSaveCallback` -> `saveFile(false)` in `useEditorActions.ts`.

`saveFile` writes to disk via `commands.saveMarkdownContent`, then sets `isDirty: false` and calls `queryClient.invalidateQueries({ queryKey: queryKeys.fileContent(...) })`. This triggers a TanStack Query background refetch.

The refetch calls `commands.parseMarkdownContent` which reads the file from disk and parses it via `parse_frontmatter`. The result arrives as new `data` in `useFileContentQuery`. If structurally different from the cached data, `useEditorFileContent`'s effect fires and syncs the content to the Zustand store.

The Editor.tsx subscription (line 276) listens for store changes and compares the new `editorContent` against both the previous store value AND the current CM document. If both comparisons show a difference, it dispatches a full document replacement to CodeMirror.

The typewriter mode transaction extender intercepts ALL transactions with `docChanged` or `selection` changes and adds `EditorView.scrollIntoView(head, { y: 'center' })`, which is the direct cause of the "scrolls to middle" symptom.
</details>

<details>
<summary>Rust lines() behaviour that causes Source B</summary>

Rust's `str::lines()` treats a final `\n` as a line terminator, not as creating a new empty line:

- `"text\n".lines()` -> `["text"]` (1 element, trailing \n dropped)
- `"text\n\n".lines()` -> `["text", ""]` (2 elements, only the LAST \n dropped)
- `"text\n\n\n".lines()` -> `["text", "", ""]` (3 elements, only the LAST \n dropped)

When joined back with `join("\n")`:
- `["text"].join("\n")` -> `"text"` (lost the \n)
- `["text", ""].join("\n")` -> `"text\n"` (lost one \n — had \n\n, got \n)
- `["text", "", ""].join("\n")` -> `"text\n\n"` (lost one \n — had \n\n\n, got \n\n)

The pattern is consistent: `lines()` always drops exactly one trailing `\n`. The fixed compensation code always adds exactly one back, achieving a net-zero loss.
</details>

<details>
<summary>Why the issue appeared between v1.0.10 and v1.0.11</summary>

The trailing newline bugs existed before v1.0.10 — the Rust save/parse code and the auto-save -> query invalidation path didn't change between versions. The frontend changes between versions (editor view ref, Linux font handling, watcher rescan events) don't affect scroll behaviour.

However, CodeMirror was upgraded: `@codemirror/view` 6.39.14->6.40.0, `@codemirror/state` 6.5.4->6.6.0. The most likely explanation is that the CM6 upgrade changed how viewport position is handled during full document replacements, making the scroll disruption visible where it was previously absorbed by CM6's internal viewport management.
</details>
