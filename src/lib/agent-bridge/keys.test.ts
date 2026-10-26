import { describe, it, expect } from 'vitest'
import { keyEventInit } from './keys'

describe('keyEventInit', () => {
  it('maps mod to Cmd on macOS and Ctrl elsewhere', () => {
    expect(keyEventInit('mod+b', true)).toMatchObject({
      key: 'b',
      code: 'KeyB',
      metaKey: true,
    })
    expect(keyEventInit('mod+b', false)).toMatchObject({
      key: 'b',
      code: 'KeyB',
      ctrlKey: true,
    })
    expect(keyEventInit('mod+b', false).metaKey).toBeUndefined()
  })

  it('combines modifiers and upper-cases shifted letters', () => {
    expect(keyEventInit('cmd+alt+shift+p', true)).toMatchObject({
      key: 'P',
      code: 'KeyP',
      metaKey: true,
      altKey: true,
      shiftKey: true,
    })
  })

  it('handles digits, function keys and named keys', () => {
    expect(keyEventInit('mod+1', true)).toMatchObject({
      key: '1',
      code: 'Digit1',
    })
    expect(keyEventInit('f5', true)).toMatchObject({ key: 'F5', code: 'F5' })
    expect(keyEventInit('escape', true)).toMatchObject({
      key: 'Escape',
      code: 'Escape',
    })
    expect(keyEventInit('space', true)).toMatchObject({
      key: ' ',
      code: 'Space',
    })
  })

  it('accepts punctuation by name or character', () => {
    expect(keyEventInit('mod+comma', true)).toMatchObject({
      key: ',',
      code: 'Comma',
    })
    expect(keyEventInit('mod+,', true)).toMatchObject({
      key: ',',
      code: 'Comma',
    })
  })

  it('is case-insensitive', () => {
    expect(keyEventInit('Mod+Shift+Enter', true)).toMatchObject({
      key: 'Enter',
      metaKey: true,
      shiftKey: true,
    })
  })

  it('creates bubbling, cancelable events', () => {
    expect(keyEventInit('a', true)).toMatchObject({
      bubbles: true,
      cancelable: true,
    })
  })

  it('rejects unknown modifiers and keys', () => {
    expect(() => keyEventInit('hyper+a', true)).toThrow(
      'Unknown modifier "hyper"'
    )
    expect(() => keyEventInit('mod+nope', true)).toThrow('Unknown key "nope"')
  })
})
