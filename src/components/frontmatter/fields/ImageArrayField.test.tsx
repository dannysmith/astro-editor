import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { ImageArrayField } from './ImageArrayField'
import { useEditorStore } from '../../../store/editorStore'
import { renderWithProviders } from '../../../test/test-utils'

const gallery = () => useEditorStore.getState().frontmatter.gallery

describe('ImageArrayField', () => {
  beforeEach(() => {
    useEditorStore.setState({
      frontmatter: { gallery: ['a.png', 'b.png', 'c.png'] },
    })
    renderWithProviders(<ImageArrayField name="gallery" label="Gallery" />)
  })

  it('shows a picker for each image, then one to add another', () => {
    expect(screen.getAllByTitle('Clear image')).toHaveLength(3)
    expect(screen.getByText('Add Image')).toBeInTheDocument()
  })

  it('removes an image when it is cleared', () => {
    fireEvent.click(screen.getAllByTitle('Clear image')[1]!)

    expect(gallery()).toEqual(['a.png', 'c.png'])
  })

  it('removes the field when the last image is cleared', () => {
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getAllByTitle('Clear image')[0]!)
    }

    expect(gallery()).toBeUndefined()
  })

  it('replaces an image whose path is edited', () => {
    fireEvent.click(screen.getAllByTitle('Edit path manually')[2]!)
    const input = screen.getByDisplayValue('c.png')
    fireEvent.change(input, { target: { value: 'd.png' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(gallery()).toEqual(['a.png', 'b.png', 'd.png'])
  })
})
