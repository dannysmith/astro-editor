import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useHarperStore, type HarperIssue } from '../../store/harperStore'
import { useProjectStore } from '../../store/projectStore'
import {
  applyIssueFix,
  CHECK_COLOURS,
  ignoreIssue,
  readCopyedit,
  selectIssue,
} from '../../lib/editor/extensions/harper'
import { cn } from '../../lib/utils'

/** Kinds that say no more than the issue's colour, so they're left out */
const PLAIN_KINDS = new Set([
  'Spelling',
  'Typo',
  'Miscellaneous',
  'Grammar',
  'Style',
])

/**
 * The open document's Harper issues, in document order, each in its check's
 * colour. Clicking one selects it in the editor and shows its tooltip; the
 * one at the cursor shows its fixes here too.
 */
export const HarperIssues: React.FC = () => {
  const issues = useHarperStore(state => state.issues)
  const anyCheckOn = useProjectStore(state =>
    Object.values(readCopyedit(state.globalSettings).checks).some(Boolean)
  )
  const hasFile = useEditorStore(state => state.currentFile !== null)

  if (!anyCheckOn || !hasFile) return null

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">
        Issues{' '}
        <span className="font-normal text-muted-foreground">
          {issues.length}
        </span>
      </h3>
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues found.</p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {issues.map(issue => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Harper's message, with the words it quotes in bold */
const Message: React.FC<{ text: string }> = ({ text }) =>
  text.split('`').map((part, index) =>
    index % 2 === 1 ? (
      // The parts never move, so their position is their identity
      <strong key={index} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )

const IssueRow: React.FC<{ issue: HarperIssue }> = ({ issue }) => {
  const active = useHarperStore(state => state.activeIssue === issue.id)
  const ref = React.useRef<HTMLLIElement>(null)

  React.useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <li
      ref={ref}
      className={cn(
        'rounded-md px-2 py-1.5 text-sm',
        active ? 'bg-accent' : 'hover:bg-accent/60'
      )}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => selectIssue(issue.id)}
      >
        <span className="flex items-baseline gap-2">
          <span
            className="truncate font-medium"
            style={{ color: CHECK_COLOURS[issue.check] }}
          >
            {issue.text}
          </span>
          {!PLAIN_KINDS.has(issue.kind) && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {issue.kind}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          <Message text={issue.message} />
        </span>
      </button>
      {active && (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {issue.fixes.map((fix, fixIndex) => (
            <button
              // Two fixes can share a label, like "Remove"
              key={fixIndex}
              type="button"
              className="font-(family-name:--editor-font-family) text-[13px] text-foreground hover:text-(--issue-colour)"
              style={
                {
                  '--issue-colour': CHECK_COLOURS[issue.check],
                } as React.CSSProperties
              }
              onClick={() => applyIssueFix(issue.id, fixIndex)}
            >
              {fix}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => ignoreIssue(issue.id)}
          >
            Ignore
          </button>
        </div>
      )}
    </li>
  )
}
