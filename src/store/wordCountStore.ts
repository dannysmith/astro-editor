import { create } from 'zustand'

interface WordCountState {
  /** Words in the open document's prose */
  words: number
  /** Words in the selection, 0 when nothing is selected */
  selectedWords: number
}

interface WordCountActions {
  setWords: (words: number) => void
  setSelectedWords: (selectedWords: number) => void
}

/**
 * The open document's word count. The editor extension
 * (`lib/editor/extensions/word-count.ts`) publishes it and the Copyedit panel
 * shows it.
 */
export const useWordCountStore = create<WordCountState & WordCountActions>()(
  set => ({
    words: 0,
    selectedWords: 0,

    setWords: words => set({ words }),
    setSelectedWords: selectedWords => set({ selectedWords }),
  })
)
