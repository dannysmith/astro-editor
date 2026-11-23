import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import type { DeleteItem } from '../../lib/git/context-menu'
import { changeStatus, type GitTone } from '../../lib/git/status'

/** Each status colour's classes: the `--git-*` tokens */
const TONES: Record<GitTone, { dot: string; text: string }> = {
  added: { dot: 'bg-git-added', text: 'text-git-added' },
  modified: { dot: 'bg-git-modified', text: 'text-git-modified' },
  deleted: { dot: 'bg-git-deleted', text: 'text-git-deleted' },
  conflict: { dot: 'bg-git-conflict', text: 'text-git-conflict' },
}

/** A coloured dot for a status, or a dim one for none */
export function StatusDot({ tone }: { tone: GitTone | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        tone ? TONES[tone].dot : 'bg-muted-foreground/40'
      )}
    />
  )
}

/** VS Code's status letter, coloured, with git's word for it as a tooltip */
export function StatusLetter({
  status,
}: {
  status: ReturnType<typeof changeStatus>
}) {
  return (
    <span
      // A label on a plain span isn't read, so it's marked as an image
      role="img"
      title={status.label}
      aria-label={status.label}
      className={cn(
        'w-3 shrink-0 text-center font-mono text-xs font-semibold',
        TONES[status.tone].text
      )}
    >
      {status.letter}
    </span>
  )
}

/** Shows the right-click menu for a file (relative to the repository root) */
export type FileMenu = (
  path: string,
  exists: boolean,
  position: { x: number; y: number },
  deleteItem?: DeleteItem
) => void

/** A right-click handler showing `path`'s menu */
export function fileMenu(
  onFileMenu: FileMenu,
  path: string,
  exists: boolean,
  deleteItem?: DeleteItem
) {
  return (event: MouseEvent) => {
    event.preventDefault()
    onFileMenu(path, exists, { x: event.clientX, y: event.clientY }, deleteItem)
  }
}
