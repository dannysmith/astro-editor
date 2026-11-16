/**
 * Harper's spelling, grammar and style checks in the editor.
 *
 * Built on `@codemirror/lint`, which runs the check after typing pauses and
 * keeps the issues in editor state, mapped through edits. This adds the
 * Harper source, the underlines, the issue tooltip (`tooltip.ts`), and a
 * plugin that publishes the issues to `harperStore` for the Copyedit panel and
 * re-checks when Harper's settings change. `issues.ts` holds what each issue
 * is and how it's fixed.
 */

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { linter, setDiagnosticsEffect, type Diagnostic } from '@codemirror/lint'
import type { EditorState } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { HarperLint } from './harper.worker'
import { useHarperStore, type HarperIssue } from '@/store/harperStore'
import { useProjectStore } from '@/store/projectStore'
import { getCurrentEditorView } from '../../editor-view-ref'
import { CHECK_COLOURS, checkForKind } from './checks'
import { shouldShow } from './filter'
import {
  addIssue,
  applyFix,
  currentIssues,
  issueById,
  recheck,
  recheckEffect,
  type Fix,
  type Issue,
} from './issues'
import { clearIgnoredLints, ignoreLint, lintProse } from './linter'
import { proseText } from './prose'
import { readCopyedit } from './settings'
import { issueTooltip, showIssueTooltip, tooltipTheme } from './tooltip'

/** harper.js's `SuggestionKind`, which the worker sends as a number */
const REMOVE = 1
const INSERT_AFTER = 2

/** How many of a lint's suggestions are offered as fixes */
const MAX_SUGGESTIONS = 3

/** The latest check. They run one at a time, since the worker answers in turn */
let checking: Promise<unknown> = Promise.resolve()

/**
 * The lint source. A check waits for the one before it, and is skipped if the
 * document changed while it waited: typing in bursts on a long document would
 * otherwise queue checks whose results are all thrown away.
 */
function lintDocument(view: EditorView): Promise<Diagnostic[]> {
  // The lint plugin discards the result if the document changes meanwhile
  const { state } = view
  const check = checking.then(() =>
    view.state.doc === state.doc ? checkDocument(state) : []
  )
  checking = check.catch(() => undefined)
  return check
}

async function checkDocument(state: EditorState): Promise<Diagnostic[]> {
  const { checks } = readCopyedit(useProjectStore.getState().globalSettings)
  if (!Object.values(checks).some(Boolean)) return []

  // The whole document's tree, giving up after a second on a huge document
  // and using what's been parsed so far
  const tree =
    ensureSyntaxTree(state, state.doc.length, 1000) ?? syntaxTree(state)
  const doc = state.doc.toString()
  const text = proseText(doc, tree)
  // A failed check has reset the worker and set Harper's status
  const lints = await lintProse(text).catch(() => null)
  if (!lints) return []

  const diagnostics: Diagnostic[] = []
  for (const lint of lints) {
    const { rule, kind, start, end } = lint
    const check = checkForKind(kind)
    if (!checks[check] || !shouldShow({ rule, kind, start, end }, text, doc))
      continue

    const diagnostic: Diagnostic = {
      from: start,
      to: end,
      severity: 'info',
      markClass: `cm-harper cm-harper-${check}`,
      message: lint.message,
      renderMessage: () => renderMessage(lint.messageHtml),
    }
    addIssue(diagnostic, {
      check,
      kind: lint.kindLabel,
      text: doc.slice(start, end),
      fixes: lint.suggestions.slice(0, MAX_SUGGESTIONS).map(toFix),
      // Typos are words run together, like "isnow", so not dictionary words
      word: kind === 'Spelling' ? lint.problem : null,
      ignore: () => ignoreLint(lint.hash),
    })
    diagnostics.push(diagnostic)
  }
  // Grouped by rule, so put them back in document order
  return diagnostics.sort((a, b) => a.from - b.from)
}

/** Harper's message as HTML, which marks the words it quotes as code */
function renderMessage(html: string): Node {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

function toFix({
  kind,
  text: replacement,
}: HarperLint['suggestions'][number]): Fix {
  if (kind === REMOVE || !replacement) {
    return {
      label: 'Remove',
      apply: (view, from, to) => edit(view, from, to, ''),
    }
  }
  if (kind === INSERT_AFTER) {
    return {
      label: `Add “${replacement}”`,
      apply: (view, _from, to) => edit(view, to, to, replacement),
    }
  }
  return {
    label: replacement,
    apply: (view, from, to) => edit(view, from, to, replacement),
  }
}

function edit(view: EditorView, from: number, to: number, insert: string) {
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    userEvent: 'input',
  })
}

