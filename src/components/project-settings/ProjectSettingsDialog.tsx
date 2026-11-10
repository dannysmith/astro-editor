import { Database, FolderCog, Plug } from 'lucide-react'
import type { Collection, ProjectScan } from '@/lib/bindings'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
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
import { clearSavedSettings } from '../../lib/project-settings/actions'
import {
  collectionProblems,
  isUnreadLoader,
  projectProblems,
  statusLevel,
} from '../../lib/project-settings/status'
import { StatusIcon } from './Problems'
import { ProjectPage } from './ProjectPage'
import { CollectionPage } from './CollectionPage'

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

function ProjectSettingsContent({
  scan,
  projectPath,
}: {
  scan: ProjectScan
  projectPath: string
}) {
  const page = useUIStore(state => state.projectSettingsPage)
  const setPage = useUIStore(state => state.setProjectSettingsPage)
  const stored = useProjectStore(state => state.projectSettings)

  const editable = scan.collections.filter(c => c.kind !== 'data')
  const shown = editable.filter(c => c.folderStatus === 'ok')
  const notShown = editable.filter(
    c => c.folderStatus !== 'ok' && !isUnreadLoader(c)
  )
  const unreadLoaders = editable.filter(isUnreadLoader)
  const data = scan.collections.filter(c => c.kind === 'data')
  // With the folder fallback, the config's collections aren't known, so
  // nothing saved for them is offered for clearing
  const saved = scan.fallback
    ? []
    : Object.keys(stored?.collections ?? {}).filter(
        name => !scan.collections.some(c => c.name === name)
      )

  const current = editable.find(c => c.name === page)
  const schema = current?.completeSchema
    ? deserializeCompleteSchema(current.completeSchema)
    : null
  const name = projectName(projectPath)

  const collectionItem = (collection: Collection) => (
    <SidebarMenuItem key={collection.name}>
      <SidebarMenuButton
        isActive={current?.name === collection.name}
        onClick={() => setPage(collection.name)}
      >
        <span className="truncate">{collection.name}</span>
        <StatusIcon
          level={statusLevel(collectionProblems(collection, projectPath))}
          className="ml-auto"
        />
      </SidebarMenuButton>
    </SidebarMenuItem>
  )

  return (
    <SidebarProvider className="h-full min-h-0 items-stretch">
      <Sidebar collapsible="none" className="hidden md:flex">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={!current}
                    onClick={() => setPage(null)}
                  >
                    <FolderCog />
                    <span className="truncate">{name}</span>
                    <StatusIcon
                      level={statusLevel(projectProblems(scan))}
                      className="ml-auto"
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {shown.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Collections</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{shown.map(collectionItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {notShown.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Not in the File List</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{notShown.map(collectionItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {data.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Data</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {data.map(collection => (
                    <SidebarMenuItem
                      key={collection.name}
                      className="flex h-8 items-center gap-2 px-2 text-sm text-muted-foreground"
                      title="Data collections hold JSON or YAML, which Astro Editor doesn't edit"
                    >
                      <Database className="size-4" />
                      <span className="truncate">{collection.name}</span>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {unreadLoaders.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Other Loaders</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {unreadLoaders.map(collection => (
                    <SidebarMenuItem key={collection.name}>
                      <SidebarMenuButton
                        isActive={current?.name === collection.name}
                        onClick={() => setPage(collection.name)}
                        className="text-muted-foreground"
                      >
                        <Plug />
                        <span className="truncate">{collection.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {saved.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>
                Settings for Removed Collections
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {saved.map(collectionName => (
                    <SidebarMenuItem
                      key={collectionName}
                      className="flex h-8 items-center px-2 text-sm text-muted-foreground"
                    >
                      <span className="truncate">{collectionName}</span>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="mx-2 mt-1"
                  onClick={() => void clearSavedSettings(saved)}
                >
                  Clear
                </Button>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{name}</BreadcrumbPage>
              </BreadcrumbItem>
              {current && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{current.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Keyed by page, so each page starts at the top */}
        <div
          key={current?.name ?? ''}
          className="flex-1 overflow-y-auto px-4 pb-6"
        >
          {current ? (
            <CollectionPage
              collection={current}
              schema={schema}
              projectPath={projectPath}
            />
          ) : (
            <ProjectPage scan={scan} projectPath={projectPath} />
          )}
        </div>
      </main>
    </SidebarProvider>
  )
}
