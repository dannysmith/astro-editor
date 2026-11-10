import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import type { FileEntry } from '@/lib/bindings'
import { useContentLinkerStore } from '../../store/contentLinkerStore'
import { useProjectStore } from '../../store/projectStore'
import { makeCollection, makeScan } from '../../test/fixtures'
import { renderWithProviders } from '../../test/test-utils'
import { ContentLinkerDialog } from './ContentLinkerDialog'

const notes = makeCollection({ name: 'notes' })
notes.settings.titleField = { value: 'name', source: 'set' }

const note: FileEntry = {
  id: 'on-walking',
  name: 'on-walking',
  path: `${notes.path}/on-walking.md`,
  extension: 'md',
  collection: 'notes',
  last_modified: null,
  frontmatter: { name: 'On walking' },
  is_entry: true,
}

// cmdk measures its list and scrolls to the selected item, which jsdom can't
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView = () => {}

describe('ContentLinkerDialog', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'scan_project') return Promise.resolve(makeScan([notes]))
      if (cmd === 'scan_collection_files_recursive')
        return Promise.resolve([note])
      return Promise.resolve(null)
    })
    useProjectStore.setState({ projectPath: '/site' })
    useContentLinkerStore.setState({ isOpen: true })
  })

  it("lists files by their collection's title field", async () => {
    renderWithProviders(<ContentLinkerDialog />)

    expect(await screen.findByText('On walking')).toBeInTheDocument()
  })
})
