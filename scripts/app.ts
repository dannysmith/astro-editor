// Drives the running dev app through its debug-only agent bridge
// (src-tauri/src/agent_bridge). Needs `bun run tauri:dev` to be running.
//
//   bun run app status                 # is the app up? window size and theme
//   bun run app eval 'document.title'  # run JS in the webview and print the result
//   bun run app shot [name]            # PNG of the webview in docs/tasks-todo/temporary
//   bun run app resize 1200x800        # resize the window (logical pixels)
//
// Flags: --out=<dir> (shot)  --timeout=<ms> (eval)
import { homedir } from 'node:os'
import path from 'node:path'

const USAGE = `Usage: bun run app <command> [args] [flags]

  status              App name, version, window size and theme
  eval <js>           Run JS in the webview and print the result. Takes an
                      expression, or a function body if it contains "return".
                      Runs in an async function, so "await" works. --timeout=<ms>
  shot [name]         Save a PNG of the webview. --out=<dir>
  resize <W>x<H>      Resize the window, in logical pixels`

type BridgeInfo = { port: number; token: string; pid: number }
type WindowInfo = {
  width: number
  height: number
  scale: number
  theme: string
}

const root = path.join(import.meta.dir, '..')
const args = process.argv.slice(2)
const flags = Object.fromEntries(
  args
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=')
      return [k, v.length ? v.join('=') : true]
    })
) as Record<string, string | true>
const [command, ...params] = args.filter(a => !a.startsWith('--'))

function fail(message: string): never {
  console.error(`app: ${message}`)
  process.exit(1)
}

function print(value: unknown) {
  console.log(
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  )
}

// The bridge writes its port and token to the dev app's data dir on startup.
let bridge: BridgeInfo | undefined
async function bridgeInfo(): Promise<BridgeInfo> {
  if (bridge) return bridge
  const config = path.join(root, 'src-tauri/tauri.dev.conf.json')
  const { identifier } = (await Bun.file(config).json()) as {
    identifier: string
  }
  const file = Bun.file(
    path.join(
      homedir(),
      'Library/Application Support',
      identifier,
      'agent-bridge.json'
    )
  )
  if (!(await file.exists())) {
    fail("the dev app isn't running. Start it with `bun run tauri:dev`")
  }
  bridge = (await file.json()) as BridgeInfo
  return bridge
}

async function call<T>(
  method: 'GET' | 'POST',
  route: string,
  body?: unknown
): Promise<T> {
  const { port, token } = await bridgeInfo()
  let response: Response
  try {
    response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method,
      headers: {
        'x-agent-bridge-token': token,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    fail(
      `can't reach the bridge on port ${port}. Is \`bun run tauri:dev\` still running?`
    )
  }
  const result = (await response.json()) as {
    ok: boolean
    value?: T
    error?: string
  }
  if (!result.ok) fail(result.error ?? `HTTP ${response.status}`)
  return result.value as T
}

// A run timestamp (YYYYMMDD-HHMMSS), as in the website's shoot script.
function stamp() {
  return new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T-]/g, m => (m === 'T' ? '-' : ''))
}

const commands: Record<string, () => Promise<void>> = {
  async status() {
    const health = await call<{ app: string; version: string; pid: number }>(
      'GET',
      '/health'
    )
    const window = await call<WindowInfo>('GET', '/window')
    print(
      `${health.app} ${health.version} (pid ${health.pid})\n` +
        `window ${window.width}x${window.height} @${window.scale}x, ${window.theme}`
    )
  },

  async eval() {
    const js = params.join(' ')
    if (!js) fail('eval needs some JS, e.g. `bun run app eval document.title`')
    const timeout =
      flags.timeout === undefined ? undefined : Number(flags.timeout)
    const body = /\breturn\b/.test(js) ? js : `return (${js})`
    print(await call('POST', '/eval', { js: body, timeoutMs: timeout }))
  },

  async shot() {
    const name = params[0] ?? 'app'
    const out =
      typeof flags.out === 'string' ? flags.out : 'docs/tasks-todo/temporary'
    const window = await call<WindowInfo>('GET', '/window')
    const file = path.resolve(
      root,
      out,
      `${name}-${window.width}x${window.height}-${stamp()}.png`
    )
    const shot = await call<{ width: number; height: number }>(
      'POST',
      '/snapshot',
      { path: file }
    )
    print(`${path.relative(root, file)} (${shot.width}x${shot.height}px)`)
  },

  async resize() {
    const match = /^(\d+)x(\d+)$/.exec(params[0] ?? '')
    if (!match) fail('resize needs a size like 1200x800')
    const window = await call<WindowInfo>('POST', '/window', {
      width: Number(match[1]),
      height: Number(match[2]),
    })
    print(`window ${window.width}x${window.height}`)
  },
}

if (!command || command === 'help' || !(command in commands)) {
  if (command && command !== 'help')
    console.error(`app: unknown command "${command}"\n`)
  console.log(USAGE)
  process.exit(command && command !== 'help' ? 1 : 0)
}
await commands[command]()
