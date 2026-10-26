// Drives the running dev app through its debug-only agent bridge
// (src-tauri/src/agent_bridge) and the `window.__agentBridge` API it calls in the webview
// (src/lib/agent-bridge). Needs `bun run tauri:dev` to be running.
//
//   bun run app shot sidebar                  # light + dark PNGs in docs/tasks-todo/temporary
//   bun run app open-project                  # open the test vault (temp-dummy-astro-project)
//   bun run app open articles/first-post.md   # open a file in the current project
//   bun run app tree                          # outline of the visible UI, with refs to click
//
// Run `bun run app help` for every command.
import { cp, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { Target } from '../src/lib/agent-bridge/page'
import { parseDuration, parseLevel, readCrashes, readLogs } from './app-logs'

const USAGE = `Usage: bun run app <command> [args] [flags]

Looking
  status                  App name, version, window size and theme
  state                   Project, file, panels, theme, editor, dialogs and toasts
  tree                    Outline of the visible UI. Controls get [n] refs for click/fill
  shot [name]             PNGs of the window, light then dark, in docs/tasks-todo/temporary
                          --theme=light|dark|both  --size=<W>x<H>  --out=<dir>

Doing
  open-project [path]     Open a project folder. Defaults to the test vault, which is
                          copied from test/dummy-astro-project if it's missing
  reset                   Recreate the test vault from test/dummy-astro-project
  open <file>             Open a file: absolute, or relative to the project or its
                          src/content (the extension is optional)
  run <command-id>        Run a command palette command. --list shows the ids
  type <text>             Type at the editor's cursor
  key <combo>             Send a key combo to the focused element, e.g. mod+b, escape
  click <target>          Click @<ref>, a CSS selector, or --text=<label>
  fill <target> <value>   Set an input's value. Target as for click
  resize <W>x<H>          Resize the window, in logical pixels
  reload                  Reload the webview, e.g. when HMR hasn't picked up a change
  goto <path>             Load another dev-server page in the window, e.g. /styleguide.html.
                          \`goto /\` returns to the app
  styleguide [section...] Screenshot styleguide sections (all by default) with shot's
                          flags, then return to the app
  eval <js>               Run JS in the webview and print the result. An expression,
                          or a function body if it contains "return". --timeout=<ms>

Logs (don't need the app running)
  logs                    Recent warnings and errors from Rust, the webview (including
                          console.*) and the tauri:dev terminal, repeats collapsed
                          --source=rust|js|dev  --level=debug|info|warn|error (warn)
                          --since=<30s|5m|2h|1d> (30m)  --grep=<regex>  --limit=<n> (50)
                          --full (don't truncate)
  logs --crashes          Recent crash reports, and a summary of the newest`

type BridgeInfo = { port: number; token: string; pid: number }
type WindowInfo = {
  width: number
  height: number
  scale: number
  theme: string
}
type AppState = { project: string | null; file: { path: string } | null }

const root = path.join(import.meta.dir, '..')
const VAULT = path.join(root, 'temp-dummy-astro-project')
const VAULT_SOURCE = path.join(root, 'test/dummy-astro-project')
const SHOT_DIR = 'docs/tasks-todo/temporary'
// Long enough for openProject, which waits for collections to load
const API_TIMEOUT_MS = 30_000

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

// The flags each command takes; anything else is rejected rather than ignored
const COMMAND_FLAGS: Record<string, string[]> = {
  shot: ['theme', 'size', 'out'],
  styleguide: ['theme', 'size', 'out'],
  run: ['list'],
  click: ['text'],
  fill: ['text'],
  eval: ['timeout'],
  logs: ['source', 'level', 'since', 'grep', 'limit', 'full', 'crashes'],
}
// The only flags that can be given without a value
const SWITCHES = ['list', 'full', 'crashes']

function print(value: unknown) {
  console.log(
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  )
}

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false
  )

/** The dev app's identity, which decides where its data and logs live. */
async function devConfig() {
  const config = path.join(root, 'src-tauri/tauri.dev.conf.json')
  return (await Bun.file(config).json()) as {
    identifier: string
    productName: string
  }
}

