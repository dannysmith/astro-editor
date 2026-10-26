# Base UI Migration

Move our shadcn components from Radix to Base UI before the form work in #289 and the project manager in #82. Both add a lot of new form UI, and it's cheaper to write that against Base UI from the start than to migrate it later.

## Context

- **shadcn's position:** Base UI has been the default for new shadcn projects since July 2026. Radix is still maintained and supported.
- **Combobox:** shadcn's Combobox is built on `@base-ui/react` even in the Radix styles. It's the obvious control for #289's multi-selects and collection-entry pickers, so we'd end up with Base UI anyway.
- **No CLI migration.** The official path is shadcn's `migrate-radix-to-base` agent skill. It works one component at a time, rewires the primitives in our own files, keeps our classes, and writes `.migration/<component>.md` reports.
- **Styling decision:** keep our current look by migrating in place, then point `components.json` at a `base-*` style. Future `shadcn add` calls then deliver Base UI versions, which we adjust to match as we add them. The `new-york` style has no Base UI equivalent.
- **`ui/context-menu.tsx` isn't Radix.** It builds a native Tauri menu, so it needs no migration.
- **Animations stay on tw-animate.** The skill suggests restating `animate-in` / `animate-out` as transitions, but shadcn's own base registry keeps `data-open:animate-in data-closed:animate-out`, and Base UI waits for CSS animations (`getAnimations()`) before unmounting. Keeping them means the least visual drift.
- **cmdk keeps some Radix.** cmdk depends on `@radix-ui/react-dialog`, `-primitive`, `-id` and `-compose-refs`, so those stay in the lockfile. The skill says not to touch cmdk.
- **Versions:** `@base-ui/react` is at 1.9.0. The skill's references were checked against 1.6.0, so check `node_modules/@base-ui/react/**/*.d.ts` when something doesn't match.

## Tooling (from task 1)

Use the `app-control` skill to check the work in the running dev app rather than asking Danny for screenshots. The commands that matter most here:

- **`bun run app styleguide [section...]`** shoots styleguide sections in light and dark.
  - The sections are `buttons`, `inputs`, `toggles`, `frontmatter`, `sidebar`, `command`, `select`, `date`, `menus`, `popovers`, `dialog`, `alert-dialog` and `toasts`; they cover every `ui/` component the app uses.
  - Overlays are rendered open on their own pages.
  - Afterwards it returns to the app and reopens the project and file.
- **The Radix baseline** is in `docs/tasks-todo/temporary/baseline/` (26 images, taken on 2026-10-26). That folder is gitignored, so if it's missing, regenerate it **before changing anything**: `bun run app styleguide --out=docs/tasks-todo/temporary/baseline`.
- **Comparing:** `bun run app diff docs/tasks-todo/temporary/baseline docs/tasks-todo/temporary` pairs each baseline shot with the newest shot of the same name. It lists which are pixel-identical, boxes the changes in the rest, and writes diff images to `docs/tasks-todo/temporary/diff/`. Repeat shots of an unchanged page are identical, so any difference is real. Look at the diff image and the new shot for anything that differs.
- **Driving the styleguide:** `app goto '/styleguide.html?section=menus'`, then `app tree`, `app click @n`, `app key down` / `app key escape`, `app state`. Use these to check behaviour (open and close, keyboard navigation, checked state), not just looks.
- **In the real app:**
  - `app open-project`, `app open <file>` and `app tree` reach the frontmatter fields, the file list and the preferences dialog (`app run open-preferences`);
  - `app logs` catches runtime errors and React warnings after each group.
- **Hidden window:** if the dev window is behind others, CSS animations don't run. `shot` jumps them to their end state, so screenshots can't judge open/close animations. That part of the check stays with Danny.

### Tooling notes

Things in the agent tooling that got in the way or could be better, found during this task:

