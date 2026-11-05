import { convertFileSrc } from '@tauri-apps/api/core'
import { commands } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { assetSettings } from '../project-scan'
import { toast } from '../toast'
import { processFileToAssets } from './fileProcessing'
import type { ProcessFileToAssetsResult } from './types'

/**
 * Copies an image the writer picked into the open file's collection assets
 * (unless it's already in the project) and returns the path to write into the
 * file, relative or absolute as the collection's settings say. Used by image
 * fields and the component builder's image props.
 */
export async function copyImageToAssets(
  sourcePath: string
): Promise<ProcessFileToAssetsResult> {
  const { projectPath } = useProjectStore.getState()
  const { currentFile } = useEditorStore.getState()
  if (!projectPath || !currentFile) {
    throw new Error('No file is open')
  }

  return processFileToAssets({
    sourcePath,
    projectPath,
    collection: currentFile.collection,
    copyStrategy: 'only-if-outside-project',
    currentFilePath: currentFile.path,
    ...assetSettings(currentFile.collection),
  })
}

/**
 * Tells the writer an image couldn't be added. Resolves to nothing, so it can
 * end a promise chain: `await copyImageToAssets(path).catch(showAddImageError)`
 */
export function showAddImageError(error: unknown): undefined {
  toast.error('Failed to add image', {
    description: error instanceof Error ? error.message : 'Unknown error',
  })
  return undefined
}

/**
 * A URL the webview can load for an image path as written in a file: remote
 * URLs as they are, local paths (relative to the file or the project) through
 * the asset protocol. Throws if a local path can't be resolved.
 */
export async function resolveImageSrc(
  path: string,
  projectPath: string,
  currentFilePath: string | null
): Promise<string> {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const result = await commands.resolveImagePath(
    path,
    projectPath,
    currentFilePath
  )
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return convertFileSrc(result.data)
}
