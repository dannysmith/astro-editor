/**
 * The part-of-speech highlight settings, read and written for the Copyedit
 * panel and the palette commands. They're global settings, so they survive
 * restarts; the extension follows them (see extension.ts).
 */

import type { GlobalSettings, Highlights } from '@/lib/bindings'
import { useProjectStore } from '@/store/projectStore'

/** The highlights that are on. All are off until the settings have loaded */
export function readHighlights(settings: GlobalSettings | null): Highlights {
  const highlights = settings?.general?.highlights
  return {
    nouns: highlights?.nouns ?? false,
    verbs: highlights?.verbs ?? false,
    adjectives: highlights?.adjectives ?? false,
    adverbs: highlights?.adverbs ?? false,
    conjunctions: highlights?.conjunctions ?? false,
  }
}

function saveHighlights(highlights: Highlights) {
  void useProjectStore
    .getState()
    .updateGlobalSettings({ general: { highlights } })
}

export function setHighlight(key: keyof Highlights, on: boolean) {
  const current = readHighlights(useProjectStore.getState().globalSettings)
  saveHighlights({ ...current, [key]: on })
}

export function toggleHighlight(key: keyof Highlights) {
  const current = readHighlights(useProjectStore.getState().globalSettings)
  setHighlight(key, !current[key])
}

/** Turns every highlight off if any is on, otherwise turns them all on */
export function toggleAllHighlights() {
  const current = readHighlights(useProjectStore.getState().globalSettings)
  const on = !Object.values(current).some(Boolean)
  saveHighlights({
    nouns: on,
    verbs: on,
    adjectives: on,
    adverbs: on,
    conjunctions: on,
  })
}
