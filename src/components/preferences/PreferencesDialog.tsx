import React, { useState } from 'react'
import { Settings, Folder, FileText, Layers } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { GeneralPane } from './panes/GeneralPane'
import { ProjectSettingsPane } from './panes/ProjectSettingsPane'
import { FrontmatterMappingsPane } from './panes/FrontmatterMappingsPane'
import { CollectionSettingsPane } from './panes/CollectionSettingsPane'
import { usePreferences } from '../../hooks/usePreferences'

interface PreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PreferencePane = 'general' | 'project' | 'frontmatter' | 'collections'

const getNavigationItems = (hasProject: boolean) =>
  [
    {
      id: 'general' as const,
      name: 'General',
      icon: Settings,
      available: true,
    },
    {
      id: 'project' as const,
      name: 'Project Settings',
      icon: Folder,
      available: hasProject,
    },
    {
      id: 'frontmatter' as const,
      name: 'Frontmatter Mappings',
      icon: FileText,
      available: hasProject,
    },
    {
      id: 'collections' as const,
      name: 'Collections',
      icon: Layers,
      available: hasProject,
    },
  ].filter(item => item.available)

const getPaneTitle = (pane: PreferencePane): string => {
  switch (pane) {
    case 'general':
      return 'General'
    case 'project':
      return 'Project Settings'
    case 'frontmatter':
      return 'Frontmatter Mappings'
    case 'collections':
      return 'Collections'
    default:
      return 'General'
  }
}

export const PreferencesDialog: React.FC<PreferencesDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [activePane, setActivePane] = useState<PreferencePane>('general')
  const { hasProject } = usePreferences()
  const navigationItems = getNavigationItems(hasProject)

  // Reset to general pane if current pane becomes unavailable
  React.useEffect(() => {
    if (!navigationItems.some(item => item.id === activePane)) {
      setActivePane('general')
    }
  }, [navigationItems, activePane])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[600px] md:max-w-[900px] lg:max-w-[1000px] font-sans">
        <DialogTitle className="sr-only">Preferences</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your application preferences here.
        </DialogDescription>

        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map(item => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={activePane === item.id}
                        >
                          <button
                            onClick={() => setActivePane(item.id)}
                            className="w-full"
                          >
                            <item.icon />
                            <span>{item.name}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex flex-1 flex-col overflow-hidden max-h-[600px]">
            <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Preferences</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {getPaneTitle(activePane)}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pt-0">
              <div className="space-y-6">
                {activePane === 'general' && <GeneralPane />}
                {activePane === 'project' && <ProjectSettingsPane />}
                {activePane === 'frontmatter' && <FrontmatterMappingsPane />}
                {activePane === 'collections' && <CollectionSettingsPane />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
