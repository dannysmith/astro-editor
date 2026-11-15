import React, { useEffect, useRef, useState } from 'react'
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
 * only the icon (with the label as a tooltip) when the labels don't fit.
 *
 * It measures rather than using a breakpoint, so it works for any number of
 * tabs: when the labelled tabs overflow, it remembers how wide they were and
 * shows labels again once the list is that wide.
 */
export function ResponsiveTabsList({
  tabs,
  className,
}: ResponsiveTabsListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [iconsOnly, setIconsOnly] = useState(false)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    // Labelled tabs don't shrink below their text (they're nowrap), so they
    // overflow the list when they don't fit. WebKit's scrollWidth doesn't
    // count that overflow, so measure from the first tab to the last. The
    // labelled width is measured once, so it assumes the tabs and font size
    // don't change while mounted
    let showingIconsOnly = false
    let labelledWidth = 0
    const observer = new ResizeObserver(() => {
      // Hidden or collapsed: keep what was showing
      if (list.clientWidth === 0) return
      const style = getComputedStyle(list)
      const available =
        list.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)
      if (showingIconsOnly) {
        showingIconsOnly = available < labelledWidth
      } else {
        const tabs = list.querySelectorAll('[role="tab"]')
        const first = tabs[0]?.getBoundingClientRect()
        const last = tabs[tabs.length - 1]?.getBoundingClientRect()
        const tabsWidth = first && last ? last.right - first.left : 0
        // Tabs that fit grow to fill the list exactly; allow for rounding
        if (tabsWidth > available + 0.5) {
          labelledWidth = tabsWidth
          showingIconsOnly = true
        }
      }
      setIconsOnly(showingIconsOnly)
    })
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  return (
    <TabsList ref={listRef} className={cn('w-full', className)}>
      {tabs.map(({ value, label, icon: Icon }) => (
        <TabsTrigger
          key={value}
          value={value}
          aria-label={label}
          title={iconsOnly ? label : undefined}
        >
          <Icon />
          {!iconsOnly && <span>{label}</span>}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
