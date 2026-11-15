import { create } from 'zustand'
import type { RightSidebarTab } from '../lib/right-sidebar'

export interface CollectionViewState {
  sortMode: string // 'default' | 'title' | 'filename' | 'date-{field}' | 'order' | 'modified'
  sortDirection: 'asc' | 'desc'
  searchQuery: string
  filterBarExpanded: boolean
}

interface UIState {
  // Layout state
  leftSidebarVisible: boolean
  rightSidebarVisible: boolean
  /** The tab the right sidebar shows, kept while the sidebar is closed */
  rightSidebarTab: RightSidebarTab
  focusModeEnabled: boolean
  typewriterModeEnabled: boolean
  distractionFreeBarsHidden: boolean
  projectListOpen: boolean
  projectSettingsOpen: boolean
  /** The project settings page shown: a collection's name, or null for the project */
  projectSettingsPage: string | null

  // View filters (per-collection state, ephemeral)
  draftFilterByCollection: Record<string, boolean>
  collectionViewState: Record<string, CollectionViewState>

  // Actions
  setLeftSidebarVisible: (visible: boolean) => void
  setRightSidebarVisible: (visible: boolean) => void
  toggleLeftSidebar: () => void
  /** Opens or closes the right sidebar, keeping its tab (the title bar button) */
  toggleRightSidebar: () => void
  /** Opens the right sidebar on a tab; never closes it (for code that reveals a panel) */
  showRightSidebarTab: (tab: RightSidebarTab) => void
  /**
   * Closes the right sidebar if it's open on `tab`, otherwise opens it on
   * `tab` (the Cmd+<digit> shortcuts and their menu items)
   */
  toggleRightSidebarTab: (tab: RightSidebarTab) => void
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  setDistractionFreeBarsHidden: (hidden: boolean) => void
  setProjectListOpen: (open: boolean) => void
  /** Opens the project settings at a page (see `projectSettingsPage`), or closes them */
  setProjectSettingsOpen: (open: boolean, page?: string | null) => void
  setProjectSettingsPage: (page: string | null) => void
  handleTypingInEditor: () => void
  showBars: () => void
  toggleDraftFilter: (collectionName: string) => void
  setSquareCorners: (enabled: boolean) => void

  // Collection view state actions
  getCollectionViewState: (collectionName: string) => CollectionViewState
  setSortMode: (
    collectionName: string,
    mode: string,
    direction: 'asc' | 'desc'
  ) => void
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
  leftSidebarVisible: true,
  rightSidebarVisible: true,
  rightSidebarTab: 'frontmatter',
  focusModeEnabled: false,
  typewriterModeEnabled: false,
  distractionFreeBarsHidden: false,
  projectListOpen: false,
  projectSettingsOpen: false,
  projectSettingsPage: null,
  draftFilterByCollection: {},
  collectionViewState: {},

  // Actions
  setLeftSidebarVisible: (visible: boolean) => {
    set({ leftSidebarVisible: visible })
  },

  setRightSidebarVisible: (visible: boolean) => {
    set({ rightSidebarVisible: visible })
  },

  // Toggling either sidebar shows the bars distraction-free mode hid

  toggleLeftSidebar: () => {
    set(state => ({
      leftSidebarVisible: !state.leftSidebarVisible,
      distractionFreeBarsHidden: false,
    }))
  },

  toggleRightSidebar: () => {
    set(state => ({
      rightSidebarVisible: !state.rightSidebarVisible,
      distractionFreeBarsHidden: false,
    }))
  },

  showRightSidebarTab: (tab: RightSidebarTab) => {
    set({
      rightSidebarVisible: true,
      rightSidebarTab: tab,
      distractionFreeBarsHidden: false,
    })
  },

  toggleRightSidebarTab: (tab: RightSidebarTab) => {
    const { rightSidebarVisible, rightSidebarTab } = get()
    if (rightSidebarVisible && rightSidebarTab === tab) {
      get().toggleRightSidebar()
    } else {
      get().showRightSidebarTab(tab)
    }
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

  setProjectListOpen: (open: boolean) => {
    // Opening shows the bars distraction-free mode hid
    set(
      open
        ? { projectListOpen: true, distractionFreeBarsHidden: false }
        : { projectListOpen: false }
    )
  },

  setProjectSettingsOpen: (open: boolean, page: string | null = null) => {
    set(
      open
        ? {
            projectSettingsOpen: true,
            projectSettingsPage: page,
            distractionFreeBarsHidden: false,
          }
        : { projectSettingsOpen: false }
    )
  },

  setProjectSettingsPage: (page: string | null) => {
    set({ projectSettingsPage: page })
  },

  handleTypingInEditor: () => {
    const { leftSidebarVisible, rightSidebarVisible } = get()
    // Immediately hide bars if both sidebars are hidden
    if (!leftSidebarVisible && !rightSidebarVisible) {
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

  setSortMode: (
    collectionName: string,
    mode: string,
    direction: 'asc' | 'desc'
  ) => {
    set(state => ({
      collectionViewState: {
        ...state.collectionViewState,
        [collectionName]: {
          ...DEFAULT_VIEW_STATE,
          ...state.collectionViewState[collectionName],
          sortMode: mode,
          sortDirection: direction,
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
// const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)
