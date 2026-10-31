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
  })

  it('drops a trailing index', () => {
    expect(astroEntryId(file('articles/guides/index'))).toBe('guides')
  })

  it('uses a slug from the frontmatter', () => {
    expect(
      astroEntryId(file('articles/second-article', { slug: 'advanced' }))
    ).toBe('advanced')
  })
})
