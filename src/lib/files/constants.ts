/**
 * Image file extensions supported by the editor: the images Astro can use,
 * plus the ones it serves as they are from `public/` (bmp, ico)
 * Exported in two formats for different use cases
 */
export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'tiff',
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

/**
 * Images Astro can't use, which are converted to JPEG as they're added to a
 * project (by `copy_file_to_assets`). A HEIC already in a project still isn't
 * usable, so these aren't in IMAGE_EXTENSIONS.
 */
export const CONVERTED_IMAGE_EXTENSIONS = ['heic', 'heif'] as const

/** Every image that can be added to a project, for pickers and drops */
export const ADDABLE_IMAGE_EXTENSIONS: readonly string[] = [
  ...IMAGE_EXTENSIONS,
  ...CONVERTED_IMAGE_EXTENSIONS,
]

/** Whether a file is an image that's converted as it's added */
export const isConvertedImage = (path: string): boolean => {
  const dot = path.lastIndexOf('.')
  const extension = dot === -1 ? '' : path.slice(dot + 1).toLowerCase()
  return (CONVERTED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)
}
