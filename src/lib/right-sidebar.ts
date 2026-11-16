import { GitBranch, SpellCheck, TableProperties } from 'lucide-react'
import type { ResolvedProjectSettings } from '@/lib/bindings'
import { getProjectScan } from './project-scan'

/**
 * The right sidebar's tabs, in order. The tab bar, the Cmd+<digit> shortcuts
 * and the palette commands are built from this list, filtered by
 * `isRightSidebarTabAvailable`; the native View menu items are written by hand
 * in `src-tauri/src/lib.rs`. Each tab's panel is mapped in
 * `components/layout/RightSidebar.tsx`.
 */
export const RIGHT_SIDEBAR_TABS = [
  {
    id: 'frontmatter',
    label: 'Frontmatter',
    icon: TableProperties,
    shortcutDigit: 2,
  },
  { id: 'copyedit', label: 'Copyedit', icon: SpellCheck, shortcutDigit: 3 },
  { id: 'git', label: 'Git', icon: GitBranch, shortcutDigit: 4 },
] as const

export type RightSidebarTab = (typeof RIGHT_SIDEBAR_TABS)[number]['id']

/**
 * Whether a tab is offered for a project with these settings. The Git tab is
 * an experiment each project switches on, and isn't in the native View menu.
 */
export function isRightSidebarTabAvailable(
  tab: RightSidebarTab,
  settings: ResolvedProjectSettings | undefined
): boolean {
  return tab !== 'git' || settings?.gitPanel.value === true
}

/** Whether a tab is offered for the open project, for code outside React */
export function isRightSidebarTabAvailableNow(tab: RightSidebarTab): boolean {
  return isRightSidebarTabAvailable(tab, getProjectScan()?.projectSettings)
}
