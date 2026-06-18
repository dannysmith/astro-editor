import { useEffect, useRef } from 'react'
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link'
import { error as logError } from '@tauri-apps/plugin-log'
import { parseDeepLinkPath, resolveDeepLinkStartup } from '../lib/deep-link'

/**
 * Wires up the `astro-editor://open?path=...` URL scheme.
 *
 * Handles two cases:
 * - **Warm** (app already running): `onOpenUrl` fires with the incoming URL(s).
 * - **Cold start** (app launched *by* the link): `onOpenUrl` does not fire for
 *   the launch URL, so we read it once via `getCurrent()`.
 *
 * On cold start we also signal `resolveDeepLinkStartup` so the persisted-project
 * loader yields to the deep link's target project (see `loadPersistedProject`).
 */
export function useDeepLink(openFileByPath: (path: string) => Promise<void>) {
  // Capture the latest callback in a ref so listeners are set up only once
  // (mirrors useMenuEvents) — re-registering would re-process the launch URL.
  const openFileByPathRef = useRef(openFileByPath)

  useEffect(() => {
    openFileByPathRef.current = openFileByPath
  }, [openFileByPath])

  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined

    const handleUrl = async (url: string) => {
      const path = parseDeepLinkPath(url)
      if (path) {
        await openFileByPathRef.current(path)
      }
    }

    const setup = async () => {
      // Cold start: retrieve the launch URL(s), if any.
      try {
        const launchUrls = await getCurrent()
        const openUrls = (launchUrls ?? []).filter(
          url => parseDeepLinkPath(url) !== null
        )

        // Let the persisted-project loader know whether to stand down.
        resolveDeepLinkStartup(openUrls.length > 0)

        if (!cancelled) {
          for (const url of openUrls) {
            await handleUrl(url)
          }
        }
      } catch (e) {
        // No launch URL / plugin unavailable — fall back to normal startup.
        resolveDeepLinkStartup(false)
        await logError(`Deep link getCurrent failed: ${String(e)}`)
      }

      // Warm: handle subsequent deep links while the app is running.
      try {
        unlisten = await onOpenUrl(urls => {
          for (const url of urls) {
            void handleUrl(url)
          }
        })
      } catch (e) {
        await logError(`Deep link onOpenUrl registration failed: ${String(e)}`)
      }
    }

    void setup()

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])
}
