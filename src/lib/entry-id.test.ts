import { describe, it, expect } from 'vitest'
import type { FileEntry } from '@/types'
import { astroEntryId } from './entry-id'

function file(id: string, frontmatter: FileEntry['frontmatter'] = null) {
  return {
    id,
    path: `/site/src/content/${id}.md`,
    name: id.split('/').pop()!,
    extension: 'md',
    collection: 'articles',
    last_modified: null,
    frontmatter,
  } satisfies FileEntry
}

describe('astroEntryId', () => {
  it('is the path in the collection, slugified as Astro does', () => {
    expect(astroEntryId(file('articles/first-article'))).toBe('first-article')
    expect(astroEntryId(file('articles/2024/My Post'))).toBe('2024/my-post')
    expect(astroEntryId(file('articles/Café & Crème'))).toBe('café--crème')
    // github-slugger drops other numbers like ² but keeps letter-like symbols like Ⓐ
    expect(astroEntryId(file('articles/x² Ⓐ_1'))).toBe('x-ⓐ_1')
    // Dots go, which is where the app's ids and Astro's differ most
    expect(astroEntryId(file('articles/v1.2-notes'))).toBe('v12-notes')
  })

  it('drops a trailing index', () => {
    expect(astroEntryId(file('articles/guides/index'))).toBe('guides')
    // Only a trailing `/index`: a top-level one stays
    expect(astroEntryId(file('articles/index'))).toBe('index')
  })

  it('uses a slug from the frontmatter', () => {
    expect(
      astroEntryId(file('articles/second-article', { slug: 'advanced' }))
    ).toBe('advanced')
    // YAML reads `slug: 2024` as a number
    expect(astroEntryId(file('articles/x', { slug: 2024 }))).toBe('2024')
  })
})
