/**
 * Harper, running in its own Web Worker (`harper.worker.ts`). The worker and
 * Harper's WebAssembly (about 20 MB) only load when a check first runs, which
 * is when a check is switched on or, if one was left on, when a file is
 * opened. The main thread never loads the WebAssembly.
 *
 * Each call sends the current settings first, which the worker applies only
 * when they've changed. A call that fails, or gets no answer in time, stops
 * the worker, so the next call starts a new one (see `run`).
 */

import { error as logError, warn as logWarn } from '@tauri-apps/plugin-log'
import type { GlobalSettings } from '@/lib/bindings'
import { useHarperStore } from '@/store/harperStore'
import { useProjectStore } from '@/store/projectStore'
import { HARPER_DIALECTS } from './checks'
import type {
  HarperApi,
  HarperLint,
  HarperRequest,
  HarperResponse,
} from './harper.worker'
import { MASK_PATTERN } from './prose'
import { readCopyedit } from './settings'

/**
 * Where ignored issues are kept. Harper records each as a hash of the issue
 * and the text around it, so an ignore holds in any document with the same
 * wording, and the list can't be read back as words: it can only be cleared.
 * They're cheap to lose, so localStorage is enough.
 */
const IGNORED_KEY = 'harper-ignored-issues'

/** The form Harper exports ignored issues in, which is all it will import */
const IGNORED_FORMAT = /^\{"context_hashes":\[(?:\d+(?:,\d+)*)?\]\}$/

/** How long the worker may take to start, and to answer a call, in ms */
const START_TIMEOUT = 30_000
const CALL_TIMEOUT = 15_000

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let worker: Worker | null = null
/** Whether the worker has applied settings once, which is when it's started */
let started = false
let nextId = 0
const pending = new Map<number, Pending>()

function startWorker(): Worker {
  const created = new Worker(new URL('./harper.worker.ts', import.meta.url), {
    type: 'module',
  })
  created.onmessage = ({ data }: MessageEvent<HarperResponse>) => {
    const call = pending.get(data.id)
    if (!call) return
    pending.delete(data.id)
    clearTimeout(call.timer)
    if ('error' in data) call.reject(new Error(data.error))
    else call.resolve(data.value)
  }
  // The worker's script failed to load or threw outside a call
  created.onerror = event => {
    event.preventDefault()
    stopWorker(new Error(`Harper's worker failed: ${event.message}`))
  }
  started = false
  return created
}

/** Stops the worker, failing the calls still waiting for it */
function stopWorker(reason: Error) {
  worker?.terminate()
  worker = null
  for (const call of pending.values()) {
    clearTimeout(call.timer)
    call.reject(reason)
  }
  pending.clear()
}

function send<K extends keyof HarperApi>(
  method: K,
  args: Parameters<HarperApi[K]>,
  timeout: number
): Promise<Awaited<ReturnType<HarperApi[K]>>> {
  const target = (worker ??= startWorker())
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Harper didn't answer ${method} within ${timeout} ms`))
    }, timeout)
    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer,
    })
    target.postMessage({ id, method, args } satisfies HarperRequest)
  })
}

/** The stored ignored issues. Anything Harper wouldn't import is dropped */
function storedIgnores(): string | null {
  const stored = localStorage.getItem(IGNORED_KEY)
  if (stored === null || IGNORED_FORMAT.test(stored)) return stored
  localStorage.removeItem(IGNORED_KEY)
  void logWarn('Astro Editor [HARPER] Dropped unreadable ignored issues')
  return null
}

/** Failed calls in a row, after which the worker isn't started again */
const MAX_FAILURES = 3

let failures = 0

/** The settings when the worker was given up on. Any change tries again */
let gaveUpOn: GlobalSettings['copyedit'] | undefined

/**
 * Calls the worker, starting it and sending the settings first. If anything
 * fails or runs out of time, the worker is stopped and the call throws. A
 * document that keeps crashing Harper would otherwise restart it on every
 * pause in typing, so after a few failures in a row it stays stopped until
 * the settings change.
 */
async function run<K extends keyof HarperApi>(
  method: K,
  ...args: Parameters<HarperApi[K]>
): Promise<Awaited<ReturnType<HarperApi[K]>>> {
  const status = useHarperStore.getState()
  const { globalSettings } = useProjectStore.getState()
  if (failures >= MAX_FAILURES) {
    if (globalSettings?.copyedit === gaveUpOn) {
      throw new Error('Harper is stopped after repeated failures')
    }
    failures = 0
  }
  try {
    if (!worker) status.setStatus('loading')
    const { dialect, dictionary } = readCopyedit(globalSettings)
    await send(
      'configure',
      [
        {
          dialect: HARPER_DIALECTS[dialect],
          dictionary,
          ignored: storedIgnores(),
        },
      ],
      started ? CALL_TIMEOUT : START_TIMEOUT
    )
    started = true
    const result = await send(method, args, CALL_TIMEOUT)
    failures = 0
    if (useHarperStore.getState().status !== 'ready') status.setStatus('ready')
    return result
  } catch (error) {
    stopWorker(error instanceof Error ? error : new Error(String(error)))
    if (++failures >= MAX_FAILURES) gaveUpOn = globalSettings?.copyedit
    status.setStatus('error')
    void logError(`Astro Editor [HARPER] ${String(error)}`)
    throw error
  }
}

/** The issues Harper finds in prose from `proseText` */
export function lintProse(text: string): Promise<HarperLint[]> {
  return run('lint', text, MASK_PATTERN)
}

/** How many times the ignored issues have been cleared */
let clears = 0

/**
 * Ignores the issue `rule` found at `start`–`end` in `text` (from
 * `proseText`), in this and later checks
 */
export async function ignoreLint(
  text: string,
  rule: string,
  start: number,
  end: number
) {
  const clearsBefore = clears
  const ignored = await run('ignore', text, MASK_PATTERN, rule, start, end)
  // A clear while this was waiting has emptied the list, which this would
  // otherwise put back
  if (clears === clearsBefore) localStorage.setItem(IGNORED_KEY, ignored)
}

/**
 * Forgets every ignored issue. The stored list goes at once; the worker's
 * copy follows, and the promise settles when it has.
 */
export async function clearIgnoredLints() {
  clears++
  localStorage.removeItem(IGNORED_KEY)
  if (worker) await run('clearIgnored')
}
