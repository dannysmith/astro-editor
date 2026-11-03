import React from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command'
import { useCommandPalette } from '../../hooks/useCommandPalette'

/**
 * The palette's filter: matches the search against the command's label only,
 * case-insensitively. Items' values are "id:label"; ids have no colons, but
 * labels can ("Open Collection: blog").
 */
export function filterByLabel(value: string, search: string): number {
  const label = value.slice(value.indexOf(':') + 1)
  return label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
}

/**
 * Command palette component with Cmd+P shortcut
 * Provides quick access to application commands
 */
export function CommandPalette() {
  const { open, setOpen, commandGroups, executeCommand } = useCommandPalette()

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Type a command or search..."
      filter={filterByLabel}
      loop
    >
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {commandGroups.map((group, groupIndex) => (
          <React.Fragment key={group.heading}>
            <CommandGroup heading={group.heading}>
              {group.commands.map(command => {
                const Icon = command.icon
                return (
                  <CommandItem
                    key={command.id}
                    value={`${command.id}:${command.label}`}
                    onSelect={() => void executeCommand(command)}
                    className="cursor-pointer"
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    <div className="flex flex-col">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-xs text-muted-foreground">
                          {command.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {/* Add separator between groups (except for the last group) */}
            {groupIndex < commandGroups.length - 1 && <CommandSeparator />}
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
