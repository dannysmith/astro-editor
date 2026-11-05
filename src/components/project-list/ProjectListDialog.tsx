import { useState } from 'react'
import {
  Command,
  commandDialogClassName,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandShortcut,
} from '../ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import type { ListedProject } from '@/lib/bindings'
import { useUIStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useProjectListQuery } from '../../hooks/queries/useProjectListQuery'
import { usePlatform } from '../../hooks/usePlatform'
import { focusEditorDelayed } from '../../lib/focus-utils'
import {
  locateProject,
  openListedProject,
  openProjectViaDialog,
  removeProject,
} from '../../lib/projects/actions'
import { showProjectContextMenu } from '../../lib/projects/context-menu'
import { OpenFolderButton } from './OpenFolderButton'
import { ProjectItem } from './ProjectItem'

const NO_PROJECTS: ListedProject[] = []

/** Matches the search against what items pass as keywords: name and path */
function filterByKeywords(_value: string, search: string, keywords?: string[]) {
  const query = search.toLowerCase()
  return keywords?.some(keyword => keyword.toLowerCase().includes(query))
    ? 1
    : 0
}

/**
 * The project list: every project AE has opened, to switch to, locate or
 * remove, plus Open Folder… for one it hasn't. Every way of opening a project
 * shows it (`showProjectList`).
 */
export function ProjectListDialog() {
  const open = useUIStore(state => state.projectListOpen)
  const setProjectListOpen = useUIStore(state => state.setProjectListOpen)

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (value) return
        setProjectListOpen(false)
        focusEditorDelayed()
      }}
    >
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Projects</DialogTitle>
          <DialogDescription>
            Search your projects to open one, or open another folder
          </DialogDescription>
        </DialogHeader>
        {/* The dialog unmounts its content when closed, so the list's
            selection and `now` are fresh each time it opens */}
        <ProjectList />
      </DialogContent>
    </Dialog>
  )
}

function ProjectList() {
  const projectPath = useProjectStore(state => state.projectPath)
  const { data } = useProjectListQuery(true)
  const projects = data?.projects ?? NO_PROJECTS
  const platform = usePlatform()
  const modKey = platform === 'macos' || platform === undefined ? '⌘' : 'Ctrl+'
  const [now] = useState(() => new Date())

  // The highlighted project. Until the writer moves it, it's the most recent
  // one that isn't open, so Enter goes back to the previous project
  const [selected, setSelected] = useState<string | null>(null)
  const byId = new Map(projects.map(listed => [listed.project.id, listed]))
  const fallback =
    projects.find(listed => listed.project.path !== projectPath) ?? projects[0]
  const value =
    selected && byId.has(selected) ? selected : (fallback?.project.id ?? '')

  const choose = (listed: ListedProject) => {
    if (listed.missing) {
      void locateProject(listed.project)
    } else {
      openListedProject(listed.project.path)
    }
  }

  const openFolder = () => {
    useUIStore.getState().setProjectListOpen(false)
    void openProjectViaDialog()
  }

  // Cmd+O opens a folder; Cmd+Backspace removes the highlighted project,
  // except the open one
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return
    if (event.key === 'o') {
      event.preventDefault()
      openFolder()
      return
    }
    if (event.key !== 'Backspace') return
    const listed = byId.get(value)
    if (!listed || listed.project.path === projectPath) return
    event.preventDefault()
    void removeProject(listed.project)
  }

  return (
    <Command
      className={commandDialogClassName}
      filter={filterByKeywords}
      value={value}
      onValueChange={setSelected}
      loop
    >
      <CommandInput
        placeholder="Search projects..."
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <OpenFolderButton shortcut={`${modKey}O`} onClick={openFolder} />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>
          {projects.length > 0 ? 'No matching projects.' : 'No projects yet.'}
        </CommandEmpty>
        {projects.length > 0 && (
          <CommandGroup>
            {projects.map(listed => (
              <ProjectItem
                key={listed.project.id}
                listed={listed}
                isOpen={listed.project.path === projectPath}
                home={data?.home ?? null}
                now={now}
                onSelect={() => choose(listed)}
                onContextMenu={event => {
                  event.preventDefault()
                  void showProjectContextMenu(listed, {
                    x: event.clientX,
                    y: event.clientY,
                  })
                }}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>

      <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          <CommandShortcut>↩</CommandShortcut> Open
        </span>
        <span>
          <CommandShortcut>{modKey}⌫</CommandShortcut> Remove
        </span>
      </div>
    </Command>
  )
}
