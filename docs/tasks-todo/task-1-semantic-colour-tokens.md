# Semantic Colour Tokens

Make every colour in the app a semantic CSS variable, defined once with `light-dark()` in oklch, so we control all of them in both modes from one place. This is the groundwork for #197 (user themes) but doesn't add any theme loading. It replaces #274, which predates the Base UI migration: close it with thanks and credit MareDevi in the new PR.

## Context

- **Where colour lives now:**
  - **`App.css` `:root` / `.dark`:** shadcn and status tokens, mapped into Tailwind with `@theme inline`.
  - **`Editor.css` `:root` / `.dark`:** a separate `--editor-color-*` palette in rgba.
  - **Our components:** about 40 hardcoded Tailwind palette classes. Mostly the title bar, the Windows controls, form text, framework colours and `DebugScreen`.
  - **Raw values:** the traffic lights (hex), `ImagePreview` (inline styles, white in dark mode), and the CodeMirror snippet borders (`rgba(0,0,0,…)`).
  - **The heading colour:** JS applies it, and a `MutationObserver` watches for the `.dark` class. Its default is duplicated in four TS files.
- **CodeMirror is already fine.** `theme.ts` and `highlightStyle.ts` only use `--editor-color-*`, apart from the snippet borders.
- **Tokens stay semantic only.** No primitive palette layer.

### Two deliberate token sets

The app tokens (`--background`, `--foreground` and so on) are for the chrome around the editor. The `--editor-color-*` tokens are the iA Writer palette, for the writing surface only, and they differ on purpose. For example, editor text in dark mode is 80% grey, against the UI's 90%, for long-form reading. They stay separate, with separate names. `docs/developer/editor-styles.md` says to keep the whole editor palette, including the unused `highlight-*` colours. The one place the chrome uses an editor token on purpose is the title bar when both panels are hidden: it takes the editor background so the window reads as one surface.

### Why the other inconsistencies exist

- **`text-gray-900 dark:text-white` on form text, and the icon greys:** these came from the July 2025 dark-mode work, when tokens like `text-foreground` didn't render. Several rules wrapped already-`hsl()` tokens in `hsl()` again. That was fixed in October 2026 (95ef1e38), so the workaround no longer has a reason to exist.
- **Tailwind's `gray-*` is blue-tinted;** every token is a neutral grey. The title bar (`gray-50`), icon buttons (`gray-700` / `gray-300`) and form text (`gray-900`) carry a slight blue cast that nothing else has. Form text is also pure white in dark mode, brighter than the labels beside it.
- **Surfaces don't follow a scheme:**

  | Surface                                 | Light                | Dark          |
  | --------------------------------------- | -------------------- | ------------- |
  | Sidebars (`--background`)               | 100%                 | 7%            |
  | Card, popover                           | 100%                 | 9%            |
  | Editor                                  | 97%                  | 10%           |
  | Muted, accent                           | 96%                  | 12–15%        |
  | Title bar with panels (`gray-50`/black) | 98%, blue-tinted     | 0%            |

  The title bar is the odd one out: blue-tinted in light, and in dark the darkest thing on screen.
- **Selection looks three different ways:**
  - **Editor:** the iA cyan.
  - **`Input`:** shadcn's inverted `selection:bg-primary` (near-black in light).
  - **Textareas and tag input:** the macOS system accent.
- **"Active" is three colours:** focus and typewriter icons use `blue-500` / `blue-400`, the caret is cyan `rgb(0,195,255)`, and the search filter is the `--filter` cyan.
- **Draft is two colours:** the file list badge uses the red `destructive` variant, while the header, filter button and count use the orange `--draft`.
- **Unused tokens:** `--warning*` (`DebugScreen` uses raw yellow instead), `--sidebar-primary` and `--sidebar-primary-foreground`.

### Why `light-dark()` is safe here

- **macOS:** needs Safari 17.5+, which runs on Monterey and later. Tailwind v4 already needs Safari 16.4+, so the real floor was already past `minimumSystemVersion` (10.15). Checked in the dev WKWebView: `light-dark()` resolves inside custom properties and inside Tailwind's `color-mix()` opacity modifiers.
- **Windows:** WebView2 is evergreen Chromium, and `light-dark()` has worked since Chromium 123.
- **Linux:** every supported distro that ships `libwebkit2gtk-4.1` has WebKitGTK 2.50 or newer in its updates (Ubuntu 22.04: 2.50.4; 24.04: 2.52.6; Debian 12: 2.50.6). The AppImage bundles the ubuntu-22.04 runner's copy.

### Fitting shadcn and Tailwind

- **shadcn** still documents `:root` / `.dark` blocks plus `@theme inline`. `@theme inline` stays exactly as it is; only the variable definitions change shape. Components that ship CSS variables (sidebar, chart) make `shadcn add` write `:root` / `.dark` entries into `App.css`. Fold those into `light-dark()` by hand when it happens.
- **Keep the `.dark` class and Tailwind's `dark:` variant.** `.light` and `.dark` set `color-scheme`, which is what `light-dark()` follows. Non-colour overrides, like the editor's dark font weight, stay in `.dark`.
- **Leave shadcn's `dark:` idioms in `ui/`** (`dark:bg-input/30`, `dark:aria-invalid:ring-destructive/40`). They already read from tokens, and stripping them makes every future `shadcn add` a bigger merge. Literal colours (`bg-black/50`, `text-white`) go everywhere.
- **Gotchas:**
  - Never register a `light-dark()` token with `@property`. WebKit and Firefox both resolve registered ones wrongly.
  - Avoid relative colour syntax (`oklch(from var(--x) …)`) on tokens; early WebKit got it wrong with `light-dark()`.

### Converting to oklch without changing colours