function publishIssues(state: EditorState, issues: Issue[]) {
  useHarperStore.getState().setIssues(
    issues.map(({ diagnostic, details, from, to }): HarperIssue => ({
      id: details.id,
      check: details.check,
      kind: details.kind,
      text: state.sliceDoc(from, to),
      message: diagnostic.message,
      fixes: details.fixes.map(fix => fix.label),
    }))
  )
}

function publishActiveIssue(state: EditorState, issues: Issue[]) {
  const head = state.selection.main.head
  const active =
    issues.find(({ from, to }) => from <= head && head <= to)?.details.id ??
    null
  if (useHarperStore.getState().activeIssue !== active) {
    useHarperStore.getState().setActiveIssue(active)
  }
}

/**
 * Publishes the issues to the store after each check, and when an edit
 * removes one, so the panel never lists an issue that's gone (such as after
 * a fix, or when another file opens). Re-checks when the settings change.
 */
const issuesPlugin = ViewPlugin.fromClass(
  class {
    private unsubscribe: () => void

    constructor(view: EditorView) {
      // Each change to the settings replaces the `copyedit` object
      this.unsubscribe = useProjectStore.subscribe((state, previous) => {
        if (
          state.globalSettings?.copyedit !== previous.globalSettings?.copyedit
        ) {
          recheck(view)
        }
      })
    }

    update(update: ViewUpdate) {
      const checked = update.transactions.some(tr =>
        tr.effects.some(effect => effect.is(setDiagnosticsEffect))
      )
      if (!checked && !update.docChanged && !update.selectionSet) return
      const issues = currentIssues(update.state)
      if (checked || issues.length !== useHarperStore.getState().issues.length)
        publishIssues(update.state, issues)
      publishActiveIssue(update.state, issues)
    }

    destroy() {
      this.unsubscribe()
    }
  }
)

/**
 * Shows every ignored issue again, re-checking the open document once
 * Harper has forgotten them. Doesn't wait for Harper, which may be stuck.
 */
export function clearIgnoredIssues() {
  void clearIgnoredLints().then(
    () => {
      const view = getCurrentEditorView()
      if (view) recheck(view)
    },
    () => undefined
  )
}

/**
 * Selects an issue from the panel, scrolls it into view and shows its
 * tooltip, which stays until the selection moves
 */
export function selectIssue(id: number) {
  const view = getCurrentEditorView()
  const issue = view && issueById(view.state, id)
  if (!view || !issue) return
  view.dispatch({
    selection: { anchor: issue.from, head: issue.to },
    effects: EditorView.scrollIntoView(issue.from, { y: 'center' }),
  })
  view.focus()
  showIssueTooltip(view, issue.from)
}

/** Applies one of an issue's fixes from the panel */
export function applyIssueFix(id: number, fixIndex: number) {
  const view = getCurrentEditorView()
  const issue = view && issueById(view.state, id)
  const fix = issue?.details.fixes[fixIndex]
  if (!view || !issue || !fix) return
  applyFix(view, issue.diagnostic, fix)
  view.focus()
}

/** Ignores an issue from the panel */
export function ignoreIssue(id: number) {
  const view = getCurrentEditorView()
  const issue = view && issueById(view.state, id)
  if (!view || !issue) return
  void issue.details.ignore().then(
    () => recheck(view),
    () => undefined
  )
}

/** An issue's underline in its check's colour, softened so it doesn't shout */
const underline = (colour: string) =>
  `color-mix(in oklch, ${colour} 60%, transparent)`

const underlineTheme = EditorView.theme({
  // Replaces the lint package's own underline, a background image
  '.cm-harper': {
    backgroundImage: 'none',
    paddingBottom: '0',
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '5px',
    textDecorationSkipInk: 'none',
  },
  '.cm-harper-spelling': {
    textDecorationColor: underline(CHECK_COLOURS.spelling),
  },
  '.cm-harper-grammar': {
    textDecorationColor: underline(CHECK_COLOURS.grammar),
  },
  '.cm-harper-style': { textDecorationColor: underline(CHECK_COLOURS.style) },
})

export function createHarperExtension() {
  return [
    linter(lintDocument, {
      needsRefresh: update =>
        update.transactions.some(tr =>
          tr.effects.some(effect => effect.is(recheckEffect))
        ),
      // The lint package's own tooltip, which `issueTooltip` replaces
      tooltipFilter: () => [],
    }),
    issueTooltip,
    issuesPlugin,
    underlineTheme,
    tooltipTheme,
  ]
}
