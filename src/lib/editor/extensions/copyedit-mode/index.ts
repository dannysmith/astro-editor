/**
 * Copyedit Mode Extension
 *
 * Provides parts of speech (POS) highlighting for prose editing.
 * Uses compromise.js for NLP analysis to highlight nouns, verbs,
 * adjectives, adverbs, and conjunctions with configurable colors.
 *
 * See extension.ts for implementation details.
 */

export {
  createCopyeditModeExtension,
  updateCopyeditModePartsOfSpeech,
} from './extension'
