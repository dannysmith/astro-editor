import { describe, it, expect } from 'vitest'
import type { FileEntry } from '@/types'
import { visibleFiles } from './visible-files'

const mappings = {
  publishedDate: 'pubDate',
  title: 'title',
  description: 'description',
  draft: 'draft',
}

const file = (name: string, title: string, draft: boolean): FileEntry => ({
  id: `posts/${name}`,
  name,
  path: `/content/posts/${name}.md`,
  extension: 'md',
  collection: 'posts',
  last_modified: null,
  frontmatter: { title, draft },
  is_entry: true,
})

const files = [
  file('c', 'Zebra notes', true),
  file('a', 'Apple notes', true),
  file('b', 'Mango recipe', true),
  file('d', 'Apple published', false),
]

describe('visibleFiles', () => {
  it('applies the draft filter and search, then sorts what is left', () => {
    const result = visibleFiles(
      files,
      {
        showDraftsOnly: true,
        searchQuery: 'notes',
        sortMode: 'title',
        sortDirection: 'asc',
      },
      mappings,
      null
    )

    expect(result.map(entry => entry.name)).toEqual(['a', 'c'])
  })

  it("doesn't reorder the list it was given", () => {
    const original = [...files]

    visibleFiles(
      files,
      {
        showDraftsOnly: false,
        searchQuery: '',
        sortMode: 'title',
        sortDirection: 'asc',
      },
      mappings,
      null
    )

    expect(files).toEqual(original)
  })
})
