import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useCommandContext } from './commands/useCommandContext'
import { getAllCommands } from '../lib/commands/app-commands'
import { AppCommand, CommandGroup } from '../lib/commands/types'
import { useUIStore } from '../store/uiStore'
import { focusEditorDelayed } from '../lib/focus-utils'

// The palette's groups, in order. A command whose group isn't here isn't shown
const GROUP_ORDER: Array<{ key: AppCommand['group']; heading: string }> = [
  { key: 'file', heading: 'File' },
  { key: 'navigation', heading: 'Navigation' },
  { key: 'project', heading: 'Project' },
  { key: 'settings', heading: 'Settings' },
  { key: 'highlight', heading: 'Highlights' },
  { key: 'ide', heading: 'IDE' },
  { key: 'help', heading: 'Help' },
]

/**
 * Hook for managing command palette state and commands
 *
 * The React Compiler memoises the command list on the context, which
 * useCommandContext builds from store selectors, so the list only changes when
 * something a command can read does.
 */
export function useCommandPalette() {
  const [open, setOpenState] = useState(false)
  const context = useCommandContext()
  const setDistractionFreeBarsHidden = useUIStore(
    state => state.setDistractionFreeBarsHidden
  )

  // Opening shows the bars hidden by distraction-free mode; closing returns
  // focus to the editor
  const setOpen = (value: boolean) => {
    setOpenState(value)
    if (value) {
      setDistractionFreeBarsHidden(false)
    } else {
      focusEditorDelayed()
    }
  }

  // Cmd+P (macOS) / Ctrl+P (Windows and Linux). react-hotkeys-hook keeps the
  // first callback unless it's given dependencies, so `open` is one
  useHotkeys(
    'mod+p',
    () => setOpen(!open),
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [open]
  )

  const commands = getAllCommands(context)
  const commandGroups: CommandGroup[] = GROUP_ORDER.map(group => ({
    heading: group.heading,
    commands: commands.filter(command => command.group === group.key),
  })).filter(group => group.commands.length > 0)

  // Execute a command and close the palette
  const executeCommand = async (command: AppCommand) => {
    setOpen(false) // Returns focus to the editor
    await command.execute(context)
  }

  return {
    open,
    setOpen,
    commands,
    commandGroups,
    executeCommand,
  }
}
