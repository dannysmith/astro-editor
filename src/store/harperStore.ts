import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HarperCheck,
  HarperDialect,
} from '../lib/editor/extensions/harper/checks'

/** An issue Harper found in the open document, as the Copyedit panel lists it */
export interface HarperIssue {
  check: HarperCheck
  /** Harper's name for the kind of issue, like "Word Choice" */
  kind: string
  /** The text the issue is about */
  text: string
  message: string
  /** The names of its fixes, which `applyIssueAction` applies by index */
  actions: string[]
}

/**
 * Harper's state: idle until a check is first switched on, then loading while
 * its WebAssembly starts, then ready (or error if it couldn't start)
 */
export type HarperStatus = 'idle' | 'loading' | 'ready' | 'error'

interface HarperState {
  checks: Record<HarperCheck, boolean>
  dialect: HarperDialect
  /** Words added to the user's dictionary */
  words: string[]
  status: HarperStatus
  /** The open document's issues, in document order */
  issues: HarperIssue[]
  /** The index in `issues` of the issue at the cursor */
  activeIssue: number | null
}

interface HarperActions {
  setCheck: (check: HarperCheck, on: boolean) => void
  setDialect: (dialect: HarperDialect) => void
  addWord: (word: string) => void
  setStatus: (status: HarperStatus) => void
  setIssues: (issues: HarperIssue[]) => void
  setActiveIssue: (index: number | null) => void
}

/**
 * Harper's settings and what it found. The editor extension
 * (`lib/editor/extensions/harper`) follows the settings and publishes the
 * issues; the Copyedit panel shows both. The settings are kept in
 * localStorage.
 */
export const useHarperStore = create<HarperState & HarperActions>()(
  persist(
    set => ({
      checks: { spelling: false, grammar: false, style: false },
      dialect: 'American',
      words: [],
      status: 'idle',
      issues: [],
      activeIssue: null,

      setCheck: (check, on) =>
        set(state => ({ checks: { ...state.checks, [check]: on } })),
      setDialect: dialect => set({ dialect }),
      addWord: word =>
        set(state =>
          state.words.includes(word) ? state : { words: [...state.words, word] }
        ),
      setStatus: status => set({ status }),
      setIssues: issues => set({ issues }),
      setActiveIssue: activeIssue => set({ activeIssue }),
    }),
    {
      name: 'harper-settings',
      partialize: ({ checks, dialect, words }) => ({ checks, dialect, words }),
    }
  )
)
