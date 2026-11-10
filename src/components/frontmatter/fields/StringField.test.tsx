import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { StringField } from './StringField'
import { useEditorStore } from '../../../store/editorStore'
import { renderWithProviders } from '../../../test/test-utils'

describe('StringField', () => {
  it('keeps the line breaks in a value that has them', () => {
    useEditorStore.setState({ frontmatter: { summary: 'First line\nSecond' } })
    renderWithProviders(<StringField name="summary" label="Summary" />)

    const box = screen.getByRole('textbox')
    expect(box.tagName).toBe('TEXTAREA')
    expect(box).toHaveValue('First line\nSecond')
  })

  it('is a one-line input otherwise', () => {
    useEditorStore.setState({ frontmatter: { summary: 'One line' } })
    renderWithProviders(<StringField name="summary" label="Summary" />)

    expect(screen.getByRole('textbox').tagName).toBe('INPUT')
  })
})
