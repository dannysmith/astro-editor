import { commands } from '@/lib/bindings'
import { globalCommandRegistry } from './CommandRegistry'
import { HeadingLevel } from '../markdown/types'

/**
 * Interface for menu integration
 */
export interface MenuCommands {
  toggleBold: () => void
  toggleItalic: () => void
  createLink: () => void
  formatHeading: (level: HeadingLevel) => void
}

/**
 * Create menu command functions that integrate with the command registry
 */
export const createMenuCommands = (): MenuCommands => {
  return {
    toggleBold: () => {
      globalCommandRegistry.execute('toggleBold')
    },
    toggleItalic: () => {
      globalCommandRegistry.execute('toggleItalic')
    },
    createLink: () => {
      globalCommandRegistry.execute('createLink')
    },
    formatHeading: (level: HeadingLevel) => {
      globalCommandRegistry.execute('formatHeading', level)
    },
  }
}

/**
 * Update menu state based on editor focus
 */
export const updateFormatMenuState = async (
  enabled: boolean
): Promise<void> => {
  try {
    await commands.updateFormatMenuState(enabled)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update format menu state:', error)
  }
}

/**
 * Export menu commands to global scope for menu integration
 * This provides a clean API for the menu system
 */
export const exportMenuCommands = (): void => {
  const commands = createMenuCommands()

  // Export to global scope for menu access
  Object.assign(globalThis, {
    editorCommands: commands,
  })
}

/**
 * Cleanup menu commands from global scope
 */
export const cleanupMenuCommands = (): void => {
  // @ts-expect-error - Cleaning up global properties
  delete globalThis.editorCommands
}
