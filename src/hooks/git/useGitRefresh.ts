import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { warn as logWarn } from '@tauri-apps/plugin-log'
import { commands } from '@/lib/bindings'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { useEditorStore } from '../../store/editorStore'

/**
 * Keeps the Git tab current while it's showing. People commit from other apps
 * as they write, often side by side, so the tab can't wait for AE to be
 * focused again. It reads git again when:
 *
 * - the git folder changes (the watcher Rust runs for as long as this is
 *   mounted: a commit, staging, a push, a fetch, a branch switch)
 * - AE saves the open file
 * - the project watcher sees a content file change
 * - the window is focused again
 *
 * The Git panel is inside `<Activity>`, which tears effects down while it's
 * hidden, so none of this runs unless the tab is on screen.
 */
export function useGitRefresh(projectPath: string) {
  useEffect(() => {
    const refresh = () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gitStates(projectPath),
      })

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
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.lastSaveTimestamp !== previous.lastSaveTimestamp) refresh()
    })
    window.addEventListener('file-changed', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      void watcher.then(id => {
        if (id !== null) void commands.gitWatchStop(id)
      })
      void unlisten.then(stop => stop())
      unsubscribe()
      window.removeEventListener('file-changed', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [projectPath])
}
