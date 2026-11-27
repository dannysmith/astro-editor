import { describe, it, expect } from 'vitest'
import { parseDeepLink, findOwningProjectPath } from './deep-link'

describe('parseDeepLink', () => {
  it('extracts and decodes the path from a valid open URL', () => {
    const url =
      'astro-editor://open?path=/Users/danny/dev/blog/src/content/blog/post.md'
    expect(parseDeepLink(url)).toEqual({
      action: 'open',
      path: '/Users/danny/dev/blog/src/content/blog/post.md',
    })
  })

  it('decodes percent-encoded paths (spaces and special chars)', () => {
    const url =
      'astro-editor://open?path=%2FUsers%2Fdanny%2Fmy%20blog%2Fa%20post.md'
    expect(parseDeepLink(url)).toEqual({
      action: 'open',
      path: '/Users/danny/my blog/a post.md',
    })
  })

  it('returns null for a different scheme', () => {
    expect(parseDeepLink('other-app://open?path=/x.md')).toBeNull()
  })

  it('returns null for an unknown action/host', () => {
    expect(parseDeepLink('astro-editor://close?path=/x.md')).toBeNull()
  })

  it('returns null when path is missing or empty', () => {
    expect(parseDeepLink('astro-editor://open')).toBeNull()
    expect(parseDeepLink('astro-editor://open?path=')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(parseDeepLink('not a url')).toBeNull()
  })

  it('reads a new link, ignoring parameters it doesn’t know', () => {
    const url =
      'astro-editor://new?project=%2FUsers%2Fme%2Fmy%20site&collection=notes&folder=%2F2024%2Fjan%2F&title=A%20%26%20B&body=%20%20indented%0A&tags=x'
    expect(parseDeepLink(url)).toEqual({
      action: 'new',
      project: '/Users/me/my site',
      collection: 'notes',
      folder: '2024/jan',
      title: 'A & B',
      body: '  indented\n',
    })
  })

  it('leaves out optional parameters that are missing or empty', () => {
    expect(
      parseDeepLink(
        'astro-editor://new?project=/site&collection=notes&folder=/&title='
      )
    ).toEqual({
      action: 'new',
      project: '/site',
      collection: 'notes',
      folder: undefined,
      title: undefined,
      body: undefined,
    })
  })

  it('needs a project and a collection for a new link', () => {
    expect(parseDeepLink('astro-editor://new?collection=notes')).toBeNull()
    expect(parseDeepLink('astro-editor://new?project=/site')).toBeNull()
  })

  it('refuses a folder outside the collection', () => {
    for (const folder of ['..', 'a/../../b', './a', 'a//b', 'a\\..\\b']) {
      const url = `astro-editor://new?project=/site&collection=notes&folder=${encodeURIComponent(folder)}`
      expect(parseDeepLink(url)).toBeNull()
    }
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
