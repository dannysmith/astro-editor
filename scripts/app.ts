// Drives the running dev app through its debug-only agent bridge
// (src-tauri/src/agent_bridge) and the `window.__ae` API it calls in the webview
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
  eval <js>               Run JS in the webview and print the result. An expression,
                          or a function body if it contains "return". --timeout=<ms>`

type BridgeInfo = { port: number; token: string; pid: number }
type WindowInfo = {
  width: number
  height: number
  scale: number
  theme: string
}
type AppState = { project: string | null }
type Target = { ref?: number; text?: string; selector?: string }

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
    throw new Error(
      "the dev app isn't running. Start it with `bun run tauri:dev`"
    )
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
    throw new Error(
      `can't reach the bridge on port ${port}. Is \`bun run tauri:dev\` still running?`
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

/** Calls a `window.__ae` method in the webview. */
function ae<T = unknown>(method: string, ...methodArgs: unknown[]): Promise<T> {
  const js =
    `if (!window.__ae) throw new Error("window.__ae isn't installed. Is the app's page loaded?")\n` +
    `return await window.__ae.${method}(...${JSON.stringify(methodArgs)})`
  return call<T>('POST', '/eval', { js, timeoutMs: API_TIMEOUT_MS })
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

// A run timestamp (YYYYMMDD-HHMMSS), as in the website's shoot script.
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
    print(await ae('state'))
  },

  async tree() {
    print(await ae('tree'))
  },

  async shot() {
    const name = params[0] ?? 'app'
    const theme = flags.theme ?? 'both'
    if (theme !== 'light' && theme !== 'dark' && theme !== 'both') {
      throw new Error(`--theme must be light, dark or both, got "${theme}"`)
    }
    const themes = theme === 'both' ? ['light', 'dark'] : [theme]
    const out = typeof flags.out === 'string' ? flags.out : SHOT_DIR
    const runStamp = stamp()

    const before = await call<WindowInfo>('GET', '/window')
    const appTheme = await ae<string>('getTheme')
    try {
      if (flags.size) await call('POST', '/window', parseSize(flags.size))
      await ae('shotMode', true)
      for (const t of themes) {
        // The native appearance only affects vibrancy, which snapshots don't
        // capture. The app theme is set directly because a hidden window doesn't
        // get prefers-color-scheme changes until it renders again.
        await call('POST', '/window', { theme: t })
        await ae('setTheme', t)
        await ae('idle')
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
      await ae('shotMode', false)
      await call('POST', '/window', { theme: 'system' })
      await ae('setTheme', appTheme)
      if (flags.size) {
        await call('POST', '/window', {
          width: before.width,
          height: before.height,
        })
      }
    }
  },

  async 'open-project'() {
    const project = params[0] ? path.resolve(params[0]) : VAULT
    if (project === VAULT && !(await exists(VAULT))) await copyVault()
    const state = await ae<AppState>('openProject', project)
    print(`opened ${state.project}`)
  },

  async reset() {
    await copyVault()
    const state = await ae<AppState>('state')
    if (state.project === VAULT) await ae('refreshProject')
    print(`recreated ${path.relative(root, VAULT)}`)
  },

  async open() {
    const file = params[0]
    if (!file) throw new Error('open needs a file, e.g. articles/first-post.md')
    const { project } = await ae<AppState>('state')
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
    await ae('openFile', found)
    print(`opened ${project ? path.relative(project, found) : found}`)
  },

  async run() {
    if (flags.list) {
      const list = await ae<{ id: string; label: string }[]>('commands')
      print(list.map(c => `${c.id.padEnd(32)} ${c.label}`).join('\n'))
      return
    }
    if (!params[0])
      throw new Error('run needs a command id. `run --list` shows them')
    await ae('run', params[0])
    print(`ran ${params[0]}`)
  },

  async type() {
    const text = params.join(' ')
    if (!text) throw new Error('type needs some text')
    await ae('type', text)
    print(`typed ${text.length} characters`)
  },

  async key() {
    if (!params[0]) throw new Error('key needs a combo, e.g. mod+b')
    const result = await ae<{ target: string; handled: boolean }>(
      'key',
      params[0]
    )
    print(
      `${params[0]} → ${result.target}${result.handled ? ' (handled)' : ''}`
    )
  },

  async click() {
    const { target } = parseTarget()
    print(`clicked ${await ae<string>('click', target)}`)
  },

  async fill() {
    const { target, rest } = parseTarget()
    print(`filled ${await ae<string>('fill', target, rest.join(' '))}`)
  },

  async reload() {
    // The eval returns before the reload happens, so mark the old page and wait
    // for a page without the mark that has the API installed
    await call('POST', '/eval', {
      js: 'window.__aeReloading = true; setTimeout(() => location.reload(), 0)',
    })
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      await Bun.sleep(200)
      const fresh = await call<boolean>('POST', '/eval', {
        js: 'return Boolean(window.__ae) && !window.__aeReloading',
      }).catch(() => false)
      if (fresh) {
        await ae('idle')
        print('reloaded')
        return
      }
    }
    throw new Error("the page didn't come back within 15s")
  },

  async resize() {
    const window = await call<WindowInfo>(
      'POST',
      '/window',
      parseSize(params[0])
    )
    print(`window ${window.width}x${window.height}`)
  },

  async eval() {
    const js = params.join(' ')
    if (!js)
      throw new Error(
        'eval needs some JS, e.g. `bun run app eval document.title`'
      )
    const timeoutMs =
      flags.timeout === undefined ? undefined : Number(flags.timeout)
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
try {
  await commands[command]!()
} catch (error) {
  console.error(
    `app: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
}