// The bridge writes its port and token to the dev app's data dir on startup.
let bridge: BridgeInfo | undefined
async function bridgeInfo(): Promise<BridgeInfo> {
  if (bridge) return bridge
  const { identifier } = await devConfig()
  const file = Bun.file(
    path.join(
      homedir(),
      'Library/Application Support',
      identifier,
      'agent-bridge.json'
    )
  )
  if (!(await file.exists())) {
    throw new Error(
      "the dev app isn't running. Start it with `bun run tauri:dev`"
    )
  }
  bridge = (await file.json()) as BridgeInfo
  return bridge
}

/** Whether a process is alive. EPERM means it exists but belongs to someone else. */
function isRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function call<T>(
  method: 'GET' | 'POST',
  route: string,
  body?: unknown
): Promise<T> {
  const { port, token, pid } = await bridgeInfo()
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
    throw new Error(
      isRunning(pid)
        ? `can't reach the bridge on port ${port}. Is \`bun run tauri:dev\` still running?`
        : "the dev app isn't running (it stopped without cleaning up). Start it with `bun run tauri:dev`"
    )
  }
  const result = (await response.json()) as {
    ok: boolean
    value?: T
    error?: string
  }
  if (!result.ok) throw new Error(result.error ?? `HTTP ${response.status}`)
  return result.value as T
}

/**
 * A JavaScript literal for `value`. JSON is valid JS except for a few characters
 * that can end a script or a line, so those are escaped.
 */
function jsLiteral(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>/\u2028\u2029]/g,
    c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

/** Calls a `window.__agentBridge` method in the webview. */
function callApi<T = unknown>(
  method: string,
  ...methodArgs: unknown[]
): Promise<T> {
  const js =
    `if (!window.__agentBridge) throw new Error("window.__agentBridge isn't installed. Is the app's page loaded?")\n` +
    `return await window.__agentBridge.${method}(...${jsLiteral(methodArgs)})`
  return call<T>('POST', '/eval', { js, timeoutMs: API_TIMEOUT_MS })
}

/** Reads a positive whole number from a flag's value. */
function parsePositiveInt(name: string, value: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`--${name} must be a positive whole number, got "${value}"`)
  }
  return number
}

function parseSize(value: string | true | undefined) {
  const match = /^(\d+)x(\d+)$/.exec(typeof value === 'string' ? value : '')
  if (!match) throw new Error(`expected a size like 1200x800, got "${value}"`)
  return { width: Number(match[1]), height: Number(match[2]) }
}

/** Reads a click/fill target from `--text=…` or the first param (`@12` or a selector). */
function parseTarget(): { target: Target; rest: string[] } {
  if (typeof flags.text === 'string')
    return { target: { text: flags.text }, rest: params }
  const [first, ...rest] = params
  if (!first)
    throw new Error('needs a target: @<ref>, a CSS selector, or --text=<label>')
  const ref = /^@(\d+)$/.exec(first)
  return { target: ref ? { ref: Number(ref[1]) } : { selector: first }, rest }
}

// A timestamp (YYYYMMDD-HHMMSS) shared by every shot in a run, so they sort together
function stamp() {
  return new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T-]/g, m => (m === 'T' ? '-' : ''))
}

async function copyVault() {
  await rm(VAULT, { recursive: true, force: true })
  // The editor only reads src/ and the committed .astro/ schemas
  await cp(VAULT_SOURCE, VAULT, {
    recursive: true,
    filter: source =>
      !/\/(node_modules|dist)(\/|$)/.test(source.slice(VAULT_SOURCE.length)),
  })
}

/**
 * Loads a dev-server page (`{ url: '/styleguide.html' }`) or reloads the current
 * one, then waits for the new page's API. The old page is marked first, so a
 * page without the mark is the new one.
 */
async function navigate(target: { url: string } | { reload: true }) {
  await call('POST', '/eval', { js: 'window.__agentBridgeReloading = true' })
  await call('POST', '/window', target)
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    await Bun.sleep(200)
    const fresh = await call<boolean>('POST', '/eval', {
      js: 'return Boolean(window.__agentBridge) && !window.__agentBridgeReloading',
    }).catch(() => false)
    if (fresh) {
      await callApi('idle')
      return
    }
  }
  throw new Error("the page didn't load within 15s")
}

