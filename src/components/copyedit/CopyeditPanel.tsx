import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '../../store/projectStore'
import {
  POS_CONFIGS,
  readHighlights,
  setHighlight,
  toggleAllHighlights,
} from '../../lib/editor/extensions/copyedit-mode'
import { Button } from '../ui/button'
import { FieldLabel } from '../ui/field'
import { Switch } from '../ui/switch'
// Each label shows in its highlight's colour
import '../../lib/editor/extensions/copyedit-mode/copyedit-mode.css'

/**
 * The right sidebar's Copyedit tab: switches for the part-of-speech
 * highlights. They're global settings, which the editor follows, so the
 * palette commands and this panel always agree.
 */
export const CopyeditPanel: React.FC = () => {
  const highlights = useProjectStore(
    useShallow(state => readHighlights(state.globalSettings))
  )
  const anyHighlightOn = Object.values(highlights).some(Boolean)
  const id = React.useId()

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">Highlights</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground"
              onClick={toggleAllHighlights}
            >
              {anyHighlightOn ? 'Hide all' : 'Show all'}
            </Button>
          </div>
          {POS_CONFIGS.map(({ settingKey, name, className }) => (
            <div
              key={settingKey}
              className="flex items-center justify-between gap-3"
            >
              <FieldLabel htmlFor={`${id}-${settingKey}`} className={className}>
                {name}s
              </FieldLabel>
              <Switch
                id={`${id}-${settingKey}`}
                checked={highlights[settingKey]}
                onCheckedChange={on => setHighlight(settingKey, on)}
              />
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
