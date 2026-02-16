import { useState, useMemo, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useCommandContext } from './commands/useCommandContext'
import { getAllCommands } from '../lib/commands/app-commands'
import { AppCommand, CommandGroup } from '../lib/commands/types'
import { useUIStore } from '../store/uiStore'
import { focusEditorDelayed } from '../lib/focus-utils'

/**
 * Hook for managing command palette state and commands
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  const context = useCommandContext()
  // Use selector syntax for consistency
  const setDistractionFreeBarsHidden = useUIStore(
    state => state.setDistractionFreeBarsHidden
  )

  // Custom setOpen that shows bars when command palette opens and returns focus when closed
  const handleSetOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setOpen(prev => {
        const newValue = typeof value === 'boolean' ? value : value(prev)

        // Show bars when command palette opens
        if (newValue) {
          setDistractionFreeBarsHidden(false)
        } else {
          // Return focus to editor when command palette closes
          focusEditorDelayed()
        }

        return newValue
      })
    },
    [setDistractionFreeBarsHidden]
  )

  // Handle Cmd+P (macOS) / Ctrl+P (Windows) keyboard shortcut
  // Uses mod+ prefix which maps to Cmd on macOS and Ctrl on Windows
  useHotkeys(
    'mod+p',
    () => {
      handleSetOpen(open => !open)
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    }
  )

  // Get all available commands based on current context
  const commands = useMemo(
    () => getAllCommands(context),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      context.currentFile?.id,
      context.selectedCollection,
      context.projectPath,
      context.globalSettings?.general?.ideCommand,
      context.globalSettings?.general?.highlights?.nouns,
      context.globalSettings?.general?.highlights?.verbs,
      context.globalSettings?.general?.highlights?.adjectives,
      context.globalSettings?.general?.highlights?.adverbs,
      context.globalSettings?.general?.highlights?.conjunctions,
      context.collections.length, // Only react to collection count changes, not array reference
    ]
  )

  // Group commands by category
  const commandGroups = useMemo((): CommandGroup[] => {
    const groups: Record<string, AppCommand[]> = {}

    commands.forEach(command => {
      if (!groups[command.group]) {
        groups[command.group] = []
      }
      groups[command.group]!.push(command)
    })

    // Define group order and labels
    const groupOrder: Array<{ key: string; heading: string }> = [
      { key: 'file', heading: 'File' },
      { key: 'navigation', heading: 'Navigation' },
      { key: 'project', heading: 'Project' },
      { key: 'settings', heading: 'Settings' },
      { key: 'highlight', heading: 'Highlights' },
      { key: 'ide', heading: 'IDE' },
    ]

    return groupOrder
      .filter(group => groups[group.key] && groups[group.key]!.length > 0)
      .map(group => ({
        heading: group.heading,
        commands: groups[group.key]!,
      }))
  }, [commands])

  // Execute a command and close the palette
  const executeCommand = async (command: AppCommand) => {
    handleSetOpen(false) // This will automatically return focus to editor via handleSetOpen
    await command.execute(context)
  }

  return {
    open,
    setOpen: handleSetOpen,
    commands,
    commandGroups,
    executeCommand,
  }
}
