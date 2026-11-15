# Task: Tabs in the right sidebar

The right sidebar only holds the frontmatter panel. Harper (#265) and simple git support (#369) will each need a panel of their own, and both belong in the right sidebar rather than in new sidebars. So the right sidebar becomes a container with tabs: one sidebar, one visibility flag, one active tab, and a panel per tab.

This task builds that container and a first Copyedit panel (the part-of-speech highlight toggles and a spelling toggle), and settles the patterns later panels will follow: state, commands and shortcuts, rendering hidden panels cheaply, and linking a panel to the editor. Nothing changes on the website yet; the docs there are updated before the release that ships Harper or git.

## Decisions

- **Panels and tabs.** The right sidebar holds panels (`FrontmatterPanel`, `CopyeditPanel`, later `GitPanel`), switched with tabs. "Copyedit" is one word, matching the website's Copyedit Modes page.
- **Panels don't assume a file is open.** Most will be about the current file, but each panel handles its own empty state (as `FrontmatterPanel` already does), so the container never needs to know.
- **The active tab isn't persisted.** It's `uiStore` state, like the rest of `uiStore`, and the app opens on Frontmatter.
- **Focus and typewriter mode stay out of the Copyedit panel.** They're writing modes with their own toolbar buttons.
- **"Sidebar" means both sides now,** so the left one is renamed too: `sidebarVisible` → `leftSidebarVisible`, `toggleSidebar` → `toggleLeftSidebar`, and the matching names in commands, menus and the agent bridge.

## State and actions

In `uiStore`, `frontmatterPanelVisible` becomes `rightSidebarVisible`, and `rightSidebarTab: RightSidebarTab` holds the active tab (`'frontmatter'` initially). Three actions:

| Action                       | What it does                                                         | Used by                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `toggleRightSidebar()`       | Opens or closes the sidebar, keeping the active tab                  | Title bar button, palette "Toggle Right Sidebar", View menu "Toggle Right Sidebar" (no accelerator)            |
| `toggleRightSidebarTab(tab)` | If the sidebar is open on `tab`, closes it; otherwise opens it on `tab` | ⌘2 / ⌘3, the View menu's per-tab items (same accelerators), palette "Toggle Frontmatter Panel" / "Toggle Copyedit Panel" |
| `showRightSidebarTab(tab)`   | Opens the sidebar on `tab`; never closes it                          | Code that reveals a panel: `useCreateFile`, later "reveal this issue in the panel"                            |

So with the sidebar closed, ⌘3 opens it on Copyedit; ⌘3 again closes it. With it open on Copyedit, ⌘2 switches to Frontmatter; ⌘2 again closes it. Dragging the sidebar shut keeps the tab, like the button. `setRightSidebarVisible` stays for the drag-to-collapse sync in Layout. Opening a tab doesn't move focus out of the editor.

`toggleRightSidebarTab` is `showRightSidebarTab` plus one check, so there's one way to open a tab. `handleTypingInEditor` and the title bar's "both panels hidden" check move to the new names.

## Tabs and panels

- **`RIGHT_SIDEBAR_TABS`** in `lib/` lists each tab's `id`, `label`, `icon` and shortcut digit. The `RightSidebarTab` union comes from it, and the tab bar, the hotkeys and the palette commands are generated from it. The native menu items are written by hand in `lib.rs`, as all menu items are.
- **`RightSidebar.tsx`** renders the tab bar and the panels, mapping ids to components with a `Record<RightSidebarTab, ComponentType>` so a new tab can't be added without a panel.
- **Hidden panels are wrapped in React's `<Activity>`:** `mode` is `'visible'` only when the sidebar is open and that tab is active. A hidden panel keeps its DOM and state but its effects are torn down (subscriptions, scroll-into-view, polling), and store-driven re-renders drop to idle priority. That also stops the frontmatter panel re-rendering on every frontmatter change while the sidebar is collapsed. Check in the app that WebKit keeps each panel's scroll position across `display: none`; if it doesn't, save and restore `scrollTop`.
- **The tab bar** uses shadcn's Base UI Tabs for the list (tab semantics and arrow keys), with our own `<Activity>` panels below. Each tab shows an icon and a label, and when the labels don't fit the bar switches to icons only, with tooltips. That's a reusable component in `components/ui/` (nothing ready-made fits): it measures the labelled row against the bar's width with a `ResizeObserver`, so it adapts to however many tabs there are, rather than a fixed container-query breakpoint.

## Copyedit panel

- **Highlight switches** for nouns, verbs, adjectives, adverbs and conjunctions, each with its highlight colour, and one to turn them all on or off.
- **A Spelling switch.** CodeMirror sets `spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"` and `writingsuggestions="false"` on the editor by default, and we don't override them. The switch flips `spellcheck` through `EditorView.contentAttributes` (a compartment, or an effect like the modes use). WebKit then underlines misspellings, and the editor has no custom context menu, so right-click offers suggestions. Grammar checking is out: in WebKit on macOS it's set through NSSpellChecker and the Edit → Spelling and Grammar menu, not an attribute. Try `autocorrect` and `writingsuggestions` in the app; add them only if they're a simple attribute flip that behaves well with CodeMirror. Harper may replace all of this later.
- **The highlight toggles stop going through DOM events.** Plain functions in `lib/editor/extensions/copyedit-mode/` write the settings with `getState()`, and both the panel and the palette commands call them. That removes the `toggle-highlight-*` and `toggle-all-highlights` events from `useDOMEventListeners` and six members from `CommandContext`.
- **The copyedit extension follows the settings itself.** It subscribes to the highlight settings in `projectStore` and re-analyses when they change. `updateGlobalSettings` sets the store before it writes, so this replaces the `setTimeout(updateCopyeditModePartsOfSpeech, 50)`. It also uses `getCurrentEditorView()` instead of its own module-level view.

**Spelling is persisted like the highlights.** The highlights are global settings (`general.highlights` in `global-settings.json`) and survive restarts, so Spelling joins them as `general.spellcheck`, a Rust settings field that's off by default. The panel's switches all behave the same way, and nothing changes for existing users.

Later, per-file toggles (a file reopening with the highlights and spelling it was last edited with) might be worth having. That's a bigger change to how these settings work and is out of scope here.

## Linking a panel to the editor

Not built in this task; written into the architecture guide so Harper and git panels follow one pattern.

- **Anything with document positions lives in CodeMirror state** (lint results, highlight ranges), because positions have to be mapped through edits (`tr.changes`).
- **Editor → panel:** a view plugin publishes what the panel shows to a small feature store, such as the list of issues and the id of the one under the cursor, only when it changes. Each row selects a boolean (`s => s.activeIssueId === id`), so moving the cursor re-renders two rows, not the list. The active row scrolls itself into view in an effect, which `<Activity>` pauses while the panel is hidden.
- **Panel → editor:** a plain `lib/` function takes the view from `getCurrentEditorView()` and dispatches the selection with `EditorView.scrollIntoView`.
- **No DOM events for this.** They stay for actions that need a hook.

## Phases

### Phase 1: The container

- [ ] Rename the left sidebar state, actions, commands and menu ids.
- [ ] Replace `frontmatterPanelVisible` with `rightSidebarVisible` and `rightSidebarTab`, with the three actions above, and update every caller: Layout, `TitleBarToolbar`, `useMenuEvents`, `WindowsMenu`, `useKeyboardShortcuts`, `useCreateFile`, `useCommandContext`, `app-commands.ts`, the agent bridge (`rightSidebar: { visible, tab }`) and the tests.
- [ ] `RIGHT_SIDEBAR_TABS`, `RightSidebar` with `<Activity>` panels, and the responsive tab bar component (with a styleguide entry).
- [ ] ⌘2 / ⌘3 hotkeys, View menu items in `lib.rs` (per-tab items with accelerators, plus Toggle Right Sidebar), palette commands.
- [ ] An empty Copyedit panel, to check switching, hiding and scroll positions in the app.
- [ ] `bun run check:all`.
- [ ] **Mini architecture review** of the Phase 1 code, while it's only the container, shortcuts and commands: naming, the three actions and who calls which, the tab list and how a panel is added, `<Activity>` and re-renders, against the architecture guide. Quick, by Claude or one or two cold-read agents given the code rather than this doc. Fix what it finds.
- [ ] **Open a PR for Phase 1** so CodeRabbit reviews the pattern on its own. Work through its comments before Phase 2.

### Phase 2: The Copyedit panel

- [ ] Move the highlight toggles into `lib/` functions; drop their DOM events and `CommandContext` members.
- [ ] Make the copyedit extension follow the highlight settings and use `getCurrentEditorView()`.
- [ ] The panel's highlight switches.
- [ ] The Spelling switch, with `general.spellcheck` in the Rust settings.
- [ ] `bun run check:all`.
- [ ] **Manual testing in the dev app (Danny):** shortcuts in every state, title bar button, menu items, palette commands, drag to collapse, new file with a title field while on Copyedit, scroll positions, narrow sidebar, highlight and spelling switches, light and dark. Fix what comes up before Phase 3.

### Phase 3: Docs and wrap-up

- [ ] `architecture-guide.md`: `<Activity>` for hidden panels (next to "Keep stateful panels mounted"), a short "Right sidebar" section (tabs, actions, adding a panel), and the panel ↔ editor pattern.
- [ ] `commands-and-shortcuts.md`: the right sidebar actions and shortcuts; the highlight toggles no longer go through events.
- [ ] `editor.md`: spelling and the content attributes CodeMirror sets.
- [ ] AGENTS.md "Where things live" if a new directory is added.
- [ ] `bun run check:all`.
- [ ] **Open a long-lived "Docs updates for the next release" GitHub issue,** listing what the website needs before the next release ships (below). Later work adds to it.

## Website updates for the next release

These go in the GitHub issue rather than being made now, since merging website changes publishes them. The website still describes ⌘2 as "Toggle Frontmatter Panel" and the palette as the only way to toggle highlights. Update `reference/keyboard-shortcuts.mdx` (⌘2 and ⌘3, the left sidebar's name), `reference/commands.mdx` (the right sidebar commands, renamed sidebar commands), `editor/copyedit-modes.mdx` (the Copyedit panel and Spelling), `reference/advanced-preferences.mdx` if it lists the settings, and any screenshots that show the right sidebar.
