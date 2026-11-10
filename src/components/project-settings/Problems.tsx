import React from 'react'
import { AlertTriangle, CircleX, Info } from 'lucide-react'
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

/**
 * A problem at the top of a page: what's wrong, what to do about it, and the
 * error AE got. `action` is a button that fixes it, when there is one.
 */
export function ProblemCallout({
  problem,
  action,
}: {
  problem: Problem
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        problem.level === 'error'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-warning/40 bg-warning/5'
      )}
    >
      <StatusIcon level={problem.level} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          <WithCode text={problem.message} />
        </p>
        {problem.fix && (
          <p className="text-muted-foreground">
            <WithCode text={problem.fix} />
          </p>
        )}
        {problem.detail && (
          <p className="font-mono text-xs break-words text-muted-foreground">
            {problem.detail}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

/**
 * Something worth knowing at the top of a page that isn't a problem, like a
 * collection without a schema. It has no status, so nothing flags it in the
 * sidebar or the file list.
 */
export function NoteCallout({
  message,
  fix,
}: {
  message: string
  fix?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          <WithCode text={message} />
        </p>
        {fix && (
          <p className="text-muted-foreground">
            <WithCode text={fix} />
          </p>
        )}
      </div>
    </div>
  )
}
