/**
 * Copyedit Mode Extension
 *
 * Re-exports for backward compatibility.
 * Import from 'copyedit-mode' or 'copyedit-mode/index' should work unchanged.
 */

export {
  createCopyeditModeExtension,
  highlightDecorations,
  highlightPlugin,
  updateCopyeditModePartsOfSpeech,
  updatePosDecorations,
} from './extension'

// Export types for external use
export type {
  CompromiseDocument,
  CompromiseMatch,
  CompromiseMatches,
  CompromiseOffset,
  MatchRange,
  PosConfig,
} from './types'

// Export constants for external configuration
export { POS_CONFIGS } from './constants'

// Export pure functions for testing
export {
  buildExclusionSet,
  getMatchRanges,
  isExcludedContent,
  isRangeBeingEdited,
  isValidRange,
  processPosType,
} from './pos-matching'
