import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RenameInput } from './RenameInput'

function renderInput() {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  render(
    <RenameInput
      fileName="my-post.mdx"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  )
  return {
    input: screen.getByRole<HTMLInputElement>('textbox'),
    onSubmit,
    onCancel,
  }
}

describe('RenameInput', () => {
  it('starts with the name selected, up to the extension', async () => {
    const { input } = renderInput()

    await waitFor(() => expect(input.selectionEnd).toBe('my-post'.length))
    expect(input.selectionStart).toBe(0)
    expect(input).toHaveValue('my-post.mdx')
  })

  it('submits the typed name on Enter', () => {
    const { input, onSubmit } = renderInput()

    fireEvent.change(input, { target: { value: 'renamed.mdx' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledWith('renamed.mdx')
  })

  it('cancels on Escape', () => {
    const { input, onSubmit, onCancel } = renderInput()

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
