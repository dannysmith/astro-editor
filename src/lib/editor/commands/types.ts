import { EditorView } from '@codemirror/view'
import { HeadingLevel } from '../markdown/types'

/**
 * Editor command function type
 */
export type EditorCommand = (view: EditorView) => boolean

/**
 * Editor command registry interface
 */
export interface EditorCommandRegistry {
  toggleBold: EditorCommand
  toggleItalic: EditorCommand
  createLink: EditorCommand
  formatHeading: (level: HeadingLevel) => EditorCommand
  save: EditorCommand
  toggleFocusMode: EditorCommand
  addCursorsToLineEnds: EditorCommand
}

/**
 * Command registration options
 */
export interface CommandOptions {
  /** Whether the command should be enabled */
  enabled?: boolean
  /** Keyboard shortcut for the command */
  shortcut?: string
  /** Menu item label */
  label?: string
}
