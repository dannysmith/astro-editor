# Editor System

## Overview

The editor is built on **CodeMirror 6** with **Lezer** for parsing. This document explains the mental models and patterns.

**Key insight**: CodeMirror 6 is a "state machine with a view." The `EditorState` is immutable; changes happen through transactions that produce new states. Understanding this unlocks everything else.

**Context7 references**:
- `@codemirror/view` - EditorView, extensions, decorations
- `@codemirror/state` - EditorState, StateField, transactions
- `@lezer/highlight` - Syntax highlighting system

## Syntax Highlighting Pipeline

Syntax highlighting flows through four stages:

```
Parser nodes → styleTags → Tags → HighlightStyle → CSS
```

### Why Custom Markdown Tags?

We define custom tags in `markdownTags.ts` instead of using `@lezer/highlight`'s built-in `tags.*` because:

1. **Fine-grained control**: Separate tags for `heading1` vs `heading2` vs `headingMark`
2. **Mark styling**: Distinct styling for syntax characters (`*`, `#`, `` ` ``) vs content

The pipeline:
- `markdownTags.ts` - Defines ~30 custom tags via `Tag.define()`
- `styleExtension.ts` - Maps Lezer parser nodes to our tags via `styleTags()`
- `highlightStyle.ts` - Maps tags to CSS properties via `HighlightStyle.define()`

### The @lezer/highlight 1.2.2 Workaround

**Critical institutional knowledge**: A behavior change in `@lezer/highlight` 1.2.2 broke our contextual styling.

**What changed**: When custom `styleTags` are added to nodes that already have rules, old rules are now preserved and checked **first**.

**The problem**: `@lezer/markdown`'s built-in highlighting maps all marks to `tags.processingInstruction`:
```javascript
// Built-in rule (checked first after 1.2.2)
"HeaderMark HardBreak QuoteMark ListMark LinkMark EmphasisMark CodeMark": tags.processingInstruction
```

Our contextual rules like `'ATXHeading1/HeaderMark': markdownTags.headingMark` never fire because the unconditional built-in rule matches first.

**The fix**: `syntax-mark-decorations.ts` bypasses the highlight system entirely for marks that need special treatment. It walks the syntax tree and applies decorations directly:
- `HeaderMark` inside `ATXHeading` → `.cm-heading-mark`
- `EmphasisMark` inside `Emphasis` → `.cm-emphasis-mark`
- `EmphasisMark` inside `StrongEmphasis` → `.cm-strong-mark`

These classes are styled in `theme.ts` with `inherit !important` rules to override the inner highlight spans.

## Extension Patterns

We use two CodeMirror extension patterns:

### StateField (Document-Based)

Use for decorations that depend on document content. Rebuilds when document changes.

```typescript
// Pattern used by: hanging-headers, code-block-background, syntax-mark-decorations
export const myExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state)
  },
  update(decorations, tr) {
    if (tr.docChanged) {
      return buildDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },
  provide: f => EditorView.decorations.from(f),
})
```

### ViewPlugin (Viewport/Lifecycle)

Use for decorations that depend on viewport, external state, or need lifecycle hooks.

```typescript
// Pattern used by: url-hover (responds to Alt key state)
export const myPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { /* ... */ }
    update(update: ViewUpdate) { /* ... */ }
  },
  { decorations: v => v.decorations }
)
```

### Our Extensions

| Extension | Pattern | Purpose |
|-----------|---------|---------|
| `hanging-headers` | StateField | Line classes for hanging indent styling |
| `code-block-background` | StateField | Background color on fenced code blocks |
| `syntax-mark-decorations` | StateField | Mark styling workaround (see above) |
| `blockquote-style` | StateField | Line classes for blockquote styling |
| `focus-mode` | StateField | Dims text outside current sentence |
| `copyedit-mode` | StateField + ViewPlugin | Parts-of-speech highlighting |
| `url-hover` (plugin.ts) | ViewPlugin | Alt+Click URL decoration |

Each extension has a header comment explaining its purpose—read those for implementation details.

### When to Create a New Extension

**Create new extension when**:
- Visual effect applies to specific syntax nodes (use StateField)
- Feature needs viewport awareness or external state (use ViewPlugin)
- Behavior is toggleable and self-contained

**Add to existing extension when**:
- Extending similar functionality (e.g., another mark type to `syntax-mark-decorations`)
- Shared state or logic

## React Integration

We manage `EditorView` manually rather than using a React wrapper library. This gives us full control but requires careful state synchronization.

### Key Patterns in Editor.tsx

**1. Single initialization**: EditorView is created once in a `useEffect` with empty deps. Extensions are passed at creation time.

**2. Programmatic update flag**: When updating editor content from React (e.g., file load), we set `isProgrammaticUpdate.current = true` to prevent the update listener from treating it as user input.

**3. Zustand subscription**: We subscribe to store changes directly (not via hook) to update the editor without causing React re-renders:
```typescript
useEditorStore.subscribe(state => {
  if (viewRef.current && state.editorContent !== currentContent) {
    // Update editor...
  }
})
```

**4. State effects for mode toggles**: Focus mode, Alt key state, etc. are toggled via `dispatch({ effects: [...] })`.

**5. Memoization**: The component is wrapped in `React.memo` with a custom comparator that always returns `true`—we manage updates ourselves.

## File Structure

```
src/lib/editor/
├── index.ts                 # Public API exports
├── syntax/
│   ├── markdownTags.ts      # Custom tag definitions
│   ├── styleExtension.ts    # Parser node → tag mapping
│   └── highlightStyle.ts    # Tag → CSS mapping
├── extensions/
│   ├── createExtensions.ts  # Extension factory (entry point)
│   ├── keymap.ts            # Keyboard shortcuts
│   ├── theme.ts             # Editor CSS theming
│   ├── focus-mode.ts        # Focus mode (sentence dimming)
│   ├── hanging-headers.ts   # Hanging indent for headings
│   ├── code-block-background.ts
│   ├── blockquote-style.ts
│   ├── syntax-mark-decorations.ts  # Mark styling workaround
│   └── copyedit-mode/       # POS highlighting (multi-file)
├── markdown/
│   ├── formatting.ts        # Bold, italic, etc.
│   └── headings.ts          # Heading level changes
├── urls/
│   ├── plugin.ts            # Alt+Click URL hover
│   ├── detection.ts         # URL regex matching
│   └── handlers.ts          # URL click handling
├── paste/                   # Paste event handling
├── dragdrop/                # File drag-and-drop
└── commands/                # Command registry integration
```

## Related Documentation

- **[editor-styles.md](./editor-styles.md)** - CSS color palette and typography specs
- **[command-system.md](./command-system.md)** - Command pattern and editor commands
- **[keyboard-shortcuts.md](./keyboard-shortcuts.md)** - Shortcut implementation
- **[performance-patterns.md](./performance-patterns.md)** - React/Zustand optimization

---

**Remember**: The header comments in each extension file explain the "what" and "why" for that specific file. This document provides the mental models to understand how they fit together.
