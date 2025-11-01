import { useState, useEffect, useMemo, useCallback } from 'react'
import { useCommandContext } from './commands/useCommandContext'
import { getAllCommands } from '../lib/commands/app-commands'
import { AppCommand, CommandGroup } from '../lib/commands/types'
import { useUIStore } from '../store/uiStore'
import { focusEditorDelayed } from '../lib/focus-utils'

/**
 * Hook for managing command palette state and commands
 */
export function useCommandPalette(searchValue = '') {
  const [open, setOpen] = useState(false)
  const context = useCommandContext()
  const { setDistractionFreeBarsHidden } = useUIStore()

  // Custom setOpen that shows bars when command palette opens and returns focus when closed
  const handleSetOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof value === 'boolean' ? value : value(open)
      setOpen(value)

      // Show bars when command palette opens
      if (newValue) {
        setDistractionFreeBarsHidden(false)
      } else {
        // Return focus to editor when command palette closes
        focusEditorDelayed()
      }
    },
    [open, setDistractionFreeBarsHidden]
  )

  // Handle Cmd+P keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' && e.metaKey) {
        e.preventDefault()
        handleSetOpen(open => !open)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSetOpen])

  // Get all available commands based on current context
  // Optimize dependencies to prevent unnecessary recalculations that could disrupt navigation
  // Note: We deliberately exclude searchValue from dependencies to prevent disrupting navigation
  const baseCommands = useMemo(
    () => getAllCommands(context, ''), // Pass empty string to get base commands only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      context.currentFile?.id,
      context.selectedCollection,
      context.projectPath,
      context.isDirty,
      context.globalSettings?.general?.ideCommand,
      context.globalSettings?.general?.highlights?.nouns,
      context.globalSettings?.general?.highlights?.verbs,
      context.globalSettings?.general?.highlights?.adjectives,
      context.globalSettings?.general?.highlights?.adverbs,
      context.globalSettings?.general?.highlights?.conjunctions,
      context.collections.length, // Only react to collection count changes, not array reference
    ]
  )

  // Generate search commands separately to avoid disrupting navigation
  const searchCommands = useMemo(
    () => {
      if (!searchValue || searchValue.length < 2 || !context.projectPath) {
        return []
      }
      // For search commands, we only need the collections and projectPath from context
      return getAllCommands(context, searchValue).filter(
        cmd => cmd.group === 'search'
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchValue, context.projectPath, context.collections.length]
  )

  // Combine base commands with search commands
  const commands = useMemo(
    () => [...searchCommands, ...baseCommands],
    [searchCommands, baseCommands]
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
      { key: 'search', heading: 'Search Results' },
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
