import { invoke } from '@tauri-apps/api/core'
import { ProcessedFile } from './types'
import { useProjectStore } from '../../../store/projectStore'
import { getEffectiveAssetsDirectory } from '../../project-registry'
import { ASTRO_PATHS } from '../../constants'

/**
 * Image file extensions that should be treated as images
 */
export const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
] as const

/**
 * Check if a file is an image based on its extension
 * @param filename - Name of the file
 * @returns true if the file is an image
 */
export const isImageFile = (filename: string): boolean => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.includes(
    extension as (typeof IMAGE_EXTENSIONS)[number]
  )
}

/**
 * Extract filename from a file path
 * @param filePath - Full file path
 * @returns Just the filename portion
 */
export const extractFilename = (filePath: string): string => {
  // Handle both Unix and Windows path separators
  const parts = filePath.split(/[/\\]/)
  const filename = parts[parts.length - 1]

  // If the filename is empty (path ends with separator), return empty string
  if (filename === '') {
    return ''
  }

  return filename || filePath
}

/**
 * Format a file as markdown (image or link)
 * @param filename - Name of the file
 * @param path - Path to the file
 * @param isImage - Whether the file is an image
 * @returns Formatted markdown string
 */
export const formatAsMarkdown = (
  filename: string,
  path: string,
  isImage: boolean
): string => {
  if (isImage) {
    return `![${filename}](${path})`
  } else {
    return `[${filename}](${path})`
  }
}

/**
 * Process a single file for drag and drop
 * @param filePath - Path to the dropped file
 * @param projectPath - Path to the project root
 * @param collection - Name of the collection
 * @returns Processed file information
 */
export const processDroppedFile = async (
  filePath: string,
  projectPath: string,
  collection: string
): Promise<ProcessedFile> => {
  const filename = extractFilename(filePath)
  const isImage = isImageFile(filename)

  try {
    // Get assets directory using centralized path resolution with collection context
    const { currentProjectSettings } = useProjectStore.getState()
    const assetsDirectory = getEffectiveAssetsDirectory(
      currentProjectSettings,
      collection
    )

    let newPath: string
    if (assetsDirectory !== ASTRO_PATHS.ASSETS_DIR) {
      // Use the resolved assets directory (could be collection-specific or project-level override)
      newPath = await invoke<string>('copy_file_to_assets_with_override', {
        sourcePath: filePath,
        projectPath: projectPath,
        collection: collection,
        assetsDirectory: assetsDirectory,
      })
    } else {
      // Use default
      newPath = await invoke<string>('copy_file_to_assets', {
        sourcePath: filePath,
        projectPath: projectPath,
        collection: collection,
      })
    }

    // Return markdown formatted string with new path
    const markdownText = formatAsMarkdown(filename, `/${newPath}`, isImage)

    return {
      originalPath: filePath,
      filename,
      isImage,
      markdownText,
    }
  } catch {
    // Fallback to original path if copy fails
    const markdownText = formatAsMarkdown(filename, filePath, isImage)

    return {
      originalPath: filePath,
      filename,
      isImage,
      markdownText,
    }
  }
}

/**
 * Process multiple files for drag and drop
 * @param filePaths - Array of file paths
 * @param projectPath - Path to the project root
 * @param collection - Name of the collection
 * @returns Array of processed files
 */
export const processDroppedFiles = async (
  filePaths: string[],
  projectPath: string,
  collection: string
): Promise<ProcessedFile[]> => {
  return Promise.all(
    filePaths.map(filePath =>
      processDroppedFile(filePath, projectPath, collection)
    )
  )
}
