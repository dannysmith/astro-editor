# Typewriter Mode

## Goal

Implement a typewriter scrolling mode that keeps the line currently being typed/edited vertically centred in the editor viewport at all times, mimicking the behaviour of iA Writer's typewriter mode.

## Requirements

### Core Behaviour

- The **visual line** containing the cursor must always be at the **vertical centre** of the editor viewport
- This applies whether the cursor moved because the user:
  - Typed a character (including when a long line wraps to a new visual line)
  - Pressed Enter, arrow keys, Home/End, Page Up/Down
  - Clicked anywhere in the document
  - Used Find & Replace or any other navigation

### Edge Cases: Empty Space / Padding

- When the cursor is on the **first line** (or any line near enough to the top of the doc that there isn't enough content above it), there must be empty space above it to push it to the centre
- When the cursor is on the **last line** (or any line near enough to the bottom of the doc that there isn't enough content below it), there must be empty space below it to keep it centred
- An **empty file** needs both top and bottom padding so the cursor sits in the middle
- Clicking the empty padding regions should:
  - **Above content**: place cursor at the start of the first line
  - **Below content**: place cursor at the end of the last line
- This padding is not real document content - it's visual-only

### Scrolling

- Manual scrolling must work normally (user can freely scroll through long documents)
- After manual scrolling, the next cursor movement should re-centre
- Scrolling should be smooth, not jarring/jumpy

### Resilience

- Must handle **window resizing** (vertical) gracefully - re-centre after resize
- Must handle **font size changes** (the editor uses responsive typography via container queries that change font-size/line-height at different widths)
- Must handle **panel toggles** (sidebar, frontmatter panel) that change the editor's available width/height

### Non-Interference

- All existing editor features must work identically whether typewriter mode is on or off:
  - Focus mode (sentence dimming)
  - Copyedit mode (highlighting various things)
  - Markdown formatting commands (bold, italic, headings, etc.)
  - URL clicking, drag & drop
  - Keyboard shortcuts
  - Auto-save
  - Find & Replace
  - Multiple cursors

### Toggle

- Typewriter mode should be toggleable (command palette, keyboard shortcut etc)
- When toggled off, editor returns to normal scroll behaviour
- When toggled on mid-editing, smoothly transition to centred position

## Codebase Context

### Editor Architecture

The editor is built on **CodeMirror 6** with a manual React integration (no wrapper library). Key files:

- **`src/components/editor/Editor.tsx`** - Main component. Creates `EditorView` once in a `useEffect`. Manages programmatic updates, Alt key state, typing detection, and Tauri event listeners. Wrapped in `React.memo` with custom comparator.
- **`src/lib/editor/extensions/createExtensions.ts`** - Extension factory. Assembles all CM6 extensions in categories: core, language, keymaps, event handlers, writing modes, visual enhancements, theme.
- **`src/lib/editor/extensions/theme.ts`** - Editor theme via `EditorView.theme()`. Defines styling for `.cm-content`, `.cm-scroller`, `.cm-cursor`, `.cm-line`, etc.
- **`src/components/editor/Editor.css`** - CSS variables (colours, typography, responsive breakpoints), container queries, focus mode dimming, hanging headers, blockquote styling.

### Current Scroll-Related Configuration

- `.cm-content` has `padding: 40px 0` (top/bottom) and `minHeight: calc(100vh - 44px)` (viewport minus titlebar)
- `.cm-scroller` has no special scroll configuration
- `EditorView.lineWrapping` is enabled
- No existing scroll-centering, `scrollIntoView`, or typewriter code exists
- The editor container (`.editor-view`) has `padding: 0 24px` set inline

### Existing Writing Mode Pattern (Focus Mode)

Focus mode (`src/lib/editor/extensions/focus-mode.ts`) is the closest existing pattern:
- Uses `StateEffect` for toggling (`toggleFocusMode`)
- Uses `StateField` for tracking state (enabled + current sentence boundaries)
- Uses `StateField` with `provide: f => EditorView.decorations.from(f)` for visual decorations
- Includes a `ViewPlugin` shell (currently minimal)
- CSS transitions for smooth visual changes

### Responsive Typography

The editor uses CSS container queries on `.editor-view` (container name: `editor`) with 5 breakpoints that change `--editor-font-size`, `--editor-line-height`, and `--editor-content-max-width`. Any typewriter mode implementation must handle these dynamic changes.

### Preferences System

User preferences are managed through a three-tier system (see `docs/developer/preferences-system.md`). Typewriter mode toggle should integrate with existing preferences.

## Research Findings

### CSS-Only: Not Viable

Investigated CSS scroll-snap, scroll-state container queries, and scroll-padding as potential pure-CSS solutions:

- **`scroll-snap`** - Designed for snapping to predefined positions (carousels), not continuous cursor-following. Wrong paradigm.
- **`scroll-padding`** - Safari/WebKit bug (filed 2017, still open) where it only works inside scroll-snap containers. Since Tauri uses WebKit on macOS, this is a dealbreaker.
- **CSS scroll-state container queries** - Too new (Chrome 133+, no Safari/WebKit support). Not viable for Tauri.

**Conclusion:** JavaScript is required. CSS cannot implement typewriter mode.

### CodeMirror 6 API Options

#### Option 1: `scrollIntoView` with `y: "center"` (Simplest)

CM6 has a built-in scroll effect: `EditorView.scrollIntoView(pos, { y: "center" })`. Dispatched as a transaction effect. Simplest to implement but gives no control over animation, timing, or conflict resolution with user scrolling. Just snaps instantly.

#### Option 2: ViewPlugin (Most Precedent in Our Codebase)

A `ViewPlugin.fromClass()` monitoring `update.selectionSet`, using `view.coordsAtPos()` for cursor Y position and `scrollDOM.scrollTo()` to centre. More control but fires *after* DOM update, causing an extra reflow.

**Gotcha:** `coordsAtPos()` returns scrolled position (viewport-relative), not absolute. Must add `scrollDOM.scrollTop`.

#### Option 3: Transaction Extender (CM6 Maintainer Recommended)

`EditorState.transactionExtender` adds `scrollIntoView` effects to transactions *before* they're applied, reducing DOM reflows compared to ViewPlugin. This is what the Obsidian Typewriter Mode plugin uses (the most mature CM6 typewriter implementation).

### Production Reference: Obsidian Typewriter Mode

The [Obsidian Typewriter Mode plugin](https://github.com/davisriedel/obsidian-typewriter-mode) is the most complete production CM6 implementation. Key lessons:

- **User vs automatic scroll conflict** is the hardest problem. Uses `onWheel` event listeners to detect user-initiated scrolling and temporarily suppresses auto-centering.
- **Performance**: Fixed jankiness by only updating when cursor *actually moves*, not on a timer.
- **Edge cases**: Zoom levels can cause bouncing/jankiness (Scrivener has same issue at 110% zoom).

### Padding for First/Last Line Centering

For the requirement that first/last lines sit in the centre (empty space above/below):

- CM6's `.cm-content` already has `padding: 40px 0`. This can be made dynamic (~`viewportHeight / 2`) when typewriter mode is active.
- Alternative: use `EditorView.contentAttributes` to set padding.
- The padding areas need click handlers to place cursor at doc start/end.
- **Risk**: Dynamic padding changes could feel janky if not carefully managed. Needs testing.

### Smooth Scrolling

- `requestAnimationFrame` with easing (easeOutCubic) and short duration (100-200ms)
- Must handle cancellation when new cursor movement happens mid-animation
- Must not conflict with browser native smooth scrolling
- The Obsidian plugin handles this by suppressing auto-scroll during detected `onWheel` events

### Key Pitfalls

1. **Jankiness** from fighting between user scroll events and programmatic scrolling
2. **Excessive DOM reflows** from scroll calculations on every keystroke
3. **`coordsAtPos()` returning viewport-relative coords** (common mistake)
4. **Smooth scrolling conflicts** - browser native smooth scroll + our animation = double-scroll
5. **Dynamic padding causing layout shifts** if not carefully timed

## Approach Decision

**Scroll mechanism:** Start with Option 1 (`scrollIntoView` with `y: "center"`) to validate the basic behaviour. If it's insufficient (likely - no animation control, no user-scroll conflict handling), move to Option 3 (transaction extender), which is recommended by the CM6 maintainer and battle-tested in Obsidian.

**Smooth scrolling:** Yes - needed for good UX. Short `requestAnimationFrame` animation with easing.

**Padding:** Dynamic `.cm-content` padding (simplest approach). Needs careful testing to avoid jankiness - the concern is that changing padding values could cause visible layout shifts. If it does feel janky, we'll explore alternatives.

## Implementation Plan

_To be decided after exploring Option 1 and confirming approach._
