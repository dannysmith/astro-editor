/**
 * Editor Keymap Extensions
 *
 * Defines all keyboard shortcuts for the editor. Organized into three layers
 * with different precedences to ensure correct handling.
 *
 * SHORTCUTS DEFINED:
 *
 * | Key              | Action                          |
 * |------------------|---------------------------------|
 * | Mod+B            | Toggle bold (**)                |
 * | Mod+I            | Toggle italic (*)               |
 * | Mod+K            | Create/edit link                |
 * | Mod+/            | Component builder OR toggle comment |
 * | Alt+Mod+1-4      | Transform line to heading 1-4   |
 * | Alt+Mod+0        | Remove heading (to paragraph)   |
 * | Mod+Shift+F      | Toggle focus mode               |
 * | Mod+Shift+L      | Add cursors to line ends        |
 * | Tab              | Insert tab or next snippet field |
 * | Shift+Tab        | Previous snippet field          |
 *
 * PRECEDENCE:
 * - Highest: Tab handling (traps Tab key in editor)
 * - High: Markdown shortcuts (override defaults)
 * - Normal: Default CodeMirror keymaps
 */

import { keymap, EditorView } from '@codemirror/view'
import {
  defaultKeymap,
  historyKeymap,
  toggleComment,
} from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import {
  hasNextSnippetField,
  nextSnippetField,
  hasPrevSnippetField,
  prevSnippetField,
  closeBracketsKeymap,
} from '@codemirror/autocomplete'
import { Prec } from '@codemirror/state'
import { toggleMarkdown, createMarkdownLink } from '../markdown/formatting'
import { transformLineToHeading } from '../markdown/headings'
import { addCursorsToLineEnds } from '../selection'
import { globalCommandRegistry } from '../commands'

/**
 * Create custom markdown shortcuts with high precedence
 */
export const createMarkdownKeymap = (
  componentBuilderHandler?: (view: EditorView) => boolean
) => {
  return Prec.high(
    keymap.of([
      {
        key: 'Mod-b',
        run: view => toggleMarkdown(view, '**'),
      },
      {
        key: 'Mod-i',
        run: view => toggleMarkdown(view, '*'),
      },
      {
        key: 'Mod-k',
        run: view => createMarkdownLink(view),
      },
      // This is the new keybinding for the component inserter.
      {
        key: 'Mod-/',
        run: view => {
          // Try component builder first if handler is provided
          if (componentBuilderHandler && componentBuilderHandler(view)) {
            return true
          }
          // Fallback to default comment toggling
          return toggleComment(view)
        },
      },
      // Heading transformation shortcuts
      {
        key: 'Alt-Mod-1',
        run: view => transformLineToHeading(view, 1),
      },
      {
        key: 'Alt-Mod-2',
        run: view => transformLineToHeading(view, 2),
      },
      {
        key: 'Alt-Mod-3',
        run: view => transformLineToHeading(view, 3),
      },
      {
        key: 'Alt-Mod-4',
        run: view => transformLineToHeading(view, 4),
      },
      {
        key: 'Alt-Mod-0',
        run: view => transformLineToHeading(view, 0),
      },
      // Focus mode shortcut
      {
        key: 'Mod-Shift-f',
        run: () => {
          globalCommandRegistry.execute('toggleFocusMode')
          return true
        },
      },
      // Add cursors to line ends (VS Code: "Add Cursors to Line Ends")
      {
        key: 'Mod-Shift-l',
        run: view => addCursorsToLineEnds(view),
      },
    ])
  )
}

/**
 * Create default keymaps with lower precedence, but filter out the default
 * comment toggling so we can use it for our component inserter.
 */
export const createDefaultKeymap = () => {
  // Filter out the default Mod-/ keybinding for comment toggling
  const filteredDefaultKeymap = defaultKeymap.filter(
    k => k.run !== toggleComment
  )

  return keymap.of([
    ...filteredDefaultKeymap,
    ...historyKeymap,
    ...searchKeymap,
    ...closeBracketsKeymap,
  ])
}

/**
 * Create tab handling that always stays in editor
 */
export const createTabKeymap = () => {
  return Prec.highest(
    keymap.of([
      {
        key: 'Tab',
        run: view => {
          // If there's a snippet field, navigate to it
          if (hasNextSnippetField(view.state)) {
            return nextSnippetField(view)
          }

          // Otherwise, insert a tab character and stay in editor
          const from = view.state.selection.main.from
          const to = view.state.selection.main.to
          view.dispatch({
            changes: {
              from,
              to,
              insert: '\t',
            },
            selection: {
              anchor: from + 1,
            },
          })
          return true // Always consume the event
        },
      },
      {
        key: 'Shift-Tab',
        run: view => {
          // If there's a previous snippet field, navigate to it
          if (hasPrevSnippetField(view.state)) {
            return prevSnippetField(view)
          }

          // Otherwise, consume the event to stay in editor
          return true
        },
      },
    ])
  )
}

/**
 * Create all keymap extensions
 */
export const createKeymapExtensions = (
  componentBuilderHandler?: (view: EditorView) => boolean
) => {
  return [
    // Tab handling must be highest precedence to trap Tab key
    createTabKeymap(),
    createMarkdownKeymap(componentBuilderHandler),
    createDefaultKeymap(),
  ]
}
