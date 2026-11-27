# Task: Scrolling, cursor position and moving around the editor

Moving around a document should feel calm and predictable. The editor sometimes jumped: clicking back into it could throw you to the top of the document, toggling modes could move the text, and every scroll the editor made was an instant snap. This task fixed the jumps at their cause and added smooth scrolling modelled on iA Writer, so that anything later that moves the cursor or scrolls the editor behaves well without special handling. How it works now is in "Scrolling and focus" in `docs/developer/editor.md`.

## What right looks like

- Focusing the editor never moves the cursor or the scroll position, however focus got there (a click, closing a dialog, the palette, a toolbar button).
- Toggling a mode never moves the text. The exception is turning typewriter mode on, which centres the cursor line.
- The editor only scrolls when the cursor or selection needs it to: in typewriter mode, whenever the cursor moves to another visual line; otherwise, only when the cursor would be out of view.
- When it does scroll, it scrolls smoothly and quickly, in proportion to the distance, and waits briefly first if the move came from the mouse.

## Findings

### Clicking into the editor when it wasn't focused jumped

What Danny saw: with focus mode toggled from the title bar button (and also the palette and the keyboard shortcut), scrolling down a long document and clicking anywhere jumped back to the start of the document. A large block of text, roughly from where you clicked to about halfway up, ended up selected.

Focus mode wasn't the cause. It looked guilty because toggling it from the title bar button or the palette moved focus out of the editor, so the next click was a click into an unfocused editor. Measured in the dev app with dispatched mouse events, scrolled to 4000px before each click:

| Focus mode | Editor focused before the click | Scroll on mousedown | Result      |
| ---------- | ------------------------------- | ------------------- | ----------- |
| off        | no                              | 4000 → 0            | big range   |
| off        | yes                             | stays 4000          | cursor      |
| on         | no                              | 4000 → 0            | big range   |
| on         | yes                             | stays 4000          | cursor      |

The jump happened on mousedown, so the mouseup landed on different text and CodeMirror read the click as a drag.

**Cause:** WebKit 26 ignores `focus({ preventScroll: true })`: a contenteditable gaining focus scrolls to show its existing DOM selection, wherever that was. CodeMirror works around this since 6.38.5 by recording the scroll position of every ancestor, focusing, and putting them back, but only when the user agent's `Version/` token says Safari 26, and WKWebView's user agent has none. So CodeMirror trusted `preventScroll`.

**Fix:** the macOS window's user agent claims Safari 26 (`tauri.macos.conf.json` only: WebView2 isn't detected as Safari at all, and WebKitGTK's user agent already has the token; see `cross-platform.md`). Nothing else in the app or its dependencies changes behaviour on it. `focusEditor()` now calls `view.focus()`, so every route into the editor gets the workaround, and title bar buttons don't take focus, like toolbar buttons in native Mac apps. Not reported upstream, by choice.

### The editor scrolled in an outer div, not in CodeMirror's scroller

