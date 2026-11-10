import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { JsonField } from './JsonField'
import { useEditorStore } from '../../../store/editorStore'
import { renderWithProviders } from '../../../test/test-utils'
import type { FileEntry } from '@/types'

const stored = () => useEditorStore.getState().frontmatter.embed

const file: FileEntry = {
  id: 'notes/first',
  name: 'first',
  path: '/project/src/content/notes/first.md',
  extension: 'md',
  collection: 'notes',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
}

describe('JsonField', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentFile: file,
      frontmatter: { embed: { kind: 'video' } },
    })
    renderWithProviders(<JsonField name="embed" label="Embed" />)
  })

  it('keeps invalid JSON in the box while the store keeps the last valid value', () => {
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: '{ "kind": "vid' } })

    expect(box).toHaveValue('{ "kind": "vid')
    expect(stored()).toEqual({ kind: 'video' })
    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument()
  })

  it('writes the value once the JSON parses, without reformatting the text', () => {
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: '{"kind":"quote"}' } })

    expect(stored()).toEqual({ kind: 'quote' })
    expect(box).toHaveValue('{"kind":"quote"}')
  })

  it('keeps the text when it parses to an empty value, which removes the key', () => {
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: '[]' } })

    expect(stored()).toBeUndefined()
    expect(box).toHaveValue('[]')
  })

  it('shows a value changed outside the field', () => {
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '{ "kind": "vid' },
    })
    act(() => {
      useEditorStore.setState({ frontmatter: { embed: { kind: 'image' } } })
    })

    expect(screen.getByRole('textbox')).toHaveValue(
      JSON.stringify({ kind: 'image' }, null, 2)
    )
  })

  it('drops an unfinished draft when another file opens', () => {
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: '{ "kind": "vid' } })
    // Another file with the same value: the stored value doesn't change
    act(() => {
      useEditorStore.setState({
        currentFile: { ...file, id: 'notes/other' },
        frontmatter: { embed: { kind: 'video' } },
      })
    })

    expect(box).toHaveValue(JSON.stringify({ kind: 'video' }, null, 2))
  })
})
