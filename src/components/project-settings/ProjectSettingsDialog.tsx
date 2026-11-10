import { Database, Files, Plug, SlidersHorizontal } from 'lucide-react'
import type { Collection, ProjectScan } from '@/lib/bindings'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { useUIStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useProjectScanQuery } from '../../hooks/queries/useCollectionsQuery'
import { focusEditorDelayed } from '../../lib/focus-utils'
import { projectName } from '../../lib/projects/display'
import { deserializeCompleteSchema } from '../../lib/schema'
import {
  collectionProblems,
  isUnreadLoader,
  projectProblems,
  statusLevel,
} from '../../lib/project-settings/status'
import { ProjectIcon } from '../project-list'
import { StatusIcon } from './Problems'
import { ProjectPage } from './ProjectPage'
import { CollectionPage } from './CollectionPage'
import { OtherCollectionPage } from './OtherCollectionPage'

/**
 * How AE has read the open project, and its project and collection settings.
 * Opened with `showProjectSettings`.
 */
export function ProjectSettingsDialog() {
  const open = useUIStore(state => state.projectSettingsOpen)
  const setProjectSettingsOpen = useUIStore(
    state => state.setProjectSettingsOpen
  )

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (value) return
        setProjectSettingsOpen(false)
        focusEditorDelayed()
      }}
    >
      <DialogContent className="h-[min(720px,calc(100vh-6rem))] overflow-hidden p-0 font-sans md:max-w-[900px] lg:max-w-[1000px]">
        <DialogTitle className="sr-only">Project Settings</DialogTitle>
        <DialogDescription className="sr-only">
          How Astro Editor has read this project, and its settings
        </DialogDescription>
        <ProjectSettings />
      </DialogContent>
    </Dialog>
  )
}

function ProjectSettings() {
  const projectPath = useProjectStore(state => state.projectPath)
  const { data: scan } = useProjectScanQuery(projectPath)
  if (!projectPath || !scan) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Open a project to see its settings.
      </p>
    )
  }
  return <ProjectSettingsContent scan={scan} projectPath={projectPath} />
}

/** Collections AE doesn't edit: data, and loaders that probably aren't files */
function isOther(collection: Collection): boolean {
  return collection.kind === 'data' || isUnreadLoader(collection)
}

function ProjectSettingsContent({
  scan,
  projectPath,
}: {
  scan: ProjectScan
  projectPath: string
}) {
  const page = useUIStore(state => state.projectSettingsPage)
  const setPage = useUIStore(state => state.setProjectSettingsPage)

  const collections = scan.collections.filter(c => !isOther(c))
  const others = scan.collections.filter(isOther)
  const current = scan.collections.find(c => c.name === page)
  const schema = current?.completeSchema
    ? deserializeCompleteSchema(current.completeSchema)
    : null

  return (
    <SidebarProvider className="h-full min-h-0 items-stretch">
      <Sidebar collapsible="none" className="hidden md:flex">
        <SidebarHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <ProjectIcon path={projectPath} favicon={scan.favicon} />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                Project Settings
              </div>
              <div className="truncate font-mono text-xs font-medium">
                {projectName(projectPath)}
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={!current}
                    onClick={() => setPage(null)}
                  >
                    <SlidersHorizontal />
                    <span>Project</span>
                    <StatusIcon
                      level={statusLevel(projectProblems(scan))}
                      className="ml-auto"
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {collections.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Collections</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collections.map(collection => (
                    <SidebarMenuItem key={collection.name}>
                      <SidebarMenuButton
                        isActive={current?.name === collection.name}
                        onClick={() => setPage(collection.name)}
                      >
                        <Files />
                        <span className="truncate">{collection.name}</span>
                        <StatusIcon
                          level={statusLevel(
                            collectionProblems(collection, projectPath)
                          )}
                          className="ml-auto"
                        />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {others.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Other Collections</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {others.map(collection => (
                    <SidebarMenuItem key={collection.name}>
                      <SidebarMenuButton
                        isActive={current?.name === collection.name}
                        onClick={() => setPage(collection.name)}
                        className="text-muted-foreground"
                      >
                        {collection.kind === 'data' ? <Database /> : <Plug />}
                        <span className="truncate">{collection.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>

      {/* Starts below the dialog's close button, so nothing scrolls under it.
          Keyed by page, so each page starts at the top. */}
      <main
        key={current?.name ?? ''}
        className="mt-10 min-h-0 flex-1 overflow-y-auto px-6 pb-6"
      >
        {!current ? (
          <ProjectPage scan={scan} projectPath={projectPath} />
        ) : isOther(current) ? (
          <OtherCollectionPage
            collection={current}
            schema={schema}
            scan={scan}
            projectPath={projectPath}
          />
        ) : (
          <CollectionPage
            collection={current}
            schema={schema}
            scan={scan}
            projectPath={projectPath}
          />
        )}
      </main>
    </SidebarProvider>
  )
}
