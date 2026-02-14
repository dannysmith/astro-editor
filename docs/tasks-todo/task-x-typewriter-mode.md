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

### CSS-Only: Exhaustively Investigated, Not Viable

Every modern CSS scroll feature was evaluated (as of Jan 2026):

| CSS Feature | Why It Can't Work | Safari/WebKit Status |
|---|---|---|
| `scroll-snap` | Designed for carousels, not cursor-following. `proximity` mode unreliable; `mandatory` fights normal scrolling. Doesn't re-snap on programmatic target changes. | Supported but quirky |
| `scroll-padding` / `scroll-margin` | Only influences positioning when scrolling is triggered by something else. Cannot initiate scrolling. Safari only respects these inside scroll-snap containers (bug filed 2017, still open). | Broken outside snap containers |
| Scroll-Driven Animations | Causality reversed: these respond to scroll position, they don't cause it. | Safari 26+ only (not Sequoia) |
| CSS Anchor Positioning | Controls layout position of floating elements, not scroll position. | Safari 26+ only (not Sequoia) |
| `scroll-state()` queries | Styling only, cannot trigger scroll actions. | Not in Safari or Firefox at all |
| `:has()` + scroll-margin | CM6 cursor isn't native DOM focus, so `:has(:focus-within)` can't target the active line. Even if it could, CSS can't trigger scrolling. | `:has()` supported, but approach non-viable |
| `scroll-start` / `scroll-start-target` | Initial layout only, doesn't respond to dynamic changes. | Chrome 129+ only |

**Fundamental limitation:** CSS has no mechanism to say "scroll this container so element X is centred." Every CSS scroll feature either responds to scrolling, requires user scroll gestures to trigger, or only influences positioning when scrolling happens via another mechanism.

**Conclusion:** JavaScript is required. However, the JS footprint is small (~20-30 lines of CM6 extension code) and works with CM6's designed-for-this-purpose APIs rather than fighting the editor.

### CodeMirror 6 API Options

#### Option 1: `scrollIntoView` with `y: "center"` (Simplest)

CM6 has a built-in scroll effect: `EditorView.scrollIntoView(pos, { y: "center" })`. Dispatched as a transaction effect. Simplest to implement but gives no control over animation, timing, or conflict resolution with user scrolling. Just snaps instantly.

#### Option 2: ViewPlugin with `requestMeasure` (CM6 Forum Pattern)

A `ViewPlugin.fromClass()` that intercepts transactions with `scrollIntoView`, then uses `view.requestMeasure()` to read cursor coords and write a scroll adjustment. Batches DOM reads/writes properly.

**Gotcha:** `coordsAtPos()` returns scrolled position (viewport-relative), not absolute. Must add `scrollDOM.scrollTop`.

#### Option 3: Transaction Extender (CM6 Maintainer Recommended)

`EditorState.transactionExtender` adds `scrollIntoView` effects to transactions *before* they're applied, reducing DOM reflows compared to ViewPlugin. Recommended by marijn (CM6 creator). Battle-tested in Obsidian Typewriter Mode plugin.

### Production Reference: Obsidian Typewriter Mode

The [Obsidian Typewriter Mode plugin](https://github.com/davisriedel/obsidian-typewriter-mode) (also the older [cm-typewriter-scroll-obsidian](https://github.com/deathau/cm-typewriter-scroll-obsidian)) is the most complete production CM6 implementation. Architecture has 3 components:

1. **Padding Plugin**: Adds dynamic `paddingTop`/`paddingBottom` to `.cm-content` so first/last lines can reach centre
2. **Scroll Plugin**: ViewPlugin that monitors transactions for cursor moves and dispatches `EditorView.scrollIntoView(head, { y: 'start', yMargin: offset })` inside `requestAnimationFrame`
3. **Offset Facet**: Configurable 0-1 value (0.5 = centre) controlling where on screen the cursor sits

Key lessons:
- **User vs automatic scroll conflict** is the hardest problem. Uses `onWheel` to detect user scrolling and temporarily suppresses auto-centering.
- **Performance**: Fixed jankiness by only updating when cursor *actually moves*, not on a timer.
- **`requestAnimationFrame` required**: CM6 doesn't allow dispatching transactions during `update()`, so rAF is needed.

### Padding for First/Last Line Centering

Two approaches:

1. **`EditorView.scrollMargins` facet** (preferred): CM6's built-in mechanism for adding virtual scroll margins. CM6 accounts for these in its viewport calculations - no layout shifts, no jank. Set `top` and `bottom` to ~`viewportHeight / 2`.
2. **Dynamic `.cm-content` padding**: Simpler but riskier - padding changes could cause layout shifts. The Obsidian plugin uses this approach.

Both need click handlers on the padding regions to place cursor at doc start/end.

### Smooth Scrolling Options

- **CSS `scroll-behavior: smooth`** on `.cm-scroller`: Simple, browser-native. But no control over duration/easing, and could conflict with CM6's own scroll management.
- **`requestAnimationFrame` animation** with easing: Full control over duration (100-200ms) and easing. Must handle cancellation when new cursor movement happens mid-animation.
- **`scrollDOM.scrollTo({ behavior: 'smooth' })`**: Browser-native smooth scrolling via JS. Well-supported (Safari 14+). Less control than rAF but simpler.

### Key Pitfalls

1. **Jankiness** from fighting between user scroll events and programmatic scrolling
2. **Excessive DOM reflows** from scroll calculations on every keystroke
3. **`coordsAtPos()` returning viewport-relative coords** (common mistake - must add `scrollTop`)
4. **Smooth scrolling conflicts** - browser native smooth scroll + our animation = double-scroll
5. **CM6 prohibits dispatching during `update()`** - must use `requestAnimationFrame`

## Approach Decision

**Scroll mechanism:** ViewPlugin with `requestMeasure` (Option 2). This gives us proper DOM read/write batching, works with CM6's scroll system, and follows the pattern recommended on the CM6 forum. If we find it's causing extra reflows, we can refactor to a transaction extender (Option 3).

**Smooth scrolling:** `scrollDOM.scrollTo({ behavior: 'smooth' })` for simplicity. If the browser-native smoothing feels wrong, we can switch to rAF animation.

**Padding:** `EditorView.scrollMargins` facet (CM6's built-in mechanism). Cleaner than dynamic CSS padding - CM6 accounts for these in viewport calculations automatically.

**Toggle:** `StateEffect` + `StateField` pattern (same as focus mode). Integrate with preferences system and command palette.

## Implementation Plan

_See below._
