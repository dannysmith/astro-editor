/**
 * Counts the words in the open document and in the selection, for the
 * Copyedit panel. Only prose counts: the same text Harper checks
 * (`harper/prose.ts`), so code, URLs, component tags and `{expressions}` are
 * left out, and the prose inside an MDX component is counted. Frontmatter and
 * imports aren't in the editor at all.
 *
 * The document is counted when a file opens and after typing pauses, at
 * Harper's delay, so the two share the work of finding the prose. A selection
 * is counted as it changes, from the prose already found.
 */

import type { EditorState } from '@codemirror/state'
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'
import { useWordCountStore } from '@/store/wordCountStore'
import { fileLoad } from '../load-document'
import { countWords, docProse } from './harper/prose'

/** How long typing pauses before the document is counted again */
const COUNT_DELAY = 750

const hasSelection = (state: EditorState) =>
  state.selection.ranges.some(range => !range.empty)

function publishSelection(state: EditorState) {
  let selected = 0
  if (hasSelection(state)) {
    const prose = docProse(state)
    for (const { from, to } of state.selection.ranges) {
      selected += countWords(prose.slice(from, to))
    }
  }
  useWordCountStore.getState().setSelectedWords(selected)
}

function publishCounts(state: EditorState) {
  useWordCountStore.getState().setWords(countWords(docProse(state)))
  publishSelection(state)
}

export const wordCountExtension = ViewPlugin.fromClass(
  class {
    private timer: ReturnType<typeof setTimeout> | undefined

    constructor(private view: EditorView) {
      this.schedule(0)
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        const opened = update.transactions.some(tr => tr.annotation(fileLoad))
        this.schedule(opened ? 0 : COUNT_DELAY)
        // Typing replaces the selection, so this is usually immediate. A
        // selection that's still there is counted with the document
        if (!hasSelection(update.state)) {
          useWordCountStore.getState().setSelectedWords(0)
        }
      } else if (update.selectionSet) {
        publishSelection(update.state)
      }
    }

    private schedule(delay: number) {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => publishCounts(this.view.state), delay)
    }

    destroy() {
      clearTimeout(this.timer)
    }
  }
)
