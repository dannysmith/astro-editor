import { describe, it, expect } from 'vitest'
import { canImportImages, fieldMappings } from './project-scan'
import { makeCollection } from '../test/fixtures'

describe('fieldMappings', () => {
  it("uses the collection's resolved fields", () => {
    const collection = makeCollection({ name: 'blog' })
    collection.settings.draftField = { value: 'unpublished', source: 'set' }
    collection.settings.publishedDateField = {
      value: ['date'],
      source: 'schema',
    }
    expect(fieldMappings(collection)).toEqual({
      publishedDate: ['date'],
      title: 'title',
      description: 'description',
      draft: 'unpublished',
    })
  })

  it('gives a missing field an empty name, which no frontmatter key matches', () => {
    const collection = makeCollection({ name: 'blog' })
    collection.settings.draftField = { value: null, source: 'missing' }
    expect(fieldMappings(collection).draft).toBe('')
  })
})

describe('canImportImages', () => {
  it('imports images unless they go in public/', () => {
    const collection = makeCollection({ name: 'blog' })
    expect(canImportImages(true, collection)).toBe(true)
    expect(canImportImages(false, collection)).toBe(false)

    collection.settings.assetsDirectory = {
      value: 'public/images',
      source: 'set',
    }
    expect(canImportImages(true, collection)).toBe(false)
  })
})
