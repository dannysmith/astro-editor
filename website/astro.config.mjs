// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightThemeFlexoki from 'starlight-theme-flexoki'
import starlightLlmsTxt from 'starlight-llms-txt'
import starlightKbd from 'starlight-kbd'

// https://astro.build/config
export default defineConfig({
  site: 'https://astroeditor.danny.is',
  integrations: [
    starlight({
      plugins: [
        starlightThemeFlexoki({ accentColor: 'blue' }),
        starlightLlmsTxt(),
        starlightKbd({
          types: [
            { id: 'mac', label: 'macOS', detector: 'apple', default: true },
            { id: 'windows', label: 'Windows', detector: 'windows' },
            { id: 'linux', label: 'Linux', detector: 'linux' },
          ],
        }),
      ],
      title: 'Astro Editor',
      description: 'Schema-aware markdown editor for Astro content collections',
      components: {
        Footer: './src/components/Footer.astro',
      },
      logo: {
        src: './src/assets/icon.png',
        alt: 'Astro Editor Logo',
      },
      favicon: '/favicon.png',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/dannysmith/astro-editor',
        },
      ],
      head: [
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
        {
          tag: 'meta',
          attrs: { property: 'og:site_name', content: 'Astro Editor' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'script',
          attrs: {
            async: true,
            src: 'https://scripts.simpleanalyticscdn.com/latest.js',
          },
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { slug: 'getting-started' },
            { slug: 'getting-started/installation' },
            { slug: 'getting-started/philosophy' },
            { slug: 'getting-started/introduction' },
          ],
        },
        {
          label: 'The Editor',
          items: [
            { slug: 'editor/overview' },
            { slug: 'editor/markdown-formatting' },
            { slug: 'editor/links' },
            { slug: 'editor/images-and-files' },
            { slug: 'editor/mdx-components' },
            { slug: 'editor/focus-and-typewriter' },
            { slug: 'editor/copyedit-modes' },
          ],
        },
        {
          label: 'File Management',
          items: [
            { slug: 'file-management/overview' },
            { slug: 'file-management/drafts-filtering-and-sorting' },
            { slug: 'file-management/ide-integration' },
          ],
        },
        {
          label: 'Frontmatter & Schemas',
          items: [
            { slug: 'frontmatter/overview' },
            { slug: 'frontmatter/field-types' },
            { slug: 'frontmatter/special-fields' },
          ],
        },
        { slug: 'preferences' },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { slug: 'reference/keyboard-shortcuts' },
            { slug: 'reference/commands' },
            { slug: 'reference/overrides' },
            { slug: 'reference/url-scheme' },
            { slug: 'reference/advanced-preferences' },
            { slug: 'reference/yaml' },
            { slug: 'reference/troubleshooting' },
          ],
        },
        {
          label: 'Releases',
          link: '/releases/',
        },
      ],
    }),
  ],
})
