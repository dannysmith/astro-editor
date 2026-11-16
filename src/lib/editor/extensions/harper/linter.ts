/**
 * The one Harper linter, running in a Web Worker. harper.js and its
 * WebAssembly (about 20 MB) are only loaded when a check first runs, which is
 * when a check is switched on or, if one was left on, when a file is opened.
 *
 * harper.js's worker never reports an error: a call that fails in it never
 * settles, and every later call waits behind it. So each call here has a
 * time limit, and a call that fails or runs out of time throws the worker
 * away, so the next call starts a new one.
 */

import { error as logError, warn as logWarn } from '@tauri-apps/plugin-log'
import type { Dialect as HarperDialect, Lint, Linter } from 'harper.js'
import type { Dialect } from '@/lib/bindings'
import { useHarperStore } from '@/store/harperStore'
import { useProjectStore } from '@/store/projectStore'
import { HARPER_DIALECTS } from './checks'
import { MASK_PATTERN } from './prose'
import { readCopyedit } from './settings'

/**
 * Rules turned off for every check, as well as the `Expand…` rules, which ask
 * for abbreviations like "config" and "ctrl" to be spelled out
 */
const RULES_OFF = [
  // Masking syntax out of the text leaves runs of spaces
  'Spaces',
  'NoFrenchSpaces',
  // House style, not mistakes
  'OxfordComma',
  'UseEllipsisCharacter',
  'NumericRangeEnDash',
  'AvoidCurses',
  'Gonna',
  'Gotta',
  'Wanna',
  // Mostly wrong on blogs and docs: "file names" → "filenames", "auto-save"
  // → "autosave", "a greeting" as a mass noun, "plugin" as a phrasal verb
  'CompoundNouns',
  'DisjointPrefixes',
  'MassNouns',
  'PhrasalVerbAsCompoundNoun',
  'WrongNegative',
]

/**
 * Words every Astro project uses that Harper doesn't know. Short on purpose:
 * acronyms and names inside a sentence are never flagged (`filter.ts`), so
 * this only needs words that are lowercase or start sentences.
 */
const ASTRO_WORDS = [
  'Astro',
  "Astro's",
  'Astro’s',
  'frontmatter',
  'blockquote',
  'blockquotes',
  'Markdoc',
  'Starlight',
  'pnpm',
  'npx',
]

/**
 * Where ignored issues are kept. Harper records each as a hash of the issue
 * and the text around it, so an ignore holds in any document with the same
 * wording, and the list can't be read back as words: it can only be cleared.
 * They're cheap to lose, so localStorage is enough.
 */
const IGNORED_KEY = 'harper-ignored-issues'

/** The form Harper exports ignored issues in, which is all it will import */
const IGNORED_FORMAT = /^\{"context_hashes":\[(?:\d+(?:,\d+)*)?\]\}$/

/** How long Harper may take to start, and to answer a call, in ms */
const START_TIMEOUT = 30_000
const CALL_TIMEOUT = 15_000

interface Harper {
  linter: Linter
  /** harper.js's `Dialect` enum, from the lazily loaded module */
  dialects: typeof HarperDialect
}

let harper: Promise<Harper> | null = null

/** What the linter was last given, so settings are only sent when they change */
let applied: { dialect: Dialect; words: string | null } | null = null

const settings = () => readCopyedit(useProjectStore.getState().globalSettings)

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Harper didn't answer within ${ms} ms`)),
      ms
    )
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })
}

async function start(): Promise<Harper> {
  const [{ WorkerLinter, Dialect: dialects }, { binary }] = await Promise.all([
    import('harper.js'),
    import('harper.js/binary'),
  ])
  const { dialect } = settings()
  const linter = new WorkerLinter({
    binary,
    dialect: dialects[HARPER_DIALECTS[dialect]],
  })
  await linter.setup()
  const rules = Object.keys(await linter.getDefaultLintConfig())
  await linter.setLintConfig(
    Object.fromEntries(
      rules
        .filter(rule => rule.startsWith('Expand') || RULES_OFF.includes(rule))
        .map(rule => [rule, false])
    )
  )
  const ignored = storedIgnores()
  if (ignored) await linter.importIgnoredLints(ignored)
  applied = { dialect, words: null }
  return { linter, dialects }
}

/** The stored ignored issues. Anything Harper wouldn't import is dropped */
function storedIgnores(): string | null {
  const stored = localStorage.getItem(IGNORED_KEY)
  if (stored === null || IGNORED_FORMAT.test(stored)) return stored
  localStorage.removeItem(IGNORED_KEY)
  void logWarn('Astro Editor [HARPER] Dropped unreadable ignored issues')
  return null
}

/** Gives the linter the dialect and dictionary from the settings */
async function syncSettings({ linter, dialects }: Harper) {
  const { dialect, dictionary } = settings()
  if (dialect !== applied?.dialect) {
    await linter.setDialect(dialects[HARPER_DIALECTS[dialect]])
  }
  const words = [...ASTRO_WORDS, ...dictionary]
  if (words.join('\n') !== applied?.words) {
    await linter.clearWords()
    await linter.importWords(words)
  }
  applied = { dialect, words: words.join('\n') }
}

/** Stops the worker, so the next call starts a new one */
function reset() {
  const stopping = harper
  harper = null
  applied = null
  // harper.js's `dispose()` asks the worker to stop, which a stuck worker
  // never answers, so stop it directly
  void stopping?.then(
    ({ linter }) =>
      (linter as unknown as { worker: Worker }).worker.terminate(),
    () => undefined
  )
}

/**
 * Runs a call into Harper, starting it and applying the settings first. If
 * anything fails or runs out of time, the worker is reset and the call throws.
 */
async function run<T>(call: (linter: Linter) => Promise<T>): Promise<T> {
  const status = useHarperStore.getState()
  try {
    if (!harper) {
      status.setStatus('loading')
      harper = withTimeout(start(), START_TIMEOUT)
    }
    const current = await harper
    await withTimeout(syncSettings(current), CALL_TIMEOUT)
    const result = await withTimeout(call(current.linter), CALL_TIMEOUT)
    if (useHarperStore.getState().status !== 'ready') status.setStatus('ready')
    return result
  } catch (error) {
    reset()
    status.setStatus('error')
    void logError(`Astro Editor [HARPER] ${String(error)}`)
    throw error
  }
}

/** The issues Harper finds in prose from `proseText`, by the rule that found them */
export function lintProse(text: string): Promise<Record<string, Lint[]>> {
  return run(linter =>
    linter.organizedLints(text, {
      language: 'plaintext',
      regex_mask: MASK_PATTERN,
    })
  )
}

/** Ignores an issue Harper found in `text`, in this and later checks */
export async function ignoreLint(text: string, lint: Lint) {
  await run(async linter => {
    await linter.ignoreLint(text, lint)
    localStorage.setItem(IGNORED_KEY, await linter.exportIgnoredLints())
  })
}

/**
 * Forgets every ignored issue. The stored list goes at once; the running
 * linter's copy follows, and the promise settles when it has.
 */
export async function clearIgnoredLints() {
  localStorage.removeItem(IGNORED_KEY)
  if (harper) await run(linter => linter.clearIgnoredLints())
}