- **HMR errors in the logs after CSS edits.** `[vite] Failed to reload /src/App.css` with `IPC custom protocol failed` shows up when a CSS change lands while the bridge is navigating (`app styleguide` right after an edit); it also happened during task 1. The shots that follow are fine. Worth knowing so it isn't mistaken for a regression, or waiting a moment before shooting after an edit
- [x] **`tree` didn't wait for idle.** Right after opening an overlay in a hidden window, its opening animation is paused at opacity 0, so `tree` (and `click --text`) found nothing, however often it ran. `tree`, `click` and `fill` now call `idle()` first
- **`tree` doesn't list an open Base UI Select's options**, though they're in the DOM and focused (the cmdk listbox in the reference picker does show). Not fixed; `click '[role=listbox] [role=option]:nth-child(2)'` works
- **`click --text` matches placeholders and partial text.** `--text=Title` hit the frontmatter's "Enter title..." field rather than the sort option "Title", and the click outside closed the Select. An exact-match mode, or preferring options and menu items, would help
- **Removing a package confuses Vite's dependency optimiser.** After `@radix-ui/react-icons` was removed in Phase 1, the next re-optimisation (triggered by adding `@base-ui/react`) failed with `ENOENT … react-icons.esm.js` and the page wouldn't load until Danny restarted `tauri:dev`. Removing `radix-ui` in Phase 5 will probably need the same
- [x] **No image diff → `app diff`.** Comparing with the baseline meant reading both PNGs by eye: the bytes always differ, and there's no PIL or ImageMagick. Built with `pixelmatch` and `pngjs` in the CLI (`scripts/app-diff.ts`) rather than in the webview, so it works without the app running, like `logs`. Shooting `buttons` and `menus` twice gave 0 changed pixels, even counting anti-aliasing, so it's strict by default
- **`app goto /` doesn't restore the open file** the way `app styleguide` does, so driving the styleguide by hand leaves the app with the project open but no file
- **An intermittent Rust test failure** (`test_validate_app_data_path_valid`, see Phase 1). Not agent tooling as such, but worth watching

## Branch

Task 2 has been merged, so start a fresh branch from `main`. Same commit discipline: one commit per phase, merge commit.

## Phase 1: Prep

