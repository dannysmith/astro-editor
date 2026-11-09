import { describe, expect, it } from 'vitest'
import { makeCollection, makeScan } from '@/test/fixtures'
import {
  collectionProblems,
  hasProblems,
  projectProblems,
  statusLevel,
} from './status'

const levels = (problems: { level: string }[]) => problems.map(p => p.level)

describe('collectionProblems', () => {
  it('finds nothing wrong with a collection AE can read', () => {
    const blog = makeCollection({ name: 'blog', schemaStatus: 'complete' })
    expect(collectionProblems(blog, '/site')).toEqual([])
  })

  it('treats a collection without a schema as fine', () => {
    expect(
      collectionProblems(makeCollection({ name: 'blog' }), '/site')
    ).toEqual([])
  })

  it('makes a missing or outside folder an error, with the folder relative to the project', () => {
    const missing = collectionProblems(
      makeCollection({ name: 'blog', folderStatus: 'missing' }),
      '/site'
    )
    expect(levels(missing)).toEqual(['error'])
    expect(missing[0]?.message).toContain('`src/content/blog`')

    const outside = makeCollection({
      name: 'blog',
      folderStatus: 'outsideProject',
    })
    expect(levels(collectionProblems(outside, '/site'))).toEqual(['error'])
  })

  it('only reports an unknown loader when its folder is missing', () => {
    const guessed = makeCollection({
      name: 'blog',
      kind: 'unknown',
      folderSource: 'convention',
    })
    expect(collectionProblems(guessed, '/site')).toEqual([])
    expect(
      levels(
        collectionProblems({ ...guessed, folderStatus: 'missing' }, '/site')
      )
    ).toEqual(['error'])
  })

  it('reports schema and pattern problems with the error AE got', () => {
    const problems = collectionProblems(
      makeCollection({
        name: 'blog',
        schemaStatus: 'unreadable',
        schemaError: 'expected a string',
        patternError: 'unclosed group',
      }),
      '/site'
    )
    expect(levels(problems)).toEqual(['warning', 'error'])
    expect(problems.map(p => p.detail)).toEqual([
      'unclosed group',
      'expected a string',
    ])
    expect(statusLevel(problems)).toBe('error')
  })

  it('warns when there’s no generated schema', () => {
    const blog = makeCollection({ name: 'blog', schemaStatus: 'notGenerated' })
    const problems = collectionProblems(blog, '/site')
    expect(statusLevel(problems)).toBe('warning')
    expect(problems[0]?.fix).toContain('astro sync')
  })

  it('ignores data collections', () => {
    const authors = makeCollection({
      name: 'authors',
      kind: 'data',
      folderStatus: 'missing',
    })
    expect(collectionProblems(authors, '/site')).toEqual([])
  })
})

describe('projectProblems', () => {
  const blog = makeCollection({ name: 'blog', kind: 'folder' })

  it('says why AE is using the folder fallback', () => {
    const noConfig = { ...makeScan([blog]), configPath: null, fallback: true }
    expect(projectProblems(noConfig)[0]?.message).toMatch(
      /^There's no content config/
    )

    const broken = {
      ...makeScan([blog]),
      fallback: true,
      configError: 'Unexpected token',
    }
    const [problem] = projectProblems(broken)
    expect(problem?.message).toMatch(/couldn't be read/)
    expect(problem?.detail).toBe('Unexpected token')

    const unreadable = { ...makeScan([blog]), fallback: true }
    expect(projectProblems(unreadable)[0]?.message).toMatch(
      /^None of the collections/
    )
  })

  it('warns when there are no collections to edit', () => {
    const authors = makeCollection({ name: 'authors', kind: 'data' })
    expect(levels(projectProblems(makeScan([authors])))).toEqual(['warning'])
  })

  it('finds nothing wrong with a readable config', () => {
    expect(
      projectProblems(makeScan([makeCollection({ name: 'blog' })]))
    ).toEqual([])
  })
})

describe('hasProblems', () => {
  it('looks at the project and every collection', () => {
    const fine = makeCollection({ name: 'blog' })
    const missing = makeCollection({ name: 'docs', folderStatus: 'missing' })
    expect(hasProblems(makeScan([fine]), '/site')).toBe(false)
    expect(hasProblems(makeScan([fine, missing]), '/site')).toBe(true)
  })
})
