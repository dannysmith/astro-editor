import { useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import { projectName } from '../../lib/projects/display'

// Literal class names, so Tailwind generates them
const COLOURS = [
  'bg-project-1',
  'bg-project-2',
  'bg-project-3',
  'bg-project-4',
  'bg-project-5',
  'bg-project-6',
  'bg-project-7',
  'bg-project-8',
]

/** The same colour for a path every time */
function colourFor(path: string): string {
  let hash = 0
  for (const char of path) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLOURS[hash % COLOURS.length]!
}

/**
 * A project's icon, telling projects apart and project settings from
 * Preferences: its favicon, or the first letter of its folder name on a
 * colour picked from its path. Size it with `className` (it's `size-8`).
 */
export function ProjectIcon({
  path,
  favicon,
  className,
}: {
  path: string
  /** An absolute path, from the scan or the project list */
  favicon: string | null
  className?: string
}) {
  // The favicon that failed to load, so another project's is still tried
  const [failed, setFailed] = useState<string | null>(null)
  const classes = cn('size-8 shrink-0 rounded-[22%]', className)

  if (favicon && favicon !== failed) {
    return (
      <img
        src={convertFileSrc(favicon)}
        alt=""
        draggable={false}
        onError={() => setFailed(favicon)}
        className={cn(classes, 'object-contain')}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        classes,
        // A size container, so the letter scales with the icon
        'flex items-center justify-center leading-none font-semibold text-project-foreground select-none @container',
        colourFor(path)
      )}
    >
      <span className="text-[55cqw]">
        {projectName(path).charAt(0).toUpperCase()}
      </span>
    </span>
  )
}
