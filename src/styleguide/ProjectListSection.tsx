import type { ListedProject } from '@/lib/bindings'
import {
  Command,
  commandDialogClassName,
  CommandGroup,
  CommandInput,
  CommandList,
} from '../components/ui/command'
import { cn } from '../lib/utils'
import { OpenFolderButton, ProjectItem } from '../components/project-list'

const NOW = new Date('2026-11-05T12:00:00Z')
const HOME = '/Users/writer'

function listed(
  path: string,
  lastOpened: string,
  missing = false
): ListedProject {
  return {
    project: { id: path, name: path, path, lastOpened, created: lastOpened },
    missing,
    favicon: null,
  }
}

const PROJECTS = [
  listed('/Users/writer/sites/blog', '2026-11-05T11:58:00Z'),
  listed('/Users/writer/sites/docs', '2026-11-05T09:00:00Z'),
  listed('/Users/writer/clients/acme-site', '2026-11-04T15:00:00Z'),
  listed('/Users/writer/old/portfolio', '2026-03-28T10:00:00Z', true),
]

/**
 * The project list as its dialog shows it: Open Folder…, then the open
 * project, recent ones and a missing one
 */
export function ProjectListSection() {
  return (
    <Command
      className={cn(
        commandDialogClassName,
        'max-w-lg rounded-lg border shadow-md'
      )}
      value={PROJECTS[1]?.project.id}
    >
      <CommandInput placeholder="Search projects..." />
      <OpenFolderButton shortcut="⌘O" />
      <CommandList className="max-h-none">
        <CommandGroup>
          {PROJECTS.map((project, index) => (
            <ProjectItem
              key={project.project.id}
              listed={project}
              isOpen={index === 0}
              home={HOME}
              now={NOW}
            />
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
