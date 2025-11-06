import type { ProjectSettings } from '../project-registry/types'
import type { ImageExtension } from './constants'

/**
 * Options for processing files to assets directory
 */
export interface ProcessFileToAssetsOptions {
  /** Path to the source file to process */
  sourcePath: string
  /** Path to the project root */
  projectPath: string
  /** Name of the collection (for collection-specific asset directory resolution) */
  collection: string
  /** Current project settings (for path overrides) */
  projectSettings?: ProjectSettings | null
  /**
   * Strategy for copying files:
   * - 'always': Always copy and rename (editor drag-and-drop)
   * - 'only-if-outside-project': Only copy if file is outside project (frontmatter fields)
   */
  copyStrategy: 'always' | 'only-if-outside-project'
  /** Path to the current file being edited (for relative path calculation) */
  currentFilePath: string
  /** Whether to use relative paths (true) or absolute from project root (false) */
  useRelativePaths: boolean
}

/**
 * Result of processing a file to assets
 */
export interface ProcessFileToAssetsResult {
  /**
   * Path to the asset - either relative to current file (e.g., '../../assets/image.png')
   * or absolute from project root (e.g., '/src/assets/image.png')
   */
  relativePath: string
  /** Whether the file was copied (true) or existing path was reused (false) */
  wasCopied: boolean
  /** Original filename (useful for markdown formatting) */
  filename: string
}

export type { ImageExtension }
