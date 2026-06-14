// Utilities for generating URL slugs from human-readable text.

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'can',
  'do',
  'for',
  'from',
  'had',
  'has',
  'have',
  'he',
  'her',
  'here',
  'him',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'let',
  'me',
  'my',
  'no',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'she',
  'so',
  'some',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'too',
  'up',
  'us',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'which',
  'who',
  'will',
  'with',
  'would',
  'you',
  'your',
])

const TARGET_LENGTH = 50

/** Generate a URL slug from a title string.
 *
 * Strips emojis, punctuation, and common filler words, then takes enough
 * full words to land near TARGET_LENGTH characters. Falls back to the raw
 * cleaned words (without stop-word filtering) if every word is a stop word.
 * Single very long words are truncated to TARGET_LENGTH.
 */
export function slugFromTitle(title: string): string {
  // Strip emoji and non-alphanumeric (keep ASCII letters, digits, whitespace, hyphens)
  const cleaned = title
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .toLowerCase()
    .trim()

  const allWords = cleaned.split(/[\s-]+/).filter(w => w.length > 0)
  if (allWords.length === 0) return ''

  const meaningful = allWords.filter(w => !STOP_WORDS.has(w))
  // Fall back to unfiltered words if every word was a stop word.
  const words = meaningful.length > 0 ? meaningful : allWords

  if (words.length === 1) {
    return (words[0] ?? '').slice(0, TARGET_LENGTH)
  }

  const result: string[] = []
  let len = 0

  for (const word of words) {
    const added = result.length > 0 ? word.length + 1 : word.length
    if (len + added > TARGET_LENGTH && result.length > 0) break
    result.push(word)
    len += added
  }

  return result.join('-')
}
