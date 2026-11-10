import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock Tauri API calls for testing
const mockInvoke = vi.fn()
const mockListen = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}))

// plugin-log is loaded outside Vitest's module graph, so the invoke mock above
// doesn't reach it and its real invoke throws. Mocking it here lets app code
// import it directly
vi.mock('@tauri-apps/plugin-log', () => ({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

// Make mocks available globally for tests
globalThis.mockTauri = {
  invoke: mockInvoke,
  listen: mockListen,
  reset: () => {
    mockInvoke.mockReset()
    mockListen.mockReset()
  },
}
