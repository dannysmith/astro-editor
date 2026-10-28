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
  toggleTypewriterMode: EditorCommand
  addCursorsToLineEnds: EditorCommand
}
