/**
 * Colour themes: CSS files of colour token overrides in the `themes/` folder of
 * the app data folder, picked in Preferences. Only colour tokens are read from
 * a file, and they're set as inline styles on <html>, so a theme can't add
 * rules or load anything. See docs/developer/color-system.md.
 */
import { COLOUR_TOKEN_GROUPS } from './colour-tokens'

/**
 * The tokens a theme may set: every colour token except the heading colour,
 * which follows the user's preference and falls back to the editor text colour
 */
const THEME_TOKENS: ReadonlySet<string> = new Set(
  COLOUR_TOKEN_GROUPS.flatMap(group => group.tokens).filter(
    token => token !== 'editor-color-heading'
  )
)

/** Token names, without `--`, and their values */
export type ThemeTokens = Record<string, string>

/**
 * A value that could load something when a token is used in a `background`
 * shorthand: `url()`, a string as in `image-set("…")`, or an escape, which
 * could spell `url(` (`\75 rl(`). No colour has any of these.
 */
const LOADS_SOMETHING = /url\(|["'\\]/i

/**
 * Reads the colour tokens from a theme's CSS. Only declarations in top-level
 * style rules count; the browser drops anything it can't parse, and `@import`.
 * `ignored` lists the declarations left out: other properties, unknown
 * tokens, and values that could load something.
 */
export function parseColourTheme(css: string): {
  tokens: ThemeTokens
  ignored: string[]
} {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  const tokens: ThemeTokens = {}
  const ignored: string[] = []
  for (const rule of sheet.cssRules) {
    if (!(rule instanceof CSSStyleRule)) continue
    for (const property of rule.style) {
      const token = property.slice(2)
      const value = rule.style.getPropertyValue(property).trim()
      if (
        property.startsWith('--') &&
        THEME_TOKENS.has(token) &&
        !LOADS_SOMETHING.test(value)
      ) {
        tokens[token] = value
      } else {
        ignored.push(property)
      }
    }
  }
  return { tokens, ignored }
}

/**
 * Sets a theme's tokens on <html>, where inline styles beat App.css, and
 * removes any the previous theme set. Tokens the theme leaves out keep their
 * App.css value. `{}` goes back to the default colours.
 */
export function applyColourTheme(tokens: ThemeTokens) {
  const { style } = document.documentElement
  for (const token of THEME_TOKENS) {
    const value = tokens[token]
    if (value) style.setProperty(`--${token}`, value)
    else style.removeProperty(`--${token}`)
  }
}

/**
 * The chosen theme's tokens, kept so the next launch can apply them before
 * settings load, without a flash of the default colours. Only set while a
 * theme is in use.
 */
const CACHE_KEY = 'astro-editor-colour-theme'

/** Keeps the tokens for the next launch, or forgets them with `null` */
export function cacheColourTheme(tokens: ThemeTokens | null) {
  if (tokens) localStorage.setItem(CACHE_KEY, JSON.stringify(tokens))
  else localStorage.removeItem(CACHE_KEY)
}

/** Applies the cached theme, if there is one. Runs before React renders */
export function applyCachedColourTheme() {
  const cached = localStorage.getItem(CACHE_KEY)
  if (!cached) return
  try {
    applyColourTheme(JSON.parse(cached) as ThemeTokens)
  } catch {
    localStorage.removeItem(CACHE_KEY)
  }
}
