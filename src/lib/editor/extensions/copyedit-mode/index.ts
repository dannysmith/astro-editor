/**
 * Copyedit Mode Extension
 *
 * Provides parts of speech (POS) highlighting for prose editing.
 * Uses compromise.js for NLP analysis to highlight nouns, verbs,
 * adjectives, adverbs, and conjunctions with configurable colors.
 *
 * See extension.ts for implementation details, and highlights.ts for the
 * settings that turn each highlight on and off.
 */

export { createCopyeditModeExtension } from './extension'
export { POS_CONFIGS } from './constants'
export {
  readHighlights,
  setHighlight,
  toggleHighlight,
  toggleAllHighlights,
} from './highlights'
