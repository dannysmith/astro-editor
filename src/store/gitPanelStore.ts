import { create } from 'zustand'
import type { Staging } from '../lib/git/staging'

interface GitPanelState {
  /**
   * The files AE copied into the project for each entry this session (dropped
   * in, or picked for an image field or prop), keyed by the entry's absolute
   * path, all absolute. One taken out of the text again usually stays on disk,
   * so the Git tab keeps offering it with the entry, unticked. Recorded where
   * the copy happens, so it doesn't matter whether the tab is open. Forgotten
   * when AE quits.
   */
  added: Record<string, string[]>
  rememberAdded: (entry: string, path: string) => void
  /**
   * Files renamed this session: the path each had first, keyed by its path
   * now (both absolute). Git sees a rename as the old path deleted and the new
   * one added, so the Git tab offers the old path with the entry. Forgotten
   * when AE quits.
   */
  renamedFrom: Record<string, string>
  /**
   * Also moves the files added for an entry, and what's staged for it, along
   * with it
   */
  rememberRename: (from: string, to: string) => void
  /** What the Git tab last staged, and for which entry (see `staging.ts`) */
  staging: Staging | null
  setStaging: (staging: Staging | null) => void
}

export const useGitPanelStore = create<GitPanelState>((set, get) => ({
  added: {},
  rememberAdded: (entry, path) => {
    const known = get().added[entry] ?? []
    if (known.includes(path)) return
    set(state => ({ added: { ...state.added, [entry]: [...known, path] } }))
  },
  renamedFrom: {},
  rememberRename: (from, to) => {
    set(state => {
      const { [from]: first = from, ...renamedFrom } = state.renamedFrom
      const { [from]: added, ...others } = state.added
      return {
        renamedFrom: { ...renamedFrom, [to]: first },
        added: added ? { ...others, [to]: added } : state.added,
        staging:
          state.staging?.entry === from
            ? { ...state.staging, entry: to }
            : state.staging,
      }
    })
  },
  staging: null,
  setStaging: staging => set({ staging }),
}))
