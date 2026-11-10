import { describe, it, expect } from 'vitest'
import { newFileFrontmatter } from './new-file'
import { FieldType, type SchemaField } from '../schema'
import type { FieldMappings } from './sorting'

const field = (
  name: string,
  type: FieldType,
  required: boolean,
  extra: Partial<SchemaField> = {}
): SchemaField => ({ name, label: name, type, required, ...extra })

const mappings = { title: 'title', publishedDate: 'pubDate' }
const TODAY = '2026-11-10'
const build = (
  fields: SchemaField[],
  fieldMappings: Pick<FieldMappings, 'title' | 'publishedDate'> = mappings
) => newFileFrontmatter(fields, fieldMappings, 'New Note', TODAY)

describe('newFileFrontmatter', () => {
  it('writes the title and today for the published date, required or not', () => {
    expect(
      build([
        field('title', FieldType.String, true),
        field('pubDate', FieldType.Date, false),
      ])
    ).toEqual({ title: 'New Note', pubDate: TODAY })
  })

  it('follows the collection’s title and published date fields', () => {
    const fields = [
      field('name', FieldType.String, true),
      field('created', FieldType.Date, true),
      field('updated', FieldType.Date, false),
    ]
    expect(
      build(fields, { title: 'name', publishedDate: ['created', 'updated'] })
    ).toEqual({ name: 'New Note', created: TODAY, updated: TODAY })
  })

  it('fills required switches, dates and lists with values that are always valid', () => {
    expect(
      build([
        field('featured', FieldType.Boolean, true),
        field('deadline', FieldType.Date, true),
        field('tags', FieldType.Array, true),
      ])
    ).toEqual({ featured: false, deadline: TODAY, tags: [] })
  })

  it('leaves out required fields that have no valid empty value', () => {
    expect(
      build([
        field('description', FieldType.String, true),
        field('order', FieldType.Number, true),
        field('status', FieldType.Enum, true, { enumValues: ['a', 'b'] }),
        field('email', FieldType.Email, true),
        field('website', FieldType.URL, true),
        field('cover', FieldType.Image, true),
        field('author', FieldType.Reference, true),
        field('extra', FieldType.Object, true),
        field('related', FieldType.Array, true, {
          constraints: { minItems: 1 },
        }),
      ])
    ).toEqual({})
  })

  it('leaves out optional fields', () => {
    expect(
      build([
        field('draft', FieldType.Boolean, false, { default: false }),
        field('updatedDate', FieldType.Date, false),
        field('tags', FieldType.Array, false),
      ])
    ).toEqual({})
  })

  it('leaves out fields inside objects, which may themselves be optional', () => {
    expect(
      build([
        field('sponsor.name', FieldType.String, true),
        field('metadata.flagged', FieldType.Boolean, true),
        field('metadata.deadline', FieldType.Date, true),
      ])
    ).toEqual({})
  })

  it('nests a title or published date that lives in an object', () => {
    expect(
      build(
        [
          field('meta.title', FieldType.String, true),
          field('meta.date', FieldType.Date, true),
        ],
        { title: 'meta.title', publishedDate: 'meta.date' }
      )
    ).toEqual({ meta: { title: 'New Note', date: TODAY } })
  })
})
