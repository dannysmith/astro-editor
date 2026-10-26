// These tests exercise the console itself
// oxlint-disable no-console
import { describe, it, expect, vi, afterEach } from 'vitest'

const forwarded = vi.hoisted(() => ({
  info: vi.fn(() => Promise.resolve()),
  warn: vi.fn(() => Promise.resolve()),
  error: vi.fn(() => Promise.resolve()),
  debug: vi.fn(() => Promise.resolve()),
}))
vi.mock('@tauri-apps/plugin-log', () => forwarded)

import { formatConsoleArgs, forwardConsoleToLog } from './console'

describe('formatConsoleArgs', () => {
  it('joins strings, JSON and errors', () => {
    const error = new Error('boom')
    error.stack = 'at somewhere'
    expect(formatConsoleArgs(['count', 3, { a: 1 }, error])).toBe(
      'count 3 {"a":1} Error: boom\nat somewhere'
    )
  })

  it('falls back to String() for values JSON can’t handle', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(formatConsoleArgs([undefined, circular])).toBe(
      'undefined [object Object]'
    )
  })
})

describe('forwardConsoleToLog', () => {
  const originals = { ...console }
  afterEach(() => {
    Object.assign(console, originals)
    vi.clearAllMocks()
  })

  it('forwards console calls to the matching log level and still prints them', () => {
    const printed = vi.spyOn(console, 'warn').mockImplementation(() => {})
    forwardConsoleToLog()

    console.warn('careful', 1)
    console.log('hello')

    expect(printed).toHaveBeenCalledWith('careful', 1)
    expect(forwarded.warn).toHaveBeenCalledWith('[console] careful 1')
    expect(forwarded.info).toHaveBeenCalledWith('[console] hello')
  })

  it('skips messages that are already forwarded, so echoes can’t loop', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    forwardConsoleToLog()

    console.info('[console] hello')

    expect(forwarded.info).not.toHaveBeenCalled()
  })
})
