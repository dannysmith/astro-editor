import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginAstro from 'eslint-plugin-astro'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    ignores: ['dist/', '.astro/', 'node_modules/', 'video/out/'],
  },
  // The video pipeline scripts run in Node, and pass callbacks that run in the
  // browser page to Playwright's page.evaluate().
  {
    files: ['video/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        window: 'readonly',
      },
    },
  },
]
