import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { StatusBar } from './StatusBar'
import { useEditorStore } from '../../store/editorStore'

describe('StatusBar Component', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentFile: null,
      editorContent: '',
      isDirty: false,
    })
  })

  it('should render empty when no file is selected', () => {
    render(<StatusBar />)

    // Should not show file info or stats when no file
    expect(screen.queryByText(/words/)).not.toBeInTheDocument()
    expect(screen.queryByText(/characters/)).not.toBeInTheDocument()
  })

  it('should display file name and extension when file is selected', () => {
    useEditorStore.setState({
      currentFile: {
        id: 'test/example',
        path: '/test/example.md',
        name: 'example',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
      },
      editorContent: 'Hello world',
      isDirty: false,
    })

    render(<StatusBar />)

    expect(screen.getByText('example.md')).toBeInTheDocument()
  })

  it('should show dirty indicator when file has unsaved changes', async () => {
    useEditorStore.setState({
      currentFile: {
        id: 'test/example',
        path: '/test/example.md',
        name: 'example',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
      },
      editorContent: 'Hello world',
      isDirty: true,
    })

    render(<StatusBar />)

    // Wait for the polling interval to pick up isDirty state
    await waitFor(
      () => {
        expect(screen.getByText('•')).toBeInTheDocument()
      },
      { timeout: 600 }
    )
  })

  it('should display correct word and character counts', async () => {
    useEditorStore.setState({
      currentFile: {
        id: 'test/example',
        path: '/test/example.md',
        name: 'example',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
      },
      editorContent: 'Hello world this is a test',
      isDirty: false,
    })

    render(<StatusBar />)

    // Wait for polling interval to update word count (500ms interval)
    await waitFor(
      () => {
        expect(screen.getByText('6 words')).toBeInTheDocument()
        expect(screen.getByText('26 characters')).toBeInTheDocument()
      },
      { timeout: 600 }
    )
  })

  it('should handle empty content correctly', async () => {
    useEditorStore.setState({
      currentFile: {
        id: 'test/example',
        path: '/test/example.md',
        name: 'example',
        extension: 'md',
        isDraft: false,
        collection: 'posts',
      },
      editorContent: '',
      isDirty: false,
    })

    render(<StatusBar />)

    // Wait for polling interval to update counts
    await waitFor(
      () => {
        expect(screen.getByText('0 words')).toBeInTheDocument()
        expect(screen.getByText('0 characters')).toBeInTheDocument()
      },
      { timeout: 600 }
    )
  })
})
