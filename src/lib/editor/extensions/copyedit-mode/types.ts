/**
 * Type definitions for copyedit mode POS highlighting
 */

import type { Highlights } from '@/lib/bindings'

// Compromise.js type definitions
export interface CompromiseOffset {
  start: number
  length: number
}

export interface CompromiseMatch {
  text(): string
  offset?: CompromiseOffset
}

export interface CompromiseMatches {
  length: number
  forEach(callback: (match: CompromiseMatch) => void): void
}

export interface CompromiseDocument {
  match(pattern: string): CompromiseMatches
}

// POS configuration for the config-driven approach
export interface PosConfig {
  /** Compromise.js tag, e.g., '#Noun' */
  tag: string
  /** CSS class, e.g., 'cm-pos-noun' */
  className: string
  /** Its key in the `highlights` global settings, e.g. 'nouns' */
  settingKey: keyof Highlights
  /** Singular, e.g. 'Noun': the palette shows "Show Noun Highlights", the
   * Copyedit panel "Nouns" */
  name: string
  /** Tags to exclude, e.g., ['#Pronoun'] */
  exclusionTags?: string[]
}

// Match range for decoration creation
export interface MatchRange {
  from: number
  to: number
  text: string
}
