import { create } from 'zustand'
import { commands } from '@/lib/bindings'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { toast } from '../lib/toast'

interface PreviewState {
  isStarting: boolean
  isRunning: boolean
  url: string | null
  logs: string[]

  // Event listener cleanup functions
  _unlistenUrl: UnlistenFn | null
  _unlistenStdout: UnlistenFn | null
  _unlistenStderr: UnlistenFn | null

  // Actions
  startPreview: (projectPath: string) => Promise<void>
  stopPreview: () => Promise<void>
  clearLogs: () => void
  init: () => Promise<void>
  cleanup: () => void
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  isStarting: false,
  isRunning: false,
  url: null,
  logs: [],
  _unlistenUrl: null,
  _unlistenStdout: null,
  _unlistenStderr: null,

  startPreview: async (projectPath: string) => {
    set({ isStarting: true, logs: [], url: null })
    try {
      const result = await commands.startPreview(projectPath)
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      set({ isRunning: true, isStarting: false })
      toast.info('Preview starting...', {
        description: 'pnpm dev is running in the background',
      })
    } catch (error) {
      set({ isStarting: false, isRunning: false })
      toast.error('Failed to start preview', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  },

  stopPreview: async () => {
    try {
      await commands.stopPreview()
      set({ isRunning: false, url: null, isStarting: false })
      toast.info('Preview stopped')
    } catch (error) {
      toast.error('Failed to stop preview', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  },

  clearLogs: () => {
    set({ logs: [] })
  },

  init: async () => {
    // Clean up existing listeners if any
    get().cleanup()

    const unlistenUrl = await listen<string>('preview-url', event => {
      set({ url: event.payload })
      toast.success('Preview ready!', {
        description: `Server running at ${event.payload}`,
      })
    })

    const unlistenStdout = await listen<string>('preview-stdout', event => {
      set(state => ({
        logs: [...state.logs.slice(-99), event.payload],
      }))
    })

    const unlistenStderr = await listen<string>('preview-stderr', event => {
      set(state => ({
        logs: [...state.logs.slice(-99), `ERR: ${event.payload}`],
      }))
    })

    set({
      _unlistenUrl: unlistenUrl,
      _unlistenStdout: unlistenStdout,
      _unlistenStderr: unlistenStderr,
    })

    // Check initial state
    const running = await commands.isPreviewRunning()
    if (running.status === 'ok') {
      set({ isRunning: running.data })
    }
  },

  cleanup: () => {
    const { _unlistenUrl, _unlistenStdout, _unlistenStderr } = get()
    if (_unlistenUrl) _unlistenUrl()
    if (_unlistenStdout) _unlistenStdout()
    if (_unlistenStderr) _unlistenStderr()

    set({
      _unlistenUrl: null,
      _unlistenStdout: null,
      _unlistenStderr: null,
    })
  },
}))