- **The tool:** `@csstools/css-color-parser` is already in `node_modules` (pulled in by another package). It parses hex, rgba and hsl, and serialises to oklch and back.
- **The check script:** `docs/tasks-todo/temporary/oklch-check.ts` converts every colour literal in `App.css` and `Editor.css`, then checks each round trip to 8-bit sRGB. Run it with `bun docs/tasks-todo/temporary/oklch-check.ts $PWD`. Greys come out with a `NaN` hue; write those as `0`.
- **Precision:** 4 decimal places reproduces 82 of 84 values exactly. The other two (`hsl(0 0% 10%)` and `90%`, plus `50%` at 5 places) sit exactly on a half-step between two 8-bit values. Settle them with `app diff`.
- **Tailwind palette values** we keep in Phase 1 are already oklch in Tailwind's theme. Reference them as `var(--color-gray-700)` rather than copying numbers.

## Checkpoints

Where a step says **Checkpoint**, stop and show Danny before moving on.

- Save before and after shots to `docs/tasks-todo/temporary/colours/` as `<topic>-before-*` / `<topic>-after-*`, both themes. Note which screen each one shows.
- Where there are real options, shoot each one (`<topic>-a-*`, `<topic>-b-*`) and recommend one.
- Keep the change in the working tree until Danny picks, then commit.

## Phase 1: Tokens, pixel-identical

Nothing should look different at the end of this phase. Prove it with `app diff`.

- [ ] Baseline. The styleguide shots in `temporary/baseline/` don't cover the app chrome, so also shoot to `temporary/baseline-colours/`:
  - the editor with both panels, and with both hidden;
  - preferences, the component builder and an image preview;
  - the window unfocused;
  - a draft file selected with the drafts filter on.
- [ ] Move every colour token into one block in `App.css`, which is where `components.json` points `shadcn add`. That includes the editor palette from `Editor.css`; the `--editor-*` names stay
- [ ] Convert each token to one `light-dark()` declaration with the same values. Set `:root { color-scheme: light dark }` so the first paint follows the OS before React sets a class, and `.light` / `.dark` pin it
- [ ] Heading colour: Layout sets `--heading-color-light` and `--heading-color-dark` once, and `--editor-color-heading` is `light-dark()` of the two. Remove the `MutationObserver` and keep the default in one place
- [ ] Replace the hardcoded colours with tokens holding today's values, in our components, `ImagePreview` and `theme.ts`.
  - Reuse an existing token only where the value matches exactly. Otherwise add a new one, for example `--titlebar`, `--icon`, `--active`, `--overlay`, `--traffic-light-*`, `--framework-*`, `--input-text` and `--selection`.
  - Register every new token in `@theme inline` so it's a normal utility; no `bg-[var(--x)]`.
- [ ] Traffic lights: the unfocused colours become tokens, which drops the `.dark.window-unfocused` rules and the `!important`s
- [ ] `DebugScreen` uses the `--warning` tokens
- [ ] Convert all token values to oklch (see above), in its own commit
- [ ] Add a lint rule (ast-grep) banning Tailwind palette classes (`gray-700`, `blue-500`, `black`, `white` and so on) in `src/`
- [ ] Add a "colours" section to the styleguide: every token as a swatch with its name, grouped into chrome, editor, status and window, shot in both themes
- [ ] `app diff` against the baselines shows nothing changed. `bun run check:all` passes

## Phase 2: Consistency

Each item is a visible change and a **checkpoint**. The goal is a small, explainable set of surfaces and greys, reusing today's values where they already work.

- [ ] **Surfaces.** Settle on a named set (chrome, raised for card and popover, subtle for muted and hover, editor, title bar) and say what each is for in a comment. **Checkpoint**
- [ ] **Title bar with panels shown.** Options: (a) match the sidebars (`--background`); (b) its own neutral step between the sidebars and the editor. Without panels it keeps the editor background. **Checkpoint**
- [ ] **Neutral greys.** Re-point `--icon` and `--input-text` at neutral values, likely `--muted-foreground` and `--foreground`. That removes the blue tint and the pure white form text in dark mode. Then merge any tokens that become duplicates. **Checkpoint**
- [ ] **Selection.** One `--selection` everywhere. Options: (a) the editor's iA cyan for inputs and textareas too; (b) the system accent everywhere outside the editor. Also decide whether inputs get the editor's caret colour. **Checkpoint**
- [ ] **Active colour.** Replace `blue-500` / `blue-400` on the focus and typewriter icons with one `--active`. It might share a hue with the caret or `--filter`. **Checkpoint**
- [ ] **Draft.** The file list badge uses `--draft` rather than `destructive`. **Checkpoint**
- [ ] **Dark mode fixes.** Theme the image preview card and the snippet-field borders. **Checkpoint**
- [ ] **Unused tokens.** Remove the ones nothing reads (`--sidebar-primary*`, and any Phase 1 tokens merged away). The editor palette stays whole

## Phase 3: Theme switching and docs

- [ ] Call Tauri's `getCurrentWindow().setTheme()` from the ThemeProvider (`null` for system), so native menus and the vibrancy follow the app theme rather than the OS. Check whether they currently mismatch first
- [ ] Simplify `theme-provider.tsx` where `color-scheme` now does the work
- [ ] Rewrite `docs/developer/color-system.md`: one token file, the chrome / editor split, `light-dark()` and oklch, how to add a token, the shadcn rule, the gotchas. It currently recommends `text-gray-900 dark:text-white`
- [ ] Update the `light-dark()` platform notes in `cross-platform.md`. Consider raising `minimumSystemVersion` to match reality
- [ ] Close #274 with a thank-you, open the new PR, and comment on #197 with what this unlocks
