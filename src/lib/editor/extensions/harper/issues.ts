/**
 * Harper's issues in the editor: what each one is, finding them in editor
 * state, and acting on them.
 *
 * An issue is a `@codemirror/lint` diagnostic, which the lint package maps
 * through edits, plus the details here. Fixes are applied only while the text
 * the issue was raised on is still there, so a stale list, a double click or
 * an edit inside the issue can never change the wrong text.
 */

import {
  forceLinting,
  forEachDiagnostic,
  type Diagnostic,
} from '@codemirror/lint'
import { StateEffect, type EditorState } from '@codemirror/state'
import { closeHoverTooltips, type EditorView } from '@codemirror/view'
import type { HarperCheck } from './checks'

/** A suggested fix for an issue, applied over the issue's current range */
export interface Fix {
  label: string
  apply: (view: EditorView, from: number, to: number) => void
}

export interface IssueDetails {
  /**
   * Identifies the issue in the panel. The same issue in unchanged text keeps
   * its id from one check to the next (see `checkDocument`)
   */
  id: string
  check: HarperCheck
  /** Harper's name for the kind of issue, like "Word Choice" */
  kind: string
  /** The text the issue was raised on */
  text: string
  fixes: Fix[]
  /** The word, when it can be added to the dictionary */
  word: string | null
  ignore: () => Promise<void>
}

export interface Issue {
  diagnostic: Diagnostic
  details: IssueDetails
  from: number
  to: number
}

const details = new WeakMap<Diagnostic, IssueDetails>()

/** Fixed issues, left out until the re-check that follows a fix replaces them */
const fixed = new WeakSet<Diagnostic>()

/** Records an issue's details with its diagnostic */
export function addIssue(diagnostic: Diagnostic, issue: IssueDetails) {
  details.set(diagnostic, issue)
}

/** The document's issues with their current positions, in document order */
export function currentIssues(state: EditorState): Issue[] {
  const issues: Issue[] = []
  forEachDiagnostic(state, (diagnostic, from, to) => {
    const found = details.get(diagnostic)
    if (found && !fixed.has(diagnostic)) {
      issues.push({ diagnostic, details: found, from, to })
    }
  })
  return issues
}

export function issueById(state: EditorState, id: string): Issue | undefined {
  return currentIssues(state).find(({ details }) => details.id === id)
}

/** The issues at `pos`; `side` says which way a position on an edge leans */
export function issuesAt(
  state: EditorState,
  pos: number,
  side: -1 | 1 = 1
): Issue[] {
  return currentIssues(state).filter(
    ({ from, to }) =>
      (from < pos || (from === pos && side > 0)) &&
      (to > pos || (to === pos && side < 0))
  )
}

/** Marks a transaction as needing a fresh check, though the document is the same */
export const recheckEffect = StateEffect.define()

/**
 * Checks the document again straight away. `forceLinting` alone only hurries
 * a check that's already waiting, so this schedules one first.
 */
export function recheck(view: EditorView) {
  view.dispatch({ effects: recheckEffect.of(null) })
  forceLinting(view)
}

/**
 * Applies a fix if the issue still covers the text it was raised on, then
 * closes the tooltip and re-checks
 */
export function applyFix(view: EditorView, diagnostic: Diagnostic, fix: Fix) {
  const issue = currentIssues(view.state).find(i => i.diagnostic === diagnostic)
  if (
    !issue ||
    view.state.sliceDoc(issue.from, issue.to) !== issue.details.text
  )
    return
  fixed.add(diagnostic)
  fix.apply(view, issue.from, issue.to)
  view.dispatch({ effects: closeHoverTooltips })
  recheck(view)
}
