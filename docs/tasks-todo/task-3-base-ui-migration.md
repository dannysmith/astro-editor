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
- **Driving the styleguide:** `app goto '/styleguide.html?section=menus'`, then `app tree`, `app click @n`, `app key down` / `app key escape`, `app state`. Use these to check behaviour (open and close, keyboard navigation, checked state), not just looks.
- **In the real app:**
  - `app open-project`, `app open <file>` and `app tree` reach the frontmatter fields, the file list and the preferences dialog (`app run open-preferences`);
  - `app logs` catches runtime errors and React warnings after each group.
- **Hidden window:** if the dev window is behind others, CSS animations don't run. `shot` jumps them to their end state, so screenshots can't judge open/close animations. That part of the check stays with Danny.

## Branch

Task 2 has been merged, so start a fresh branch from `main`. Same commit discipline: one commit per phase, merge commit.

## Phase 1: Prep

- [ ] Check the baseline exists (see Tooling), and regenerate it if not
- [ ] Read the skill and its reference files: https://github.com/shadcn-ui/ui/tree/main/skills/migrate-radix-to-base. Not installed: a copy lives in `docs/tasks-todo/temporary/migrate-radix-to-base/` (re-fetch from `raw.githubusercontent.com` if missing). Use `class-mapping.md`, `consumer-props.md`, `wrapper-shapes.md` and the per-family files as the reference
- [ ] Find our customisations: diff each wrapper we're migrating against the stock `new-york` file (`https://ui.shadcn.com/r/styles/new-york/<component>.json`, `files[0].content`) and note what we changed, so it survives the migration
- [ ] Delete the shadcn components nothing imports: `alert`, `button-group`, `card`, `empty`, `item`, `kbd`, `radio-group`, `scroll-area`, `toggle-group`, and `toggle` (only `toggle-group` uses it). Re-check imports (including from other `ui/` files and tests) first, and re-add them through the CLI when needed. None of them are in the styleguide
- [ ] Replace `@radix-ui/react-icons` (used only in `ui/breadcrumb.tsx`) with lucide. Compare the `sidebar` section against the baseline

## Phase 2: Dual-mode data attributes (still on Radix)

