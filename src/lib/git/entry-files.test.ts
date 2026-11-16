import { describe, it, expect } from 'vitest'
import type { GitChange, GitChangeKind } from '@/lib/bindings'
import { entryChanges } from './entry-files'

function change(path: string, kind: GitChangeKind = 'modified'): GitChange {
  return { path, originalPath: null, kind, submodule: false }
}

const paths = (changes: GitChange[]) => changes.map(c => c.path)

describe('entryChanges', () => {
  const changes = [
    change('src/assets/articles/2026-11-16-harbour.jpg', 'new'),
    change('src/content/articles/harbour.md'),
    change('src/assets/articles/2026-11-16-old-map.png', 'new'),
    change('src/assets/articles/map.png', 'new'),
    change('src/content/articles/other.md'),
    change('package.json'),
  ]

  it('takes the entry and the files its text names, entry first', () => {
    const { entry, others } = entryChanges({
      changes,
      entryPath: 'src/content/articles/harbour.md',
      entryText:
        '---\ncover: ../../assets/articles/2026-11-16-harbour.jpg\n---\n\nSee [the other one](./other.md).\n\n![](../../assets/articles/2026-11-16-old-map.png)\n',
    })
    expect(paths(entry)).toEqual([
      'src/content/articles/harbour.md',
      'src/assets/articles/2026-11-16-harbour.jpg',
      'src/assets/articles/2026-11-16-old-map.png',
    ])
    // map.png is only named as the end of a longer name, and other.md is
    // another entry
    expect(paths(others)).toEqual([
      'src/assets/articles/map.png',
      'src/content/articles/other.md',
      'package.json',
    ])
  })

  it('matches a name written URL-encoded', () => {
    const { entry } = entryChanges({
      changes: [change('notes/a.md'), change('notes/my photo.jpg', 'new')],
      entryPath: 'notes/a.md',
      entryText: '![](./my%20photo.jpg)',
    })
    expect(paths(entry)).toEqual(['notes/a.md', 'notes/my photo.jpg'])
  })

  it("takes the files in a colocated entry's folder, but not other entries", () => {
    const { entry } = entryChanges({
      changes: [
        change('posts/trip/cover.jpg', 'new'),
        change('posts/trip/index.mdx'),
        change('posts/trip/notes.md', 'new'),
        change('posts/other/cover.jpg', 'new'),
      ],
      entryPath: 'posts/trip/index.mdx',
      entryText: '',
    })
    expect(paths(entry)).toEqual([
      'posts/trip/index.mdx',
      'posts/trip/cover.jpg',
    ])
  })

  it('includes the old path of a rename', () => {
    const { entry } = entryChanges({
      changes: [change('a/old.md', 'deleted'), change('a/new.md', 'new')],
      entryPath: 'a/new.md',
      entryText: '',
      alsoInclude: ['a/old.md'],
    })
    expect(paths(entry)).toEqual(['a/new.md', 'a/old.md'])
  })

  it('puts everything in others without an entry', () => {
    const { entry, others } = entryChanges({
      changes,
      entryPath: '',
      entryText: '',
    })
    expect(entry).toEqual([])
    expect(others).toEqual(changes)
  })
})
