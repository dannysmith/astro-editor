import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useHarperStore, type HarperIssue } from '../../store/harperStore'
import { useProjectStore } from '../../store/projectStore'
import {
  applyIssueAction,
  readCopyedit,
  selectIssue,
} from '../../lib/editor/extensions/harper'
import { cn } from '../../lib/utils'
import { CHECK_COLOURS } from './HarperChecks'

/**
 * The open document's Harper issues, in document order. Clicking one selects
 * it in the editor; the one at the cursor shows its fixes.
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
          {issues.map((issue, index) => (
            <IssueRow
              // Issues have no identity across checks: the list is replaced
              key={index}
              issue={issue}
              index={index}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

const IssueRow: React.FC<{ issue: HarperIssue; index: number }> = ({
  issue,
  index,
}) => {
  const active = useHarperStore(state => state.activeIssue === index)
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
        onClick={() => selectIssue(index)}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              CHECK_COLOURS[issue.check]
            )}
          />
          <span className="truncate font-medium text-foreground">
            {issue.text}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {issue.kind}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {issue.message.replaceAll('`', '')}
        </span>
      </button>
      {active && issue.actions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {issue.actions.map((name, actionIndex) => (
            <button
              key={name}
              type="button"
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground hover:bg-secondary"
              onClick={() => applyIssueAction(index, actionIndex)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}
