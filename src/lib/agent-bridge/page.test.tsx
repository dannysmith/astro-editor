import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import { createPageApi } from './page'

// jsdom has no font loading, Web Animations, AnimationEvent or scrolling
beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve() },
    configurable: true,
  })
  document.getAnimations = () => []
  Element.prototype.scrollIntoView = () => {}
  globalThis.AnimationEvent ??= class extends Event {
    animationName: string
    constructor(type: string, init: AnimationEventInit = {}) {
      super(type, init)
      this.animationName = init.animationName ?? ''
    }
  } as unknown as typeof AnimationEvent
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

describe('idle', () => {
  it('ends the exit animation of closed overlays so they can unmount', async () => {
    document.body.innerHTML =
      '<div role="dialog" data-state="closed" style="animation-name: exit"></div>' +
      '<div role="dialog" data-state="open" style="animation-name: enter"></div>'
    const ended: string[] = []
    for (const dialog of document.querySelectorAll('[role="dialog"]')) {
      dialog.addEventListener('animationend', e =>
        ended.push(
          `${dialog.getAttribute('data-state')} ${(e as AnimationEvent).animationName}`
        )
      )
    }

    await api().idle()

    expect(ended).toEqual(['closed exit'])
  })
})
