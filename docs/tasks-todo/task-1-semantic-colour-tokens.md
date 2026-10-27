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

- **The tool:** `@csstools/css-color-parser` is already in `node_modules` (pulled in by another package). It parses hex, rgba and hsl, and serialises to oklch and back. `docs/tasks-todo/temporary/oklch-convert.ts` rewrites the token block with it.
- **Precision:** 4 decimal places, converted from the exact float value. WebKit paints from the float rather than snapping to 8-bit first, so half-step greys like `hsl(0 0% 10%)` (25.5) can't be matched by rounding to a whole 8-bit value. The worst error at 4 places is 0.11 of one 8-bit level.
- **Checking:** `app diff` counts any changed pixel, so it flags those rounding differences everywhere. `docs/tasks-todo/temporary/max-delta.ts <a> <b>` reports the largest per-channel change instead. After the conversion, every shot stayed within 1 level.
- **Tailwind palette values** are copied as oklch literals rather than referenced as `var(--color-gray-700)`. Tailwind only emits the theme variables it sees used, and literals don't shift on a Tailwind upgrade.

## Checkpoints

Where a step says **Checkpoint**, stop and show Danny before moving on.

- Save before and after shots to `docs/tasks-todo/temporary/colours/` as `<topic>-before-*` / `<topic>-after-*`, both themes. Note which screen each one shows.
- Where there are real options, shoot each one (`<topic>-a-*`, `<topic>-b-*`) and recommend one.
- Keep the change in the working tree until Danny picks, then commit.

### Tooling

- **`bash docs/tasks-todo/temporary/colours-shots.sh <dir>`** shoots the app screens this task touches, plus every styleguide section, in both themes. It pins the traffic lights (focused for `app-panels`, unfocused after); window focus otherwise changes them between runs. Repeat runs are pixel-identical.
- **Run `app reload` before shooting after an edit.** Shots taken while HMR is still applying catch transitions such as the welcome screen fading, or a different scroll position.
- **Toast shots are occasionally caught mid-animation.** Reshoot before trusting a toasts diff.
- **Shots that can't be taken:** the Windows caption buttons (macOS only renders the macOS title bar) and the image preview (needs a real Alt+hover).
- **Don't use `git stash` for probes.** This repo has an old stash entry, and `git stash pop` with nothing stashed applies it.

## Phase 1: Tokens, pixel-identical

Nothing should look different at the end of this phase. Prove it with `app diff`. Done on branch `semantic-colour-tokens`.

- [x] Baseline in `temporary/baseline-colours/`: the editor with and without panels, focus and typewriter modes on, the drafts filter with a draft selected, the component builder, preferences, the window unfocused, and every styleguide section
- [x] Move every colour token into one block in `App.css`, which is where `components.json` points `shadcn add`. That includes the editor palette from `Editor.css`; the `--editor-*` names stay
- [x] Convert each token to one `light-dark()` declaration with the same values. Set `:root { color-scheme: light dark }` so the first paint follows the OS before React sets a class, and `.light` / `.dark` pin it. All 38 shots identical
- [x] Heading colour: Layout sets `--heading-color-light` and `--heading-color-dark` once, and `--editor-color-heading` is `light-dark()` of the two, defaulting to `--editor-color-text`. The `MutationObserver` is gone, and `GeneralPane` reads the default from `DEFAULT_GLOBAL_SETTINGS`. `migrations.ts` keeps its literals, since a migration shouldn't change with the defaults
- [x] Replace the hardcoded colours with tokens holding today's values, registered in `@theme inline`:
  - **New tokens:** `--titlebar`, `--icon`, `--active`, `--input-foreground`, `--overlay`, `--image-preview*`, `--framework-*`, `--window-control-hover`, `--window-close*`, `--traffic-light-*` and `--editor-color-snippet-border*`, plus `--color-editor-background` for `bg-editor-background`.
  - **No `--selection` yet:** `Input`'s selection already uses tokens.
  - **Two intended classes now apply in dark mode,** because `dark:text-white` no longer overrides them. The frontmatter title uses `text-heading` (98% rather than 100%), and select placeholders are muted rather than white. These were the only differences in the shots.
  - **Outside the shots:**
    - `--destructive-foreground` is now white to match shadcn's destructive button and badge, which nudges `DebugPane`'s one use from 98% / 95%.
    - The Windows close button's icon now turns white on hover in dark mode too; `dark:text-gray-300` used to win.
