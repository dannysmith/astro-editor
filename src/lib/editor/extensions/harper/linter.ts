/**
 * The one Harper linter, running in a Web Worker. harper.js and its
 * WebAssembly (about 20 MB) are only loaded when a check is first switched
 * on, so the app pays nothing for Harper until then.
 */

import { error as logError } from '@tauri-apps/plugin-log'
import type { Lint, Linter } from 'harper.js'
import type { CopyeditSettings } from '@/lib/bindings'
import { useHarperStore } from '@/store/harperStore'
import { useProjectStore } from '@/store/projectStore'
import { HARPER_DIALECTS } from './checks'
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

async function ruleOverrides(linter: Linter) {
  const rules = Object.keys(await linter.getDefaultLintConfig())
  return Object.fromEntries(
    rules
      .filter(rule => rule.startsWith('Expand') || RULES_OFF.includes(rule))
      .map(rule => [rule, false])
  )
}

/**
 * Where ignored issues are kept. Harper records each as a hash of the issue
 * and the text around it, so an ignore holds in any document with the same
 * wording, and the list can't be read back as words: it can only be cleared.
 * They're cheap to lose, so localStorage is enough.
 */
const IGNORED_KEY = 'harper-ignored-issues'

let harper: Promise<Linter> | null = null

/** What the linter was last given, so settings are only sent when they change */
let applied: Pick<CopyeditSettings, 'dialect' | 'dictionary'> | null = null

const settings = () => readCopyedit(useProjectStore.getState().globalSettings)

async function createLinter(): Promise<Linter> {
  const [{ WorkerLinter, Dialect }, { binary }] = await Promise.all([
    import('harper.js'),
    import('harper.js/binary'),
  ])
  const { dialect, dictionary } = settings()
  const linter = new WorkerLinter({
    binary,
    dialect: Dialect[HARPER_DIALECTS[dialect]],
  })
  await linter.setup()
  await linter.setLintConfig(await ruleOverrides(linter))
  await linter.importWords([...ASTRO_WORDS, ...dictionary])
  const ignored = localStorage.getItem(IGNORED_KEY)
  if (ignored) {
    await linter.importIgnoredLints(ignored).catch((error: unknown) => {
      void logError(
        `Astro Editor [HARPER] Couldn't read ignored issues: ${String(error)}`
      )
    })
  }
  applied = { dialect, dictionary }
  return linter
}

/** Ignores an issue Harper found in `text`, here and in later checks */
export async function ignoreLint(linter: Linter, text: string, lint: Lint) {
  await linter.ignoreLint(text, lint)
  localStorage.setItem(IGNORED_KEY, await linter.exportIgnoredLints())
}

/** Forgets every ignored issue */
export async function clearIgnoredLints() {
  localStorage.removeItem(IGNORED_KEY)
  if (harper) await (await harper).clearIgnoredLints()
}

/**
 * The linter, with the dialect and dictionary from the settings applied.
 * Starts it the first time, setting Harper's status while it loads.
 */
export async function getHarper(): Promise<Linter> {
  if (!harper) {
    useHarperStore.getState().setStatus('loading')
    harper = createLinter()
    harper.then(
      () => useHarperStore.getState().setStatus('ready'),
      (error: unknown) => {
        harper = null
        useHarperStore.getState().setStatus('error')
        void logError(`Astro Editor [HARPER] Failed to start: ${String(error)}`)
      }
    )
  }
  const linter = await harper
  await applySettings(linter)
  return linter
}

async function applySettings(linter: Linter) {
  const { dialect, dictionary } = settings()
  if (!applied) return
  if (dialect !== applied.dialect) {
    const { Dialect } = await import('harper.js')
    await linter.setDialect(Dialect[HARPER_DIALECTS[dialect]])
  }
  if (dictionary.join('\n') !== applied.dictionary.join('\n')) {
    await linter.clearWords()
    await linter.importWords([...ASTRO_WORDS, ...dictionary])
  }
  applied = { dialect, dictionary }
}
