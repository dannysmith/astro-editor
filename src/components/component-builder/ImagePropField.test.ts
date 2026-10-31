import { describe, it, expect } from 'vitest'
import type { ProjectSettings } from '../../lib/project-registry/types'
import { canPickImages } from './ImagePropField'

function settings(overrides: Partial<ProjectSettings>): ProjectSettings {
  return {
    pathOverrides: {},
    frontmatterMappings: {},
    addComponentImports: true,
    ...overrides,
  }
}

describe('canPickImages', () => {
  it('picks images when the project adds imports and they go under src/', () => {
    expect(canPickImages(settings({}), 'notes')).toBe(true)
    expect(
      canPickImages(
        settings({ pathOverrides: { assetsDirectory: './src/images/' } }),
        'notes'
      )
    ).toBe(true)
  })

  it('takes typed names otherwise', () => {
    expect(
      canPickImages(settings({ addComponentImports: false }), 'notes')
    ).toBe(false)
    expect(
      canPickImages(
        settings({ pathOverrides: { assetsDirectory: 'public/images' } }),
        'notes'
      )
    ).toBe(false)
    // A collection that keeps its images in public/
    expect(
      canPickImages(
        settings({
          collections: [
            {
              name: 'notes',
              settings: { pathOverrides: { assetsDirectory: 'public/notes' } },
            },
          ],
        }),
        'notes'
      )
    ).toBe(false)
    expect(canPickImages(settings({}), undefined)).toBe(false)
  })
})
