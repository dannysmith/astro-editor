import { commands } from '@/lib/bindings'
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
    const isInProject = await commands.isPathInProject(sourcePath, projectPath)
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

    let result
    if (assetsDirectory !== ASTRO_PATHS.ASSETS_DIR) {
      // Use collection-specific or project-level override
      result = await commands.copyFileToAssetsWithOverride(
        sourcePath,
        projectPath,
        collection,
        assetsDirectory,
        currentFilePath,
        useRelativePaths
      )
    } else {
      // Use default assets directory
      result = await commands.copyFileToAssets(
        sourcePath,
        projectPath,
        collection,
        currentFilePath,
        useRelativePaths
      )
    }

    if (result.status === 'error') {
      throw new Error(result.error)
    }
    relativePath = result.data

    wasCopied = true
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
 * Extract filename from a file path
 * @param filePath - Full file path
 * @returns Just the filename portion
 */
function extractFilename(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  return filename || filePath
}
