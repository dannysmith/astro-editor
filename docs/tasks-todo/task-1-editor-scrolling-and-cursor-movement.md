# Task: Scrolling, cursor position and moving around the editor

Moving around a document should feel calm and predictable. Today the editor sometimes jumps: clicking back into it can throw you to the top of the document, toggling modes can move the text, and every scroll the editor makes is an instant snap. This task fixes the jumps at their cause and adds smooth scrolling modelled on iA Writer, so that anything we build later that moves the cursor or scrolls the editor behaves well without special handling.

## What right looks like

- Focusing the editor never moves the cursor or the scroll position, however focus got there (a click, closing a dialog, the palette, a toolbar button).
- Toggling a mode never moves the text. The exception is turning typewriter mode on, which centres the cursor line.
- The editor only scrolls when the cursor or selection needs it to: in typewriter mode, whenever the cursor moves to another visual line; otherwise, only when the cursor would be out of view.
- When it does scroll, it scrolls smoothly and quickly, in proportion to the distance, and waits briefly first if the move came from the mouse.

## Findings so far

### Clicking into the editor when it isn't focused jumps (cause found)

What Danny saw: with focus mode toggled from the title bar button (and also the palette and the keyboard shortcut), scrolling down a long document and clicking anywhere jumps back to the start of the document. A large block of text, roughly from where you clicked to about halfway up, ends up selected. Turning focus mode off also scrolled the view up a little.

Focus mode isn't the cause. It only adds decorations that dim text, and it never scrolls or moves focus. It looked guilty because toggling it from the title bar button or the palette moves focus out of the editor, so the next click is a click into an unfocused editor. Measured in the dev app with dispatched mouse events (`click-matrix.js`, see Testing), scrolled to 4000px before each click:

| Focus mode | Editor focused before the click | Scroll on mousedown | Result      |
| ---------- | ------------------------------- | ------------------- | ----------- |
| off        | no                              | 4000 → 0            | big range   |
| off        | yes                             | stays 4000          | cursor      |
| on         | no                              | 4000 → 0            | big range   |
| on         | yes                             | stays 4000          | cursor      |

The jump happens on mousedown, so the mouseup lands on different text and CodeMirror reads the click as a drag, which is the stray selection.

