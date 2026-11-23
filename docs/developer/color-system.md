# Colour system and dark mode

Every colour in the app is a CSS custom property defined once in `src/App.css`, with its light and dark values side by side. Components only use these tokens, never Tailwind's palette colours or literal values, so any colour can be changed in one place for both themes.

## Tokens

All colour tokens live in one `:root` block near the top of `src/App.css`:

```css
:root {
  color-scheme: light dark;
  --background: light-dark(oklch(1 0 0), oklch(0.1815 0 0));
  --draft: light-dark(oklch(0.47 0.102 69.33), oklch(0.8371 0.1285 69.9811));
  /* ... */
}
```

- **`light-dark()`** picks a value by the element's `color-scheme`, so a token never needs a second definition in `.dark`. Webview support is in `cross-platform.md`.
- **Values are oklch.** Write new ones in oklch too, so the file stays consistent (see Adding a token for exact conversion).
- **`@theme inline`** maps each token to a Tailwind colour (`--color-draft: var(--draft)`), so it works as a normal utility with variants and opacity modifiers: `text-draft`, `hover:bg-draft-bg/80`.
- **The styleguide's "Colour tokens" section** (`localhost:1420/styleguide.html?section=colours`) shows every token as a swatch. Shoot it with `bun run app styleguide colours` to compare both themes. It flags any `:root` colour token missing from its list, `COLOUR_TOKEN_GROUPS` in `lib/colour-tokens.ts`.

### Groups

- **App chrome:** shadcn's tokens plus our own. A comment above them in `App.css` says what each surface is for:
  - `--background` is the chrome: sidebars, and the title bar while a panel is open;
  - `--card` and `--popover` are raised above it (dialogs, menus);
  - `--muted`, `--secondary` and `--accent` are subtle fills, hover and selected rows;
  - `--sidebar-*` is only for the preferences dialog's sidebar.

  Our own chrome tokens are `--heading`, `--icon`, `--active`, `--overlay`, `--image-preview*` and `--framework-*`.
- **Status:** `--draft`, `--filter` (each with a `-bg` tint), `--required`, and `--warning` for what AE couldn't fully read and for frontmatter values outside their constraints (errors use `--destructive`). A strong colour and its background tint are separate tokens, because each token name means one colour for every utility.
- **Window controls:** the Windows caption buttons and the macOS traffic lights.
- **Editor:** `--editor-color-*`, the iA Writer palette for the writing surface only (see `editor-styles.md`). Keep all of it, used or not. The chrome and the editor differ on purpose; for example, editor text in dark mode is softer than UI text. The app chrome uses the editor background in one place: the title bar when both panels are hidden, so the window reads as one surface.

## How the theme is applied

`ThemeProvider` (`src/lib/theme-provider.tsx`) takes `light`, `dark` or `system` and:

1. sets the native window theme with Tauri's `setTheme()` (`null` for system), so native context menus and dialogs match the app rather than the OS;
2. adds `.light` or `.dark` to `<html>`, resolving `system` with `prefers-color-scheme` and following its changes.

`.light` and `.dark` set `color-scheme`, which `light-dark()` follows. Until React adds a class, `:root { color-scheme: light dark }` follows the OS, so the first paint is already in the system theme. Tailwind's `dark:` variant is keyed to the `.dark` class (`@custom-variant dark`).

The user's heading colours from Appearance settings are set by Layout as `--heading-color-light` and `--heading-color-dark`, only when the user picked one. `--editor-color-heading` picks between them with `light-dark()`, falling back to the editor text colour, which is how a colour theme colours headings.

## User themes

A colour theme is a CSS file in the app data folder's `themes/` folder, chosen with `appearance.colorTheme`. The code is `lib/colour-themes.ts` and `hooks/useColourTheme.ts`; the user docs are in the website's `reference/advanced-preferences.mdx`.

- **Only colour tokens are read, and set as inline styles on `<html>`.** The file is never added as a stylesheet, so a theme can't add rules. Values with `url(` or a quote are dropped: tokens feed `background` shorthands, where those could load an image.
- **The token list is `COLOUR_TOKEN_GROUPS`, not read from the CSSOM.** Production builds rewrite `light-dark()`: Vite minifies CSS with Lightning CSS for targets that include Safari 16.4, so every token becomes `var(--lightningcss-light, …) var(--lightningcss-dark, …)`, while the dev server serves `App.css` as written. Themes are unaffected, since they're applied at runtime with native `light-dark()`.
- **Token names are public.** Renaming one silently breaks user themes that set it (they get the default), so mention renames in the release notes.

## Rules

- **No Tailwind palette colours** (`text-gray-700`, `bg-black/50`, `text-white`). The ast-grep rule `no-palette-colours` fails `check:all` on them.
- **No arbitrary token classes** (`bg-[var(--x)]`). Register the token in `@theme inline` and use the utility.
- **Don't name a `:root` token `--color-*`.** That namespace belongs to `@theme`, and a clash silently breaks the generated utilities.
- **Tokens are full colour values.** Use `var(--token)`, never `hsl(var(--token))`, which is invalid and silently dropped.
- **Never register a token with `@property`.** WebKit and Firefox resolve a registered `light-dark()` value wrongly.
- **Avoid relative colour syntax** (`oklch(from var(--x) …)`) on tokens; early WebKit got it wrong with `light-dark()`.
- **Non-colour dark-mode overrides** go in a `.dark` rule, placed after the `:root` rule they override, since both have the same specificity. The editor's lighter dark-mode font weight in `Editor.css` is one.
- **Text selection outside the editor is left to the system.** A custom `::selection` would lose the grey selection macOS shows in an inactive window. The editor draws its own with `--editor-color-selectedtext-background`.

### shadcn components

- shadcn's own `dark:` idioms in `src/components/ui/` (`dark:bg-input/30`, `dark:aria-invalid:ring-destructive/40`) stay. They already read from tokens, and stripping them would make every future `shadcn add` a bigger merge. Literal colours in them get replaced with tokens.
- shadcn's standard theme tokens stay even when nothing reads them yet (`--card-foreground`, `--sidebar-primary*`): components added later expect them.
- `shadcn add` writes any CSS variables a component ships into `:root` and `.dark` blocks. Fold them into the token block as `light-dark()` pairs.

## Adding a token

1. Add it to the right group in the `:root` block in `App.css` as a `light-dark()` pair, or a single value if it's the same in both themes. Add a short comment if its use isn't obvious from the name.
2. If components use it as a class, register it in `@theme inline`: `--color-name: var(--name)`.
3. Add it to `COLOUR_TOKEN_GROUPS` in `src/lib/colour-tokens.ts`. That's the styleguide's list and the tokens a user theme may set.

To convert existing colours to oklch exactly, `@csstools/css-color-parser` is in `node_modules` (a dependency of jsdom). It parses any CSS colour and serialises to oklch. Four decimal places stay within a fraction of one 8-bit level.