The editor grew to its content's height and `MainEditor`'s `overflow-y-auto` div did the scrolling. There was no recorded reason (searched git history, the completed task docs, GitHub issues and PRs #70, #126 and #174, and the developer docs); it dated from the first session in July 2025. With an outer scroller, CodeMirror only keeps the text still when lines above the view change height while the editor has focus or just after a wheel event, and its focus and snapshot handling only cover its own scroller.

Now `.cm-scroller` scrolls. On a generated 3000-line document of unevenly wrapped paragraphs, scrolling up through estimated lines in 300px steps with focus elsewhere (as dragging the scrollbar does), the old layout jumped 63 to 125px twice in every eight steps; the new one moved exactly 300px each time.

### Focus mode moved the view when its dimming appeared or went

With the cursor mid-document, turning focus mode on (at the first cursor move, when the dimming was first drawn) or off scrolled the view so the cursor line sat at the bottom. Typewriter mode only seemed involved because it moves the cursor. Two causes:

- Focus mode dimmed by wrapping the whole document in marks, so every visible line changed when the dimming appeared or went. While CodeMirror rebuilt them, the content was briefly short enough for WebKit to clamp the scroll position (a temporary `padding-bottom: 20000px` on `.cm-content` made the jumps vanish). Now a class on the content dims every line, and only the cursor's line is decorated. This also fixed focus mode not dimming anything until the cursor moved.
- Its decorations were provided directly, which CodeMirror treats as able to change heights, so it re-estimated the lines they changed on. Focus and copyedit decorations are now provided as functions.

The opacity transition went too: a line fading while its marks changed at once flashed the dimmed text bright.

### Turning typewriter mode off moved the text

Removing typewriter mode's 50vh padding moved the text up by the padding's height, so the centred line jumped to the top. The typewriter plugin now scrolls by however much the padding changes. CodeMirror doesn't correct for padding itself, since its scroll anchor is measured within the content.

## Smooth scrolling, as iA Writer does it

Danny's observations from iA Writer:

- In typewriter mode, when you put the cursor on another line with the mouse, it waits about half a second, then quickly but smoothly scrolls so that line is centred.
- Without the mouse (up and down arrows, Enter, typing to the end of a line), it doesn't wait at all, and it still seems to scroll smoothly, even though it's very fast, as it needs to be.
- Jumping a long way (the command palette's jump to heading, or anything like it) also scrolls smoothly but very quickly.

The rules this suggests, which aren't specific to typewriter mode:

1. Any time the cursor moves to another visual line in a way that needs the view to scroll (in typewriter mode, always; otherwise, only when the cursor isn't visible), scroll smoothly but very quickly to the right place. A one-line scroll should feel immediate and keep up when holding an arrow key or Enter. Bigger jumps take longer in proportion to the distance, so moving from the top of a long document to far down feels almost instant but is still visibly a scroll.
2. If the move came from a mouse click, wait half a second before starting the scroll.

Specific to typewriter mode:

- If the selection spans more than one visual line, centre the selected block rather than the cursor.
- The mouse delay applies here too. Selecting with the keyboard centres straight away; dragging to select only centres the block half a second after the drag ends, since scrolling mid-selection would break it.
- With multiple cursors, typewriter mode centres the main one. Centring between the first and the last might make more sense, but it's unlikely to come up and wasn't worth custom code.

### What was built

- **Research:** CodeMirror won't animate scrolling ("Smooth scrolling isn't something the library will do for you"). `EditorView.scrollHandler` (6.26) exists for taking over scroll-into-view, and nobody had published an animated one. The Obsidian typewriter plugin doesn't animate, and ignores mouse selections rather than delaying them.
- **CSS `scroll-behavior: smooth` was tried first and doesn't work:** WebKit then animates CodeMirror's own height corrections too, and the drift test showed jumps of 38px and 132px in two of four runs. It also can't make long jumps almost instant, since WebKit chooses the duration.
- **`extensions/smooth-scroll.ts`:** a `scrollHandler` takes every scroll target and animates `.cm-scroller` towards it in a frame loop that only runs while it's moving. Each frame reads the target afresh (exact if drawn, else `lineBlockAt`'s estimate) and covers the share of the remaining distance the easing curve gives it, so it arrives exactly on time. About 80ms for a line, at most 250ms; a jump longer than two screens moves instantly to one screen away first. It stops when you scroll yourself or edit, a file load scrolls instantly, and Reduce Motion turns it off.
- **Things that didn't work:** reading layout in the handler itself (CodeMirror calls it while writing to the DOM, where `coordsAtPos` throws), and moving the scroll position inside CodeMirror's measure cycle (its loop keeps using the position it read at the start, so long jumps went wrong).
- **Typewriter mode** centres `selection.main`, so a multi-line selection is centred as a block, and centres a mouse selection 500ms after mouseup, cancelled by any keyboard movement.

## Testing notes

The dev app was driven with `bun run app`, using scripts kept in the gitignored `docs/tasks-todo/temporary/scroll-tests/`. Things that will matter next time:

- When the dev window is hidden behind others, CodeMirror can wait for an animation frame that never comes, so scrolls don't apply; call `view.measure()` inside `eval`, or bring the window forward. Hidden windows also throttle timers to about 200ms and don't run CSS transitions.
- In a hidden window, WebKit can put a scroll position set from script every frame back to where it was; long smooth-scroll jumps landed wrong there and correctly in the visible window. Judge scrolling in the visible window.
- `app click` scrolls its target into view before sending mousedown and mouseup, so it can't test click-and-scroll bugs; dispatch the mouse events yourself.
- A hot reload can leave the editor with typewriter mode off while the store says on; toggle it with the title bar button. Changes to extensions need `app reload`, since the editor keeps the extension instances it was created with.
- `schemaless/long-scroll-test.md` in the test vault was generated for this (1500 numbered paragraphs of random length, with headings every 40); `bun run reset:testdata` removes it.

## Done

- [x] The macOS window's user agent claims Safari 26, `focusEditor()` calls `view.focus()`, title bar buttons don't take focus
- [x] Focus stays in the editor after the View menu items and the shortcuts (checked by Danny)
- [x] `.cm-scroller` is the scroller; typewriter mode's padding compensation uses it
- [x] Smooth scrolling for every scroll into view
- [x] Typewriter mode centres multi-line selections, and mouse selections after a half-second delay
- [x] Focus mode dims with a class and decorates only the cursor's line
- [x] "Scrolling and focus" in `docs/developer/editor.md`, and the user agent note in `cross-platform.md`
- [ ] ~~Multiple cursors in typewriter mode~~ (skipped: not worth custom code)
