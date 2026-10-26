// Reading the dev app's logs for `bun run app logs`. Three sources:
//
//   rust  Rust `log` output, from the tauri-plugin-log file
//   js    webview output in the same file: plugin-log calls and console.* (marked [console])
//   dev   the `bun run tauri:dev` terminal (Vite, cargo), from tauri-dev.log
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const
type Level = (typeof LEVELS)[number]
type Source = 'rust' | 'js' | 'dev'

interface Entry {
  time: Date | null
  level: Level
  source: Source
  target: string
  message: string
  count: number
}

export interface LogOptions {
  source?: Source
  level: Level
  sinceMs: number | null
  grep?: RegExp
  limit: number
  full: boolean
}

// tauri-plugin-log's default format, with UTC timestamps
const PLUGIN_LINE =
  /^\[(\d{4}-\d{2}-\d{2})\]\[(\d{2}:\d{2}:\d{2})\]\[([^\]]*)\]\[(TRACE|DEBUG|INFO|WARN|ERROR)\] ?(.*)$/
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g

const MAX_MESSAGE = 400
const MAX_EXTRA_LINES = 4

function logDir(identifier: string) {
  return path.join(homedir(), 'Library/Logs', identifier)
}

async function readIfExists(file: string) {
  try {
    return await readFile(file, 'utf8')
  } catch {
    return ''
  }
}

export function parsePluginLog(text: string): Entry[] {
  const entries: Entry[] = []
  for (const line of text.split('\n')) {
    const match = PLUGIN_LINE.exec(line)
    if (match) {
      const [, date, time, target = '', level = 'INFO', message = ''] = match
      const js = target.startsWith('webview')
      entries.push({
        time: new Date(`${date}T${time}Z`),
        level: level.toLowerCase() as Level,
        source: js ? 'js' : 'rust',
        target: js ? 'js' : target.replace(/^astro_editor_lib::/, ''),
        message,
        count: 1,
      })
    } else if (line && entries.length) {
      // Continuation of a multi-line message, e.g. a stack trace
      entries[entries.length - 1]!.message += `\n${line}`
    }
  }
  return entries
}

// Indented lines and cargo's numbered source lines (`10 |`) belong to the line before
const CONTINUATION = /^\s|^\d+\s*\|/

export function parseDevLog(text: string): Entry[] {
  const entries: Entry[] = []
  for (const raw of text.replace(ANSI, '').split('\n')) {
    const line = raw.trimEnd()
    // The app's stdout repeats the plugin-log lines, which are read from the log file
    if (!line.trim() || PLUGIN_LINE.test(line)) continue
    const last = entries[entries.length - 1]
    if (last && CONTINUATION.test(line)) {
      last.message += `\n${line}`
      continue
    }
    entries.push({
      time: null,
      level: /\berror\b|panicked/i.test(line)
        ? 'error'
        : /\bwarn(ing)?\b/i.test(line)
          ? 'warn'
          : 'info',
      source: 'dev',
      target: 'dev',
      message: line,
      count: 1,
    })
  }
  return entries
}

/** Collapses consecutive entries with the same source, level and message. */
export function collapse(entries: Entry[]): Entry[] {
  const collapsed: Entry[] = []
  for (const entry of entries) {
    const last = collapsed[collapsed.length - 1]
    if (
      last &&
      last.source === entry.source &&
      last.level === entry.level &&
      last.message === entry.message
    ) {
      last.count += 1
      last.time = entry.time
    } else {
      collapsed.push({ ...entry })
    }
  }
  return collapsed
}

export function formatEntry(entry: Entry, full: boolean): string {
  const time = entry.time ? entry.time.toISOString().slice(11, 19) : '--:--:--'
  const [first = '', ...rest] = entry.message.split('\n')
  const extra = full ? rest : rest.slice(0, MAX_EXTRA_LINES)
  let message = [first, ...extra.map(line => `    ${line}`)].join('\n')
  if (!full && rest.length > extra.length) {
    message += `\n    … ${rest.length - extra.length} more lines (--full)`
  }
  if (!full && message.length > MAX_MESSAGE)
    message = `${message.slice(0, MAX_MESSAGE)}…`
  const count = entry.count > 1 ? ` (×${entry.count})` : ''
  return `${time} ${entry.level.toUpperCase().padEnd(5)} ${entry.target}  ${message}${count}`
}

/**
 * Matching entries, oldest first. Entries from the dev terminal have no
 * timestamps; that file only covers the current run, so `since` doesn't apply.
 */
