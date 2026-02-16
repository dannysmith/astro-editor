import { EditorView } from '@codemirror/view'
import { create } from 'zustand'
import { buildContentLink } from '../lib/content-linker'
import { useUIStore } from './uiStore'
import type { FileEntry } from '@/types'

interface ContentLinkerState {
  isOpen: boolean
  editorView: EditorView | null
}

interface ContentLinkerActions {
  open: (view: EditorView | null) => void
  close: () => void
  insertLink: (
    targetFile: FileEntry,
    sourceFile: FileEntry,
    urlPattern?: string,
    titleField?: string
  ) => void
}

const initialState: ContentLinkerState = {
  isOpen: false,
  editorView: null,
}

export const useContentLinkerStore = create<
  ContentLinkerState & ContentLinkerActions
>((set, get) => ({
  ...initialState,

  open: editorView => {
    useUIStore.getState().setDistractionFreeBarsHidden(false)
    set({
      isOpen: true,
      editorView,
    })
  },

  close: () => {
    const { editorView } = get()
    set({ ...initialState })
    if (editorView) {
      setTimeout(() => {
        if (editorView.dom?.isConnected) {
          editorView.focus()
        }
      }, 100)
    }
  },

  insertLink: (targetFile, sourceFile, urlPattern, titleField) => {
    const { editorView } = get()
    if (!editorView) return

    const linkText = buildContentLink(
      sourceFile,
      targetFile,
      urlPattern,
      titleField
    )

    const { from, to } = editorView.state.selection.main
    editorView.dispatch({
      changes: { from, to, insert: linkText },
      selection: { anchor: from + linkText.length },
    })

    get().close()
  },
}))
