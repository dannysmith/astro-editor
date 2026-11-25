import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput, type Tag } from './tag-input'
import type { TagSuggestion } from '@/lib/tag-suggestions'

const SUGGESTIONS: TagSuggestion[] = [
  { value: 'JavaScript', count: 5 },
  { value: 'Astro', count: 3 },
  { value: 'TypeScript', count: 2 },
]

/** A tag input that keeps its tags, listing them for assertions */
function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState<Tag[]>(
    initial.map(text => ({ id: text, text }))
  )
  return (
    <>
      <TagInput tags={tags} onTagsChange={setTags} suggestions={SUGGESTIONS} />
      <output>{tags.map(tag => tag.text).join(',')}</output>
    </>
  )
}

function setup(initial?: string[]) {
  const user = userEvent.setup()
  render(<Harness initial={initial} />)
  return { user, input: screen.getByRole('combobox') }
}

const added = () => screen.getByRole('status').textContent
const options = () =>
  screen.queryAllByRole('option').map(option => option.textContent)

describe('TagInput suggestions', () => {
  it('lists suggestions matching what is typed, ignoring case', async () => {
    const { user, input } = setup()
    await user.type(input, 'script')
    expect(options()).toEqual(['JavaScript5', 'TypeScript2'])
  })

  it('leaves out tags already added', async () => {
    const { user, input } = setup(['Astro'])
    await user.type(input, 'a')
    expect(options()).toEqual(['JavaScript5'])
  })

  it('lists the most used on ↓ in an empty input', async () => {
    const { user, input } = setup()
    await user.click(input)
    expect(options()).toEqual([])
    await user.keyboard('{ArrowDown}')
    expect(options()).toEqual(['JavaScript5', 'Astro3', 'TypeScript2'])
  })

  it('adds a clicked suggestion', async () => {
    const { user, input } = setup()
    await user.type(input, 'ast')
    await user.click(screen.getByRole('option', { name: /Astro/ }))
    expect(added()).toBe('Astro')
    expect(input).toHaveValue('')
  })

  it('adds the highlighted suggestion on Enter', async () => {
    const { user, input } = setup()
    await user.type(input, 'script{ArrowDown}{ArrowDown}{Enter}')
    expect(added()).toBe('TypeScript')
  })

  it('adds what was typed on Enter when nothing is highlighted', async () => {
    const { user, input } = setup()
    await user.type(input, 'java{Enter}')
    expect(added()).toBe('java')
  })

  it("adds the collection's spelling of a tag typed in another case", async () => {
    const { user, input } = setup()
    await user.type(input, 'javascript{Enter}')
    expect(added()).toBe('JavaScript')
  })

  it('closes the list on Escape, then clears the input', async () => {
    const { user, input } = setup()
    await user.type(input, 'ast')
    await user.keyboard('{Escape}')
    expect(options()).toEqual([])
    expect(input).toHaveValue('ast')
    await user.keyboard('{Escape}')
    expect(input).toHaveValue('')
  })

  it('removes the last tag on Backspace in an empty input', async () => {
    const { user, input } = setup(['Astro', 'CSS'])
    await user.type(input, '{Backspace}')
    expect(added()).toBe('Astro')
  })
})
