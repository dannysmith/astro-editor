import { useEffect } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { error as logError } from '@tauri-apps/plugin-log'
import { getExternalUrlFromClick } from '../lib/external-links'

/**
 * App-wide safety net that routes external links to the OS default browser.
 *
 * Registers a single capturing click listener on the document. Any click on an
 * external link (e.g. inside update release notes rendered via
 * `dangerouslySetInnerHTML`) is intercepted and opened in the user's default
 * browser instead of navigating the Tauri webview away from the app.
 *
 * See `lib/external-links.ts` for the link-classification logic.
 */
export function useExternalLinkHandler() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const url = getExternalUrlFromClick(event)
      if (!url) return

      // We fully handle external links here. Stop propagation so component-level
      // handlers (e.g. DocsLink) don't also fire and open the URL twice.
      event.preventDefault()
      event.stopPropagation()
      void openUrl(url).catch(err => {
        void logError(`Failed to open external URL: ${String(err)}`)
      })
    }

    // Capture phase so we intercept before any component-level navigation.
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])
}
