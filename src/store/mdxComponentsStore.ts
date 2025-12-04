import { create } from 'zustand'
import { commands, type MdxComponent } from '@/types'

interface MdxComponentsState {
  components: MdxComponent[]
  isLoading: boolean
  error: string | null
  loadComponents: (projectPath: string, mdxDirectory?: string) => Promise<void>
  clearComponents: () => void
}

export const useMdxComponentsStore = create<MdxComponentsState>(set => ({
  components: [],
  isLoading: false,
  error: null,

  loadComponents: async (projectPath: string, mdxDirectory?: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await commands.scanMdxComponents(
        projectPath,
        mdxDirectory ?? null
      )
      if (result.status === 'error') {
        throw new Error(result.error)
      }

      set({ components: result.data, isLoading: false })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load MDX components:', error)
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load MDX components',
        isLoading: false,
      })
    }
  },

  clearComponents: () => {
    set({ components: [], error: null })
  },
}))
