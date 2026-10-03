import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      exclude: [
        'test/dummy-astro-project/**',
        'temp-dummy-astro-project/**',
        'node_modules/**',
        'dist/**',
        'src-tauri/**',
        '**/*.config.{js,ts}',
        '**/test/**',
        '**/*.test.{js,ts,jsx,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
