import React from 'react'
import { TabsList, TabsTrigger } from './tabs'
import { cn } from '@/lib/utils'

export interface ResponsiveTab {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface ResponsiveTabsListProps {
  tabs: readonly ResponsiveTab[]
  className?: string
}

/**
 * A full-width tab list for `Tabs` whose tabs show an icon and a label, or
 * only the icon when the label doesn't fit.
 *
 * It's all CSS, so it follows any width and any number of tabs: each tab's
 * icon and label sit in a one-line box that wraps and clips, so a label too
 * wide for its tab wraps onto the hidden second line, leaving the icon
 * centred. Tabs drop their labels one at a time, longest first. The label is
 * the tooltip, for when it's hidden.
 */
export function ResponsiveTabsList({
  tabs,
  className,
}: ResponsiveTabsListProps) {
  return (
    <TabsList className={cn('w-full', className)}>
      {tabs.map(({ value, label, icon: Icon }) => (
        <TabsTrigger
          key={value}
          value={value}
          aria-label={label}
          title={label}
          className="min-w-0"
        >
          <span className="flex h-5 min-w-0 flex-wrap content-start items-center justify-center gap-x-1.5 overflow-hidden">
            <Icon className="my-0.5 size-4" />
            <span>{label}</span>
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
