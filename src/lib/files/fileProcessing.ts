import { invoke } from '@tauri-apps/api/core'
import { getEffectiveAssetsDirectory } from '../project-registry'
import { ASTRO_PATHS } from '../constants'
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
    projectSettings,
    copyStrategy,
    currentFilePath,
    useRelativePaths,
  } = options

  // Extract filename for result
  const filename = extractFilename(sourcePath)

  // Determine if we need to copy the file
  let shouldCopy = copyStrategy === 'always'

  if (copyStrategy === 'only-if-outside-project') {
    const isInProject = await invoke<boolean>('is_path_in_project', {
      filePath: sourcePath,
      projectPath: projectPath,
    })
    shouldCopy = !isInProject
  }

  let relativePath: string
  let wasCopied: boolean

  if (shouldCopy) {
    // Copy file to assets directory
    const assetsDirectory = getEffectiveAssetsDirectory(
      projectSettings,
      collection
    )

    if (assetsDirectory !== ASTRO_PATHS.ASSETS_DIR) {
      // Use collection-specific or project-level override
      relativePath = await invoke<string>('copy_file_to_assets_with_override', {
        sourcePath: sourcePath,
        projectPath: projectPath,
        collection: collection,
        assetsDirectory: assetsDirectory,
        currentFilePath: currentFilePath,
        useRelativePaths: useRelativePaths,
      })
    } else {
      // Use default assets directory
      relativePath = await invoke<string>('copy_file_to_assets', {
        sourcePath: sourcePath,
        projectPath: projectPath,
        collection: collection,
        currentFilePath: currentFilePath,
        useRelativePaths: useRelativePaths,
      })
    }

    wasCopied = true
  } else {
    // File is already in project - reuse existing path
    relativePath = await invoke<string>('get_relative_path', {
      filePath: sourcePath,
      projectPath: projectPath,
      currentFilePath: currentFilePath,
      useRelativePaths: useRelativePaths,
    })
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
 * Extract filename from a file path
 * @param filePath - Full file path
 * @returns Just the filename portion
 */
function extractFilename(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  return filename || filePath
}
