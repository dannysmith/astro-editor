import { vi } from 'vitest'

/**
 * Mock toast notifications for testing
 * Use this in tests to verify toast.error, toast.success, etc. are called
 */
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}

/**
 * Reset all toast mocks
 * Call this in beforeEach to ensure clean state between tests
 */
export function resetToastMocks() {
  mockToast.success.mockClear()
  mockToast.error.mockClear()
  mockToast.warning.mockClear()
  mockToast.info.mockClear()
}

// Mock the toast module
vi.mock('../../lib/toast', () => ({
  toast: mockToast,
}))
