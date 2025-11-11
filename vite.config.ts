import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', { target: '19' }]
        ],
      },
    }),
    tailwindcss(),
    visualizer({
      template: 'treemap', // or 'sunburst'
      open: true,
      filename: 'bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Build optimizations
  build: {
    sourcemap: false,  // Disable source maps in production
    minify: 'terser',  // Use terser for minification
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console logs in production
        drop_debugger: true  // Remove debugger statements
      }
    }
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri` and test data
      ignored: [
        '**/src-tauri/**',
        '**/test/dummy-astro-project/**',
        '**/temp-dummy-astro-project/**',
      ],
    },
  },
}))
