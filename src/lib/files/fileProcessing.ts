import { commands } from '@/lib/bindings'
import { useGitPanelStore } from '../../store/gitPanelStore'
import { isConvertedImage } from './constants'
import type {
  ProcessFileToAssetsOptions,
  ProcessFileToAssetsResult,
} from './types'

/**
 * Process a file for use in Astro content
 *
 * Handles file copying with two strategies:
 * 1. 'always': Always copy to assets directory (for article-specific images)
 * 2. 'only-if-outside-project': Only copy if outside project (for reusable assets)
 *
 * Images Astro can't use (HEIC) are converted to JPEG as they're copied.
 *
 * @param options - Processing options
 * @returns Processing result with relative path and metadata
 * @throws Error if file processing fails
 */
export async function processFileToAssets(
  options: ProcessFileToAssetsOptions
): Promise<ProcessFileToAssetsResult> {
  const {
    sourcePath,
    projectPath,
    collection,
    assetsDirectory,
    copyStrategy,
    currentFilePath,
    useRelativePaths,
  } = options

  // Extract filename for result
  const filename = extractFilename(sourcePath)

  // Determine if we need to copy the file. One that has to be converted (a
  // HEIC photo) is always copied, as a JPEG, even from inside the project
  let shouldCopy = copyStrategy === 'always' || isConvertedImage(sourcePath)

  if (!shouldCopy) {
    const isInProject = await commands.isPathInProject(sourcePath, projectPath)
    shouldCopy = !isInProject
  }

  let relativePath: string
  let wasCopied: boolean

  if (shouldCopy) {
    const result = await commands.copyFileToAssets(
      sourcePath,
      projectPath,
      collection,
      assetsDirectory,
      currentFilePath,
      useRelativePaths
    )
    if (result.status === 'error') {
      throw new Error(result.error)
    }
    relativePath = result.data.reference
    wasCopied = true

    // So the Git tab can offer it with the entry even after it's taken out of
    // the text
    useGitPanelStore.getState().rememberAdded(currentFilePath, result.data.path)
  } else {
    // File is already in project - reuse existing path
    const result = await commands.getRelativePath(
      sourcePath,
      projectPath,
      currentFilePath,
      useRelativePaths
    )
    if (result.status === 'error') {
      throw new Error(result.error)
    }
    relativePath = result.data
    wasCopied = false
  }

  // Path is already in final format from Rust - no normalization needed
  return {
    relativePath,
    wasCopied,
    filename,
  }
}

/**
 * Saves a pasted image into the collection's assets, named after `fileName`
 * as a copied file would be, and returns the path to write in the entry
 * @throws Error if it can't be saved
 */
export async function savePastedImage(
  image: Blob,
  fileName: string,
  options: Omit<ProcessFileToAssetsOptions, 'sourcePath' | 'copyStrategy'>
): Promise<string> {
  const { projectPath, collection, assetsDirectory, currentFilePath } = options
  const result = await commands.saveImageToAssets(
    await toBase64(image),
    fileName,
    {
      projectPath,
      collection,
      assetsDirectory,
      currentFilePath,
      useRelativePaths: options.useRelativePaths,
    }
  )
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  useGitPanelStore.getState().rememberAdded(currentFilePath, result.data.path)
  return result.data.reference
}

/** A blob's bytes as base64, which crosses to Rust far faster than an array */
async function toBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Unreadable'))
    reader.readAsDataURL(blob)
  })
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

/**
 * Extract filename from a file path
 * @param filePath - Full file path
 * @returns Just the filename portion
 */
function extractFilename(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  return filename || filePath
}
