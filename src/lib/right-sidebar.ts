import { SpellCheck, TableProperties } from 'lucide-react'

/**
 * The right sidebar's tabs, in order. The tab bar, the Cmd+<digit> shortcuts
 * and the palette commands are built from this list; the native View menu
 * items are written by hand in `src-tauri/src/lib.rs`. Each tab's panel is
 * mapped in `components/layout/RightSidebar.tsx`.
 */
export const RIGHT_SIDEBAR_TABS = [
  {
    id: 'frontmatter',
    label: 'Frontmatter',
    icon: TableProperties,
    shortcutDigit: 2,
  },
  { id: 'copyedit', label: 'Copyedit', icon: SpellCheck, shortcutDigit: 3 },
] as const

export type RightSidebarTab = (typeof RIGHT_SIDEBAR_TABS)[number]['id']
