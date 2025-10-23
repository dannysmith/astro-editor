/**
 * Image file extensions supported by the editor
 * Exported in two formats for different use cases
 */
export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
] as const

/** Image extensions with dot prefix for file extension matching */
export const IMAGE_EXTENSIONS_WITH_DOTS = IMAGE_EXTENSIONS.map(
  ext => `.${ext}`
) as readonly string[]

/** Type for image extension strings */
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number]
