import { debug, info, warn, error } from '@tauri-apps/plugin-log'

const MARKER = '[console]'

const FORWARDS = {
  debug,
  log: info,
  info,
  warn,
  error,
} as const

/** Formats console arguments roughly the way the console shows them. */
export function formatConsoleArgs(args: unknown[]): string {
  return args
    .map(arg => {
      if (typeof arg === 'string') return arg
      // WebKit's stack doesn't include the message
      if (arg instanceof Error)
        return arg.stack ? `${arg}\n${arg.stack}` : String(arg)
      try {
        return JSON.stringify(arg) ?? String(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

/**
 * Dev only: copies console output into the log file, marked `[console]`, so
 * `bun run app logs` can read it. The console itself behaves as before.
 */
export function forwardConsoleToLog() {
  for (const [method, forward] of Object.entries(FORWARDS)) {
    const name = method as keyof typeof FORWARDS
    const original = console[name].bind(console)
    console[name] = (...args: unknown[]) => {
      original(...args)
      const message = formatConsoleArgs(args)
      // Anything that echoes log output back to the console would otherwise loop
      if (message.includes(MARKER)) return
      forward(`${MARKER} ${message}`).catch(() => {
        // Logging must never break the app
      })
    }
  }
}
