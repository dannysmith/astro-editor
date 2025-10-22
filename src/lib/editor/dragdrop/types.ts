/**
 * Types for drag and drop functionality
 */

export interface FileDropPayload {
  paths?: string[]
  position?: {
    x: number
    y: number
  }
}

export interface ProcessedFile {
  originalPath: string
  filename: string
  isImage: boolean
  markdownText: string
}

export interface DropResult {
  success: boolean
  insertText: string
  error?: string
}