export async function readLogs(
  identifier: string,
  productName: string,
  options: LogOptions
): Promise<string> {
  const dir = logDir(identifier)
  const pluginEntries = parsePluginLog(
    await readIfExists(path.join(dir, `${productName}.log`))
  )
  const devEntries = parseDevLog(
    await readIfExists(path.join(dir, 'tauri-dev.log'))
  )
  const minLevel = LEVELS.indexOf(options.level)
  const cutoff = options.sinceMs === null ? null : Date.now() - options.sinceMs

  const matches = (entry: Entry) =>
    (!options.source || entry.source === options.source) &&
    LEVELS.indexOf(entry.level) >= minLevel &&
    (cutoff === null ||
      entry.time === null ||
      entry.time.getTime() >= cutoff) &&
    (!options.grep ||
      options.grep.test(entry.message) ||
      options.grep.test(entry.target))

  const sections: string[] = []
  const app = collapse(pluginEntries.filter(matches)).slice(-options.limit)
  const dev = collapse(devEntries.filter(matches)).slice(-options.limit)
  if (app.length)
    sections.push(app.map(e => formatEntry(e, options.full)).join('\n'))
  if (dev.length) {
    sections.push(
      `── tauri dev output (this run) ──\n${dev.map(e => formatEntry(e, options.full)).join('\n')}`
    )
  }
  return sections.length ? sections.join('\n\n') : 'No matching log entries.'
}

/** Parses `5m`, `2h`, `30s` or `1d` into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value)
  if (!match)
    throw new Error(
      `expected a duration like 30s, 5m, 2h or 1d, got "${value}"`
    )
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    match[2] as 's' | 'm' | 'h' | 'd'
  ]
  return Number(match[1]) * unit
}

export function parseLevel(value: string): Level {
  if (!(LEVELS as readonly string[]).includes(value)) {
    throw new Error(
      `--level must be one of ${LEVELS.join(', ')}, got "${value}"`
    )
  }
  return value as Level
}

const CRASH_DIR = path.join(homedir(), 'Library/Logs/DiagnosticReports')

/**
 * Lists recent crash reports for the app (dev binary or bundle) and summarises
 * the newest: exception, termination reason and the crashed thread's frames.
 */
export async function readCrashes(productNames: string[]): Promise<string> {
  const prefixes = ['astro-editor', ...productNames]
  let files: string[]
  try {
    files = await readdir(CRASH_DIR)
  } catch {
    return `Can't read ${CRASH_DIR}.`
  }
  const reports = await Promise.all(
    files
      .filter(f => f.endsWith('.ips') && prefixes.some(p => f.startsWith(p)))
      .map(async f => ({
        file: f,
        mtime: (await stat(path.join(CRASH_DIR, f))).mtime,
      }))
  )
  reports.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  if (!reports.length) return 'No crash reports for Astro Editor.'

  const list = reports
    .slice(0, 5)
    .map(
      r => `${r.mtime.toISOString().slice(0, 19).replace('T', ' ')}  ${r.file}`
    )
    .join('\n')
  const newest = path.join(CRASH_DIR, reports[0]!.file)
  return `${list}\n\nNewest (${newest}):\n${summariseCrash(await readFile(newest, 'utf8'))}`
}

interface CrashBody {
  exception?: { type?: string; signal?: string; subtype?: string }
  termination?: { indicator?: string; reasons?: string[] }
  faultingThread?: number
  threads?: {
    frames?: { imageIndex?: number; symbol?: string; imageOffset?: number }[]
  }[]
  usedImages?: { name?: string }[]
}

/** Summarises a macOS `.ips` crash report: a JSON header line, then a JSON body. */
export function summariseCrash(text: string): string {
  const newline = text.indexOf('\n')
  let body: CrashBody
  try {
    body = JSON.parse(text.slice(newline + 1)) as CrashBody
  } catch {
    return text.slice(0, 2000)
  }
  const lines: string[] = []
  const { exception, termination } = body
  if (exception) {
    lines.push(
      `exception: ${[exception.type, exception.signal, exception.subtype].filter(Boolean).join(' ')}`
    )
  }
  if (termination?.indicator)
    lines.push(`termination: ${termination.indicator}`)
  for (const reason of termination?.reasons ?? []) lines.push(`  ${reason}`)

  const thread = body.threads?.[body.faultingThread ?? 0]
  if (thread?.frames?.length) {
    lines.push(`crashed thread ${body.faultingThread ?? 0}:`)
    for (const frame of thread.frames.slice(0, 20)) {
      const image = body.usedImages?.[frame.imageIndex ?? -1]?.name ?? '?'
      lines.push(
        `  ${frame.symbol ?? `+${frame.imageOffset ?? '?'}`}  (${image})`
      )
    }
  }
  return lines.join('\n')
}
