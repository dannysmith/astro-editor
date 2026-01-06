import { create } from 'zustand'

interface UIState {
  // Layout state
  sidebarVisible: boolean
  frontmatterPanelVisible: boolean
  focusModeEnabled: boolean
  distractionFreeBarsHidden: boolean

  // View filters (per-collection state, ephemeral)
  draftFilterByCollection: Record<string, boolean>

  // Actions
  toggleSidebar: () => void
  toggleFrontmatterPanel: () => void
  toggleFocusMode: () => void
  setDistractionFreeBarsHidden: (hidden: boolean) => void
  handleTypingInEditor: () => void
  showBars: () => void
  toggleDraftFilter: (collectionName: string) => void
  setSquareCorners: (enabled: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  sidebarVisible: true,
  frontmatterPanelVisible: true,
  focusModeEnabled: false,
  distractionFreeBarsHidden: false,
  draftFilterByCollection: {},

  // Actions
  toggleSidebar: () => {
    set(state => ({
      sidebarVisible: !state.sidebarVisible,
      // Show bars when opening sidebar
      distractionFreeBarsHidden: false,
    }))
  },

  toggleFrontmatterPanel: () => {
    set(state => ({
      frontmatterPanelVisible: !state.frontmatterPanelVisible,
      // Show bars when opening frontmatter panel
      distractionFreeBarsHidden: false,
    }))
  },

  toggleFocusMode: () => {
    set(state => ({ focusModeEnabled: !state.focusModeEnabled }))
  },

  setDistractionFreeBarsHidden: (hidden: boolean) => {
    set({ distractionFreeBarsHidden: hidden })
  },

  showBars: () => {
    set({ distractionFreeBarsHidden: false })
  },

  handleTypingInEditor: () => {
    const { sidebarVisible, frontmatterPanelVisible } = get()
    // Immediately hide bars if both panels are hidden
    if (!sidebarVisible && !frontmatterPanelVisible) {
      set({ distractionFreeBarsHidden: true })
    }
  },

  toggleDraftFilter: (collectionName: string) => {
    set(state => ({
      draftFilterByCollection: {
        ...state.draftFilterByCollection,
        [collectionName]: !state.draftFilterByCollection[collectionName],
      },
    }))
  },

  setSquareCorners: (enabled: boolean) => {
    document.documentElement.classList.toggle('square-corners', enabled)
  },
}))

// Components can use direct selectors like:
// const sidebarVisible = useUIStore(state => state.sidebarVisible)
