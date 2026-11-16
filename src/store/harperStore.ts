import { create } from 'zustand'
import type { HarperCheck } from '../lib/editor/extensions/harper/checks'

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
  status: HarperStatus
  /** The open document's issues, in document order */
  issues: HarperIssue[]
  /** The index in `issues` of the issue at the cursor */
  activeIssue: number | null
}

interface HarperActions {
  setStatus: (status: HarperStatus) => void
  setIssues: (issues: HarperIssue[]) => void
  setActiveIssue: (index: number | null) => void
}

/**
 * What Harper is doing and what it found. The editor extension
 * (`lib/editor/extensions/harper`) publishes it and the Copyedit panel shows
 * it. Harper's settings are global settings (`harper/settings.ts`).
 */
export const useHarperStore = create<HarperState & HarperActions>()(set => ({
  status: 'idle',
  issues: [],
  activeIssue: null,

  setStatus: status => set({ status }),
  setIssues: issues => set({ issues }),
  setActiveIssue: activeIssue => set({ activeIssue }),
}))
