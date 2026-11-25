// Loaders AE can't read from the content config: the shapes custom and
// third-party loaders take, without network access or secrets.
import { file, glob, type Loader } from 'astro/loaders'

/** Markdown and MDX files in a folder, under a loader name AE doesn't know */
export function markdownFolder(base: string): Loader {
  return { ...glob({ pattern: '**/*.{md,mdx}', base }), name: 'markdown-folder' }
}

/** A JSON file of records, like `file()`, under a loader name AE doesn't know */
export function jsonRecords(path: string): Loader {
  return { ...file(path), name: 'json-records' }
}

/**
 * Stands in for a loader that fetches records from an API (AT Protocol,
 * Notion, a feed): its entries have ids and data, and no files
 */
export function apiRecords(name: string, records: Array<{ id: string } & Record<string, unknown>>): Loader {
  return {
    name,
    load: async ({ store, parseData, generateDigest }) => {
      store.clear()
      for (const record of records) {
        const data = await parseData({ id: record.id, data: record })
        store.set({ id: record.id, data, digest: generateDigest(record) })
      }
    },
  }
}
