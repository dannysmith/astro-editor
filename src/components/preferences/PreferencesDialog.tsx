import React, { useState } from 'react'
import { ArrowUpRight, FolderCog, Settings, Wrench } from 'lucide-react'
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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { GeneralPane } from './panes/GeneralPane'
import { DebugPane } from './panes/DebugPane'
import { useProjectStore } from '../../store/projectStore'
import { showProjectSettings } from '../../lib/project-settings/actions'

interface PreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NAVIGATION_ITEMS = [
  { id: 'general', name: 'General', icon: Settings },
  { id: 'debug', name: 'Advanced', icon: Wrench },
] as const

type PreferencePane = (typeof NAVIGATION_ITEMS)[number]['id']

/**
 * App-wide preferences. A project's settings are in the project settings
 * dialog, which the sidebar links to when a project is open.
 */
export const PreferencesDialog: React.FC<PreferencesDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [activePane, setActivePane] = useState<PreferencePane>('general')
  const projectPath = useProjectStore(state => state.projectPath)
  const paneTitle = NAVIGATION_ITEMS.find(item => item.id === activePane)?.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 font-sans md:max-h-[600px] md:max-w-[900px] lg:max-w-[1000px]">
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
                    {NAVIGATION_ITEMS.map(item => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activePane === item.id}
                          onClick={() => setActivePane(item.id)}
                        >
                          <item.icon />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              {projectPath && (
                <SidebarGroup>
                  <SidebarGroupLabel>This Project</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => {
                            onOpenChange(false)
                            showProjectSettings()
                          }}
                        >
                          <FolderCog />
                          <span>Project Settings</span>
                          <ArrowUpRight className="ml-auto text-muted-foreground" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>
          </Sidebar>

          <main className="flex max-h-[600px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Preferences</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{paneTitle}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pt-0">
              <div className="space-y-6">
                {activePane === 'general' && <GeneralPane />}
                {activePane === 'debug' && <DebugPane />}
              </div>
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
