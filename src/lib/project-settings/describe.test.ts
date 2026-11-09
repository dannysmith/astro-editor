import { describe, expect, it } from 'vitest'
import type { FileEntry } from '@/lib/bindings'
import { FieldType, type SchemaField } from '../schema'
import { getSortOptionsForCollection } from '../files/sorting'
import {
  defaultSortChoices,
  describeConstraints,
  describeFieldType,
  frontmatterKeysOfType,
} from './describe'

const field = (overrides: Partial<SchemaField>): SchemaField => ({
  name: 'field',
  label: 'Field',
  type: FieldType.String,
  required: false,
  ...overrides,
})

describe('describeFieldType', () => {
  it('names references and what arrays hold', () => {
    expect(
      describeFieldType(
        field({ type: FieldType.Reference, reference: 'authors' })
      )
    ).toBe('reference to authors')
    expect(
      describeFieldType(field({ type: FieldType.Array, subReference: 'posts' }))
    ).toBe('array of references to posts')
    expect(
      describeFieldType(
        field({ type: FieldType.Array, subType: FieldType.Date })
      )
    ).toBe('array of date')
    expect(
      describeFieldType(field({ type: FieldType.Enum, enumValues: ['a', 'b'] }))
    ).toBe('one of `a`, `b`')
  })
})

describe('describeConstraints', () => {
  it('joins inclusive bounds into a range, and keeps exclusive ones apart', () => {
    expect(
      describeConstraints(field({ constraints: { min: 1, max: 5 } }))
    ).toEqual(['1–5'])
    expect(
      describeConstraints(
        field({ constraints: { min: 0, minExclusive: true, max: 5 } })
      )
    ).toEqual(['> 0', '≤ 5'])
  })

  it('describes lengths, item counts, patterns and defaults', () => {
    expect(
      describeConstraints(
        field({
          constraints: { minLength: 3, maxLength: 100, maxItems: 2 },
          default: 'draft',
        })
      )
    ).toEqual(['3–100 characters', 'at most 2 items', 'defaults to `"draft"`'])
  })
})

describe('defaultSortChoices', () => {
  it('offers each sort mode both ways round, worded for its kind', () => {
    const choices = defaultSortChoices(getSortOptionsForCollection(null))
    expect(choices.map(c => c.label)).toEqual([
      'Title, A to Z',
      'Title, Z to A',
      'Filename, A to Z',
      'Filename, Z to A',
      'Last Modified, oldest first',
      'Last Modified, newest first',
    ])
    expect(choices[1]?.sort).toEqual({ mode: 'title', direction: 'desc' })
  })
})

describe('frontmatterKeysOfType', () => {
  const file = (frontmatter: FileEntry['frontmatter']): FileEntry => ({
    id: 'id',
    path: 'path.md',
    name: 'path',
    extension: 'md',
    collection: 'notes',
    last_modified: null,
    frontmatter,
    is_entry: true,
  })
  const files = [
    file({ heading: 'One', posted: '2024-01-01', hidden: true }),
    file({ heading: 'Two', subtitle: 'More', posted: '2024-02-01' }),
  ]

  it('finds keys by the kind of value they hold, most common first', () => {
    expect(frontmatterKeysOfType(files, FieldType.String)).toEqual([
      'heading',
      'subtitle',
    ])
    expect(frontmatterKeysOfType(files, FieldType.Date)).toEqual(['posted'])
    expect(frontmatterKeysOfType(files, FieldType.Boolean)).toEqual(['hidden'])
  })
})
