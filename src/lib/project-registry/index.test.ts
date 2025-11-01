/**
 * Basic tests for the project registry system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Unmock the project-registry module for these tests
vi.unmock('.')
vi.unmock('./defaults')
vi.unmock('./persistence')
vi.unmock('./utils')

import { ProjectRegistryManager } from '.'
import { DEFAULT_PROJECT_SETTINGS } from './defaults'

// Mock Tauri invoke for testing
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('Project Registry System', () => {
  let manager: ProjectRegistryManager
  let mockInvoke: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Import the mocked invoke function
    const { invoke } = await import('@tauri-apps/api/core')
    mockInvoke = invoke as ReturnType<typeof vi.fn>

    // Create fresh manager instance for each test
    manager = new ProjectRegistryManager()
  })

  it('should initialize with default settings', async () => {
    // Mock the file system calls to return default data
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (registry)
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (global settings)

    await manager.initialize()

    const globalSettings = manager.getGlobalSettings()
    const registry = manager.getRegistry()

    // Check structure instead of exact equality
    expect(globalSettings).toBeDefined()
    expect(globalSettings.general).toBeDefined()
    expect(globalSettings.general.ideCommand).toBe('')
    expect(globalSettings.general.theme).toBe('system')
    expect(globalSettings.general.autoSaveDelay).toBe(2) // Check auto-save delay default
    expect(globalSettings.appearance).toBeDefined()
    expect(globalSettings.appearance.headingColor).toBeDefined()
    expect(globalSettings.appearance.headingColor.light).toBe('#191919') // Check heading color defaults
    expect(globalSettings.appearance.headingColor.dark).toBe('#cccccc')
    expect(globalSettings.version).toBe(2)

    expect(registry.projects).toEqual({})
    expect(registry.lastOpenedProject).toBeNull()
  })

  it('should handle project registration', async () => {
    // Initialize manager first
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (registry)
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (global settings)

    await manager.initialize()

    // Mock project discovery
    const mockProjectPath = '/Users/test/projects/test-project' // Use test-project as folder name
    const mockPackageJson = JSON.stringify({ name: 'test-project' })

    // Mock the project registration calls
    mockInvoke.mockResolvedValueOnce(mockPackageJson) // read_file_content (package.json)
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir for save
    mockInvoke.mockResolvedValueOnce(undefined) // create_directory (preferences)
    mockInvoke.mockResolvedValueOnce(undefined) // create_directory (projects)
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir for save path
    mockInvoke.mockResolvedValueOnce(undefined) // write_app_data_file (save registry)

    const projectId = await manager.registerProject(mockProjectPath)

    // The ID will be based on the path since package.json read is failing
    expect(projectId).toBeTruthy()
    expect(manager.getRegistry().projects[projectId]).toBeDefined()
    expect(manager.getRegistry().projects[projectId]?.name).toBe('test-project')
    expect(manager.getRegistry().projects[projectId]?.path).toBe(
      mockProjectPath
    )
    expect(manager.getRegistry().lastOpenedProject).toBe(projectId)
  })

  it('should provide effective settings combining global and project settings', async () => {
    // Initialize manager
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (registry)
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (global settings)

    await manager.initialize()

    // Register a project
    const mockProjectPath = '/mock/project/path'
    const mockPackageJson = JSON.stringify({ name: 'test-project' })

    mockInvoke.mockResolvedValueOnce(mockPackageJson) // read_file_content (package.json)
    mockInvoke.mockResolvedValueOnce(undefined) // write_app_data_file (save registry)

    const projectId = await manager.registerProject(mockProjectPath)

    // Mock loading project data (no project-specific settings)
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (project data)
    mockInvoke.mockResolvedValueOnce(undefined) // write_app_data_file (save project data)

    const effectiveSettings = await manager.getEffectiveSettings(projectId)

    // Should return default settings plus collections array
    expect(effectiveSettings).toEqual({
      ...DEFAULT_PROJECT_SETTINGS,
      collections: [],
    })
  })

  it('should handle project path migration', async () => {
    // Initialize manager
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (registry)
    mockInvoke.mockRejectedValueOnce(new Error('File not found')) // read_file_content (global settings)

    await manager.initialize()

    // Register a project at original path
    const originalPath = '/original/project/test-project'
    const mockPackageJson = JSON.stringify({ name: 'test-project' })

    mockInvoke.mockResolvedValueOnce(mockPackageJson) // read_file_content (package.json)
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir for save
    mockInvoke.mockResolvedValueOnce(undefined) // create_directory (preferences)
    mockInvoke.mockResolvedValueOnce(undefined) // create_directory (projects)
    mockInvoke.mockResolvedValueOnce('/mock/app/data') // get_app_data_dir for save path
    mockInvoke.mockResolvedValueOnce(undefined) // write_app_data_file (save registry)

    const originalProjectId = await manager.registerProject(originalPath)

    // Now try to register same project at new path
    const newPath = '/new/location/test-project'

    // Mock the isSameProject check - it reads package.json from new path
    mockInvoke.mockResolvedValueOnce(mockPackageJson) // read_file_content (package.json) for isSameProject check
    mockInvoke.mockResolvedValueOnce(undefined) // write_app_data_file (save registry after migration)

    const migratedProjectId = await manager.registerProject(newPath)

    // Verify migration occurred correctly
    // 1. Same project ID (not a new project)
    expect(migratedProjectId).toBe(originalProjectId)

    // 2. Path was updated
    expect(manager.getRegistry().projects[originalProjectId]?.path).toBe(
      newPath
    )

    // 3. Only one project exists in registry
    expect(Object.keys(manager.getRegistry().projects)).toHaveLength(1)

    // 4. Project name remains the same
    expect(manager.getRegistry().projects[originalProjectId]?.name).toBe(
      'test-project'
    )
  })
})