**Cause:** WebKit in Safari 26 ignores `focus({ preventScroll: true })`. When a contenteditable gains focus it scrolls to show its existing DOM selection, wherever that was (the start of the document, or wherever the cursor was before focus left). CodeMirror knows about this: since 6.38.5 it skips `preventScroll` on Safari 26 and instead records the scroll position of every ancestor, focuses, and puts them back (`focusPreventScroll` in `@codemirror/view`). It decides it's on Safari 26 from the `Version/26` token in the user agent, and our WKWebView's user agent has none: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)`. So `browser.safari_version` is 0 and CodeMirror trusts `preventScroll`. Checked in the dev app (`prevent-scroll.js`): focusing the content with `preventScroll` from 4000px went to 0, while recording and restoring the ancestors' positions kept 4000. CodeMirror's fallback restores every ancestor, so it works with our outer scroll container too (see the next finding). Nothing else in CodeMirror reads `safari_version`, and the app doesn't read the user agent at all (only `navigator.platform`, for diagnostics).

**Fix options:**

1. Give the window a user agent that includes `Version/26.0 Safari/605.1.15` (`userAgent` in the window config in `tauri.conf.json`), so CodeMirror's own workaround applies. The fallback works on every WebKit, so claiming 26 on an older macOS costs nothing. It's one line of config and relies entirely on CodeMirror's work. The risk is anything else that sniffs the user agent, which today is nothing we know of.
2. Report it upstream: CodeMirror's version detection can't see WKWebView, whose user agent has no `Version/` token and a frozen WebKit version. Feature detection, or treating an Apple vendor without a `Version/` token as current, would fix it for every WKWebView app. Worth doing whatever we choose (ask Danny before filing).
3. Our own focus handler that records and restores the scroll container's position. Duplicates CodeMirror; only if 1 turns out to be a problem.

Related: `focusEditor()` in `src/lib/focus-utils.ts` calls `.cm-content`'s `focus({ preventScroll: true })` directly. It should call `view.focus()` (via `getCurrentEditorView()`), which goes through CodeMirror's `focusPreventScroll` and so gets the same fix.

### The toggles leave focus in different places

The four ways to toggle focus and typewriter mode run the same store action, but focus ends up in different places:

- **Title bar buttons:** clicking one moves focus to the button, so the editor loses focus and the next click into it goes through the bug above. Toolbar buttons in native Mac apps don't take focus. Preventing focus on mousedown for these buttons would make them behave like the shortcut: the cursor stays put and you can keep typing.
- **Command palette:** focus moves to the palette and comes back through `focusEditorDelayed()` (100ms later) when it closes.
- **Cmd+Shift+F / Cmd+Shift+T:** handled in the editor's keymap, so focus stays in the editor. Danny saw the jump after using the shortcut too, so check whether it reaches us through the native View menu and whether that briefly takes focus from the webview.
- **View menu:** native; check what happens to focus.

After fixing the focus bug, recheck Danny's "turning focus mode off scrolls up a little" separately, in case it has another cause.

### The editor scrolls in an outer div, not in CodeMirror's scroller

The editor grows to the full height of its content (`.cm-content` has `minHeight: calc(100vh - 44px)`), and `MainEditor`'s outer `overflow-y-auto` div does the scrolling. `.cm-scroller` (CodeMirror's `scrollDOM`) never scrolls. It's been like this since the first session in July 2025.

There's no recorded reason. Searched: git history of `MainEditor.tsx`, `theme.ts` and `Editor.css`; every completed task doc mentioning scrolling, scrollbars or `cm-scroller`; GitHub issues and PRs about scrolling (#70 light scrollbars in dark mode, #174 the auto-save scroll jump, #126 typewriter mode); the developer docs. Typewriter mode (#126) only added `no-scrollbar` to the outer div, and its task doc assumed `scrollDOM` was the scroller ("must add `scrollDOM.scrollTop`"). Danny remembers there being a reason: possibly typewriter mode, the scrollbar's position, the feel of scrolling, or how off-screen content is handled. CodeMirror only renders the visible lines either way, since it works out what's visible from the nearest scrolling ancestor.

CodeMirror supports an outer scroller, but several of its protections are weaker or absent with one:

- **Height stabilisation.** When lines above the view change height (estimated heights replaced by measured ones, wrapped lines re-measured), CodeMirror adjusts the scroll position so the text doesn't move. For an outer scroller it only does this while the editor has focus or just after a wheel or touch event (`scroll == this.scrollDOM || this.hasFocus || …` in `measure`). With focus on a title bar button, those corrections don't happen.
- **Focus.** Its `focus` observer resets a scroll position that focusing reset to 0, but only for `scrollDOM`.
- **`EditorView.scrollSnapshot()`** and the `isSnapshot` scroll targets read and write `scrollDOM` only.
- Our own code has to find the real scroller (`scrollContainer()` in `typewriter-mode.ts`, added when fixing the typewriter toggle).

Switching would mean: the outer div stops scrolling and the editor fills it with a fixed height; the 24px side padding (`.editor-view`) moves inside the scroller so the scrollbar stays at the edge of the pane; typewriter's `no-scrollbar` moves to `.cm-scroller`; the `minHeight` calc goes; check clicks in the margins beside the 65ch column, the click below the last line, `ImagePreview` positioning, drag and drop, and the load error view that shares the container. `scrollContainer()` keeps working, since it would then find `.cm-scroller`.

Since the click jump isn't caused by this, it's a separate decision. Make it by trying it: switch on a scratch commit and run the same tests (the click matrix, typewriter on and off, jump to heading, focus mode toggles, wrapped long paragraphs) before and after.

### Turning typewriter mode off moved the text (fixed)

Removing typewriter mode's 50vh padding moved the text up by the padding's height, so the centred line jumped to the top. Fixed on main (`a9273cd9`): the typewriter plugin scrolls the container by however much the padding changes. Near the start or end of a document the text still moves, because the space it was centred in goes away.

## Smooth scrolling, as iA Writer does it

Danny's observations from iA Writer, which is a good implementation to emulate:

- In typewriter mode, when you put the cursor on another line with the mouse, it waits about half a second, then quickly but smoothly scrolls so that line is centred.
- Without the mouse (up and down arrows, Enter, typing to the end of a line), it doesn't wait at all, and it still seems to scroll smoothly, even though it's very fast, as it needs to be.
- Jumping a long way (the command palette's jump to heading, or anything like it) also scrolls smoothly but very quickly.

The rules this suggests, which aren't specific to typewriter mode:

1. Any time the cursor moves to another visual line in a way that needs the view to scroll (in typewriter mode, always; otherwise, only when the cursor isn't visible), scroll smoothly but very quickly to the right place. A one-line scroll should feel immediate and keep up when holding an arrow key or Enter. Bigger jumps take longer in proportion to the distance, so in a long document, moving the cursor from the top to far down (jump to heading, Cmd+Down) feels almost instant but is still visibly a scroll.
2. If the move came from a mouse click, wait half a second before starting the scroll.

Specific to typewriter mode:

- If the selection spans more than one visual line, centre the selected block rather than the cursor.
- The mouse delay applies here too. Selecting with the keyboard centres straight away. Dragging to select with the mouse works as it does anywhere else, and only scrolls to centre the block half a second after the drag ends. This is probably why iA Writer waits after mouse input at all: scrolling mid-selection would break the selection.
- Aside: with multiple cursors, typewriter mode centres the last one. Treating them like a selection and centring between the first and the last might make more sense. Unlikely to come up, and not worth custom code; only do it if it falls out of the selection handling for free.

### How it works today

- Every scroll is CodeMirror's instant `scrollIntoView`.
- Typewriter mode's transaction extender adds `scrollIntoView(head, { y: 'center' })` to every transaction that moves the selection or changes the document, so it centres the cursor (`head`), not the selection.
- For mouse selections it waits for mouseup, then a frame, then centres. Double-click to select a word can still scroll mid-selection and disturb it (noted in the auto-save scroll jump task, never fixed). A half-second delay would fix this too.
- Outside typewriter mode, CodeMirror scrolls only when the cursor leaves the view (`nearest`, with `cursorScrollMargin` of 5px).

### Approach to investigate

- **`EditorView.scrollHandler`** (since `@codemirror/view` 6.26; we have 6.43.15): a facet whose functions get every scroll-into-view target (the range and its `x`/`y` strategy and margins) and can handle it themselves by returning `true`. A smooth-scroll handler here would cover cursor movement, typewriter centring, jump to heading, search and anything we add later, in one place, without fighting CodeMirror's scroll system (which the typewriter task found direct `scrollTo` calls do). It would work out the target scroll position like `scrollRectIntoView` does, then animate the real scroller over a duration based on the distance. Snapshot targets (`isSnapshot`) bypass handlers, as they should.
- Handlers run during CodeMirror's measure phase and "should never initiate editor updates", so the animation only sets scroll positions. CodeMirror follows scroll events to update what it renders. Check that a long jump into unrendered text lands exactly, since heights there are estimates until they're drawn; this may need a correction at the end of the animation.
- A wheel or trackpad scroll by the user should cancel a running animation.
- Consider macOS Reduce Motion (`prefers-reduced-motion`): scroll instantly when it's on.
- **Centring a selection:** CodeMirror's default handling already uses the rectangle covering a range's anchor and head when the target is a non-empty range, falling back to the head when that's taller than the view. Passing `selection.main` instead of `selection.main.head` from the typewriter extender may be all it needs, if the scroll handler keeps that behaviour.
- **Mouse delay:** replace the mouseup-and-frame logic in the typewriter plugin with a half-second timer started by pointer selections, restarted while a drag continues and cancelled by keyboard movement. Decide whether the delay belongs in the shared scroll handler (rule 2 applies outside typewriter mode too) or in typewriter mode.
- Research first: CodeMirror forum threads on smooth scrolling and `scrollHandler`, and how others have done it (the Obsidian typewriter plugin is one reference). The typewriter task doc in `docs/tasks-done/task-2026-02-15-typewriter-mode.md` has notes on smooth-scrolling options from before `scrollHandler` was considered; useful background, but don't lean on it.

## Testing

- `bun run app` drives the dev app. Scripts from this investigation are in `docs/tasks-todo/temporary/scroll-tests/` (gitignored), run with `bun run --silent app eval "$(cat <file>)"`:
  - `click-matrix.js`: the four-way click test above, with dispatched mouse events
  - `prevent-scroll.js`: `preventScroll` versus recording and restoring scroll positions
  - `measure-cursor.js`: the scroll position and where the cursor line sits in the view
  - `focus-mode-drift.js`: how far the cursor line moves when focus mode is toggled, with the editor focused or not
- Gotchas found doing this:
  - When the dev window is hidden behind others, CodeMirror can wait for an animation frame that never comes, so scrolls don't apply. Call `view.measure()` (import `getCurrentEditorView` from `/src/lib/editor/editor-view-ref.ts` inside `eval`), or bring the window to the front.
  - `app click` scrolls its target into view before sending mousedown and mouseup, so it can't test click-and-scroll bugs. Dispatch the mouse events yourself, as `click-matrix.js` does.
  - A hot reload can remount the editor with typewriter mode off while the store says on. Toggle it with the title bar button to resync.
- Smooth scrolling and the mouse delay have to be judged by feel in the real app by Danny. Measurements only confirm where things end up.

## Plan

### Phase 1: focus never moves the editor

- [x] Set the window's user agent so CodeMirror detects Safari 26 (`tauri.macos.conf.json` only; see `cross-platform.md`). `click-matrix.js` now keeps 4000px and leaves a cursor in all four cases
- [x] `focusEditor()` calls `view.focus()`. Focusing it with the old selection at the start of the document and the view at 4000px keeps 4000px
- [x] Title bar buttons don't take focus: the toolbar cancels mousedown on any button in it, so clicks still work and the bar still drags the window
- [ ] Danny: check focus stays in the editor after the View menu items and the shortcuts (native menus can't be driven from the bridge)
- [x] Recheck "turning focus mode off scrolls up a little": `focus-mode-drift.js` shows no movement with the editor focused or not, so it was most likely the focus jump when coming back to the editor
- [ ] Ask Danny about reporting the WKWebView detection gap to CodeMirror

### Phase 2: which element scrolls

- [x] Try making `.cm-scroller` the scroller and run the tests before and after
- [ ] Danny: try it in the real app (scrolling with the trackpad and the scrollbar, the margins beside the text, typewriter mode) and decide
- [ ] If adopted: simplify `scrollContainer()` in `typewriter-mode.ts` to `view.scrollDOM`, and remove the generic scroller lookup from the test scripts

What the experiment changes: `MainEditor`'s container no longer scrolls (`min-h-0 flex-1 overflow-hidden`); `.editor-view`, `.editor-codemirror` and `.cm-editor` fill it; the 24px side padding moved from `.editor-view` onto `.cm-scroller`, so the scrollbar stays at the pane's edge and the margins still scroll the text; `.cm-content`'s minimum height is `100%` of the editor instead of `calc(100vh - 44px)`; typewriter mode hides the scrollbar on `.cm-scroller` instead of the container.

Results, with the same scripts on both layouts:

- **Height stabilisation** (`scroll-up-drift.js` on a 3000-line document of unevenly wrapped paragraphs, `schemaless/long-scroll-test.md` in the test vault, generated): scrolling up in 300px steps without wheel events and with focus outside the editor, the line at the top of the view should move exactly 300px per step. Old layout, three runs: two jumps per eight steps each time, of 63 to 125px (`394`, `425`, `363`). New layout, three runs: every step 300px (±1px rounding). This is the gap CodeMirror leaves for an outer scroller, and it's what dragging the scrollbar with focus elsewhere would show.
- Unchanged: the click test (all four cases keep 4000px and leave a cursor), typewriter on and off (the line stays at 362px), jump to heading (top normally, centred in typewriter mode), focus mode toggles (no drift), the palette, Cmd+0 and closing the sidebar from a field (scroll and cursor kept, focus in the editor).
- Layout: looks the same in both themes; the editor fills the pane exactly at 1000×700 and 1319×787; a click below the last line of a short document lands in the editor and puts the cursor at the end; the welcome screen is unchanged. Clicks in the margins beside the text don't move the cursor, as before (CodeMirror only handles clicks on its scroller below the content).
- Seen once, not reproduced: CodeMirror logged "Measure loop restarted more than 5 times" a couple of minutes after switching, while the dev server was reloading files. Rerunning every test didn't bring it back. Watch for it.

### Phase 3: smooth scrolling

- [ ] Research `scrollHandler` use and smooth scrolling in CodeMirror
- [ ] A scroll handler that animates every scroll into view, with duration proportional to distance and cancelled by the user scrolling
- [ ] The half-second delay after mouse selections

### Phase 4: typewriter mode

- [ ] Centre multi-line selections instead of the cursor
- [ ] Mouse selections and drags centre after the delay, keyboard selections straight away
- [ ] Multiple cursors, only if it comes free

### Phase 5: docs

- [ ] A section on scrolling and focus in `docs/developer/editor.md`: which element scrolls and why, the Safari focus issue, and the scroll handler
