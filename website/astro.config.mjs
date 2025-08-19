// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

import starlightLinksValidator from 'starlight-links-validator'
import starlightLlmsTxt from 'starlight-llms-txt'
import starlightImageZoom from 'starlight-image-zoom'
import starlightKbd from 'starlight-kbd'
import starlightGitHubAlerts from 'starlight-github-alerts'
import starlightChangelogs, {
  makeChangelogsSidebarLinks,
} from 'starlight-changelogs'

// https://astro.build/config
export default defineConfig({
  site: 'https://astroeditor.danny.is',
  integrations: [
    starlight({
      title: 'Astro Editor',
      logo: {
        src: './public/icon.png',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/dannysmith/astro-editor',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Sidebar',
          autogenerate: { directory: 'sidebar' },
        },
        {
          label: 'Recent versions',
          items: [
            ...makeChangelogsSidebarLinks([
              {
                type: 'recent',
                base: 'changelog',
                count: 7,
              },
            ]),
          ],
        },
      ],
      plugins: [
        starlightLinksValidator(),
        starlightLlmsTxt(),
        starlightImageZoom(),
        starlightGitHubAlerts(),
        starlightKbd({
          types: [{ id: 'mac', label: 'macOS', default: true }],
          globalPicker: false,
        }),
        starlightChangelogs(),
      ],
    }),
  ],
})
