import { convertFileSrc } from '@tauri-apps/api/core'
import { join, isAbsolute, resolve, dirname } from '@tauri-apps/api/path'

/**
 * Resolves an image path from frontmatter to an absolute file system path.
 *
 * Handles two path formats:
 * 1. Relative paths (starting with . or ..): resolved relative to markdown file
 * 2. Absolute paths (starting with /): resolved from project root
 *
 * @param imagePath - Path from frontmatter (e.g., "./cover.jpg" or "/src/assets/blog/cover.jpg")
 * @param markdownFilePath - Absolute path to the markdown file
 * @param projectPath - Absolute path to the project root
 * @returns Absolute file system path to the image
 */
export async function resolveImagePath(
  imagePath: string,
  markdownFilePath: string,
  projectPath: string
): Promise<string> {
  // Handle relative paths (starting with . or ..)
  if (imagePath.startsWith('.')) {
    const markdownDir = await dirname(markdownFilePath)
    return await resolve(markdownDir, imagePath)
  }

  // Handle absolute paths (starting with /)
  // Remove leading slash and resolve from project root
  const pathWithoutLeadingSlash = imagePath.startsWith('/')
    ? imagePath.slice(1)
    : imagePath
  return await join(projectPath, pathWithoutLeadingSlash)
}

/**
 * Converts an image path to a Tauri asset:// URL suitable for use in <img src>
 *
 * @param imagePath - Path from frontmatter
 * @param markdownFilePath - Absolute path to the markdown file
 * @param projectPath - Absolute path to the project root
 * @returns asset:// URL for use in img src attribute
 */
export async function getImageSrc(
  imagePath: string,
  markdownFilePath: string,
  projectPath: string
): Promise<string> {
  const absolutePath = await resolveImagePath(
    imagePath,
    markdownFilePath,
    projectPath
  )
  return convertFileSrc(absolutePath)
}

/**
 * Ensures an image path has the correct format for Astro's image() helper.
 *
 * Based on Phase 1.0 verification:
 * - Astro accepts absolute paths with leading `/` (e.g., "/src/assets/blog/cover.jpg")
 * - Astro accepts relative paths with `./` or `../`
 * - Astro does NOT accept paths without a prefix
 *
 * This function ensures paths returned from copy_file_to_assets_with_override
 * (which don't have a leading slash) are formatted correctly.
 *
 * @param imagePath - Path returned from Tauri command (e.g., "src/assets/blog/cover.jpg")
 * @returns Path formatted for Astro (e.g., "/src/assets/blog/cover.jpg")
 */
export function formatPathForAstro(imagePath: string): string {
  // If path already starts with / or ., it's already in the correct format
  if (imagePath.startsWith('/') || imagePath.startsWith('.')) {
    return imagePath
  }

  // Add leading slash for absolute project-relative paths
  return `/${imagePath}`
}
