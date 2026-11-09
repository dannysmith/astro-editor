import { AlertTriangle, CircleX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Problem, StatusLevel } from '../../lib/project-settings/status'

/** Text with its backticked parts shown as code */
export function WithCode({ text }: { text: string }) {
  return text.split('`').map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="rounded bg-muted px-1 py-0.5 text-xs">
        {part}
      </code>
    ) : (
      part
    )
  )
}

/** A warning or error icon; nothing when all's well */
export function StatusIcon({
  level,
  className,
}: {
  level: StatusLevel
  className?: string
}) {
  const classes = cn('size-4 shrink-0', className)
  switch (level) {
    case 'error':
      return (
        <CircleX
          className={cn(classes, 'text-destructive')}
          aria-label="Error"
        />
      )
    case 'warning':
      return (
        <AlertTriangle
          className={cn(classes, 'text-warning')}
          aria-label="Warning"
        />
      )
    case 'ok':
      return null
  }
}

/** A warning or error, with what to do about it */
export function ProblemNote({ problem }: { problem: Problem }) {
  return (
    <div className="flex gap-2 text-sm">
      <StatusIcon level={problem.level} className="mt-0.5" />
      <div className="space-y-1">
        <p>
          <WithCode text={problem.message} />
        </p>
        {problem.fix && (
          <p className="text-muted-foreground">
            <WithCode text={problem.fix} />
          </p>
        )}
        {problem.detail && (
          <pre className="rounded bg-muted px-2 py-1 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {problem.detail}
          </pre>
        )}
      </div>
    </div>
  )
}

export function ProblemList({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null
  return (
    <div className="space-y-3 rounded-lg border p-3">
      {problems.map(problem => (
        <ProblemNote key={problem.message} problem={problem} />
      ))}
    </div>
  )
}
