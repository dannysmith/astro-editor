import { describe, it, expect } from 'vitest'
import {
  collapse,
  formatEntry,
  parseDevLog,
  parseDuration,
  parseLevel,
  parsePluginLog,
  summariseCrash,
} from './app-logs'

describe('parsePluginLog', () => {
  it('reads tauri-plugin-log lines and tells Rust from webview output', () => {
    const entries = parsePluginLog(
      [
        '[2026-10-26][02:13:54][astro_editor_lib::commands::watcher][WARN] Watcher disconnected',
        '[2026-10-26][02:13:55][webview::runCallback@user-script:5:284:15][INFO] [console] hello',
      ].join('\n')
    )
    expect(entries).toMatchObject([
      {
        time: new Date('2026-10-26T02:13:54Z'),
        level: 'warn',
        source: 'rust',
        target: 'commands::watcher',
        message: 'Watcher disconnected',
      },
      { level: 'info', source: 'js', target: 'js', message: '[console] hello' },
    ])
  })

  it('attaches continuation lines to the message before', () => {
    const [entry] = parsePluginLog(
      '[2026-10-26][02:13:54][webview][ERROR] TypeError: boom\n  at main.tsx:3\n  at App.tsx:9'
    )
    expect(entry?.message).toBe(
      'TypeError: boom\n  at main.tsx:3\n  at App.tsx:9'
    )
  })
})

describe('parseDevLog', () => {
  it('strips colours, skips plugin-log lines and classes lines by keyword', () => {
    const entries = parseDevLog(
      [
        '\x1b[32m  VITE v8.3.5  ready\x1b[0m',
        '[2026-10-26][02:00:00][astro_editor_lib][INFO] repeated from stdout',
        '\x1b[1;33mwarning\x1b[0m: unused variable',
        "thread 'main' panicked at src/lib.rs:3:1",
      ].join('\n')
    )
    expect(entries.map(e => [e.level, e.message])).toEqual([
      ['info', '  VITE v8.3.5  ready'],
      ['warn', 'warning: unused variable'],
      ['error', "thread 'main' panicked at src/lib.rs:3:1"],
    ])
  })

  it("keeps cargo's location and source lines with the error", () => {
    const [entry] = parseDevLog(
      'error[E0425]: cannot find value `y`\n  --> src/lib.rs:10:5\n   |\n10 |     y\n   |     ^ not found'
    )
    expect(entry?.level).toBe('error')
    expect(entry?.message.split('\n')).toHaveLength(5)
  })
})

describe('collapse', () => {
  it('merges consecutive repeats and keeps the latest time', () => {
    const entries = parsePluginLog(
      [
        '[2026-10-26][02:00:00][webview][WARN] slow',
        '[2026-10-26][02:00:05][webview][WARN] slow',
        '[2026-10-26][02:00:06][webview][WARN] other',
        '[2026-10-26][02:00:07][webview][WARN] slow',
      ].join('\n')
    )
    const collapsed = collapse(entries)
    expect(collapsed.map(e => [e.message, e.count])).toEqual([
      ['slow', 2],
      ['other', 1],
      ['slow', 1],
    ])
    expect(collapsed[0]?.time).toEqual(new Date('2026-10-26T02:00:05Z'))
  })
})

describe('formatEntry', () => {
  const [entry] = parsePluginLog(
    `[2026-10-26][02:00:00][webview][ERROR] boom\n${Array.from({ length: 8 }, (_, i) => `  at line ${i}`).join('\n')}`
  )

  it('shows time, level, target, a few extra lines and the repeat count', () => {
    const text = formatEntry({ ...entry!, count: 3 }, false)
    expect(text.split('\n')[0]).toBe('02:00:00 ERROR js  boom')
    expect(text).toContain('… 4 more lines (--full)')
    expect(text.endsWith('(×3)')).toBe(true)
  })

  it('shows everything with full', () => {
    expect(formatEntry(entry!, true)).toContain('at line 7')
  })
})

describe('parseDuration and parseLevel', () => {
  it('parses durations', () => {
    expect(parseDuration('30s')).toBe(30_000)
    expect(parseDuration('5m')).toBe(300_000)
    expect(parseDuration('2h')).toBe(7_200_000)
    expect(parseDuration('1d')).toBe(86_400_000)
    expect(() => parseDuration('5x')).toThrow('expected a duration')
  })

  it('accepts known levels only', () => {
    expect(parseLevel('warn')).toBe('warn')
    expect(() => parseLevel('loud')).toThrow('--level must be one of')
  })
})

describe('summariseCrash', () => {
  it('summarises the exception and the crashed thread', () => {
    const report = [
      JSON.stringify({ app_name: 'astro-editor' }),
      JSON.stringify({
        exception: { type: 'EXC_CRASH', signal: 'SIGABRT' },
        termination: { indicator: 'Abort trap: 6' },
        faultingThread: 1,
        threads: [
          { frames: [] },
          {
            frames: [
              { imageIndex: 0, symbol: '__pthread_kill' },
              { imageIndex: 1, imageOffset: 4096 },
            ],
          },
        ],
        usedImages: [
          { name: 'libsystem_kernel.dylib' },
          { name: 'astro-editor' },
        ],
      }),
    ].join('\n')

    expect(summariseCrash(report)).toBe(
      [
        'exception: EXC_CRASH SIGABRT',
        'termination: Abort trap: 6',
        'crashed thread 1:',
        '  __pthread_kill  (libsystem_kernel.dylib)',
        '  +4096  (astro-editor)',
      ].join('\n')
    )
  })

  it('falls back to the raw text when the body is not JSON', () => {
    expect(summariseCrash('header\nnot json')).toBe('header\nnot json')
  })
})