- [ ] Add the `shadcn` dev dependency and `@import 'shadcn/tailwind.css'`. It defines `data-open:`, `data-closed:`, `data-checked:` and similar variants that match both Radix's `[data-state=…]` and Base UI's `[data-open]`
- [ ] Rewrite the `data-[state=…]` classes in `src/components/ui/` to those variants
- [ ] `bun run app styleguide` and compare every section with the baseline. Nothing should change. Commit
- [ ] The new variants are wrapped in `:where()`, so they're less specific than the `data-[state=…]:` classes they replace. Static shots won't show where that matters, so check combined states (such as the sidebar's `data-[state=open]:hover:`) with `app eval` on computed styles

## Phase 3: Migrate components

Work in this order, one commit per group, and run `bun run check:all` between groups. Each group also migrates its own call sites from the Phase 4 list: once a wrapper is on Base UI, `asChild` and the old props stop typechecking. After each group:

- run `bun run app styleguide <sections>` and compare against the baseline;
- drive the changed components on the styleguide (open, close, keyboard, checked state) and in the app;
- check `app logs --source=js`.

1. [ ] **Leaf components:** button (the real `@base-ui/react/button` primitive, as in the skill and the base registry, not `useRender`), label (Base UI has none, so it becomes a native `<label>`), separator, checkbox, switch, collapsible, badge (`useRender` + `mergeProps`). Sections: `buttons`, `inputs`, `toggles`, `frontmatter`
2. [ ] **Overlays:** dialog, alert-dialog, sheet, popover, tooltip, dropdown-menu, select. Sections: `select`, `date`, `menus`, `popovers`, `dialog`, `alert-dialog`, `command` (its dialog), `frontmatter` (Select and the reference picker's popover)
   - [ ] **First, the agent bridge** (see Phase 4). Verifying this group depends on `state` and shots being right when the window is hidden
   - [ ] Call sites: `LeftSidebar` (tooltip), `WindowsMenu` (dropdown), `ReferenceField` (popover), `DebugPane` (alert-dialog), the styleguide's triggers, every Select and the `TooltipProvider` props
3. [ ] **Composites:** sidebar, breadcrumb (`useRender`). Section: `sidebar`; and the preferences dialog in the app. Call site: `PreferencesDialog.tsx:121` (`SidebarMenuButton asChild`)

When `render` gets something other than a `<button>`, Base UI triggers and buttons need `nativeButton={false}`, or they warn at runtime.

These don't use Radix primitives directly and stay unchanged: calendar (react-day-picker), command (cmdk), resizable, sonner, `auto-expanding-textarea`, `spinner`, `skeleton`, `field`, `input-group`, `input` and `textarea`. `date-picker` and `tag-input` compose other `ui/` components such as popover, so they need re-testing after Phase 3.

## Phase 4: Call sites

API changes that affect code outside `ui/`. Most are done with their group in Phase 3; this phase is the final sweep (`consumer-props.md`) for anything left. The styleguide (`src/styleguide/sections.tsx`) uses several of them too:

- [ ] `asChild` → `render={…}`:
  - `PreferencesDialog.tsx:121`
  - `DebugPane.tsx:140`
  - `LeftSidebar.tsx:532`
  - `WindowsMenu.tsx:117`
  - `ReferenceField.tsx:166`
  - `styleguide/sections.tsx` (the dropdown, popover and tooltip triggers)
- [ ] Select:
  - `SelectContent` defaults to `position='popper'` today, so the wrapper should default to `alignItemWithTrigger={false}`. The styleguide's `position="popper"` then just goes;
  - `onValueChange` now receives `(value | null, details)`, so `useState<string>` setters passed directly will fail typecheck;
  - **`SelectValue` shows the raw value unless `items` is passed to the root.** Without it, these show `light`, `md`, `5`, `inherited` or the `NONE_SENTINEL` string instead of their labels: `GeneralPane` (theme, file extension, auto-save interval), `ProjectSettingsPane`, `CollectionSettingsPane` (two Selects) and `EnumField`. `FilterBar` renders its own `SelectValue` children, so it's fine. Base UI accepts a `null` item, which may let `EnumField` drop the sentinel
- [ ] TooltipProvider: `delayDuration` → `delay`. `skipDelayDuration` and `disableHoverableContent` are gone
- [ ] Checkbox: `checked="indeterminate"` → the `indeterminate` prop (including the styleguide's toggles section). The current checkbox draws a tick for indeterminate, not a dash, so check what Base UI draws
- [ ] Dialog: `onOpenAutoFocus` / `onCloseAutoFocus` → `initialFocus` / `finalFocus`; the outside-click and escape handlers are consolidated
- [ ] CSS variables (search the whole of `src/`, not just `ui/`; `ReferenceField` uses one):
  - `--radix-*-trigger-width` → `--anchor-width`;
  - `--radix-*-trigger-height` → `--anchor-height`;
  - `--radix-*-content-transform-origin` → `--transform-origin`;
  - `--radix-*-content-available-height` → `--available-height`.
- [ ] **Agent bridge (done at the start of Phase 3's overlays group):** two places rely on Radix's `data-state="closed"`:
  - `waitForIdle()` in `src/lib/agent-bridge/page.ts` sends `animationend` to closed overlays, because Radix keeps them mounted until their exit animation ends;
  - `state()` in `src/lib/agent-bridge/api.ts` filters closed dialogs out of `dialogs`.

  Base UI marks closing popups with `data-closed` / `data-ending-style`. Before unmounting, `useAnimationsFinished` waits one `requestAnimationFrame` and then on `getAnimations()`. A hidden window doesn't run frames, so closed popups stay mounted, and sending `animationend` doesn't help. Base UI skips the wait when `globalThis.BASE_UI_ANIMATIONS_DISABLED` is set. The bridge should set it only while it's driving the app: setting it for good would cut off the exit animations Danny judges in dev. With the window hidden, check:
  - `app key mod+p`, then `app key escape`, then `app state`: the command palette should be gone;
  - shots of the overlay sections don't catch anything mid-exit.

  Then update or remove the Radix-specific code, and the comments and docs that mention it (`docs/developer/agent-tooling.md`)

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
