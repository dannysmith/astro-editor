import React, { Activity, useEffect, useRef } from 'react'
import { useUIStore } from '../../store/uiStore'
import { focusEditor } from '../../lib/focus-utils'
import {
  RIGHT_SIDEBAR_TABS,
  isRightSidebarTabAvailable,
  type RightSidebarTab,
} from '../../lib/right-sidebar'
import { useResolvedProjectSettings } from '../../hooks/settings/useCollectionSettings'
import { Tabs, TabsContent } from '../ui/tabs'
import { ResponsiveTabsList } from '../ui/responsive-tabs-list'
import { FrontmatterPanel } from '../frontmatter'
import { CopyeditPanel } from '../copyedit'
import { GitPanel } from '../git'

const PANELS: Record<RightSidebarTab, React.ComponentType> = {
  frontmatter: FrontmatterPanel,
  copyedit: CopyeditPanel,
  git: GitPanel,
}

interface RightSidebarProps {
  /** Whether the sidebar has width: Layout follows the resizable panel's size */
  expanded: boolean
}

/**
 * The right sidebar: a tab bar and a panel for each tab in
 * `RIGHT_SIDEBAR_TABS`. Opening, closing and switching go through the
 * `uiStore` actions.
 *
 * Every panel stays mounted. One that can't be seen (another tab is active, or
 * the sidebar is collapsed) is hidden with `<Activity>`, which keeps its state
 * and DOM but tears down its effects. Store subscriptions are effects too, so a
 * hidden panel doesn't follow the stores; it catches up as it's shown.
 */
export const RightSidebar: React.FC<RightSidebarProps> = ({ expanded }) => {
  const storedTab = useUIStore(state => state.rightSidebarTab)
  const projectSettings = useResolvedProjectSettings()
  const tabs = RIGHT_SIDEBAR_TABS.filter(({ id }) =>
    isRightSidebarTabAvailable(id, projectSettings)
  )
  // A tab the open project doesn't offer (the Git tab after switching to a
  // project without it) shows Frontmatter, and the store follows below
  const available = tabs.some(({ id }) => id === storedTab)
  const activeTab = available ? storedTab : 'frontmatter'

  useEffect(() => {
    if (!available) useUIStore.setState({ rightSidebarTab: 'frontmatter' })
  }, [available])

  const sidebarRef = useRef<HTMLDivElement>(null)

  // Hiding what has focus (Cmd+3 while typing in a field, or closing the
  // sidebar) would leave focus nowhere, so give it to the editor first. A store
  // subscription runs before React hides anything
  useEffect(
    () =>
      useUIStore.subscribe((state, previous) => {
        const focused = document.activeElement
        if (!focused || !sidebarRef.current?.contains(focused)) return
        const closes =
          previous.rightSidebarVisible && !state.rightSidebarVisible
        const switchesFromPanel =
          state.rightSidebarTab !== previous.rightSidebarTab &&
          focused.closest('[role="tabpanel"]')
        if (closes || switchesFromPanel) focusEditor()
      }),
    []
  )

  return (
    <div
      ref={sidebarRef}
      // Collapsed, it has no width but its tabs could still take focus
      inert={!expanded}
      className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border bg-background"
    >
      <Tabs
        value={activeTab}
        onValueChange={(tab: RightSidebarTab) => {
          useUIStore.getState().showRightSidebarTab(tab)
        }}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="border-b border-border p-2">
          <ResponsiveTabsList
            tabs={tabs.map(({ id, label, icon }) => ({
              value: id,
              label,
              icon,
            }))}
          />
        </div>
        {tabs.map(({ id }) => {
          const Panel = PANELS[id]
          return (
            <TabsContent key={id} value={id} keepMounted className="min-h-0">
              <Activity
                mode={expanded && activeTab === id ? 'visible' : 'hidden'}
              >
                <Panel />
              </Activity>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
