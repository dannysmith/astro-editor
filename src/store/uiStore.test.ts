import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useUIStore } from './uiStore'

// Mock Tauri
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('Focus Mode Integration', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
      focusModeEnabled: false,
    })
  })

  describe('UI Store Integration', () => {
    test('toggles focus mode state correctly', () => {
      const { toggleFocusMode } = useUIStore.getState()

      // Initial state should be false
      expect(useUIStore.getState().focusModeEnabled).toBe(false)

      // Toggle on
      toggleFocusMode()
      expect(useUIStore.getState().focusModeEnabled).toBe(true)

      // Toggle off
      toggleFocusMode()
      expect(useUIStore.getState().focusModeEnabled).toBe(false)
    })
  })

  describe('State Persistence', () => {
    test('maintains state across multiple operations', () => {
      const { toggleFocusMode, toggleLeftSidebar } = useUIStore.getState()

      // Perform multiple operations
      toggleFocusMode() // Enable focus mode
      toggleLeftSidebar() // Toggle sidebar (unrelated)
      toggleLeftSidebar() // Toggle sidebar again

      // Verify focus mode is still enabled
      const state = useUIStore.getState()
      expect(state.focusModeEnabled).toBe(true)
    })
  })

  describe('Event System Integration', () => {
    test('custom events can trigger mode toggles', () => {
      // Simulate event listeners that would be in Layout component
      const handleToggleFocusMode = () => {
        useUIStore.getState().toggleFocusMode()
      }

      // Attach listener
      window.addEventListener('toggle-focus-mode', handleToggleFocusMode)

      // Initial state
      expect(useUIStore.getState().focusModeEnabled).toBe(false)

      // Trigger event
      window.dispatchEvent(new CustomEvent('toggle-focus-mode'))
      expect(useUIStore.getState().focusModeEnabled).toBe(true)

      // Cleanup
      window.removeEventListener('toggle-focus-mode', handleToggleFocusMode)
    })
  })

  describe('Store Selectors', () => {
    test('individual selectors work correctly', () => {
      // Test that individual state selectors work
      const initialState = useUIStore.getState()

      expect(initialState.focusModeEnabled).toBe(false)

      // Toggle and test again
      useUIStore.getState().toggleFocusMode()

      const newState = useUIStore.getState()
      expect(newState.focusModeEnabled).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('handles rapid toggle calls gracefully', () => {
      const { toggleFocusMode } = useUIStore.getState()

      // Rapid toggling should not cause issues
      for (let i = 0; i < 10; i++) {
        toggleFocusMode()
      }

      // Final state should be consistent (even number of toggles = false)
      const state = useUIStore.getState()
      expect(state.focusModeEnabled).toBe(false)
    })

    test('store methods are always available', () => {
      const store = useUIStore.getState()

      // All required methods should exist
      expect(typeof store.toggleFocusMode).toBe('function')
      expect(typeof store.toggleLeftSidebar).toBe('function')
      expect(typeof store.toggleRightSidebar).toBe('function')
    })
  })
})

describe('Right sidebar', () => {
  const sidebar = () => {
    const { rightSidebarVisible, rightSidebarTab } = useUIStore.getState()
    return { visible: rightSidebarVisible, tab: rightSidebarTab }
  }

  beforeEach(() => {
    useUIStore.setState({
      rightSidebarVisible: false,
      rightSidebarTab: 'frontmatter',
    })
  })

  test('toggling the sidebar keeps its tab', () => {
    useUIStore.setState({ rightSidebarTab: 'copyedit' })
    useUIStore.getState().toggleRightSidebar()
    expect(sidebar()).toEqual({ visible: true, tab: 'copyedit' })
    useUIStore.getState().toggleRightSidebar()
    expect(sidebar()).toEqual({ visible: false, tab: 'copyedit' })
  })

  test("a tab's toggle opens the closed sidebar on that tab", () => {
    useUIStore.getState().toggleRightSidebarTab('copyedit')
    expect(sidebar()).toEqual({ visible: true, tab: 'copyedit' })
  })

  test("a tab's toggle switches to it when another tab is showing", () => {
    useUIStore.setState({ rightSidebarVisible: true })
    useUIStore.getState().toggleRightSidebarTab('copyedit')
    expect(sidebar()).toEqual({ visible: true, tab: 'copyedit' })
  })

  test("a tab's toggle closes the sidebar when that tab is showing", () => {
    useUIStore.setState({ rightSidebarVisible: true })
    useUIStore.getState().toggleRightSidebarTab('frontmatter')
    expect(sidebar()).toEqual({ visible: false, tab: 'frontmatter' })
  })

  test('showing a tab never closes the sidebar', () => {
    useUIStore.setState({ rightSidebarVisible: true })
    useUIStore.getState().showRightSidebarTab('frontmatter')
    expect(sidebar()).toEqual({ visible: true, tab: 'frontmatter' })
  })
})
