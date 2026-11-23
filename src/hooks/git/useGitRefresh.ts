import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import { commands } from '@/lib/bindings'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'

/** How long to wait for other changes before reading git again */
const REFRESH_DELAY_MS = 200

/**
 * Keeps the Git tab current while it's showing. People commit from other apps
 * as they write, often side by side, so the tab can't wait for AE to be
 * focused again. It reads git again when:
 *
 * - the git folder changes (the watcher Rust runs for as long as this is
 *   mounted: a commit, staging, a push, a fetch, a branch switch)
 * - the project watcher sees a content file change, AE's own saves included
 * - the window is focused again
 *
 * These often come together (a save, then the watcher's event for it), and
 * each read runs several git commands, so they're gathered into one read.
 *
 * The Git panel is inside `<Activity>`, which tears effects down while it's
 * hidden, so none of this runs unless the tab is on screen.
 */
export function useGitRefresh(projectPath: string) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.gitStates(projectPath),
        })
      }, REFRESH_DELAY_MS)
    }

    // Stopped with the number its start returns, once it has, so hiding the
    // tab before the watcher started still stops it, and a late stop can't
    // end the watcher a later showing started
    const watcher = commands.gitWatchStart(projectPath).then(result => {
      if (result.status === 'ok') return result.data
      void logWarn(`Astro Editor [GIT] ${result.error}`)
      return null
    })
    const unlisten = listen<string>('git-changed', event => {
      if (event.payload === projectPath) refresh()
    })
    window.addEventListener('file-changed', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      clearTimeout(timer)
      void watcher.then(id => {
        if (id !== null) void commands.gitWatchStop(id)
      })
      void unlisten.then(stop => stop())
      window.removeEventListener('file-changed', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [projectPath])
}
