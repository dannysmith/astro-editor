import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

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
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
