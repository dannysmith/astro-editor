/**
 * Editor command system
 *
 * This module provides a type-safe command system for the editor:
 *
 * - Command registry for centralized command management
 * - Pre-built commands for common operations
 * - Type safety throughout the command system
 *
 * Usage:
 * ```typescript
 * import { globalCommandRegistry, createEditorCommandRegistry } from './commands'
 *
 * // In component setup
 * const commands = createEditorCommandRegistry(() => saveFile())
 * globalCommandRegistry.register(commands, editorView)
 *
 * // In menu handlers
 * globalCommandRegistry.execute('toggleBold')
 * ```
 */

export { CommandRegistry, globalCommandRegistry } from './CommandRegistry'
export { createEditorCommandRegistry } from './editorCommands'
export type { EditorCommand, EditorCommandRegistry } from './types'
