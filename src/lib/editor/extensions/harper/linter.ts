/**
 * The one Harper linter, running in a Web Worker. harper.js and its
 * WebAssembly (about 20 MB) are only loaded when a check is first switched
 * on, so the app pays nothing for Harper until then.
 */

import { error as logError } from '@tauri-apps/plugin-log'
import type { Linter } from 'harper.js'
import { useHarperStore } from '@/store/harperStore'

/**
 * Rules turned off for every check. Masking syntax out of the text leaves
 * runs of spaces, which these would flag.
 */
const RULE_OVERRIDES = {
  Spaces: false,
  NoFrenchSpaces: false,
}

let harper: Promise<Linter> | null = null

/** What the linter was last given, so settings are only sent when they change */
let applied: { dialect: string; words: string[] } | null = null

async function createLinter(): Promise<Linter> {
  const [{ WorkerLinter, Dialect }, { binary }] = await Promise.all([
    import('harper.js'),
    import('harper.js/binary'),
  ])
  const { dialect, words } = useHarperStore.getState()
  const linter = new WorkerLinter({ binary, dialect: Dialect[dialect] })
  await linter.setup()
  await linter.setLintConfig(RULE_OVERRIDES)
  if (words.length > 0) await linter.importWords(words)
  applied = { dialect, words }
  return linter
}

/**
 * The linter, with the store's dialect and dictionary applied. Starts it the
 * first time, setting the store's status while it loads.
 */
export async function getHarper(): Promise<Linter> {
  const store = useHarperStore.getState()
  if (!harper) {
    store.setStatus('loading')
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
  const { dialect, words } = useHarperStore.getState()
  if (!applied) return
  if (dialect !== applied.dialect) {
    const { Dialect } = await import('harper.js')
    await linter.setDialect(Dialect[dialect])
  }
  if (words !== applied.words) {
    await linter.clearWords()
    await linter.importWords(words)
  }
  applied = { dialect, words }
}
