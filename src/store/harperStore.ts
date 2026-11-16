import { create } from 'zustand'
import type { HarperCheck } from '../lib/editor/extensions/harper/checks'

/** An issue Harper found in the open document, as the Copyedit panel lists it */
export interface HarperIssue {
  /** What the panel's actions refer to the issue by. See `IssueDetails.id` */
  id: string
  check: HarperCheck
  /** Harper's name for the kind of issue, like "Word Choice" */
  kind: string
  /** The text the issue is about */
  text: string
  /** Harper's message, with the words it quotes in backticks */
  message: string
  /** Its suggested fixes, which `applyIssueFix` applies by index */
  fixes: string[]
}

/**
 * Harper's state: idle until the first check, loading while its WebAssembly
 * starts, then ready. Error when a check failed; the next one starts Harper
 * afresh.
 */
export type HarperStatus = 'idle' | 'loading' | 'ready' | 'error'

interface HarperState {
  status: HarperStatus
  /** The open document's issues, in document order */
  issues: HarperIssue[]
  /** The id of the issue at the cursor */
  activeIssue: string | null
}

interface HarperActions {
  setStatus: (status: HarperStatus) => void
  setIssues: (issues: HarperIssue[]) => void
  setActiveIssue: (id: string | null) => void
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
