import { getEntry, type CollectionEntry, type CollectionKey } from 'astro:content'

/** Every collection, in the content config's order */
export const allCollections: CollectionKey[] = [
  'blog',
  'notes',
  'docs',
  'journal',
  'bookmarks',
  'authors',
  'links',
  'recipes',
  'talks',
  'pages',
  'garden',
  'podcasts',
  'team',
  'scrobbles',
  'guides',
]

/** Collections of Markdown or MDX files, which get a page per entry */
export const renderable: CollectionKey[] = [
  'blog',
  'notes',
  'docs',
  'journal',
  'recipes',
  'talks',
  'pages',
  'garden',
  'podcasts',
  'guides',
]

type Entry = CollectionEntry<CollectionKey>

/** An entry's title, name or date, falling back to its id */
export function label(entry: Entry): string {
  const data = entry.data as Record<string, unknown>
  const value = data.title ?? data.name ?? data.date
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? entry.id)
}

/** Resolves every `reference()` field in an entry, as `field → target` */
export async function references(entry: Entry): Promise<string[]> {
  const refs = Object.entries(entry.data as Record<string, unknown>).filter(
    (pair): pair is [string, { collection: CollectionKey; id: string }] =>
      typeof pair[1] === 'object' && pair[1] !== null && 'collection' in pair[1] && 'id' in pair[1],
  )
  return Promise.all(
    refs.map(async ([field, ref]) => {
      const target = await getEntry(ref.collection, ref.id)
      return `${field} → ${target ? label(target) : `missing ${ref.collection}/${ref.id}`}`
    }),
  )
}
