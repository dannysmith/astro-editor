import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import { createPageApi } from './page'

// jsdom has no font loading, Web Animations or scrolling
beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve() },
    configurable: true,
  })
  document.getAnimations = () => []
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  document.body.innerHTML = ''
})

const api = () => createPageApi({ getTheme: () => 'light', setTheme: vi.fn() })

describe('click', () => {
  it('sends the event sequence of a real click and focuses the target', async () => {
    document.body.innerHTML = '<button id="save">Save</button>'
    const button = document.getElementById('save')!
    const events: string[] = []
    for (const type of [
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]) {
      button.addEventListener(type, () => events.push(type))
    }

    const description = await api().click({ selector: '#save' })

    expect(events).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ])
    expect(document.activeElement).toBe(button)
    expect(description).toBe('button "Save"')
  })

  it('skips the mouse events when pointerdown is cancelled, as browsers do', async () => {
    document.body.innerHTML = '<button id="menu">Menu</button>'
    const button = document.getElementById('menu')!
    const events: string[] = []
    button.addEventListener('pointerdown', e => e.preventDefault())
    for (const type of ['mousedown', 'mouseup', 'click']) {
      button.addEventListener(type, () => events.push(type))
    }

    await api().click({ selector: '#menu' })

    expect(events).toEqual(['click'])
  })

  it('throws when nothing matches', async () => {
    await expect(api().click({ selector: '#missing' })).rejects.toThrow(
      'Nothing matches'
    )
  })
})

describe('fill', () => {
  function ControlledInput() {
    const [value, setValue] = useState('')
    return (
      <>
        <input
          aria-label="Title"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <output>{value}</output>
      </>
    )
  }

  it('updates a React-controlled input', async () => {
    render(<ControlledInput />)

    await api().fill({ selector: 'input' }, 'Hello')

    expect(screen.getByRole('status')).toHaveTextContent('Hello')
    expect(screen.getByLabelText('Title')).toHaveValue('Hello')
  })

  it('rejects elements that are not inputs', async () => {
    document.body.innerHTML = '<button>Save</button>'
    await expect(api().fill({ selector: 'button' }, 'x')).rejects.toThrow(
      "isn't an input or textarea"
    )
  })
})

describe('key', () => {
  it('sends keydown and keyup to the focused element and reports handling', async () => {
    document.body.innerHTML = '<input aria-label="Search">'
    const input = document.querySelector('input')!
    input.focus()
    const seen: string[] = []
    input.addEventListener('keydown', e => {
      seen.push(`${e.type} ${e.key} meta=${e.metaKey}`)
      e.preventDefault()
    })
    input.addEventListener('keyup', e => seen.push(e.type))

    const result = await api().key('cmd+k')

    expect(seen).toEqual(['keydown k meta=true', 'keyup'])
    expect(result).toEqual({ target: 'textbox "Search"', handled: true })
  })
})

describe('withFrames', () => {
  it('runs frames requested during the call when real frames have stalled', async () => {
    const stalled = vi.fn(() => 1)
    const original = window.requestAnimationFrame
    window.requestAnimationFrame = stalled
    try {
      const ran = await api().withFrames(
        () =>
          new Promise<boolean>(resolve => {
            requestAnimationFrame(() => resolve(true))
          })
      )

      expect(ran).toBe(true)
      expect(stalled).toHaveBeenCalledOnce()
      expect(window.requestAnimationFrame).toBe(stalled)
    } finally {
      window.requestAnimationFrame = original
    }
  })

  it('keeps frames running until overlapping calls have all finished', async () => {
    const stalled = vi.fn(() => 1)
    const original = window.requestAnimationFrame
    window.requestAnimationFrame = stalled
    try {
      let finishFirst = () => {}
      const first = api().withFrames(
        () => new Promise<void>(resolve => (finishFirst = resolve))
      )
      // The first call finishes before the second requests its frame
      const ran = await api().withFrames(async () => {
        finishFirst()
        await first
        return new Promise<boolean>(resolve => {
          requestAnimationFrame(() => resolve(true))
        })
      })

      expect(ran).toBe(true)
      expect(window.requestAnimationFrame).toBe(stalled)
    } finally {
      window.requestAnimationFrame = original
    }
  })
})
