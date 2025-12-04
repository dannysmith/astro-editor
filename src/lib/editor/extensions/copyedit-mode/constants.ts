import type { PosConfig } from './types'

/**
 * Configuration for all parts of speech types.
 * Adding a new POS type is as simple as adding a new entry here.
 */
export const POS_CONFIGS: PosConfig[] = [
  {
    tag: '#Noun',
    className: 'cm-pos-noun',
    settingKey: 'nouns',
    exclusionTags: ['#Pronoun'],
  },
  {
    tag: '#Verb',
    className: 'cm-pos-verb',
    settingKey: 'verbs',
    exclusionTags: ['#Auxiliary', '#Modal'],
  },
  {
    tag: '#Adjective',
    className: 'cm-pos-adjective',
    settingKey: 'adjectives',
  },
  {
    tag: '#Adverb',
    className: 'cm-pos-adverb',
    settingKey: 'adverbs',
  },
  {
    tag: '#Conjunction',
    className: 'cm-pos-conjunction',
    settingKey: 'conjunctions',
  },
]
