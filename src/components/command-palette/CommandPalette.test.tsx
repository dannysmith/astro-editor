import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommandPalette, filterByLabel } from './CommandPalette'

// Mock the useCommandPalette hook
vi.mock('../../hooks/useCommandPalette', () => ({
  useCommandPalette: vi.fn(() => ({
    open: false,
    setOpen: vi.fn(),
    commandGroups: [
      {
        heading: 'File',
        commands: [
          {
            id: 'new-file',
            label: 'New File',
            description: 'Create a new file',
            execute: vi.fn(),
          },
        ],
      },
      {
        heading: 'Navigation',
        commands: [
          {
            id: 'toggle-sidebar',
            label: 'Toggle Sidebar',
            description: 'Show or hide the sidebar',
            execute: vi.fn(),
          },
        ],
      },
    ],
    executeCommand: vi.fn(),
  })),
}))

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the command palette component', () => {
    render(<CommandPalette />)

    // The component should render without crashing
    expect(document.body).toBeInTheDocument()
  })

  it('renders with closed state by default', () => {
    render(<CommandPalette />)

    // Since the dialog is closed by default, it should not be visible
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('filterByLabel', () => {
  const value = 'open-collection-blog:Open Collection: blog'

  it('matches text after a colon in the label', () => {
    expect(filterByLabel(value, 'blog')).toBe(1)
    expect(filterByLabel(value, 'collection: b')).toBe(1)
  })

  it("doesn't match the command id", () => {
    expect(filterByLabel(value, 'open-collection')).toBe(0)
  })
})
