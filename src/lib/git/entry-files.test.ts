import { describe, it, expect } from 'vitest'
import type { GitChange, GitChangeKind } from '@/lib/bindings'
import { entryName, groupChanges, usedFiles } from './entry-files'
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

  it('matches a name only when the reference ends with it', () => {
    const changes = [change('notes/a.md'), change('notes/map.png', 'new')]
    const used = (entryText: string) =>
      usedFiles({ changes, entryPath: 'notes/a.md', entryText })
    expect(used('![](./map.png.backup)')).toEqual([])
    expect(used('![](./map.png?raw)')).toEqual(['notes/map.png'])
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

  it("doesn't take another entry's file of the same name", () => {
    const changes = [
      change('posts/trip/index.md'),
      change('posts/other/cover.jpg', 'new'),
    ]
    const used = (entryText: string) =>
      usedFiles({ changes, entryPath: 'posts/trip/index.md', entryText })
    expect(used('![](./cover.jpg)')).toEqual([])
    expect(used('---\nimage: cover.jpg\n---\n')).toEqual([])
    // Unless the reference leads there
    expect(used('![](../other/cover.jpg)')).toEqual(['posts/other/cover.jpg'])
  })

  it('takes a file of the name for references that are not relative', () => {
    const changes = [
      change('src/content/blog/post.md'),
      change('src/assets/blog/map.png', 'new'),
      change('public/images/photo.jpg', 'new'),
    ]
    expect(
      usedFiles({
        changes,
        entryPath: 'src/content/blog/post.md',
        // An alias, and a path from the site's root, as written in frontmatter
        // (JSON, as the panel reads it) and MDX
        entryText:
          '{"cover":"@assets/blog/map.png"}import P from "x"\n<Image src="/images/photo.jpg" />',
      })
    ).toEqual(['src/assets/blog/map.png', 'public/images/photo.jpg'])
  })

  it('finds nothing without an entry', () => {
    expect(usedFiles({ changes, entryPath: '', entryText: 'map.png' })).toEqual(
      []
    )
  })
})

describe('entryName', () => {
  it("names a colocated entry with its folder, since they're all index.md", () => {
    expect(entryName('/site/posts/trip/index.mdx')).toBe('trip/index.mdx')
    expect(entryName('/site/posts/trip.md')).toBe('trip.md')
    expect(entryName('index.md')).toBe('index.md')
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
