# Task: Tabs in the right sidebar

Harper (#265) and simple git support (#369) will each need a panel, and both belong in the right sidebar. So the right sidebar becomes a container with tabs: one visibility flag, one active tab, a panel per tab. This task builds it with Frontmatter and a first Copyedit panel (the part-of-speech highlight switches), and settles the patterns later panels follow. The website is updated before the release that ships Harper or git.

## Decisions

- **Panels and tabs:** the right sidebar holds panels (`FrontmatterPanel`, `CopyeditPanel`, later `GitPanel`), switched with tabs. Panels handle their own empty state, so they needn't be about the open file.
- **Actions:** `toggleRightSidebar` (title bar button) keeps the tab; `toggleRightSidebarTab` (⌘2, ⌘3, their menu items and palette commands) closes the sidebar if it's on that tab and otherwise opens it there; `showRightSidebarTab` only opens (for code).
- **The active tab isn't persisted.** The app opens on Frontmatter.
- **Focus and typewriter mode stay out of the Copyedit panel;** they're writing modes with toolbar buttons.
- **The left sidebar is renamed to match** (`leftSidebarVisible`, `toggle-left-sidebar`).
- **No spelling switch.** WebKit's native spellcheck can't be toggled cleanly in CodeMirror (turning it off leaves underlines, turning it on doesn't check existing text; WebKit bug 265958), so spelling comes with the Harper work, through the same underlines-and-panel pipeline.
- **Maybe later:** per-file copyedit settings, so a file reopens with the highlights it was edited with.

## Phases

### Phase 1: The container ([#381](https://github.com/dannysmith/astro-editor/pull/381), merged)

- [x] Right sidebar state, actions, tab list, `RightSidebar` with `<Activity>` panels, `ResponsiveTabsList`, shortcuts, menus and palette commands; left sidebar renamed.
- [x] Mini architecture review and CodeRabbit's comments.

### Phase 2: The Copyedit panel

- [x] Highlight toggles are plain functions (`copyedit-mode/highlights.ts`), called by the panel and the palette; their DOM events and `CommandContext` members are gone. The palette group is now Copyedit.
- [x] The copyedit extension follows the highlight settings itself (a store `.subscribe` in its view plugin), so it no longer needs a module-level view.
- [x] The panel: a switch per part of speech, labelled in its highlight's colour, and Show all / Hide all.
- [x] Manual testing in the dev app (Danny).

### Phase 3: Docs and wrap-up

- [x] `architecture-guide.md`: `<Activity>` for hidden panels and why they're shown from the panel's size; a "Right sidebar" section (tabs, actions, adding a panel); the panel ↔ editor pattern; a CodeMirror extension in `lib/` may follow a store with `.subscribe()`.
- [x] `ui-patterns.md`: `ResponsiveTabsList`; check imports after `shadcn add`.
- [x] `commands-and-shortcuts.md`: the right sidebar actions and shortcuts; highlight toggles no longer use events.
- [x] AGENTS.md "Where things live", if needed.
- [x] `bun run check:all`.
- [x] Opened [#382](https://github.com/dannysmith/astro-editor/issues/382), a long-lived "Docs updates for the next release" issue, with the website changes.
