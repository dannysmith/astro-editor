import { describe, it, expect } from 'vitest'
import { frontmatterTree, type FrontmatterNode } from './frontmatter-tree'
import { FieldType, type CompleteSchema, type SchemaField } from './schema'

const field = (name: string): SchemaField => {
  const parentEnd = name.lastIndexOf('.')
  return {
    name,
    label: name,
    type: FieldType.String,
    required: false,
    ...(parentEnd === -1
      ? {}
      : { isNested: true, parentPath: name.slice(0, parentEnd) }),
  }
}

const schema = (...names: string[]): CompleteSchema => ({
  collectionName: 'posts',
  fields: names.map(field),
})

/** The tree as names, with a group as `[path, ...children]` */
const shape = (nodes: FrontmatterNode[]): unknown[] =>
  nodes.map(node =>
    node.kind === 'field' ? node.name : [node.path, ...shape(node.children)]
  )

describe('frontmatterTree', () => {
  it('lists a file without a schema in its own order', () => {
    expect(shape(frontmatterTree(null, ['zebra', 'apple'], 'title'))).toEqual([
      'zebra',
      'apple',
    ])
  })

  it('puts the title field first, then the schema order', () => {
    const tree = frontmatterTree(schema('date', 'title', 'tags'), [], 'title')

    expect(shape(tree)).toEqual(['title', 'date', 'tags'])
  })

  it('puts a nested object where the schema has it', () => {
    const tree = frontmatterTree(
      schema('title', 'seo.title', 'seo.image', 'draft'),
      [],
      'title'
    )

    expect(shape(tree)).toEqual([
      'title',
      ['seo', 'seo.title', 'seo.image'],
      'draft',
    ])
  })

  it('nests objects inside objects', () => {
    const tree = frontmatterTree(
      schema('seo.title', 'seo.og.image', 'seo.og.alt', 'seo.robots'),
      [],
      'title'
    )

    expect(shape(tree)).toEqual([
      [
        'seo',
        'seo.title',
        ['seo.og', 'seo.og.image', 'seo.og.alt'],
        'seo.robots',
      ],
    ])
  })

  it('creates a parent group even when it has no fields of its own', () => {
    const tree = frontmatterTree(schema('seo.og.image'), [], 'title')

    expect(shape(tree)).toEqual([['seo', ['seo.og', 'seo.og.image']]])
  })

  it('keeps same-named objects under different parents apart', () => {
    const tree = frontmatterTree(
      schema('hero.image.src', 'card.image.src'),
      [],
      'title'
    )

    expect(shape(tree)).toEqual([
      ['hero', ['hero.image', 'hero.image.src']],
      ['card', ['card.image', 'card.image.src']],
    ])
  })

  it('labels fields and groups by their last segment', () => {
    const [group] = frontmatterTree(schema('seo.ogImage'), [], 'title')

    expect(group).toMatchObject({
      heading: 'Seo',
      children: [{ label: 'Og Image' }],
    })
  })

  it('adds keys the schema lacks at the end, alphabetically', () => {
    const tree = frontmatterTree(
      schema('title', 'seo.title'),
      ['zebra', 'title', 'seo', 'apple'],
      'title'
    )

    expect(shape(tree)).toEqual([
      'title',
      ['seo', 'seo.title'],
      'apple',
      'zebra',
    ])
  })
})
