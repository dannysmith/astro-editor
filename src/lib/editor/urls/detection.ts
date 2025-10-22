/**
 * URL detection utilities for the editor
 */

import { IMAGE_EXTENSIONS } from '../dragdrop/fileProcessing'

export interface UrlMatch {
  url: string
  from: number
  to: number
}

// URL detection regex
export const urlRegex = /^https?:\/\/[^\s]+$/

/**
 * Enhanced URL detection for both plain URLs and markdown links
 * @param text - Text to search for URLs
 * @param offset - Offset to add to positions (for line-based searching)
 * @returns Array of URL matches with positions
 */
export const findUrlsInText = (
  text: string,
  offset: number = 0
): UrlMatch[] => {
  const urls: UrlMatch[] = []
  const markdownRanges: Array<{ from: number; to: number }> = []

  // First, find all markdown link ranges to avoid duplicates
  const markdownLinkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const linkUrl = match[2]
    const linkText = match[1]
    const isImage = match[0].startsWith('!')

    if (linkUrl && linkUrl.startsWith('http') && match.index !== undefined) {
      // Position of the URL part within the markdown link/image
      // For images: ![alt](url) - need to account for the extra ! character
      const urlStart = match.index + (linkText?.length || 0) + (isImage ? 4 : 3) // after "!](" or "]("
      const urlEnd = urlStart + linkUrl.length

      urls.push({
        url: linkUrl,
        from: offset + urlStart,
        to: offset + urlEnd,
      })

      // Track the entire markdown link range to avoid plain URL detection inside it
      markdownRanges.push({
        from: match.index,
        to: match.index + match[0].length,
      })
    }
  }

  // Find plain URLs, but skip those inside markdown links
  const plainUrlRegex = /https?:\/\/[^\s)]+/g
  while ((match = plainUrlRegex.exec(text)) !== null) {
    const urlStart = match.index
    const urlEnd = match.index + match[0].length

    // Check if this URL is inside a markdown link
    const isInsideMarkdown = markdownRanges.some(
      range => urlStart >= range.from && urlEnd <= range.to
    )

    if (!isInsideMarkdown) {
      urls.push({
        url: match[0],
        from: offset + urlStart,
        to: offset + urlEnd,
      })
    }
  }

  return urls
}

/**
 * Check if a string is a valid URL
 * @param text - Text to check
 * @returns true if text is a valid URL
 */
export const isValidUrl = (text: string): boolean => {
  return urlRegex.test(text.trim())
}

/**
 * Check if a URL points to an image based on its file extension
 * Handles query parameters and fragments by only checking the path portion
 * @param url - URL to check
 * @returns true if the URL path ends with an image extension
 */
export const isImageUrl = (url: string): boolean => {
  // Remove query parameters and fragments to check only the path
  const urlPath = (url.split('?')[0] ?? '').split('#')[0] ?? ''
  return IMAGE_EXTENSIONS.some(ext => urlPath.toLowerCase().endsWith(ext))
}

/**
 * Find image URLs in text (both markdown images and plain image URLs)
 * This is a convenience function that filters findUrlsInText results to only image URLs
 * @param text - Text to search for image URLs
 * @param offset - Offset to add to positions (for line-based searching)
 * @returns Array of image URL matches with positions
 */
export const findImageUrlsInText = (
  text: string,
  offset: number = 0
): UrlMatch[] => {
  const allUrls = findUrlsInText(text, offset)
  return allUrls.filter(urlMatch => isImageUrl(urlMatch.url))
}
