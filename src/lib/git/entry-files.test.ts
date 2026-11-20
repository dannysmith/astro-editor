import { describe, it, expect } from 'vitest'
import type { GitChange, GitChangeKind } from '@/lib/bindings'
import { groupChanges, usedFiles } from './entry-files'
import { changeStatus } from './status'

function change(path: string, kind: GitChangeKind = 'modified'): GitChange {
  return {
    path,
    originalPath: null,
    kind,
    staged: false,
    unstaged: kind !== 'new',
    submodule: false,
  }
}

const paths = (changes: GitChange[]) => changes.map(c => c.path)

describe('usedFiles', () => {
  const changes = [
    change('src/assets/articles/2026-11-16-harbour.jpg', 'new'),
    change('src/content/articles/harbour.md'),
    change('src/assets/articles/2026-11-16-old-map.png', 'new'),
    change('src/assets/articles/map.png', 'new'),
    change('src/content/articles/other.md'),
    change('package.json'),
  ]

  it('finds the files the text names, but not other entries', () => {
    expect(
      usedFiles({
        changes,
        entryPath: 'src/content/articles/harbour.md',
        entryText:
          '---\ncover: ../../assets/articles/2026-11-16-harbour.jpg\n---\n\nSee [the other one](./other.md).\n\n![](../../assets/articles/2026-11-16-old-map.png)\n',
      })
    ).toEqual([
      // map.png is only named as the end of a longer name
      'src/assets/articles/2026-11-16-harbour.jpg',
      'src/assets/articles/2026-11-16-old-map.png',
    ])
  })

  it('matches a name written URL-encoded', () => {
    expect(
      usedFiles({
        changes: [change('notes/a.md'), change('notes/my photo.jpg', 'new')],
        entryPath: 'notes/a.md',
        entryText: '![](./my%20photo.jpg)',
      })
    ).toEqual(['notes/my photo.jpg'])
  })

  it("takes the files in a colocated entry's folder, but not other entries", () => {
    expect(
      usedFiles({
        changes: [
          change('posts/trip/cover.jpg', 'new'),
          change('posts/trip/index.mdx'),
          change('posts/trip/notes.md', 'new'),
          change('posts/other/cover.jpg', 'new'),
        ],
        entryPath: 'posts/trip/index.mdx',
        entryText: '',
      })
    ).toEqual(['posts/trip/cover.jpg'])
  })

  it('finds nothing without an entry', () => {
    expect(usedFiles({ changes, entryPath: '', entryText: 'map.png' })).toEqual(
      []
    )
  })
})

describe('groupChanges', () => {
  it('separates the entry, its files, files added for it, and the rest', () => {
    const groups = groupChanges({
      changes: [
        change('a/old.jpg', 'new'),
        change('a/entry.md'),
        change('a/cover.jpg', 'new'),
        change('README.md'),
      ],
      entryPath: 'a/entry.md',
      used: ['a/cover.jpg'],
      added: ['a/cover.jpg', 'a/old.jpg', 'a/committed-since.jpg'],
    })
    expect(groups.entry?.path).toBe('a/entry.md')
    expect(paths(groups.used)).toEqual(['a/cover.jpg'])
    expect(paths(groups.unused)).toEqual(['a/old.jpg'])
    expect(paths(groups.others)).toEqual(['README.md'])
  })
})

describe('changeStatus', () => {
  it("names a change in git's terms", () => {
    const label = (c: Partial<GitChange>) =>
      changeStatus({ ...change('a.md'), ...c }).label
    expect(label({ kind: 'new', staged: false, unstaged: false })).toBe(
      'Untracked'
    )
    expect(label({ kind: 'new', staged: true, unstaged: false })).toBe('Added')
    expect(label({ staged: false, unstaged: true })).toBe('Modified')
    expect(label({ staged: true, unstaged: false })).toBe('Staged')
    expect(label({ staged: true, unstaged: true })).toBe('Partly staged')
    expect(label({ kind: 'conflicted' })).toBe('Conflicted')
  })

  it("gives VS Code's letter, the same staged or not", () => {
    const letter = (c: Partial<GitChange>) =>
      changeStatus({ ...change('a.md'), ...c }).letter
    expect(letter({ kind: 'new', staged: false, unstaged: false })).toBe('U')
    expect(letter({ kind: 'new', staged: true, unstaged: false })).toBe('A')
    expect(letter({ staged: true, unstaged: true })).toBe('M')
    expect(letter({ kind: 'deleted' })).toBe('D')
    expect(letter({ kind: 'renamed' })).toBe('R')
    expect(letter({ kind: 'conflicted' })).toBe('!')
  })
})
