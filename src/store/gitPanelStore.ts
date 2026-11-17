import { create } from 'zustand'

interface GitPanelState {
  /**
   * The changed files each entry's text has named this session, keyed by the
   * entry's absolute path. An image dragged in and then taken out of the text
   * usually stays on disk, so the Git tab keeps offering it with the entry,
   * unticked. Forgotten when AE quits.
   */
  named: Record<string, string[]>
  /** Adds to the files an entry has named */
  rememberNamed: (entry: string, paths: string[]) => void
  /**
   * Files renamed this session: the path each had first, keyed by its path
   * now (both absolute). Git sees a rename as the old path deleted and the new
   * one added, so the Git tab offers the old path with the entry. Forgotten
   * when AE quits.
   */
  renamedFrom: Record<string, string>
  rememberRename: (from: string, to: string) => void
}

export const useGitPanelStore = create<GitPanelState>((set, get) => ({
  named: {},
  rememberNamed: (entry, paths) => {
    const known = get().named[entry] ?? []
    const added = paths.filter(path => !known.includes(path))
    if (added.length === 0) return
    set(state => ({ named: { ...state.named, [entry]: [...known, ...added] } }))
  },
  renamedFrom: {},
  rememberRename: (from, to) => {
    set(state => {
      const { [from]: first = from, ...rest } = state.renamedFrom
      return { renamedFrom: { ...rest, [to]: first } }
    })
  },
}))
