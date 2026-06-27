/**
 * Shared logic for routing link clicks safely in a Tauri webview.
 *
 * In a Tauri webview, a plain `<a href="https://…">` click navigates the app
 * window itself — replacing the app with the website and leaving no way back.
 * Any external link, wherever it is rendered (release notes, injected HTML,
 * etc.), should instead open in the user's default browser so the app keeps
 * feeling like a native Mac app. Likewise, links using webview-navigating or
 * script schemes (`data:`, `file:`, `javascript:`) must never replace the app.
 *
 * This module provides the pure decision logic; `useExternalLinkHandler` wires
 * it up as a single app-wide click listener.
 */

// Protocols that should always be handed to the OS default handler.
const EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:'])

// Protocols that must never navigate the webview. We can't meaningfully open
// these externally, so the safe action is to block the click entirely.
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'file:'])

/**
 * What to do with a link click:
 * - `open`: open `url` in the OS default browser (don't navigate the webview)
 * - `block`: prevent navigation but do nothing else (unsafe/webview-only scheme)
 * - `ignore`: leave the click to its default behaviour
 */
export type LinkClickAction =
  | { type: 'open'; url: string }
  | { type: 'block' }
  | { type: 'ignore' }

const IGNORE: LinkClickAction = { type: 'ignore' }

/**
 * Classify a click event against the nearest anchor, deciding whether it should
 * open externally, be blocked, or be ignored. Modified clicks, non-anchor
 * clicks, and in-app (same-origin) links are ignored.
 */
export const classifyLinkClick = (event: MouseEvent): LinkClickAction => {
  // Only handle unmodified primary-button clicks that nothing else has handled.
  if (event.defaultPrevented) return IGNORE
  if (event.button !== 0) return IGNORE
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return IGNORE
  }

  const target = event.target
  if (!(target instanceof Element)) return IGNORE

  const anchor = target.closest('a')
  if (!anchor) return IGNORE

  // `href` is the property (resolved to absolute), not the raw attribute.
  const href = anchor.href
  if (!href) return IGNORE

  // `mailto:`/`tel:` always go to the OS handler.
  if (EXTERNAL_PROTOCOLS.has(anchor.protocol))
    return { type: 'open', url: href }

  // For http(s), only treat cross-origin links as external. Same-origin links
  // are in-app navigation (or the dev server) and must be left alone.
  if (anchor.protocol === 'http:' || anchor.protocol === 'https:') {
    return anchor.origin !== window.location.origin
      ? { type: 'open', url: href }
      : IGNORE
  }

  // Schemes that would navigate the webview away from the app (or run script)
  // are blocked rather than allowed through.
  if (BLOCKED_PROTOCOLS.has(anchor.protocol)) return { type: 'block' }

  return IGNORE
}
