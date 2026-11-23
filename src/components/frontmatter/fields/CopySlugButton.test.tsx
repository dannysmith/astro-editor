import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CopySlugButton } from './CopySlugButton'

describe('CopySlugButton', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockResolvedValue(null)
  })

  it('copies the title as a slug and says so', async () => {
    render(<CopySlugButton text="Getting Started" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy as slug' }))

    await waitFor(() => expect(screen.getByTitle('Copied')).toBeInTheDocument())
    const [command, args] = globalThis.mockTauri.invoke.mock.calls[0]!
    expect(command).toBe('copy_text_to_clipboard')
    expect(args).toMatchObject({ text: 'getting-started' })
  })

  it('renders nothing when the slug would be empty', () => {
    const { container } = render(<CopySlugButton text="!!!" />)

    expect(container).toBeEmptyDOMElement()
  })
})
