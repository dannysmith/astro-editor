# UI Patterns

How the app's UI should look and behave, and the patterns and gotchas of the component library underneath it. For colours, see `color-system.md`.

## Design Principles

The app should feel like a native macOS app, in the spirit of iA Writer. Great Mac apps are defined as much by what they don't show as by what they do.

- **Keyboard-first:** every action reachable from the keyboard, with visible focus states.
- **Subtle motion:** short, quiet transitions; never jarring or decorative.
- **Consistent spacing** on a 4px/8px grid.
- **Native materials:** respect the window vibrancy and system light/dark appearance rather than painting over them.
- **Native interactions:** context menus, dialogs and menus come from Tauri where a native one exists.
- **Typography:** iA Writer Duo/Mono with system fallbacks, and a comfortable line length (roughly 45–75 characters) in the editor.

## shadcn on Base UI

Components in `src/components/ui/` come from shadcn, built on [Base UI](https://base-ui.com/), not Radix. `components.json` uses the `base-vega` style, the closest to our look, so `shadcn add` delivers Base UI versions. Examples written for Radix won't work as they are.

- **`render`, not `asChild`:** pass the element to render as, e.g. `<PopoverTrigger render={<Button variant="outline" />}>Pick</PopoverTrigger>`. Our own polymorphic wrappers (badge, breadcrumb link, the sidebar parts) use `useRender` + `mergeProps`; `Button` uses Base UI's Button.
- **Select labels:** pass `items` (value → label) to `Select` whenever labels differ from values, or the trigger shows the raw value. Build the list once and map it into the `SelectItem`s. `onValueChange` receives `null` when cleared.
- **State styling:** use `data-open:`, `data-closed:`, `data-checked:`, `data-disabled:` and `data-active:`. They come from `shadcn/tailwind.css` and are wrapped in `:where()`, so they lose to any plain utility setting the same property. Base UI writes boolean attributes only when true (`data-active`, not `data-active="false"`), so `data-[active=true]` selectors never match. An open menu's trigger, including a submenu trigger, gets `data-popup-open`.
- **Popups** render `Portal > Positioner > Popup`. `side`, `align` and their offsets go on the Positioner (the wrappers forward them). Size with `--anchor-width`, `--available-height` and `--transform-origin`.
- **Exit animations:** popups use tw-animate's `animate-in` / `animate-out` on `data-open` / `data-closed`. Base UI unmounts a popup once its exit animations finish, and a dialog's backdrop only together with its popup, so a part whose exit animation is shorter than its popup's needs `data-closed:fill-mode-forwards` or it reappears until the unmount.
- **Menus:** `DropdownMenuLabel` must sit inside a `DropdownMenuGroup`. Checkbox and radio items don't close the menu when clicked (pass `closeOnClick` to change that).
- **`ui/context-menu.tsx` isn't shadcn's ContextMenu.** It's the `FileContextMenu` class, which builds a native Tauri menu for the file list. Don't `shadcn add context-menu` over it.

## Icon Buttons

Icon-only buttons, like those in the title bar, look like this:

```tsx
<Button
  variant="ghost"
  size="sm"
  className="size-7 p-0 text-icon [&_svg]:scale-100 [&_svg]:transform-gpu"
  title="Toggle Sidebar"
>
  <PanelLeft className="size-4" />
</Button>
```

- **`text-icon`** is the icon colour token. A state colour (e.g. `text-active` for an enabled mode) goes on the icon itself.
- **`[&_svg]:scale-100 [&_svg]:transform-gpu`** stops the icon shifting by a pixel when the button's state changes, which is visible when `disabled` toggles. Putting the SVG on its own compositing layer keeps its position stable. Apply it to every icon-only button, not just ones that can be disabled.
- **`title`** gives the tooltip. Add `aria-label` when the title isn't a good accessible name.

## Forms

The frontmatter panel and the preferences dialog are built from shadcn's `Field` parts. Frontmatter fields go through `FieldWrapper` (`src/components/frontmatter/fields/`), whose `layout` prop becomes `Field`'s `orientation`. Preference rows use `Field`, `FieldLabel`, `FieldContent` and `FieldDescription` directly inside `SettingsSection`, which supplies the `FieldGroup`.

- **Label wiring:** give a text control's label `htmlFor`, so clicking the label focuses it. Button-style controls (date, enum, reference and image pickers) instead get a `labelId` on the label and `aria-labelledby` on the button, because `htmlFor` would turn a label click into a button click and open the picker. `FieldWrapper` takes either.
- **Preference text inputs use `PreferencesTextInput`,** which keeps the value in local state while typing and commits on blur or Enter. Settings are written to disk asynchronously, and committing on every keystroke made the cursor jump.
- **Multi-line text uses `AutoExpandingTextarea`** (`ui/auto-expanding-textarea.tsx`), because WebKit doesn't support `field-sizing: content` across the macOS versions we support.

## Notifications

Toasts are Sonner, through shadcn's `ui/sonner.tsx`.

- **Import `toast` from `@/lib/toast`,** not `sonner`. It's a plain object, so `lib/` code and stores can call it outside React, and it gives errors (5s) and warnings (4s) longer default durations.
- **`ui/sonner.tsx` uses the app's `lib/theme-provider`**, not the `next-themes` package shadcn's version imports, and styles toasts with the popover tokens. Re-running `shadcn add sonner` would bring `next-themes` back.
- **Rust shows a toast by emitting `rust-toast`** (`{ type, message, description?, duration? }`, via `tauri::Emitter`); `lib/rust-toast-bridge.ts` listens and calls `toast`. It's for side-channel feedback during a command, like the blocked-directory warning in `commands/project.rs`. Ordinary errors return a `Result`, and the caller shows the toast.
- **Auto-save never shows the success toast.** It saves with `showToast` false; only a manual save says "File saved". A failed save still shows an error.
