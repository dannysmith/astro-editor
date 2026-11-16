/**
 * Harper's settings, read and written for the Copyedit panel and preferences.
 * They're global settings, so they survive restarts; the extension follows
 * them (see extension.ts).
 */

import type { CopyeditSettings, Dialect, GlobalSettings } from '@/lib/bindings'
import { useProjectStore } from '@/store/projectStore'
import type { HarperCheck } from './checks'

/** Harper's settings. Every check is off until the settings have loaded */
export function readCopyedit(
  settings: GlobalSettings | null
): CopyeditSettings {
  const copyedit = settings?.copyedit
  return {
    dialect: copyedit?.dialect ?? 'american',
    checks: {
      spelling: copyedit?.checks.spelling ?? false,
      grammar: copyedit?.checks.grammar ?? false,
      style: copyedit?.checks.style ?? false,
    },
    dictionary: copyedit?.dictionary ?? [],
  }
}

/** Harper's settings now, for code outside React */
export function currentCopyedit(): CopyeditSettings {
  return readCopyedit(useProjectStore.getState().globalSettings)
}

function save(copyedit: Partial<CopyeditSettings>) {
  void useProjectStore.getState().updateGlobalSettings({ copyedit })
}

export function setCheck(check: HarperCheck, on: boolean) {
  save({ checks: { ...currentCopyedit().checks, [check]: on } })
}

export function setDialect(dialect: Dialect) {
  save({ dialect })
}

/** Adds a word to the dictionary, unless it's already there */
export function addWord(word: string) {
  const { dictionary } = currentCopyedit()
  if (!dictionary.includes(word)) save({ dictionary: [...dictionary, word] })
}

export function setDictionary(words: string[]) {
  save({ dictionary: words })
}
