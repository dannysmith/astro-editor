import type { FileEntry } from '@/types'
import { astroEntryId } from '../entry-id'

/**
 * Build a relative file path from source to target
 */
export function buildRelativePath(
  sourcePath: string,
  targetPath: string
): string {
  const sourceParts = sourcePath.split('/')
  const targetParts = targetPath.split('/')

  // Get directories (strip filename)
  const sourceDir = sourceParts.slice(0, -1)
  const targetDir = targetParts.slice(0, -1)
  const targetFilename = targetParts[targetParts.length - 1]

  // Find common prefix length
  let commonLength = 0
  while (
    commonLength < sourceDir.length &&
    commonLength < targetDir.length &&
    sourceDir[commonLength] === targetDir[commonLength]
  ) {
    commonLength++
  }

  // Number of levels to go up from source dir
  const levelsUp = sourceDir.length - commonLength
  const remainingTarget = targetDir.slice(commonLength)

  if (levelsUp === 0) {
    // Same directory or subdirectory
    const parts = ['.', ...remainingTarget, targetFilename]
    return parts.join('/')
  }

  const upParts = Array.from({ length: levelsUp }, () => '..')
  const parts = [...upParts, ...remainingTarget, targetFilename]
  return parts.join('/')
}

/**
 * Resolve a URL pattern template with a file's slug: its id in Astro, which is
 * its `slug` frontmatter if it has one
 */
export function resolveUrlPattern(pattern: string, file: FileEntry): string {
  return pattern.replace('{slug}', astroEntryId(file))
}

/**
 * Build a markdown content link.
 *
 * @param sourceFile - The file the link is being inserted into
 * @param targetFile - The file being linked to
 * @param urlPattern - Optional URL pattern template (e.g. "/writing/{slug}")
 * @param titleField - Optional frontmatter field name to use as link text
 * @returns Markdown link string like "[Title](url)"
 */
export function buildContentLink(
  sourceFile: FileEntry,
  targetFile: FileEntry,
  urlPattern?: string,
  titleField?: string
): string {
  // Resolve title
  const title = resolveTitle(targetFile, titleField)

  // Resolve URL
  const url = urlPattern
    ? resolveUrlPattern(urlPattern, targetFile)
    : buildRelativePath(sourceFile.path, targetFile.path)

  const safeTitle = title.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
  const safeUrl = url.replace(/\)/g, '%29')

  return `[${safeTitle}](${safeUrl})`
}

/**
 * Resolve the display title for a file entry
 */
export function resolveTitle(file: FileEntry, titleField?: string): string {
  if (titleField && file.frontmatter?.[titleField]) {
    const val = file.frontmatter[titleField]
    if (typeof val === 'string' && val.length > 0) return val
  }

  if (file.frontmatter?.title) {
    const val = file.frontmatter.title
    if (typeof val === 'string' && val.length > 0) return val
  }

  return file.name
}
