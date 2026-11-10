import { describe, it, expect } from 'vitest'
import { isBackToBaseline } from './frontmatter-baseline'
import { FieldType, type SchemaField } from '../schema'

const field = (
  name: string,
  type: FieldType,
  extra: Partial<SchemaField> = {}
): SchemaField => ({ name, label: name, type, required: false, ...extra })

const baseline = (values: Record<string, unknown>) => ({ values, raw: '' })

describe('isBackToBaseline', () => {
  const loaded = {
    title: 'Hello',
    tags: ['a', 'b'],
    seo: { title: 'SEO', keywords: ['x'] },
  }

  it('matches the same values, whatever the key order', () => {
    const reordered = {
      seo: { keywords: ['x'], title: 'SEO' },
      tags: ['a', 'b'],
      title: 'Hello',
    }
    expect(isBackToBaseline(reordered, baseline(loaded), [])).toBe(true)
  })

  it('treats a changed, added or removed value as a change', () => {
    const check = (values: Record<string, unknown>) =>
      isBackToBaseline(values, baseline(loaded), [])

    expect(check({ ...loaded, title: 'Hello!' })).toBe(false)
    expect(check({ ...loaded, tags: ['b', 'a'] })).toBe(false)
    expect(check({ ...loaded, seo: { title: 'SEO' } })).toBe(false)
    expect(check({ ...loaded, extra: 'new' })).toBe(false)
    expect(check({ title: loaded.title, seo: loaded.seo })).toBe(false)
  })

  it('tells numbers from text that looks like them', () => {
    expect(isBackToBaseline({ order: '1' }, baseline({ order: 1 }), [])).toBe(
      false
    )
  })

  describe('a switch the file never set', () => {
    const fields = [
      field('draft', FieldType.Boolean),
      field('featured', FieldType.Boolean, { default: 'true' }),
      field('seo.noindex', FieldType.Boolean),
      field('subtitle', FieldType.String),
    ]
    const check = (values: Record<string, unknown>) =>
      isBackToBaseline(values, baseline({ title: 'Hello' }), fields)

    it('is unchanged when turned back to its default', () => {
      expect(check({ title: 'Hello', draft: false })).toBe(true)
      expect(check({ title: 'Hello', featured: true })).toBe(true)
      expect(check({ title: 'Hello', seo: { noindex: false } })).toBe(true)
    })

    it('is a change when it differs from its default', () => {
      expect(check({ title: 'Hello', draft: true })).toBe(false)
      expect(check({ title: 'Hello', featured: false })).toBe(false)
      expect(check({ title: 'Hello', seo: { noindex: true } })).toBe(false)
    })

    it("doesn't cover other fields or empty objects", () => {
      expect(check({ title: 'Hello', subtitle: false })).toBe(false)
      expect(check({ title: 'Hello', unknown: false })).toBe(false)
      expect(check({ title: 'Hello', seo: {} })).toBe(false)
    })
  })
})
