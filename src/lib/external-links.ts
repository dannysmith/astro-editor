/**
 * Shared logic for routing external links to the OS default browser.
 *
 * In a Tauri webview, a plain `<a href="https://…">` click navigates the app
 * window itself — replacing the app with the website and leaving no way back.
 * Any external link, wherever it is rendered (release notes, injected HTML,
 * etc.), should instead open in the user's default browser so the app keeps
 * feeling like a native Mac app.
 *
 * This module provides the pure decision logic; `useExternalLinkHandler` wires
 * it up as a single app-wide click listener.
 */

const EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:'])

/**
 * Given a click event, determine whether it targets an external link that
 * should be opened in the OS browser rather than navigated to in the webview.
 *
 * Returns the absolute URL to open, or `null` when the click should be left
 * to its default behaviour (not an anchor, an in-app link, a modified click,
 * or already handled).
 */
export const getExternalUrlFromClick = (event: MouseEvent): string | null => {
  // Only handle unmodified primary-button clicks that nothing else has handled.
  if (event.defaultPrevented) return null
  if (event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return null
  }

  const target = event.target
  if (!(target instanceof Element)) return null

  const anchor = target.closest('a')
  if (!anchor) return null

  // `href` is the property (resolved to absolute), not the raw attribute.
  const href = anchor.href
  if (!href) return null

  // `mailto:`/`tel:` always go to the OS handler.
  if (EXTERNAL_PROTOCOLS.has(anchor.protocol)) return href

  // For http(s), only treat cross-origin links as external. Same-origin links
  // are in-app navigation (or the dev server) and must be left alone.
  if (anchor.protocol === 'http:' || anchor.protocol === 'https:') {
    if (anchor.origin !== window.location.origin) return href
  }

  return null
}
