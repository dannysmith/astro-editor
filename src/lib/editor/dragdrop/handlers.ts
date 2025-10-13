import { EditorView } from '@codemirror/view'
import { useEditorStore } from '../../../store/editorStore'
import { useProjectStore } from '../../../store/projectStore'
import { isDropClaimed } from '../../drop-coordinator'
import { processDroppedFiles } from './fileProcessing'
import {
  validateDropContext,
  handleNoProjectFallback,
  handleNoFileFallback,
} from './edgeCases'
import { FileDropPayload, DropResult } from './types'

/**
 * Parse file paths from different payload formats
 * @param payload - Unknown payload from Tauri drag-drop event
 * @returns Array of file paths
 */
export const parseFileDropPayload = (payload: unknown): string[] => {
  let filePaths: string[] = []

  if (Array.isArray(payload)) {
    filePaths = payload as string[]
  } else if (typeof payload === 'string') {
    filePaths = [payload]
  } else if (payload && typeof payload === 'object' && 'paths' in payload) {
    // In case the payload has a 'paths' property
    filePaths = (payload as FileDropPayload).paths || []
  } else {
    // eslint-disable-next-line no-console
    console.error('Unexpected payload format:', payload)
    return []
  }

  return filePaths
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
  // Check if another component (e.g., ImageField) has already claimed this drop
  if (isDropClaimed()) {
    return {
      success: false,
      insertText: '',
      error: 'Drop claimed by another handler',
    }
  }

  if (!editorView) {
    return { success: false, insertText: '', error: 'No editor view available' }
  }

  // Parse file paths from payload
  const filePaths = parseFileDropPayload(payload)
  if (filePaths.length === 0) {
    return { success: false, insertText: '', error: 'No files in drop payload' }
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
