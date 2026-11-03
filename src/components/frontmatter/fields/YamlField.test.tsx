import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { YamlField } from './YamlField'
import { useEditorStore } from '../../../store/editorStore'
import { renderWithProviders } from '../../../test/test-utils'

const stored = () => useEditorStore.getState().frontmatter.embed

describe('YamlField', () => {
  beforeEach(() => {
    useEditorStore.setState({ frontmatter: { embed: { kind: 'video' } } })
    renderWithProviders(<YamlField name="embed" label="Embed" />)
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
})
