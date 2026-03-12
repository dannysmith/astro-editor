import React, { useState, useMemo } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSystemFontsQuery } from '@/hooks/queries/useSystemFontsQuery'

interface FontSelectorProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  defaultFonts?: string[]
}

export const FontSelector: React.FC<FontSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select font...',
  defaultFonts = [],
}) => {
  const [open, setOpen] = useState(false)
  const { data: systemFonts = [], isLoading } = useSystemFontsQuery()

  const allFonts = useMemo(() => {
    const uniqueFonts = new Set([...defaultFonts, ...systemFonts])
    return Array.from(uniqueFonts).sort((a, b) => a.localeCompare(b))
  }, [defaultFonts, systemFonts])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-md justify-between"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search fonts..." />
          <CommandList className="overflow-visible max-h-none">
            <CommandEmpty>
              {isLoading ? 'Loading fonts...' : 'No font found.'}
            </CommandEmpty>
            <ScrollArea
              className="h-[300px]"
              onWheel={e => e.stopPropagation()}
            >
              <CommandGroup>
                {allFonts.map(font => (
                  <CommandItem
                    key={font}
                    value={font}
                    onSelect={currentValue => {
                      onChange(currentValue)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === font ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span style={{ fontFamily: font }}>{font}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