- [x] Check the baseline exists (see Tooling), and regenerate it if not. All 26 images were there
- [x] Read the skill and its reference files: https://github.com/shadcn-ui/ui/tree/main/skills/migrate-radix-to-base. Not installed: a copy lives in `docs/tasks-todo/temporary/migrate-radix-to-base/` (re-fetch from `raw.githubusercontent.com` if missing). `SKILL.md`, `universal-patterns.md`, `class-mapping.md`, `consumer-props.md` and `wrapper-shapes.md` read in full; the per-family files (`overlays.md`, `menus.md`, `form-controls.md`, `disclosure.md`, `display-misc.md`) are prop-by-prop tables to look things up in per group
- [x] Find our customisations: diff each wrapper we're migrating against the stock file. Our wrappers came from `new-york-v4` (`https://ui.shadcn.com/r/styles/new-york-v4/<component>.json`, `files[0].content`), not `new-york`. Most differences are upstream drift since we installed them (stock has since gained `xs` sizes, `data-variant` attributes, alert-dialog `size`/media, `PopoverHeader` and so on); we don't want those. Git history shows our own changes, which must survive:
  - **button:** `text-foreground` on `outline` and `ghost` (dark mode); no `shadow-xs` on `default`, `destructive` and `secondary`; `icon-sm` and `icon-lg` sizes; `variant` and `size` have no defaults in the function signature (cva's `defaultVariants` handles them)
  - **select:** trigger has `text-gray-900 dark:text-white`; `SelectContent` defaults to `position='popper'` (stock is now `item-aligned`)
  - **label:** `text-foreground`
  - **dialog:** overlay has `rounded-[var(--app-corner-radius)]` so the dimmed backdrop follows the window's rounded corners
  - **sidebar:** skeleton width uses `useState` instead of `useMemo` (React Compiler purity); the floating variant's shadow uses `var(--sidebar-border)` rather than `hsl(var(…))`
  - **collapsible, tooltip, switch, badge, checkbox:** older stock shapes (bare re-exports, `TooltipProvider` inside `Tooltip`, `bg-primary` tooltip, no switch `size`, `rounded-md` badge, `flex` checkbox indicator), not deliberate changes. Keep what we have unless the Base UI version needs otherwise
- [x] Delete the shadcn components nothing imports: `alert`, `button-group`, `card`, `empty`, `item`, `kbd`, `radio-group`, `scroll-area`, `toggle-group`, and `toggle` (only `toggle-group` used it). Imports re-checked across `src/`, `scripts/` and `test/` first. Removed the ScrollArea row from `ui-patterns.md`
- [x] Replace `@radix-ui/react-icons` (used only in `ui/breadcrumb.tsx`) with lucide (`ChevronRightIcon`, `MoreHorizontalIcon`) and remove the package. The `sidebar` section matches the baseline in both themes; the separator renders `lucide-chevron-right`. The ellipsis isn't in the styleguide, and nothing uses `BreadcrumbEllipsis`
- [x] `bun run check:all` passes. The first run had one failure, `test_validate_app_data_path_valid` (`EINVAL` while creating its folders in the temp dir); it passed outside the sandbox and in six later runs inside it, so it's intermittent and the cause is unknown

## Phase 2: Dual-mode data attributes (still on Radix)

- [x] Add the `shadcn` dev dependency and `@import 'shadcn/tailwind.css'`. It defines `data-open:`, `data-closed:`, `data-checked:` and similar variants that match both Radix's `[data-state=…]` and Base UI's `[data-open]`. It also brings `no-scrollbar`, so our copy in `App.css` went. The only other global rule is a reduced-motion override for `.shimmer`, which we don't use. The `shadcn` package pulled in 235 packages (dev only, nothing ships). Copying the variants into `App.css` instead would avoid that, but future base-style `shadcn add` components expect the import. The import alone left every section identical to the baseline
- [x] Rewrite the `data-[state=…]` classes in `src/components/ui/` to those variants (`open`, `closed`, `checked`, `unchecked`; `has-data-checked:` compounds fine, checked in Vite's compiled CSS). `peer-data-[state=collapsed]` in `sidebar.tsx` is the sidebar's own attribute, not Radix's, so it stays
- [x] `bun run app styleguide`, then `app diff` against the baseline: 24 of 26 identical. The other two are `sidebar`, whose breadcrumb chevron changed in Phase 1
- [x] Specificity: the new variants are wrapped in `:where()`, so they're less specific than the `data-[state=…]:` classes they replace. Every rewritten class that shares a property with another state variant on the same element:
  - dropdown `SubTrigger` (`data-open:bg-accent` vs `focus:bg-accent`) and sidebar `SidebarMenuButton` (`data-open:hover:` vs `hover:` / `active:` / `data-[active=true]:`): same values, so no visible change
  - `SidebarMenuAction` (`data-open:opacity-100` vs `md:opacity-0`) and the dark checkbox background (`dark:data-checked:bg-primary` vs `dark:bg-input/30`): equally specific now, and the data variant still comes later in the CSS, so it still wins. Nothing uses `SidebarMenuAction`
  - **checkbox border: a real change.** `focus-visible:border-ring` and `aria-invalid:border-destructive` (0,2,0) now beat `data-checked:border-primary` (0,1,0), so a keyboard-focused checked checkbox has a ring-coloured border instead of a primary one (the focus ring itself is unchanged). This is how shadcn's base checkbox behaves too. Couldn't confirm at runtime: WebKit ignores `focus({ focusVisible: true })` and the bridge's keys are untrusted, so this rests on the compiled CSS order

## Phase 3: Migrate components

Work in this order, one commit per group, and run `bun run check:all` between groups. Each group also migrates its own call sites from the Phase 4 list: once a wrapper is on Base UI, `asChild` and the old props stop typechecking. After each group:

- run `bun run app styleguide <sections>` and `app diff` against the baseline, then look at whatever differs;
- drive the changed components on the styleguide (open, close, keyboard, checked state) and in the app;
- check `app logs --source=js`.

1. [x] **Leaf components:** button (the real `@base-ui/react/button` primitive, as in the skill and the base registry, not `useRender`), label (Base UI has none, so it becomes a native `<label>`), separator, checkbox, switch, collapsible, badge (`useRender` + `mergeProps`). Sections: `buttons`, `inputs`, `toggles`, `frontmatter`
   - Done to our own files, keeping our classes. `checkbox` and `switch` roots are now `<span>`s, so their `disabled:` classes became `data-disabled:`. `collapsible` keeps its bare re-exports (`Content` → `Panel`). `badge` has no `data-variant`, as before
   - Call sites: only the styleguide's `checked="indeterminate"` → `indeterminate`. The three `onCheckedChange` handlers already took a boolean
   - `app diff`: every section identical to the baseline (only the Phase 1 chevron differs). The DOM shows Base UI parts (`data-checked`, `data-indeterminate`, `data-disabled`)
   - Driven on the styleguide: click toggles the checkbox and switch, disabled ones ignore clicks, Space toggles a focused checkbox, both collapsibles open and close (content unmounts when closed)
   - Driven in the app: the reset-preferences checkbox toggles from its separate `<label htmlFor>` (Base UI puts the `id` on its hidden input) and enables the Reset button, then cancelled; a collection settings collapsible and its switch; the frontmatter Draft switch updates the store and marks the file dirty (vault reset afterwards)
   - Behaviour change: separators are always `role="separator"`. Radix rendered our decorative ones as `role="none"`, and Base UI has no `decorative` prop
   - Indeterminate checkboxes still draw a tick, as they did with Radix. A dash (`MinusIcon` on `data-indeterminate`) would be clearer, but that's a design change, not part of the migration

2. [x] **Overlays:** dialog, alert-dialog, sheet, popover, tooltip, dropdown-menu, select. Sections: `select`, `date`, `menus`, `popovers`, `dialog`, `alert-dialog`, `command` (its dialog), `frontmatter` (Select and the reference picker's popover)
   - [x] **First, the agent bridge** (see Phase 4). Verifying this group depends on `state` and shots being right when the window is hidden
   - [x] Call sites: `LeftSidebar` (tooltip), `WindowsMenu` (dropdown), `ReferenceField` (popover), `DebugPane` (alert-dialog), the styleguide's triggers, every Select and the `TooltipProvider` props. `sidebar.tsx`'s tooltip trigger and `delayDuration` too, since they use tooltip's API, and `command.tsx`'s `CommandDialog` (Base UI's Dialog `children` can be a function, so it types its own)
   - Wrappers keep our classes. Changes needed to keep the look pixel-identical:
     - tooltip: `sideOffset` 10, not 0. Radix added the arrow's height (`size-2.5`) to the offset; Base UI doesn't. The arrow takes the base registry's per-side position classes. Each `Tooltip` still wraps itself in a `TooltipProvider` with delay 0, as before (Base UI's trigger uses its own `delay`, then the provider's, then 600ms)
     - select: `align` defaults to `start` (Radix's popper did; Base UI centres), and the trigger-width minimum sits on the List inside the border, as it did on Radix's viewport. `ItemText` renders a `<span>` so the `*:[span]:last:` classes still reach it. `Select` is a bare re-export of `Root`, so its value type stays generic
     - dropdown: `DropdownMenuLabel` (Base UI's `GroupLabel`) must be inside a `DropdownMenuGroup`, so the styleguide's label moved into its group. The submenu trigger's open state is `data-popup-open`
     - alert-dialog: `AlertDialogAction` is a `Close` styled as a button, so it still closes the dialog when clicked (Base UI has no Action part, and the base registry's plain Button wouldn't close). `DebugPane`'s description renders a `<div>` (Base UI's is a `<p>`, and it holds a list)
     - popover: `PopoverAnchor` went (unused; Base UI has no Anchor part)
   - Every Select whose labels differ from its values now passes `items`, built once and mapped into its `SelectItem`s so the two can't drift. Items with JSX labels (the muted "Use default" options) pass the same JSX, so the trigger shows what Radix showed. Handlers ignore `null`
   - `app diff`: 24 of 26 identical. `sidebar` is the Phase 1 chevron. `dialog` differs only in the input's text selection: Radix's focus scope selected the first input's text when it focused it on open (`{ select: true }`); Base UI only focuses. Also, the styleguide's dialog opens while the page loads, so in a hidden window it doesn't take focus at all
   - Driven through the bridge: the command palette opens with focus in its input and unmounts on Escape, returning focus; the frontmatter enum Select opens by click, moves with arrow keys, selects with Enter or a click, and its trigger shows the label; the reference picker popover opens with focus in its search, picks an author, closes and returns focus, matches the trigger's width and flips above near the bottom; the date picker opens and closes with focus returned; the filter bar's sort Select changes the order; the preference Selects all show labels; the reset dialog nests inside Preferences and Cancel returns focus; the sidebar's no-schema tooltip opens on hover, to the right; on the styleguide, the menu moves with arrow keys and Enter picks a radio item
   - **Behaviour changes:**
     - a dialog nested in another (the reset dialog inside Preferences) no longer gets its own backdrop, so the area behind it is dimmed once instead of twice. Base UI only renders a nested backdrop with `forceRender`. Left as Base UI does it; see `nested-alert-*.png`
     - menu keyboard navigation now stops on disabled items (Radix skipped them)
     - dialogs no longer select the text of the input they focus on open
     - `onValueChange` passes `null` when cleared; our handlers ignore it
3. [ ] **Composites:** sidebar, breadcrumb (`useRender`). Section: `sidebar`; and the preferences dialog in the app. Call site: `PreferencesDialog.tsx:121` (`SidebarMenuButton asChild`)

When `render` gets something other than a `<button>`, Base UI triggers and buttons need `nativeButton={false}`, or they warn at runtime.

These don't use Radix primitives directly and stay unchanged: calendar (react-day-picker), command (cmdk), resizable, sonner, `auto-expanding-textarea`, `spinner`, `skeleton`, `field`, `input-group`, `input` and `textarea`. `date-picker` and `tag-input` compose other `ui/` components such as popover, so they need re-testing after Phase 3.

## Phase 4: Call sites

API changes that affect code outside `ui/`. Most are done with their group in Phase 3; this phase is the final sweep (`consumer-props.md`) for anything left. The styleguide (`src/styleguide/sections.tsx`) uses several of them too:

- [ ] `asChild` → `render={…}` (all done in the overlays group except `PreferencesDialog`, which goes with sidebar):
  - `PreferencesDialog.tsx:121`
  - `DebugPane.tsx:140`
  - `LeftSidebar.tsx:532`
  - `WindowsMenu.tsx:117`
  - `ReferenceField.tsx:166`
  - `styleguide/sections.tsx` (the dropdown, popover and tooltip triggers)
- [x] Select (done in the overlays group):
  - `SelectContent` defaults to `position='popper'` today, so the wrapper should default to `alignItemWithTrigger={false}`. The styleguide's `position="popper"` then just goes;
  - `onValueChange` now receives `(value | null, details)`, so `useState<string>` setters passed directly will fail typecheck;
  - **`SelectValue` shows the raw value unless `items` is passed to the root.** Without it, these show `light`, `md`, `5`, `inherited` or the `NONE_SENTINEL` string instead of their labels: `GeneralPane` (theme, file extension, auto-save interval), `ProjectSettingsPane`, `CollectionSettingsPane` (two Selects) and `EnumField`. `FilterBar` renders its own `SelectValue` children, so it's fine. Base UI accepts a `null` item, which may let `EnumField` drop the sentinel
- [x] TooltipProvider: `delayDuration` → `delay`. `skipDelayDuration` and `disableHoverableContent` are gone
- [x] Checkbox: `checked="indeterminate"` → the `indeterminate` prop (including the styleguide's toggles section). The current checkbox draws a tick for indeterminate, not a dash, so check what Base UI draws
- [x] Dialog: `onOpenAutoFocus` / `onCloseAutoFocus` → `initialFocus` / `finalFocus`; the outside-click and escape handlers are consolidated. Nothing used them
- [x] CSS variables (search the whole of `src/`, not just `ui/`; `ReferenceField` uses one):
  - `--radix-*-trigger-width` → `--anchor-width`;
  - `--radix-*-trigger-height` → `--anchor-height`;
  - `--radix-*-content-transform-origin` → `--transform-origin`;
  - `--radix-*-content-available-height` → `--available-height`.
- [x] **Agent bridge (done at the start of Phase 3's overlays group):** two places rely on Radix's `data-state="closed"`:
  - `waitForIdle()` in `src/lib/agent-bridge/page.ts` sends `animationend` to closed overlays, because Radix keeps them mounted until their exit animation ends;
  - `state()` in `src/lib/agent-bridge/api.ts` filters closed dialogs out of `dialogs`.

  Base UI marks closing popups with `data-closed` / `data-ending-style`. Before unmounting, `useAnimationsFinished` waits one `requestAnimationFrame` and then on `getAnimations()`. A hidden window doesn't run frames, so closed popups stay mounted, and sending `animationend` doesn't help. Base UI skips the wait when `globalThis.BASE_UI_ANIMATIONS_DISABLED` is set. The bridge should set it only while it's driving the app: setting it for good would cut off the exit animations Danny judges in dev. With the window hidden, check:
  - `app key mod+p`, then `app key escape`, then `app state`: the command palette should be gone;
  - shots of the overlay sections don't catch anything mid-exit.

  Then update or remove the Radix-specific code, and the comments and docs that mention it (`docs/developer/agent-tooling.md`)

  **Done differently:** the flag turned out not to be enough. Base UI also waits for a frame before opening a Select or menu from a click (Floating UI's `useClick`), moving focus into a popup, and removing `data-starting-style`, and its shared frame scheduler stops requesting frames once one is stalled. So `page.ts` has `withFrames()`, and the CLI runs every API call inside it: during the call, each frame request also fires from a 20ms timeout if the real frame doesn't come, and installing a new function each call makes the scheduler (in dev builds) re-request its stalled frame. Outside bridge calls nothing changes, so exit animations still play for Danny. The flag isn't used. The Radix `animationend` code and its test are gone, and `state.dialogs` skips `[data-closed]`. Checked: palette opens with focus in the input, Escape unmounts it. Without `withFrames` (a raw `eval`), the closed palette stays mounted with `data-closed data-ending-style` until the window is visible

## Phase 5: Finish

- [ ] `components.json` `style` → the `base-*` style closest to our look. It only affects future `shadcn add` calls
- [ ] Remove the `radix-ui` package. Confirm the lockfile has no `radix-ui` and that the only `@radix-ui/*` packages left are cmdk's
- [ ] Update `docs/developer/ui-patterns.md` where it describes Radix behaviour or `asChild`
- [ ] Delete the `.migration/` reports once they've been read
- [ ] Final `bun run app styleguide` against the baseline, then replace the baseline with the Base UI shots for future work
- [ ] Behaviour check through the bridge, in the app and on the styleguide, before handing over:
  - focus returns to the right place after closing dialogs, the preferences dialog and alert dialogs (`app eval 'document.activeElement.outerHTML'` after closing);
  - menus with checkbox or radio items: Base UI doesn't close the menu on click by default, so decide what we want;
  - keyboard navigation through menus and selects (`app key down`, `app key enter`, `app tree` for the highlighted item);
  - Select popup positioning in frontmatter fields (shots).
- [ ] Danny's check in the real app, for what the bridge can't judge:
  - open/close animations: still tw-animate, but now driven by Base UI's `data-open` / `data-closed` and its unmount timing;
  - tooltip delays in the sidebar and title bar;
  - real mouse and keyboard feel in menus and selects;
  - the Windows title bar menu (Windows only).
- [ ] `bun run check:all`, PR with the `ci` label, merge commit
