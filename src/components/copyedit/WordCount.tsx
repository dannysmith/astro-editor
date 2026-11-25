import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useWordCountStore } from '../../store/wordCountStore'

/** Reading speed for the reading time, in words a minute */
const WORDS_PER_MINUTE = 230

const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`

/**
 * The open document's word count and reading time, and the selection's word
 * count while there is one
 */
export const WordCount: React.FC = () => {
  const words = useWordCountStore(state => state.words)
  const selected = useWordCountStore(state => state.selectedWords)
  const hasFile = useEditorStore(state => state.currentFile !== null)

  if (!hasFile) return null

  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))

  return (
    <p className="border-t px-4 py-2 text-xs text-muted-foreground tabular-nums">
      {selected > 0
        ? `${selected.toLocaleString()} of ${plural(words, 'word')}`
        : plural(words, 'word')}
      {words > 0 && ` · ${minutes} min read`}
    </p>
  )
}
