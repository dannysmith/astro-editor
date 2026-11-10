import { describe, it, expect } from 'vitest'
import { act, screen } from '@testing-library/react'
import type { FileEntry } from '@/types'
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

  it('stays a textarea when its last line break is deleted, until another file opens', () => {
    const file = (path: string) => ({ path }) as FileEntry
    useEditorStore.setState({
      currentFile: file('/site/a.md'),
      frontmatter: { summary: 'First line\nSecond' },
    })
    renderWithProviders(<StringField name="summary" label="Summary" />)

    act(() => useEditorStore.setState({ frontmatter: { summary: 'First' } }))
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')

    act(() =>
      useEditorStore.setState({
        currentFile: file('/site/b.md'),
        frontmatter: { summary: 'One line' },
      })
    )
    expect(screen.getByRole('textbox').tagName).toBe('INPUT')
  })

  it('is a one-line input otherwise', () => {
    useEditorStore.setState({ frontmatter: { summary: 'One line' } })
    renderWithProviders(<StringField name="summary" label="Summary" />)

    expect(screen.getByRole('textbox').tagName).toBe('INPUT')
  })
})
