/**
 * Turns a key combo like `mod+shift+b` into `KeyboardEvent` init options, so the
 * agent bridge can send shortcuts to react-hotkeys-hook and CodeMirror keymaps.
 * `mod` is Cmd on macOS and Ctrl elsewhere, matching react-hotkeys-hook.
 */

const NAMED_KEYS: Record<string, { key: string; code: string }> = {
  enter: { key: 'Enter', code: 'Enter' },
  return: { key: 'Enter', code: 'Enter' },
  escape: { key: 'Escape', code: 'Escape' },
  esc: { key: 'Escape', code: 'Escape' },
  tab: { key: 'Tab', code: 'Tab' },
  space: { key: ' ', code: 'Space' },
  backspace: { key: 'Backspace', code: 'Backspace' },
  delete: { key: 'Delete', code: 'Delete' },
  up: { key: 'ArrowUp', code: 'ArrowUp' },
  down: { key: 'ArrowDown', code: 'ArrowDown' },
  left: { key: 'ArrowLeft', code: 'ArrowLeft' },
  right: { key: 'ArrowRight', code: 'ArrowRight' },
  home: { key: 'Home', code: 'Home' },
  end: { key: 'End', code: 'End' },
  pageup: { key: 'PageUp', code: 'PageUp' },
  pagedown: { key: 'PageDown', code: 'PageDown' },
  comma: { key: ',', code: 'Comma' },
  ',': { key: ',', code: 'Comma' },
  period: { key: '.', code: 'Period' },
  '.': { key: '.', code: 'Period' },
  slash: { key: '/', code: 'Slash' },
  '/': { key: '/', code: 'Slash' },
  backslash: { key: '\\', code: 'Backslash' },
  '\\': { key: '\\', code: 'Backslash' },
  semicolon: { key: ';', code: 'Semicolon' },
  ';': { key: ';', code: 'Semicolon' },
  quote: { key: "'", code: 'Quote' },
  "'": { key: "'", code: 'Quote' },
  bracketleft: { key: '[', code: 'BracketLeft' },
  '[': { key: '[', code: 'BracketLeft' },
  bracketright: { key: ']', code: 'BracketRight' },
  ']': { key: ']', code: 'BracketRight' },
  minus: { key: '-', code: 'Minus' },
  '-': { key: '-', code: 'Minus' },
  equal: { key: '=', code: 'Equal' },
  '=': { key: '=', code: 'Equal' },
  backquote: { key: '`', code: 'Backquote' },
  '`': { key: '`', code: 'Backquote' },
}

export function keyEventInit(combo: string, isMac: boolean): KeyboardEventInit {
  const parts = combo.toLowerCase().split('+')
  const name = parts.pop()
  const init: KeyboardEventInit = { bubbles: true, cancelable: true }

  for (const modifier of parts) {
    switch (modifier) {
      case 'mod':
        if (isMac) init.metaKey = true
        else init.ctrlKey = true
        break
      case 'cmd':
      case 'meta':
        init.metaKey = true
        break
      case 'ctrl':
      case 'control':
        init.ctrlKey = true
        break
      case 'alt':
      case 'option':
        init.altKey = true
        break
      case 'shift':
        init.shiftKey = true
        break
      default:
        throw new Error(`Unknown modifier "${modifier}" in "${combo}"`)
    }
  }

  if (!name) throw new Error(`No key in "${combo}"`)
  if (/^[a-z]$/.test(name)) {
    const upper = name.toUpperCase()
    return { ...init, key: init.shiftKey ? upper : name, code: `Key${upper}` }
  }
  if (/^[0-9]$/.test(name)) {
    return { ...init, key: name, code: `Digit${name}` }
  }
  if (/^f([1-9]|1[0-2])$/.test(name)) {
    return { ...init, key: name.toUpperCase(), code: name.toUpperCase() }
  }
  const named = NAMED_KEYS[name]
  if (!named) throw new Error(`Unknown key "${name}" in "${combo}"`)
  return { ...init, ...named }
}
