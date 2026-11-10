import type { ListedProject } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import {
  formatLastOpened,
  projectName,
  tildePath,
} from '../../lib/projects/display'
import { CommandItem } from '../ui/command'
import { Badge } from '../ui/badge'
import { ProjectIcon } from './ProjectIcon'

/**
 * One project in the project list: its icon, folder name and path, and when it was
 * last opened, or that it's the open project. A missing project is dimmed.
 * Search matches the name and the full path.
 */
export function ProjectItem({
  listed: { project, missing, favicon },
  isOpen,
  home,
  now,
  onSelect,
  onContextMenu,
}: {
  listed: ListedProject
  isOpen: boolean
  home: string | null
  now: Date
  onSelect?: () => void
  onContextMenu?: (event: React.MouseEvent) => void
}) {
  const name = projectName(project.path)
  return (
    <CommandItem
      value={project.id}
      keywords={[name, project.path]}
      onSelect={onSelect}
      onContextMenu={onContextMenu}
      className="cursor-pointer"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div
          className={cn(
            'flex min-w-0 items-center gap-3',
            missing && 'opacity-60'
          )}
        >
          <ProjectIcon path={project.path} favicon={favicon} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {tildePath(project.path, home)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {missing && <Badge variant="outline">Missing</Badge>}
          {isOpen ? (
            <Badge variant="secondary">Open</Badge>
          ) : (
            <span>{formatLastOpened(project.lastOpened, now)}</span>
          )}
        </div>
      </div>
    </CommandItem>
  )
}
