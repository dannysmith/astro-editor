import { describe, it, expect } from 'vitest'
import {
  buildRelativePath,
  resolveSlug,
  resolveUrlPattern,
  buildContentLink,
} from './link-builder'
import type { FileEntry } from '@/types'

function makeFile(overrides: Partial<FileEntry>): FileEntry {
  return {
    id: 'test',
    path: '/project/src/content/articles/test.md',
    name: 'test',
    extension: 'md',
    collection: 'articles',
    last_modified: null,
    frontmatter: null,
    ...overrides,
  }
}

describe('buildRelativePath', () => {
  it('same collection, same directory', () => {
    expect(
      buildRelativePath(
        '/project/src/content/articles/my-post.md',
        '/project/src/content/articles/other-post.md'
      )
    ).toBe('./other-post.md')
  })

  it('cross collection', () => {
    expect(
      buildRelativePath(
        '/project/src/content/articles/my-post.md',
        '/project/src/content/notes/idea.md'
      )
    ).toBe('../notes/idea.md')
  })

  it('source at root, target nested', () => {
    expect(
      buildRelativePath(
        '/project/src/content/posts/my-post.md',
        '/project/src/content/posts/2024/january/deep-post.md'
      )
    ).toBe('./2024/january/deep-post.md')
  })

  it('source nested, target at root', () => {
    expect(
      buildRelativePath(
        '/project/src/content/posts/2024/january/deep-post.md',
        '/project/src/content/posts/other-post.md'
      )
    ).toBe('../../other-post.md')
  })

  it('both nested at different depths', () => {
    expect(
      buildRelativePath(
        '/project/src/content/posts/2024/january/deep-post.md',
        '/project/src/content/posts/2023/february/old-post.md'
      )
    ).toBe('../../2023/february/old-post.md')
  })

  it('cross collection with nesting', () => {
    expect(
      buildRelativePath(
        '/project/src/content/articles/2024/post.md',
        '/project/src/content/notes/ideas/thought.md'
      )
    ).toBe('../../notes/ideas/thought.md')
  })
})

describe('resolveSlug', () => {
  it('returns frontmatter slug when present', () => {
    const file = makeFile({
      id: 'articles/my-post',
      frontmatter: { slug: 'custom-slug' },
    })
    expect(resolveSlug(file)).toBe('custom-slug')
  })

  it('falls back to id when no slug', () => {
    const file = makeFile({
      id: 'articles/my-post',
      frontmatter: { title: 'My Post' },
    })
    expect(resolveSlug(file)).toBe('articles/my-post')
  })

  it('falls back to id when slug is empty', () => {
    const file = makeFile({
      id: 'articles/my-post',
      frontmatter: { slug: '' },
    })
    expect(resolveSlug(file)).toBe('articles/my-post')
  })

  it('falls back to id when frontmatter is null', () => {
    const file = makeFile({
      id: 'articles/my-post',
      frontmatter: null,
    })
    expect(resolveSlug(file)).toBe('articles/my-post')
  })
})

describe('resolveUrlPattern', () => {
  it('replaces {slug} with frontmatter slug', () => {
    const file = makeFile({
      frontmatter: { slug: 'my-cool-post' },
    })
    expect(resolveUrlPattern('/writing/{slug}', file)).toBe(
      '/writing/my-cool-post'
    )
  })

  it('replaces {slug} with id when no slug field', () => {
    const file = makeFile({
      id: 'articles/my-post',
      frontmatter: { title: 'Test' },
    })
    expect(resolveUrlPattern('/blog/{slug}', file)).toBe(
      '/blog/articles/my-post'
    )
  })
})

describe('buildContentLink', () => {
  it('uses relative path when no URL pattern', () => {
    const source = makeFile({
      path: '/project/src/content/articles/my-post.md',
    })
    const target = makeFile({
      path: '/project/src/content/notes/idea.md',
      name: 'idea',
      frontmatter: { title: 'Great Idea' },
    })

    expect(buildContentLink(source, target)).toBe(
      '[Great Idea](../notes/idea.md)'
    )
  })

  it('uses URL pattern when provided', () => {
    const source = makeFile({
      path: '/project/src/content/articles/my-post.md',
    })
    const target = makeFile({
      path: '/project/src/content/articles/other.md',
      name: 'other',
      frontmatter: { title: 'Other Post', slug: 'other-slug' },
    })

    expect(buildContentLink(source, target, '/writing/{slug}')).toBe(
      '[Other Post](/writing/other-slug)'
    )
  })

  it('respects custom title field', () => {
    const source = makeFile({
      path: '/project/src/content/articles/my-post.md',
    })
    const target = makeFile({
      path: '/project/src/content/articles/other.md',
      name: 'other',
      frontmatter: { title: 'Default Title', headline: 'Custom Headline' },
    })

    expect(buildContentLink(source, target, undefined, 'headline')).toBe(
      '[Custom Headline](./other.md)'
    )
  })

  it('falls back to title when custom title field is missing', () => {
    const source = makeFile({
      path: '/project/src/content/articles/my-post.md',
    })
    const target = makeFile({
      path: '/project/src/content/articles/other.md',
      name: 'other',
      frontmatter: { title: 'Default Title' },
    })

    expect(buildContentLink(source, target, undefined, 'headline')).toBe(
      '[Default Title](./other.md)'
    )
  })

  it('falls back to filename when no title in frontmatter', () => {
    const source = makeFile({
      path: '/project/src/content/articles/my-post.md',
    })
    const target = makeFile({
      path: '/project/src/content/articles/other.md',
      name: 'other',
      frontmatter: null,
    })

    expect(buildContentLink(source, target)).toBe('[other](./other.md)')
  })

  it('escapes ] in title and ) in URL', () => {
    const source = makeFile({
      path: '/project/src/content/articles/my-post.md',
    })
    const target = makeFile({
      path: '/project/src/content/articles/other.md',
      name: 'other',
      frontmatter: { title: 'Title with ] bracket' },
    })

    expect(buildContentLink(source, target, '/path/with)paren/{slug}')).toBe(
      '[Title with \\] bracket](/path/with%29paren/test)'
    )
  })

  it('escapes backslashes in title before escaping ]', () => {
    const source = makeFile({
      path: '/project/src/content/articles/my-post.md',
    })
    const target = makeFile({
      path: '/project/src/content/articles/other.md',
      name: 'other',
      frontmatter: { title: 'Title with \\] tricky' },
    })

    expect(buildContentLink(source, target)).toBe(
      '[Title with \\\\\\] tricky](./other.md)'
    )
  })
})
