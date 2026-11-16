/**
 * The one Harper linter, running in a Web Worker. harper.js and its
 * WebAssembly (about 20 MB) are only loaded when a check is first switched
 * on, so the app pays nothing for Harper until then.
 */

import { error as logError } from '@tauri-apps/plugin-log'
import type { Linter } from 'harper.js'
import type { CopyeditSettings } from '@/lib/bindings'
import { useHarperStore } from '@/store/harperStore'
import { useProjectStore } from '@/store/projectStore'
import { HARPER_DIALECTS } from './checks'
import { readCopyedit } from './settings'

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
  await linter.setLintConfig(RULE_OVERRIDES)
  if (dictionary.length > 0) await linter.importWords(dictionary)
  applied = { dialect, dictionary }
  return linter
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
    await linter.importWords(dictionary)
  }
  applied = { dialect, dictionary }
}
