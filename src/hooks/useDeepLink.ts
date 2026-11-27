import { useEffect, useRef } from 'react'
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link'
import { error as logError } from '@tauri-apps/plugin-log'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  parseDeepLink,
  resolveDeepLinkStartup,
  type DeepLink,
} from '../lib/deep-link'
import { toast } from '../lib/toast'

declare global {
  interface Window {
    /** Dev only: handles a URL as if it came from the URL scheme, which dev builds don't register */
    __openUrl?: (url: string) => Promise<void>
  }
}

function logOpenError(error: unknown) {
  void logError(`Deep link failed to open: ${String(error)}`)
}

interface DeepLinkHandlers {
  openFileByPath: (path: string) => Promise<void>
  createFileFromLink: (link: DeepLink & { action: 'new' }) => Promise<void>
}

/**
 * Wires up the `astro-editor://` URL scheme (`open` and `new`, see
 * `parseDeepLink`).
 *
 * Handles two cases:
 * - **Warm** (app already running): `onOpenUrl` fires with the incoming URL(s).
 * - **Cold start** (app launched *by* the link): `onOpenUrl` does not fire for
 *   the launch URL, so we read it once via `getCurrent()`.
 *
 * On cold start we also signal `resolveDeepLinkStartup` so the persisted-project
 * loader yields to the deep link's target project (see `loadPersistedProject`).
 * Every link names its project, so any link the app understands claims startup.
 */
export function useDeepLink(handlers: DeepLinkHandlers) {
  // Capture the latest callbacks in a ref so listeners are set up only once
  // (mirrors useMenuEvents) — re-registering would re-process the launch URL.
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined
    // Links are handled one at a time, in order, so one that arrives while a
    // file is being created waits rather than being dropped
    let queue = Promise.resolve()

    const handleUrl = async (url: string) => {
      const link = parseDeepLink(url)
      // Bring the window forward immediately so the app visibly responds.
      try {
        const win = getCurrentWindow()
        await win.show()
        await win.unminimize()
        await win.setFocus()
      } catch {
        // Best-effort — focusing should never block handling the link.
      }

      if (!link) {
        toast.error("Astro Editor can't use that link", {
          description: url,
        })
        return
      }
      if (link.action === 'open') {
        await handlersRef.current.openFileByPath(link.path)
      } else {
        await handlersRef.current.createFileFromLink(link)
      }
    }

    const enqueue = (url: string) => {
      queue = queue.then(() => handleUrl(url).catch(logOpenError))
      return queue
    }

    if (import.meta.env.DEV) window.__openUrl = enqueue

    const setup = async () => {
      // Cold start: retrieve the launch URL(s), if any.
      // No launch URL / plugin unavailable — fall back to normal startup.
      const launchUrls = await getCurrent()
        .then(urls => urls ?? [])
        .catch((e: unknown) => {
          void logError(`Deep link getCurrent failed: ${String(e)}`)
          return []
        })

      // Let the persisted-project loader know whether to stand down.
      resolveDeepLinkStartup(launchUrls.some(url => parseDeepLink(url)))

      if (!cancelled) {
        for (const url of launchUrls) {
          await handleUrl(url).catch(logOpenError)
        }
      }

      // Warm: handle subsequent deep links while the app is running.
      unlisten = await onOpenUrl(urls => {
        for (const url of urls) void enqueue(url)
      }).catch((e: unknown) => {
        void logError(`Deep link onOpenUrl registration failed: ${String(e)}`)
        return undefined
      })
    }

    void setup()

    return () => {
      cancelled = true
      unlisten?.()
      if (import.meta.env.DEV) delete window.__openUrl
    }
  }, [])
}
