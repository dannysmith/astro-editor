import '@testing-library/jest-dom'
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

// Mock localStorage if it doesn't exist or is invalid (e.g. in some jsdom environments)
if (
  typeof localStorage === 'undefined' ||
  typeof localStorage.getItem !== 'function'
) {
  const mockStorage: Record<string, string> = {}
  const storageMock = {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: { toString(): string }) => {
      mockStorage[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key]
    }),
    clear: vi.fn(() => {
      Object.keys(mockStorage).forEach(key => delete mockStorage[key])
    }),
    key: vi.fn((index: number) => Object.keys(mockStorage)[index] || null),
    length: 0,
  }

  // Keep length in sync
  Object.defineProperty(storageMock, 'length', {
    get: () => Object.keys(mockStorage).length,
  })

  globalThis.localStorage = storageMock as unknown as Storage
}

// Mock project registry manager for testing
const mockProjectRegistryManager = {
  init: vi.fn().mockResolvedValue(undefined),
  initialize: vi.fn().mockResolvedValue(undefined),
  registerProject: vi.fn().mockImplementation((path: string) => {
    // Return path as project ID for tests
    return Promise.resolve(path.replace(/[/\\]/g, '-').replace(/^-/, ''))
  }),
  getEffectiveSettings: vi.fn().mockResolvedValue({
    pathOverrides: {
      contentDirectory: 'src/content/',
      assetsDirectory: 'src/assets/',
      mdxComponentsDirectory: 'src/components/mdx/',
    },
    frontmatterMappings: {
      title: 'title',
      description: 'description',
      publishedDate: 'date',
      draft: 'draft',
    },
  }),
  updateGlobalSettings: vi.fn().mockResolvedValue(undefined),
  updateProjectSettings: vi.fn().mockResolvedValue(undefined),
  getLastOpenedProjectId: vi.fn().mockReturnValue(null),
  getProjectData: vi.fn().mockResolvedValue(null),
  getGlobalSettings: vi.fn().mockReturnValue({
    general: { ideCommand: '' },
  }),
  getRegistry: vi.fn().mockReturnValue({
    projects: {},
    lastOpenedProject: null,
  }),
}

vi.mock('../lib/project-registry', () => ({
  projectRegistryManager: mockProjectRegistryManager,
  ProjectRegistryManager: vi
    .fn()
    .mockImplementation(() => mockProjectRegistryManager),
  GlobalSettings: {},
  ProjectSettings: {},
}))

// Make mocks available globally for tests
globalThis.mockTauri = {
  invoke: mockInvoke,
  listen: mockListen,
  reset: () => {
    mockInvoke.mockReset()
    mockListen.mockReset()
    // Reset project registry mocks
    mockProjectRegistryManager.init.mockClear()
    mockProjectRegistryManager.initialize.mockClear()
    mockProjectRegistryManager.registerProject.mockClear()
    mockProjectRegistryManager.getEffectiveSettings.mockClear()
    mockProjectRegistryManager.updateGlobalSettings.mockClear()
    mockProjectRegistryManager.updateProjectSettings.mockClear()
    mockProjectRegistryManager.getLastOpenedProjectId.mockClear()
    mockProjectRegistryManager.getProjectData.mockClear()
    mockProjectRegistryManager.getGlobalSettings.mockClear()
    mockProjectRegistryManager.getRegistry.mockClear()
  },
}
