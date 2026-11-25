import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'

/**
 * Languages for fenced code blocks, matched against the fence's info string
 * (```js, ```tsx…). Each loads lazily the first time a block uses it.
 * language-data has no Astro or Svelte grammar. Astro gets TSX, which covers
 * its frontmatter script and its `{expressions}`; Svelte gets HTML.
 */
export const codeLanguages = [
  ...languages,
  LanguageDescription.of({
    name: 'Astro',
    alias: ['astro'],
    load: () =>
      import('@codemirror/lang-javascript').then(m =>
        m.javascript({ jsx: true, typescript: true })
      ),
  }),
  LanguageDescription.of({
    name: 'Svelte',
    alias: ['svelte'],
    load: () => import('@codemirror/lang-html').then(m => m.html()),
  }),
  LanguageDescription.of({
    name: 'MDX',
    alias: ['mdx'],
    load: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  }),
]
