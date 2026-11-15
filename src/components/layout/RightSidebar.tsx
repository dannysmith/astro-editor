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

  // Hiding a panel with focus in it (Cmd+3 or closing the sidebar while typing
  // in a field) would leave focus nowhere, so give it to the editor first. A
  // store subscription runs before React hides anything
  useEffect(
    () =>
      useUIStore.subscribe((state, previous) => {
        const hidesPanel =
          (previous.rightSidebarVisible && !state.rightSidebarVisible) ||
          state.rightSidebarTab !== previous.rightSidebarTab
        const focused = document.activeElement
        if (
          hidesPanel &&
          focused?.closest('[role="tabpanel"]') &&
          sidebarRef.current?.contains(focused)
        ) {
          focusEditor()
        }
      }),
    []
  )

  return (
    <div
      ref={sidebarRef}
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
