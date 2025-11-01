import {
  extractFilename,
  isImageFile,
  formatAsMarkdown,
} from './fileProcessing'

/**
 * Build fallback markdown for file paths when project context is unavailable
 * @param filePaths - Array of file paths
 * @returns Fallback markdown text
 */
export const buildFallbackMarkdownForPaths = (filePaths: string[]): string => {
  const fallbackText = filePaths
    .map(filePath => {
      const filename = extractFilename(filePath)
      const isImage = isImageFile(filename)
      return formatAsMarkdown(filename, filePath, isImage)
    })
    .join('\n')

  return fallbackText
}

/**
 * Validate that we have the necessary context for file processing
 * @param projectPath - Path to the project
 * @param currentFile - Currently open file
 * @returns Object indicating if we can proceed and what fallback to use
 */
export const validateDropContext = (
  projectPath: string | null,
  currentFile: { collection: string } | null
): {
  canProceed: boolean
  reason?: 'no-project' | 'no-file' | 'no-collection'
} => {
  if (!projectPath) {
    return { canProceed: false, reason: 'no-project' }
  }

  if (!currentFile) {
    return { canProceed: false, reason: 'no-file' }
  }

  if (!currentFile.collection) {
    return { canProceed: false, reason: 'no-collection' }
  }

  return { canProceed: true }
}
