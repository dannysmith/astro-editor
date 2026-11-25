import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'

export default defineConfig({
  integrations: [mdx()],
  // For astro-loader-i18n, which reads the locales from here
  i18n: { locales: ['en', 'de'], defaultLocale: 'en' },
})
