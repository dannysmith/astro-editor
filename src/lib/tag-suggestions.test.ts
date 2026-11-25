import { describe, it, expect } from 'vitest'
import type { FileEntry } from '@/types'
import {
  existingSpelling,
  matchSuggestions,
  MAX_SUGGESTIONS,
  tagSuggestions,
  type TagSuggestion,
} from './tag-suggestions'

function entry(
  path: string,
  frontmatter: FileEntry['frontmatter'],
  isEntry = true
): FileEntry {
  return {
    id: path,
    path,
    name: path,
    extension: 'md',
    collection: 'blog',
    last_modified: null,
    frontmatter,
    is_entry: isEntry,
  }
}

const suggest = (...values: string[]): TagSuggestion[] =>
  values.map(value => ({ value, count: 1 }))

describe('tagSuggestions', () => {
  it('counts each value, most used first, then A–Z', () => {
    const entries = [
      entry('a', { tags: ['react', 'astro'] }),
      entry('b', { tags: ['astro', 'css'] }),
      entry('c', { tags: ['astro', 'react', 'react'] }),
    ]
    expect(tagSuggestions(entries, 'tags', undefined)).toEqual([
      { value: 'astro', count: 3 },
      { value: 'react', count: 2 },
      { value: 'css', count: 1 },
    ])
  })

  it('keeps values that differ in case apart', () => {
    const entries = [
      entry('a', { tags: ['JavaScript'] }),
      entry('b', { tags: ['javascript'] }),
    ]
    expect(tagSuggestions(entries, 'tags', undefined)).toHaveLength(2)
  })

  it('leaves out the open file, files that are not entries, and non-strings', () => {
    const entries = [
      entry('open', { tags: ['mine'] }),
      entry('draft', { tags: ['ignored'] }, false),
      entry('a', { tags: ['kept', 3, null, '  '] }),
      entry('b', { tags: 'not a list' }),
      entry('c', null),
    ]
    expect(tagSuggestions(entries, 'tags', 'open')).toEqual([
      { value: 'kept', count: 1 },
    ])
  })

  it('reads nested fields', () => {
    const entries = [entry('a', { seo: { keywords: ['astro'] } })]
    expect(tagSuggestions(entries, 'seo.keywords', undefined)).toEqual([
      { value: 'astro', count: 1 },
    ])
  })
})

describe('matchSuggestions', () => {
  it('matches anywhere in a value, ignoring case', () => {
    const matches = matchSuggestions(
      suggest('JavaScript', 'TypeScript', 'CSS'),
      'script',
      []
    )
    expect(matches.map(m => m.value)).toEqual(['JavaScript', 'TypeScript'])
  })

  it('leaves out values already in the field, in any case', () => {
    const matches = matchSuggestions(suggest('Astro', 'React'), '', ['astro'])
    expect(matches.map(m => m.value)).toEqual(['React'])
  })

  it('lists the first few when nothing has been typed', () => {
    const many = suggest(...Array.from({ length: 20 }, (_, i) => `tag${i}`))
    expect(matchSuggestions(many, '  ', [])).toEqual(
      many.slice(0, MAX_SUGGESTIONS)
    )
  })
})

describe('existingSpelling', () => {
  it("uses the collection's spelling of a value typed in another case", () => {
    expect(existingSpelling(suggest('JavaScript'), 'javascript')).toBe(
      'JavaScript'
    )
  })

  it('prefers the most used spelling', () => {
    expect(existingSpelling(suggest('Astro', 'astro'), 'ASTRO')).toBe('Astro')
  })

  it('keeps a new value as typed', () => {
    expect(existingSpelling(suggest('JavaScript'), 'java')).toBe('java')
  })
})
