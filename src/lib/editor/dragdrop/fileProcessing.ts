import { ProcessedFile } from './types'
import { useProjectStore } from '../../../store/projectStore'
import { processFileToAssets, IMAGE_EXTENSIONS_WITH_DOTS } from '../../files'

/**
 * Check if a file is an image based on its extension
 * @param filename - Name of the file
 * @returns true if the file is an image
 */
export const isImageFile = (filename: string): boolean => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return IMAGE_EXTENSIONS_WITH_DOTS.includes(extension)
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
    // Get current settings for asset directory resolution
    const { currentProjectSettings } = useProjectStore.getState()

    // Use shared utility with 'always' strategy
    const result = await processFileToAssets({
      sourcePath: filePath,
      projectPath,
      collection,
      projectSettings: currentProjectSettings,
      copyStrategy: 'always',
    })

    // Format as markdown (editor-specific concern)
    const markdownText = formatAsMarkdown(
      result.filename,
      result.relativePath,
      isImage
    )

    return {
      originalPath: filePath,
      filename,
      isImage,
      markdownText,
    }
  } catch {
    // Fallback to original path if processing fails (preserve existing behavior)
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
