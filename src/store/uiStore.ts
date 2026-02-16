import { create } from 'zustand'

export interface CollectionViewState {
  sortMode: string // 'default' | 'title' | 'filename' | 'date-{field}' | 'order' | 'modified'
  sortDirection: 'asc' | 'desc'
  searchQuery: string
  filterBarExpanded: boolean
}

interface UIState {
  // Layout state
  sidebarVisible: boolean
  frontmatterPanelVisible: boolean
  focusModeEnabled: boolean
  typewriterModeEnabled: boolean
  distractionFreeBarsHidden: boolean

  // View filters (per-collection state, ephemeral)
  draftFilterByCollection: Record<string, boolean>
  collectionViewState: Record<string, CollectionViewState>

  // Actions
  setSidebarVisible: (visible: boolean) => void
  setFrontmatterPanelVisible: (visible: boolean) => void
  toggleSidebar: () => void
  toggleFrontmatterPanel: () => void
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  setDistractionFreeBarsHidden: (hidden: boolean) => void
  handleTypingInEditor: () => void
  showBars: () => void
  toggleDraftFilter: (collectionName: string) => void
  setSquareCorners: (enabled: boolean) => void

  // Collection view state actions
  getCollectionViewState: (collectionName: string) => CollectionViewState
  setSortMode: (collectionName: string, mode: string) => void
  setSortDirection: (collectionName: string, direction: 'asc' | 'desc') => void
  toggleSortDirection: (collectionName: string) => void
  setSearchQuery: (collectionName: string, query: string) => void
  setFilterBarExpanded: (collectionName: string, expanded: boolean) => void
  toggleFilterBar: (collectionName: string) => void
  hasActiveFilters: (collectionName: string) => boolean
}

const DEFAULT_VIEW_STATE: CollectionViewState = {
  sortMode: 'default',
  sortDirection: 'desc',
  searchQuery: '',
  filterBarExpanded: false,
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  sidebarVisible: true,
  frontmatterPanelVisible: true,
  focusModeEnabled: false,
  typewriterModeEnabled: false,
  distractionFreeBarsHidden: false,
  draftFilterByCollection: {},
  collectionViewState: {},

  // Actions
  setSidebarVisible: (visible: boolean) => {
    set({ sidebarVisible: visible })
  },

  setFrontmatterPanelVisible: (visible: boolean) => {
    set({ frontmatterPanelVisible: visible })
  },

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

  toggleTypewriterMode: () => {
    set(state => ({ typewriterModeEnabled: !state.typewriterModeEnabled }))
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

  // Collection view state actions
  getCollectionViewState: (collectionName: string) => {
    return get().collectionViewState[collectionName] || DEFAULT_VIEW_STATE
  },

  setSortMode: (collectionName: string, mode: string) => {
    set(state => ({
      collectionViewState: {
        ...state.collectionViewState,
        [collectionName]: {
          ...DEFAULT_VIEW_STATE,
          ...state.collectionViewState[collectionName],
          sortMode: mode,
        },
      },
    }))
  },

  setSortDirection: (collectionName: string, direction: 'asc' | 'desc') => {
    set(state => ({
      collectionViewState: {
        ...state.collectionViewState,
        [collectionName]: {
          ...DEFAULT_VIEW_STATE,
          ...state.collectionViewState[collectionName],
          sortDirection: direction,
        },
      },
    }))
  },

  toggleSortDirection: (collectionName: string) => {
    const current = get().getCollectionViewState(collectionName)
    get().setSortDirection(
      collectionName,
      current.sortDirection === 'asc' ? 'desc' : 'asc'
    )
  },

  setSearchQuery: (collectionName: string, query: string) => {
    set(state => ({
      collectionViewState: {
        ...state.collectionViewState,
        [collectionName]: {
          ...DEFAULT_VIEW_STATE,
          ...state.collectionViewState[collectionName],
          searchQuery: query,
        },
      },
    }))
  },

  setFilterBarExpanded: (collectionName: string, expanded: boolean) => {
    set(state => ({
      collectionViewState: {
        ...state.collectionViewState,
        [collectionName]: {
          ...DEFAULT_VIEW_STATE,
          ...state.collectionViewState[collectionName],
          filterBarExpanded: expanded,
        },
      },
    }))
  },

  toggleFilterBar: (collectionName: string) => {
    const current = get().getCollectionViewState(collectionName)
    get().setFilterBarExpanded(collectionName, !current.filterBarExpanded)
  },

  hasActiveFilters: (collectionName: string) => {
    const viewState = get().getCollectionViewState(collectionName)
    const showDraftsOnly =
      get().draftFilterByCollection[collectionName] || false
    return (
      viewState.searchQuery.trim() !== '' ||
      viewState.sortMode !== 'default' ||
      showDraftsOnly
    )
  },
}))

// Components can use direct selectors like:
// const sidebarVisible = useUIStore(state => state.sidebarVisible)