- [x] Traffic lights: tokens, no `!important`. The `.dark.window-unfocused` rules never matched (`.dark` is on `<html>`, `.window-unfocused` on the group), so dark mode has always shown the light unfocused greys. Removed; see Phase 2
- [x] ~~`DebugScreen` uses the `--warning` tokens~~ Deleted instead: nothing has imported it since July 2025
- [x] Convert all token values to oklch (see above), in its own commit
- [x] Lint rule `no-palette-colours` (ast-grep). This needed `sgconfig.yml` to parse `src/` as tsx: the typescript grammar can't read JSX, so every rule was blind inside it. That exposed one Zustand destructure in `ComponentBuilderDialog`, now selectors
- [x] "Colours" styleguide section (`src/styleguide/ColoursSection.tsx`), grouped into chrome, preferences sidebar, status, window controls and editor. It lists any `:root` colour token missing from the page
- [x] Shots match (see above). `bun run check:all` passes

## Phase 2: Consistency

Each item is a visible change and a **checkpoint**. The goal is a small, explainable set of surfaces and greys, reusing today's values where they already work.

- [ ] **Surfaces.** Settle on a named set (chrome, raised for card and popover, subtle for muted and hover, editor, title bar) and say what each is for in a comment. **Checkpoint**
- [ ] **Title bar with panels shown.** Options: (a) match the sidebars (`--background`); (b) its own neutral step between the sidebars and the editor. Without panels it keeps the editor background. **Checkpoint**
- [ ] **Neutral greys.** Re-point `--icon` and `--input-foreground` at neutral values, likely `--muted-foreground` and `--foreground`. That removes the blue tint and the pure white form text in dark mode. Then merge any tokens that become duplicates. **Checkpoint**
- [ ] **Selection.** One `--selection` everywhere. Options: (a) the editor's iA cyan for inputs and textareas too; (b) the system accent everywhere outside the editor. Also decide whether inputs get the editor's caret colour. **Checkpoint**
- [ ] **Active colour.** `--active` is still `blue-500` / `blue-400`. Decide its value; it might share a hue with the caret or `--filter`. **Checkpoint**
- [ ] **Draft.** The file list badge uses `--draft` rather than `destructive`. **Checkpoint**
- [ ] **Dark mode fixes.** Theme the image preview card and the snippet-field borders. **Checkpoint**
- [ ] **Unfocused traffic lights in dark mode.** The intended dark greys (`#5a5a5a`, border `#4a4a4a`, hover `#6a6a6a`) never applied. Shoot both and decide. **Checkpoint**
- [ ] **Editor typography in dark mode.** `.dark { --editor-font-weight-normal: 480; --editor-letter-spacing: 0.005em }` in `Editor.css` never applied, because the `:root` typography block after it wins. Dark mode has always used 490 and 0. Decide whether to apply it. **Checkpoint**
- [ ] **Unused tokens.** Remove the ones nothing reads (`--sidebar-primary*`, `--warning*`, and any Phase 1 tokens merged away). The editor palette stays whole

## Phase 3: Theme switching and docs

- [ ] Call Tauri's `getCurrentWindow().setTheme()` from the ThemeProvider (`null` for system), so native menus and the vibrancy follow the app theme rather than the OS. Check whether they currently mismatch first
- [ ] Simplify `theme-provider.tsx` where `color-scheme` now does the work
- [ ] Rewrite `docs/developer/color-system.md`: one token file, the chrome / editor split, `light-dark()` and oklch, how to add a token, the shadcn rule, the gotchas, the colours styleguide section. It currently recommends `text-gray-900 dark:text-white`
- [ ] `docs/developer/editor-styles.md` lists the editor palette in rgba. Point it at `App.css` instead of repeating the values
- [ ] Update the `light-dark()` platform notes in `cross-platform.md`. Consider raising `minimumSystemVersion` to match reality
- [ ] Close #274 with a thank-you, open the new PR, and comment on #197 with what this unlocks
