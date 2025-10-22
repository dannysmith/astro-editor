import { EditorView } from '@codemirror/view'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { processDroppedFiles } from './fileProcessing'
import {
  validateDropContext,
  handleNoProjectFallback,
  handleNoFileFallback,
} from './edgeCases'
import { FileDropPayload, DropResult } from './types'

/**
 * Parse file drop payload from Tauri event
 * @param payload - Unknown payload from Tauri drag-drop event
 * @returns FileDropPayload with paths and position
 */
export const parseFileDropPayload = (
  payload: unknown
): { paths: string[]; position?: { x: number; y: number } } => {
  let filePaths: string[] = []
  let position: { x: number; y: number } | undefined = undefined

  if (Array.isArray(payload)) {
    filePaths = payload as string[]
  } else if (typeof payload === 'string') {
    filePaths = [payload]
  } else if (payload && typeof payload === 'object' && 'paths' in payload) {
    const payloadObj = payload as FileDropPayload
    filePaths = payloadObj.paths || []
    position = payloadObj.position
  } else {
    // eslint-disable-next-line no-console
    console.error('Unexpected payload format:', payload)
    return { paths: [] }
  }

  return { paths: filePaths, position }
}

/**
 * Check if drop position is within element bounds
 * @param position - Drop position
 * @param element - DOM element to check
 * @returns true if position is within element bounds
 */
export const isDropWithinElement = (
  position: { x: number; y: number } | undefined,
  element: Element | null
): boolean => {
  if (!position || !element) return false

  const rect = element.getBoundingClientRect()
  return (
    position.x >= rect.left &&
    position.x <= rect.right &&
    position.y >= rect.top &&
    position.y <= rect.bottom
  )
}

/**
 * Handle Tauri file drop events
 * @param payload - Payload from Tauri drag-drop event
 * @param editorView - CodeMirror editor view
 * @returns Promise that resolves when drop is handled
 */
export const handleTauriFileDrop = async (
  payload: unknown,
  editorView: EditorView | null
): Promise<DropResult> => {
  if (!editorView) {
    return { success: false, insertText: '', error: 'No editor view available' }
  }

  // Parse file paths and position from payload
  const { paths: filePaths, position } = parseFileDropPayload(payload)
  if (filePaths.length === 0) {
    return { success: false, insertText: '', error: 'No files in drop payload' }
  }

  // Check if drop is within editor element bounds
  // This prevents conflicts with FileUploadButton and other UI elements
  const editorElement = editorView.dom.closest('[data-editor-container]')
  if (!isDropWithinElement(position, editorElement)) {
    // Drop is outside editor bounds, ignore it
    return {
      success: false,
      insertText: '',
      error: 'Drop outside editor bounds',
    }
  }

  // Get current project path and file from store
  const { projectPath } = useProjectStore.getState()
  const { currentFile } = useEditorStore.getState()

  // Validate context and handle edge cases
  const validation = validateDropContext(projectPath, currentFile)

  if (!validation.canProceed) {
    let fallbackText = ''

    if (validation.reason === 'no-project') {
      fallbackText = handleNoProjectFallback(filePaths)
    } else if (validation.reason === 'no-file') {
      fallbackText = handleNoFileFallback(filePaths)
    } else {
      fallbackText = handleNoProjectFallback(filePaths)
    }

    // Insert fallback text
    const { state } = editorView
    const { from } = state.selection.main

    editorView.dispatch({
      changes: {
        from: from,
        to: from,
        insert: fallbackText,
      },
    })

    return {
      success: false,
      insertText: fallbackText,
      error: validation.reason,
    }
  }

  // Process files normally
  try {
    const processedFiles = await processDroppedFiles(
      filePaths,
      projectPath!,
      currentFile!.collection
    )

    const insertText = processedFiles.map(file => file.markdownText).join('\n')

    // Insert processed text at cursor position
    const { state } = editorView
    const { from } = state.selection.main

    editorView.dispatch({
      changes: { from, insert: insertText },
      selection: { anchor: from + insertText.length },
    })

    return { success: true, insertText }
  } catch {
    // Handle processing errors
    const fallbackText = handleNoProjectFallback(filePaths)

    const { state } = editorView
    const { from } = state.selection.main

    editorView.dispatch({
      changes: {
        from: from,
        to: from,
        insert: fallbackText,
      },
    })

    return {
      success: false,
      insertText: fallbackText,
      error: 'Processing failed',
    }
  }
}