/**
 * Screenshots the current page in each theme from `--theme`, at `--size` if
 * given, then restores the theme and size.
 */
async function takeShots(name: string) {
  const theme = flags.theme ?? 'both'
  if (theme !== 'light' && theme !== 'dark' && theme !== 'both') {
    throw new Error(`--theme must be light, dark or both, got "${theme}"`)
  }
  const themes = theme === 'both' ? ['light', 'dark'] : [theme]
  const out = typeof flags.out === 'string' ? flags.out : SHOT_DIR
  const runStamp = stamp()

  const before = await call<WindowInfo>('GET', '/window')
  const pageTheme = await callApi<string>('getTheme')
  try {
    if (flags.size) await call('POST', '/window', parseSize(flags.size))
    await callApi('shotMode', true)
    for (const t of themes) {
      // The native appearance only affects vibrancy, which snapshots don't
      // capture. The page theme is set directly because a hidden window doesn't
      // get prefers-color-scheme changes until it renders again.
      await call('POST', '/window', { theme: t })
      await callApi('setTheme', t)
      await callApi('idle')
      const window = await call<WindowInfo>('GET', '/window')
      const file = path.resolve(
        root,
        out,
        `${name}-${t}-${window.width}x${window.height}-${runStamp}.png`
      )
      const shot = await call<{ width: number; height: number }>(
        'POST',
        '/snapshot',
        {
          path: file,
        }
      )
      print(`${path.relative(root, file)} (${shot.width}x${shot.height}px)`)
    }
  } finally {
    await callApi('shotMode', false)
    await call('POST', '/window', { theme: 'system' })
    await callApi('setTheme', pageTheme)
    if (flags.size) {
      await call('POST', '/window', {
        width: before.width,
        height: before.height,
      })
    }
  }
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

  async state() {
    print(await callApi('state'))
  },

  async tree() {
    print(await callApi('tree'))
  },

  async shot() {
    await takeShots(params[0] ?? 'app')
  },

  async 'open-project'() {
    const project = params[0] ? path.resolve(params[0]) : VAULT
    if (project === VAULT && !(await exists(VAULT))) await copyVault()
    const state = await callApi<AppState>('openProject', project)
    print(`opened ${state.project}`)
  },

  async reset() {
    await copyVault()
    const state = await callApi<AppState>('state')
    if (state.project === VAULT) await callApi('refreshProject')
    print(`recreated ${path.relative(root, VAULT)}`)
  },

  async open() {
    const file = params[0]
    if (!file) throw new Error('open needs a file, e.g. articles/first-post.md')
    const { project } = await callApi<AppState>('state')
    const bases = path.isAbsolute(file)
      ? ['']
      : project
        ? [project, path.join(project, 'src/content')]
        : [process.cwd()]
    const candidates = bases.flatMap(base => {
      const full = path.resolve(base, file)
      return path.extname(file) ? [full] : [`${full}.md`, `${full}.mdx`]
    })
    let found: string | undefined
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        found = candidate
        break
      }
    }
    if (!found)
      throw new Error(`no such file. Tried:\n  ${candidates.join('\n  ')}`)
    await callApi('openFile', found)
    print(`opened ${project ? path.relative(project, found) : found}`)
  },

  async run() {
    if (flags.list) {
      const list = await callApi<{ id: string; label: string }[]>('commands')
      print(list.map(c => `${c.id.padEnd(32)} ${c.label}`).join('\n'))
      return
    }
    if (!params[0])
      throw new Error('run needs a command id. `run --list` shows them')
    await callApi('run', params[0])
    print(`ran ${params[0]}`)
  },

  async type() {
    const text = params.join(' ')
    if (!text) throw new Error('type needs some text')
    await callApi('type', text)
    print(`typed ${text.length} characters`)
  },

  async key() {
    if (!params[0]) throw new Error('key needs a combo, e.g. mod+b')
    const result = await callApi<{ target: string; handled: boolean }>(
      'key',
      params[0]
    )
    print(
      `${params[0]} → ${result.target}${result.handled ? ' (handled)' : ''}`
    )
  },

  async click() {
    const { target } = parseTarget()
    print(`clicked ${await callApi<string>('click', target)}`)
  },

  async fill() {
    const { target, rest } = parseTarget()
    print(`filled ${await callApi<string>('fill', target, rest.join(' '))}`)
  },

  async reload() {
    await navigate({ reload: true })
    print('reloaded')
  },

  async goto() {
    const target = params[0]
    if (!target?.startsWith('/')) {
      throw new Error(
        'goto needs a path on the dev server, e.g. /styleguide.html'
      )
    }
    await navigate({ url: target })
    print(`at ${target}`)
  },

  async styleguide() {
    // Loading the styleguide reloads the app, so note what was open to restore it
    const before = await callApi<AppState>('state').catch(() => null)
    // The index page links to every section
    await navigate({ url: '/styleguide.html' })
    const all = await call<string[]>('POST', '/eval', {
      js: 'return [...document.querySelectorAll("[data-section]")].map(a => a.dataset.section)',
    })
    const unknown = params.filter(id => !all.includes(id))
    try {
      if (unknown.length) {
        throw new Error(
          `unknown sections: ${unknown.join(', ')}. Sections: ${all.join(', ')}`
        )
      }
      for (const id of params.length ? params : all) {
        await navigate({ url: `/styleguide.html?section=${id}` })
        await takeShots(`styleguide-${id}`)
      }
    } finally {
      await navigate({ url: '/' })
      if (before?.project) await callApi('openProject', before.project)
      if (before?.file) await callApi('openFile', before.file.path)
    }
  },

  async resize() {
    const window = await call<WindowInfo>(
      'POST',
      '/window',
      parseSize(params[0])
    )
    print(`window ${window.width}x${window.height}`)
  },

  async logs() {
    const { identifier, productName } = await devConfig()
    if (flags.crashes) {
      print(await readCrashes([productName, 'Astro Editor']))
      return
    }
    const value = (name: string) =>
      typeof flags[name] === 'string' ? flags[name] : undefined
    const source = value('source')
    if (source && source !== 'rust' && source !== 'js' && source !== 'dev') {
      throw new Error(`--source must be rust, js or dev, got "${source}"`)
    }
    print(
      await readLogs(identifier, productName, {
        source,
        level: parseLevel(value('level') ?? 'warn'),
        sinceMs: parseDuration(value('since') ?? '30m'),
        grep: value('grep') ? new RegExp(value('grep')!, 'i') : undefined,
        limit: parsePositiveInt('limit', value('limit') ?? '50'),
        full: Boolean(flags.full),
      })
    )
  },

  async eval() {
    const js = params.join(' ')
    if (!js)
      throw new Error(
        'eval needs some JS, e.g. `bun run app eval document.title`'
      )
    const timeoutMs =
      typeof flags.timeout === 'string'
        ? parsePositiveInt('timeout', flags.timeout)
        : undefined
    const body = /\breturn\b/.test(js) ? js : `return (${js})`
    print(await call('POST', '/eval', { js: body, timeoutMs }))
  },
}

if (!command || command === 'help' || !(command in commands)) {
  if (command && command !== 'help')
    console.error(`app: unknown command "${command}"\n`)
  console.log(USAGE)
  process.exit(command && command !== 'help' ? 1 : 0)
}
const unknownFlags = Object.keys(flags).filter(
  flag => !(COMMAND_FLAGS[command] ?? []).includes(flag)
)
if (unknownFlags.length) {
  const allowed = COMMAND_FLAGS[command]?.map(f => `--${f}`).join(', ')
  console.error(
    `app: ${command} doesn't take ${unknownFlags.map(f => `--${f}`).join(', ')}` +
      (allowed ? `. It takes ${allowed}` : '')
  )
  process.exit(1)
}
const bareFlags = Object.keys(flags).filter(
  flag => flags[flag] === true && !SWITCHES.includes(flag)
)
if (bareFlags.length) {
  console.error(
    `app: ${bareFlags.map(f => `--${f}`).join(', ')} needs a value, e.g. --${bareFlags[0]}=…`
  )
  process.exit(1)
}

try {
  await commands[command]!()
} catch (error) {
  console.error(
    `app: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
}
