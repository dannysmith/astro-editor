'use client'

import * as React from 'react'
import { useState, useCallback } from 'react'
import { GripVerticalIcon } from 'lucide-react'
import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from 'react-resizable-panels'

import { cn } from '@/lib/utils'

type Orientation = 'horizontal' | 'vertical'

interface ResizablePanelGroupProps extends Omit<
  React.ComponentProps<typeof Group>,
  'direction'
> {
  direction?: Orientation
  /**
   * Unique ID for localStorage persistence. Layout is saved on resize
   * and restored on mount.
   */
  autoSaveId?: string
}

type PanelLayout = Record<string, number>

function ResizablePanelGroup({
  className,
  direction = 'horizontal',
  autoSaveId,
  onLayoutChange,
  ...props
}: ResizablePanelGroupProps) {
  // Load saved layout on mount (lazy initializer runs once)
  const [savedLayout] = useState<PanelLayout | undefined>(() => {
    if (!autoSaveId) return undefined
    try {
      const stored = localStorage.getItem(`panel-v4:${autoSaveId}`)
      return stored ? (JSON.parse(stored) as PanelLayout) : undefined
    } catch {
      return undefined
    }
  })

  // Save layout to localStorage on change
  const handleLayoutChange = useCallback(
    (layout: PanelLayout) => {
      if (autoSaveId) {
        localStorage.setItem(`panel-v4:${autoSaveId}`, JSON.stringify(layout))
      }
      onLayoutChange?.(layout)
    },
    [autoSaveId, onLayoutChange]
  )

  return (
    <Group
      data-slot="resizable-panel-group"
      orientation={direction}
      defaultLayout={savedLayout}
      onLayoutChange={handleLayoutChange}
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

type ResizablePanelProps = React.ComponentProps<typeof Panel>

function ResizablePanel(props: ResizablePanelProps) {
  return <Panel data-slot="resizable-panel" {...props} />
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
