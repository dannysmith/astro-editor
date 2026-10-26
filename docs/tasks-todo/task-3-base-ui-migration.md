# Base UI Migration

Move our shadcn components from Radix to Base UI before the form work in #289 and the project manager in #82. Both add a lot of new form UI, and it's cheaper to write that against Base UI from the start than to migrate it later.

## Context

- **shadcn's position:** Base UI has been the default for new shadcn projects since July 2026. Radix is still maintained and supported.
- **Combobox:** shadcn's Combobox is built on `@base-ui/react` even in the Radix styles. It's the obvious control for #289's multi-selects and collection-entry pickers, so we'd end up with Base UI anyway.
- **No CLI migration.** The official path is shadcn's `migrate-radix-to-base` agent skill. It works one component at a time, rewires the primitives in our own files, keeps our classes, and writes `.migration/<component>.md` reports.
- **Styling decision:** keep our current look by migrating in place, then point `components.json` at a `base-*` style. Future `shadcn add` calls then deliver Base UI versions, which we adjust to match as we add them. The `new-york` style has no Base UI equivalent.

## Branch

Continue on `modernise-2026-10` after task 2. If task 2 has already been merged, use a fresh branch. Same commit discipline: one commit per phase, merge commit.

## Phase 1: Prep

- [ ] Read the skill and its reference files: https://github.com/shadcn-ui/ui/tree/main/skills/migrate-radix-to-base. Installing it writes to `.claude/skills/`, which needs Danny's approval
- [ ] Delete the shadcn components nothing imports: `alert`, `button-group`, `card`, `empty`, `item`, `kbd`, `radio-group`, `scroll-area`, `toggle-group`. Re-check imports (including from other `ui/` files and tests) first, and re-add them through the CLI when needed
- [ ] Replace `@radix-ui/react-icons` (used only in `ui/breadcrumb.tsx`) with lucide

## Phase 2: Dual-mode data attributes (still on Radix)

- [ ] Add the `shadcn` dev dependency and `@import 'shadcn/tailwind.css'`. It defines `data-open:`, `data-closed:`, `data-checked:` and similar variants that match both Radix's `[data-state=…]` and Base UI's `[data-open]`
- [ ] Rewrite the `data-[state=…]` classes in `src/components/ui/` to those variants
- [ ] Commit and do a quick visual check. Everything should look and animate the same, which makes the actual swap smaller

## Phase 3: Migrate components

Work in this order, one commit per group, and run `bun run check:all` between groups. After each group, run `bun run app styleguide` and compare the sections it touched against the Radix baseline in `docs/tasks-todo/temporary/baseline/` (taken by task 1):

1. [ ] **Leaf components:** button (Slot → `useRender`), label (Base UI has none, so it becomes a native `<label>`), separator, checkbox, switch, toggle, collapsible, badge
2. [ ] **Overlays:** dialog, alert-dialog, sheet, popover, tooltip, dropdown-menu, select. `ui/context-menu.tsx` isn't a Radix component (it builds a native Tauri menu), so it needs no migration
3. [ ] **Composites:** sidebar, breadcrumb

These don't use Radix primitives directly and stay unchanged: calendar (react-day-picker), command (cmdk), resizable, sonner, `auto-expanding-textarea`, `spinner`, `skeleton`, `field`, `input-group`, `input` and `textarea`. `date-picker` and `tag-input` compose other `ui/` components such as popover, so they need re-testing after Phase 3.

## Phase 4: Call sites

API changes that affect code outside `ui/`:

- [ ] `asChild` → `render={…}` (5 uses):
  - `PreferencesDialog.tsx:121`
  - `DebugPane.tsx:140`
  - `LeftSidebar.tsx:532`
  - `WindowsMenu.tsx:117`
  - `ReferenceField.tsx:166`
- [ ] Select: `position="popper"` → `alignItemWithTrigger={false}`. `onValueChange` now receives `(value | null, details)`, so `useState<string>` setters passed directly will fail typecheck
- [ ] TooltipProvider: `delayDuration` → `delay`. `skipDelayDuration` and `disableHoverableContent` are gone
- [ ] Checkbox: `checked="indeterminate"` → the `indeterminate` prop. The current checkbox draws a tick for indeterminate, not a dash (see the styleguide's toggles section)
- [ ] Dialog: `onOpenAutoFocus` / `onCloseAutoFocus` → `initialFocus` / `finalFocus`; the outside-click and escape handlers are consolidated
- [ ] CSS variables: `--radix-*-trigger-width` → `--anchor-width`, `--radix-*-transform-origin` → `--transform-origin`. Search the whole of `src/`, not just `ui/`

## Phase 5: Finish

- [ ] `components.json` `style` → the `base-*` style closest to our look. It only affects future `shadcn add` calls
- [ ] Remove the `radix-ui` package and confirm nothing in the lockfile still pulls it in
- [ ] Update `docs/developer/ui-patterns.md` where it describes Radix behaviour or `asChild`
- [ ] Delete the `.migration/` reports once they've been read
- [ ] Danny's behaviour check in the real app:
  - focus returns to the right place after closing dialogs, the preferences window and alert dialogs;
  - menus with checkbox or radio items (Base UI doesn't close the menu on click by default);
  - tooltip delays in the sidebar and title bar;
  - Select popup positioning in frontmatter fields;
  - the file list context menu;
  - the Windows title bar menu;
  - open/close animations, which now use transitions instead of `animate-in` / `animate-out`;
  - keyboard navigation through menus and selects.
- [ ] `bun run check:all`, PR with the `ci` label, merge commit
