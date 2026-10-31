import { slug } from 'github-slugger'
import type { FileEntry } from '@/types'

/**
 * The id Astro's glob loader gives a file's entry, which `getEntry()`,
 * `reference()` and `entry.id` use: the `slug` in its frontmatter if it has
 * one, otherwise its path in the collection without the extension, each part
 * slugified as Astro does, with a trailing `/index` dropped
 * (`generateIdDefault` in `astro/dist/content/loaders/glob.js`). A collection
 * with its own `generateId` can differ.
 *
 * `FileEntry.id` is the app's own id, `<collection>/<path>`, which Astro
 * doesn't know.
 */
export function astroEntryId(file: FileEntry): string {
  const fromFrontmatter = file.frontmatter?.slug
  if (typeof fromFrontmatter === 'string' && fromFrontmatter) {
    return fromFrontmatter
  }
  if (typeof fromFrontmatter === 'number' && fromFrontmatter) {
    return String(fromFrontmatter)
  }
  return file.id
    .slice(file.collection.length + 1)
    .split('/')
    .map(segment => slug(segment))
    .join('/')
    .replace(/\/index$/, '')
}
