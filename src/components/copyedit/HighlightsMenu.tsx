import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '../../store/projectStore'
import {
  POS_CONFIGS,
  readHighlights,
  setHighlight,
  toggleAllHighlights,
} from '../../lib/editor/extensions/copyedit-mode'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
// Each item shows in its highlight's colour
import '../../lib/editor/extensions/copyedit-mode/copyedit-mode.css'

/**
 * The Copyedit tab's part-of-speech highlights, as one full-width dropdown so
 * they take a single row. Its button names the highlights that are on, in
 * their colours. The highlights are global settings, which the editor
 * follows, so the palette commands and this menu always agree.
 */
export const HighlightsMenu: React.FC = () => {
  const highlights = useProjectStore(
    useShallow(state => readHighlights(state.globalSettings))
  )
  const on = POS_CONFIGS.filter(({ settingKey }) => highlights[settingKey])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-full min-w-0 justify-between gap-2 font-normal"
          />
        }
      >
        {on.length === 0 ? (
          <span className="truncate text-muted-foreground">
            Highlight parts of speech
          </span>
        ) : (
          <span className="truncate">
            {on.map(({ settingKey, name, className }, index) => (
              <React.Fragment key={settingKey}>
                {index > 0 && ', '}
                <span className={className}>{name}s</span>
              </React.Fragment>
            ))}
          </span>
        )}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--anchor-width)">
        <DropdownMenuItem closeOnClick={false} onClick={toggleAllHighlights}>
          {on.length > 0 ? 'Hide All' : 'Show All'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {POS_CONFIGS.map(({ settingKey, name, className }) => (
          <DropdownMenuCheckboxItem
            key={settingKey}
            checked={highlights[settingKey]}
            onCheckedChange={checked => setHighlight(settingKey, checked)}
          >
            <span className={className}>{name}s</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
