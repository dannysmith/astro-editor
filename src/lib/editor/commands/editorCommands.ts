import { EditorView } from '@codemirror/view'
import { toggleMarkdown, createMarkdownLink } from '../markdown/formatting'
import { transformLineToHeading } from '../markdown/headings'
import { addCursorsToLineEnds } from '../selection'
import { HeadingLevel } from '../markdown/types'
import { EditorCommand, EditorCommandRegistry } from './types'
import { useUIStore } from '../../../store/uiStore'

/**
 * Create a bold toggle command
 */
export const createBoldCommand = (): EditorCommand => {
  return (view: EditorView) => toggleMarkdown(view, '**')
}

/**
 * Create an italic toggle command
 */
export const createItalicCommand = (): EditorCommand => {
  return (view: EditorView) => toggleMarkdown(view, '*')
}

/**
 * Create a link creation command
 */
export const createLinkCommand = (): EditorCommand => {
  return (view: EditorView) => createMarkdownLink(view)
}

/**
 * Create a heading format command
 */
export const createHeadingCommand = (level: HeadingLevel): EditorCommand => {
  return (view: EditorView) => transformLineToHeading(view, level)
}

/**
 * Create a save command
 */
export const createSaveCommand = (onSave: () => void): EditorCommand => {
  return () => {
    onSave()
    return true
  }
}

/**
 * Create a focus mode toggle command
 */
export const createFocusModeCommand = (): EditorCommand => {
  return () => {
    const toggleFocusMode = useUIStore.getState().toggleFocusMode
    toggleFocusMode()
    return true
  }
}

/**
 * Create an add cursors to line ends command
 */
export const createAddCursorsToLineEndsCommand = (): EditorCommand => {
  return (view: EditorView) => addCursorsToLineEnds(view)
}

/**
 * Create a complete editor command registry
 */
export const createEditorCommandRegistry = (
  onSave: () => void
): EditorCommandRegistry => {
  return {
    toggleBold: createBoldCommand(),
    toggleItalic: createItalicCommand(),
    createLink: createLinkCommand(),
    formatHeading: (level: HeadingLevel) => createHeadingCommand(level),
    save: createSaveCommand(onSave),
    toggleFocusMode: createFocusModeCommand(),
    addCursorsToLineEnds: createAddCursorsToLineEndsCommand(),
  }
}
