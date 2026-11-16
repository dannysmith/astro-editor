import React, { Activity, useEffect, useRef } from 'react'
import { useUIStore } from '../../store/uiStore'
import { focusEditor } from '../../lib/focus-utils'
import {
  RIGHT_SIDEBAR_TABS,
  type RightSidebarTab,
} from '../../lib/right-sidebar'
import { Tabs, TabsContent } from '../ui/tabs'
import { ResponsiveTabsList } from '../ui/responsive-tabs-list'
import { FrontmatterPanel } from '../frontmatter'
import { CopyeditPanel } from '../copyedit'

const PANELS: Record<RightSidebarTab, React.ComponentType> = {
  frontmatter: FrontmatterPanel,
  copyedit: CopyeditPanel,
}

const TABS = RIGHT_SIDEBAR_TABS.map(({ id, label, icon }) => ({
  value: id,
  label,
  icon,
}))

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
  const activeTab = useUIStore(state => state.rightSidebarTab)
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
          <ResponsiveTabsList tabs={TABS} />
        </div>
        {RIGHT_SIDEBAR_TABS.map(({ id }) => {
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
