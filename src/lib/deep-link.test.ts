import { describe, it, expect } from 'vitest'
import { parseDeepLinkPath, findOwningProjectPath } from './deep-link'

describe('parseDeepLinkPath', () => {
  it('extracts and decodes the path from a valid open URL', () => {
    const url =
      'astro-editor://open?path=/Users/danny/dev/blog/src/content/blog/post.md'
    expect(parseDeepLinkPath(url)).toBe(
      '/Users/danny/dev/blog/src/content/blog/post.md'
    )
  })

  it('decodes percent-encoded paths (spaces and special chars)', () => {
    const url =
      'astro-editor://open?path=%2FUsers%2Fdanny%2Fmy%20blog%2Fa%20post.md'
    expect(parseDeepLinkPath(url)).toBe('/Users/danny/my blog/a post.md')
  })

  it('returns null for a different scheme', () => {
    expect(parseDeepLinkPath('other-app://open?path=/x.md')).toBeNull()
  })

  it('returns null for an unknown action/host', () => {
    expect(parseDeepLinkPath('astro-editor://close?path=/x.md')).toBeNull()
  })

  it('returns null when path is missing or empty', () => {
    expect(parseDeepLinkPath('astro-editor://open')).toBeNull()
    expect(parseDeepLinkPath('astro-editor://open?path=')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(parseDeepLinkPath('not a url')).toBeNull()
  })
})

describe('findOwningProjectPath', () => {
  const projects = ['/Users/danny/dev/blog', '/Users/danny/dev/docs-site']

  it('finds the project that owns the file', () => {
    expect(
      findOwningProjectPath(
        projects,
        '/Users/danny/dev/blog/src/content/blog/post.md'
      )
    ).toBe('/Users/danny/dev/blog')
  })

  it('returns null when no known project owns the file', () => {
    expect(
      findOwningProjectPath(projects, '/Users/danny/other/file.md')
    ).toBeNull()
  })

  it('does not match on a partial path-segment prefix', () => {
    // /Users/danny/dev/blog-archive should not match /Users/danny/dev/blog
    expect(
      findOwningProjectPath(
        projects,
        '/Users/danny/dev/blog-archive/src/content/x.md'
      )
    ).toBeNull()
  })

  it('prefers the most specific (longest) matching project', () => {
    const nested = ['/Users/danny/dev', '/Users/danny/dev/blog']
    expect(
      findOwningProjectPath(nested, '/Users/danny/dev/blog/src/content/x.md')
    ).toBe('/Users/danny/dev/blog')
  })

  it('tolerates trailing slashes on the project path', () => {
    expect(
      findOwningProjectPath(
        ['/Users/danny/dev/blog/'],
        '/Users/danny/dev/blog/src/content/x.md'
      )
    ).toBe('/Users/danny/dev/blog/')
  })

  it('matches case-insensitively and across separators', () => {
    expect(
      findOwningProjectPath(
        ['C:\\Users\\Danny\\Blog'],
        'c:/users/danny/blog/src/content/x.md'
      )
    ).toBe('C:\\Users\\Danny\\Blog')
  })
})
