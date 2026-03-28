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
            { id: 'mac', label: 'macOS', default: true },
            { id: 'windows', label: 'Windows' },
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
            { slug: 'getting-started/concepts' },
            { slug: 'getting-started/example' },
            { slug: 'getting-started/installation' },
            { slug: 'getting-started/opening-a-project' },
          ],
        },
        {
          slug: 'philosophy',
        },
        {
          label: 'The Editor',
          items: [
            { slug: 'editor/overview' },
            { slug: 'editor/focus-mode' },
            { slug: 'editor/typewriter-mode' },
            { slug: 'editor/copyedit-modes' },
            { slug: 'editor/auto-saving' },
          ],
        },
        {
          label: 'Editing Features',
          items: [
            { slug: 'editing/overview' },
            { slug: 'editing/links' },
            { slug: 'editing/content-linker' },
            { slug: 'editing/images-and-files' },
            { slug: 'editing/mdx-components' },
          ],
        },
        {
          label: 'File Management',
          items: [
            { slug: 'file-management/overview' },
            { slug: 'file-management/drafts' },
            { slug: 'file-management/filtering-and-sorting' },
            { slug: 'file-management/ide-integration' },
            { slug: 'file-management/creating-files' },
          ],
        },
        {
          label: 'Frontmatter & Schemas',
          items: [
            { slug: 'frontmatter/overview' },
            { slug: 'frontmatter/basic-fields' },
            { slug: 'frontmatter/image-fields' },
            { slug: 'frontmatter/reference-fields' },
            { slug: 'frontmatter/special-fields' },
            { slug: 'frontmatter/required-fields' },
            { slug: 'frontmatter/examples' },
          ],
        },
        {
          label: 'Preferences',
          items: [
            { slug: 'preferences/general' },
            { slug: 'preferences/project' },
            { slug: 'preferences/collections' },
            { slug: 'preferences/advanced' },
          ],
        },
        { slug: 'command-palette' },
        { slug: 'troubleshooting' },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { slug: 'reference/keyboard-shortcuts' },
            { slug: 'reference/special-fields' },
            { slug: 'reference/overrides' },
            { slug: 'reference/advanced-preferences' },
            { slug: 'reference/yaml' },
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
