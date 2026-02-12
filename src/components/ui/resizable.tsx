'use client'

import * as React from 'react'
import { GripVerticalIcon } from 'lucide-react'
import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from 'react-resizable-panels'

import { cn } from '@/lib/utils'

type Orientation = 'horizontal' | 'vertical'

/**
 * Convert numeric size values to percentage strings for v4 compatibility.
 * In v4, numbers are interpreted as pixels, but strings without units are percentages.
 * This maintains backwards compatibility with v3 API where numbers were percentages.
 */
function toPercentageString(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  // Convert number to percentage string (v3 compatibility)
  return `${value}%`
}

interface ResizablePanelGroupProps
  extends Omit<React.ComponentProps<typeof Group>, 'direction'> {
  direction?: Orientation
  /**
   * @deprecated autoSaveId is no longer supported in react-resizable-panels v4.
   * Layout persistence needs to be implemented at the application level using
   * onLayoutChange callback and defaultLayout prop.
   */
  autoSaveId?: string
}

function ResizablePanelGroup({
  className,
  direction = 'horizontal',
  autoSaveId: _autoSaveId, // Ignored - v4 doesn't support this
  ...props
}: ResizablePanelGroupProps) {
  return (
    <Group
      data-slot="resizable-panel-group"
      orientation={direction}
      className={cn(
        // Note: v4 sets flex-flow via inline styles, so we just need base flex setup
        'flex h-full w-full',
        className
      )}
      {...props}
    />
  )
}

interface ResizablePanelProps
  extends Omit<
    React.ComponentProps<typeof Panel>,
    'defaultSize' | 'minSize' | 'maxSize' | 'collapsedSize'
  > {
  /**
   * Default size as a percentage (0-100).
   * Note: v4 interprets numbers as pixels, but we convert to percentage strings
   * for backwards compatibility with v3 API.
   */
  defaultSize?: number | string
  /**
   * Minimum size as a percentage (0-100).
   */
  minSize?: number | string
  /**
   * Maximum size as a percentage (0-100).
   */
  maxSize?: number | string
  /**
   * Size when collapsed (as percentage 0-100).
   */
  collapsedSize?: number | string
  /**
   * Ref for imperative panel control (collapse, expand, resize, etc.)
   */
  panelRef?: React.Ref<PanelImperativeHandle>
}

function ResizablePanel({
  defaultSize,
  minSize,
  maxSize,
  collapsedSize,
  panelRef,
  ...props
}: ResizablePanelProps) {
  return (
    <Panel
      data-slot="resizable-panel"
      defaultSize={toPercentageString(defaultSize)}
      minSize={toPercentageString(minSize)}
      maxSize={toPercentageString(maxSize)}
      collapsedSize={toPercentageString(collapsedSize)}
      panelRef={panelRef}
      {...props}
    />
  )
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  // Note: In v4, aria-orientation describes the SEPARATOR's orientation, not the group's.
  // When group is vertical, separators are horizontal (aria-orientation="horizontal").
  // When group is horizontal, separators are vertical (aria-orientation="vertical").
  // The "vertical group" styles should apply when separator is horizontal.
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}

// Re-export the imperative handle type for consumers
export type { PanelImperativeHandle }

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
