import { EditorView } from '@codemirror/view'
import { EditorCommandRegistry } from './types'

/**
 * Type-safe command registry that manages editor commands
 * This replaces the fragile global reference pattern
 */
export class CommandRegistry {
  private commands: EditorCommandRegistry | null = null
  private editorView: EditorView | null = null

  /**
   * Register commands with the registry
   */
  register(commands: EditorCommandRegistry, view: EditorView): void {
    this.commands = commands
    this.editorView = view
  }

  /**
   * Unregister commands (cleanup)
   */
  unregister(): void {
    this.commands = null
    this.editorView = null
  }

  /**
   * Execute a command safely
   */
  execute(
    commandName: keyof EditorCommandRegistry,
    ...args: unknown[]
  ): boolean {
    if (!this.commands || !this.editorView) {
      return false
    }

    const command = this.commands[commandName]
    if (!command) {
      return false
    }

    try {
      if (commandName === 'formatHeading') {
        // Special handling for formatHeading which returns a function
        const formatHeading = command as (
          level: unknown
        ) => (view: EditorView) => boolean
        const executableCommand = formatHeading(args[0])
        return executableCommand(this.editorView)
      } else {
        // For commands that are direct functions
        return (command as (view: EditorView) => boolean)(this.editorView)
      }
    } catch {
      // oxlint-disable-next-line no-console
      console.error(`Failed to execute command ${commandName}`)
      return false
    }
  }

  /**
   * Check if commands are available
   */
  isReady(): boolean {
    return this.commands !== null && this.editorView !== null
  }

  /**
   * Get the current editor view
   */
  getEditorView(): EditorView | null {
    return this.editorView
  }
}

// Global instance - this is the single point of command access
export const globalCommandRegistry = new CommandRegistry()
