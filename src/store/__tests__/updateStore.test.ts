import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUpdateStore } from '../updateStore'
import type { Update } from '@tauri-apps/plugin-updater'

const SKIPPED_VERSION_KEY = 'astro-editor-skipped-update-version'

const mockUpdate = {} as Update

function resetStore() {
  useUpdateStore.setState({
    dialogOpen: false,
    dialogMode: 'checking',
    version: null,
    currentVersion: null,
    errorMessage: null,
    updateRef: null,
    releaseNotes: null,
    releaseNotesLoading: false,
    releaseNotesError: false,
    downloadProgress: 0,
    downloadTotal: null,
    skippedVersion: null,
  })
}

describe('updateStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  describe('setChecking', () => {
    it('opens dialog in checking mode', () => {
      useUpdateStore.getState().setChecking()
      const state = useUpdateStore.getState()
      expect(state.dialogOpen).toBe(true)
      expect(state.dialogMode).toBe('checking')
    })

    it('clears previous error', () => {
      useUpdateStore.setState({ errorMessage: 'old error' })
      useUpdateStore.getState().setChecking()
      expect(useUpdateStore.getState().errorMessage).toBeNull()
    })
  })

  describe('setAvailable', () => {
    it('sets update info and opens dialog', () => {
      useUpdateStore.getState().setAvailable(mockUpdate, '1.0.9', '1.0.8')
      const state = useUpdateStore.getState()
      expect(state.dialogOpen).toBe(true)
      expect(state.dialogMode).toBe('available')
      expect(state.version).toBe('1.0.9')
      expect(state.currentVersion).toBe('1.0.8')
      expect(state.updateRef).toBe(mockUpdate)
    })

    it('starts release notes loading', () => {
      useUpdateStore.getState().setAvailable(mockUpdate, '1.0.9', '1.0.8')
      const state = useUpdateStore.getState()
      expect(state.releaseNotesLoading).toBe(true)
      expect(state.releaseNotes).toBeNull()
      expect(state.releaseNotesError).toBe(false)
    })

    it('clears previous error', () => {
      useUpdateStore.setState({ errorMessage: 'old error' })
      useUpdateStore.getState().setAvailable(mockUpdate, '1.0.9', '1.0.8')
      expect(useUpdateStore.getState().errorMessage).toBeNull()
    })
  })

  describe('setReleaseNotes', () => {
    it('sets notes and stops loading', () => {
      useUpdateStore.setState({ releaseNotesLoading: true })
      useUpdateStore.getState().setReleaseNotes('## v1.0.9\n\nSome notes')
      const state = useUpdateStore.getState()
      expect(state.releaseNotes).toBe('## v1.0.9\n\nSome notes')
      expect(state.releaseNotesLoading).toBe(false)
    })
  })

  describe('setReleaseNotesError', () => {
    it('sets error flag and stops loading', () => {
      useUpdateStore.setState({ releaseNotesLoading: true })
      useUpdateStore.getState().setReleaseNotesError()
      const state = useUpdateStore.getState()
      expect(state.releaseNotesLoading).toBe(false)
      expect(state.releaseNotesError).toBe(true)
    })
  })

  describe('closeDialog', () => {
    it('closes dialog and resets mode', () => {
      useUpdateStore.setState({ dialogOpen: true, dialogMode: 'error' })
      useUpdateStore.getState().closeDialog()
      const state = useUpdateStore.getState()
      expect(state.dialogOpen).toBe(false)
      expect(state.dialogMode).toBe('checking')
    })

    it('resets release notes state', () => {
      useUpdateStore.setState({
        dialogOpen: true,
        releaseNotes: 'some notes',
        releaseNotesLoading: true,
        releaseNotesError: true,
      })
      useUpdateStore.getState().closeDialog()
      const state = useUpdateStore.getState()
      expect(state.releaseNotes).toBeNull()
      expect(state.releaseNotesLoading).toBe(false)
      expect(state.releaseNotesError).toBe(false)
    })

    it('resets download progress', () => {
      useUpdateStore.setState({
        dialogOpen: true,
        downloadProgress: 75,
        downloadTotal: 1000,
      })
      useUpdateStore.getState().closeDialog()
      const state = useUpdateStore.getState()
      expect(state.downloadProgress).toBe(0)
      expect(state.downloadTotal).toBeNull()
    })

    it('preserves version and updateRef', () => {
      useUpdateStore.setState({
        dialogOpen: true,
        version: '1.0.9',
        updateRef: mockUpdate,
      })
      useUpdateStore.getState().closeDialog()
      const state = useUpdateStore.getState()
      expect(state.version).toBe('1.0.9')
      expect(state.updateRef).toBe(mockUpdate)
    })
  })

  describe('setDownloading', () => {
    it('sets downloading mode and resets progress', () => {
      useUpdateStore.setState({
        dialogMode: 'available',
        downloadProgress: 50,
        downloadTotal: 1000,
      })
      useUpdateStore.getState().setDownloading()
      const state = useUpdateStore.getState()
      expect(state.dialogMode).toBe('downloading')
      expect(state.downloadProgress).toBe(0)
      expect(state.downloadTotal).toBeNull()
    })
  })

  describe('setProgress', () => {
    it('calculates percentage correctly', () => {
      useUpdateStore.getState().setProgress(500, 1000)
      expect(useUpdateStore.getState().downloadProgress).toBe(50)
    })

    it('rounds to nearest integer', () => {
      useUpdateStore.getState().setProgress(333, 1000)
      expect(useUpdateStore.getState().downloadProgress).toBe(33)
    })

    it('handles zero total', () => {
      useUpdateStore.getState().setProgress(100, 0)
      expect(useUpdateStore.getState().downloadProgress).toBe(0)
    })

    it('stores total bytes', () => {
      useUpdateStore.getState().setProgress(500, 10000)
      expect(useUpdateStore.getState().downloadTotal).toBe(10000)
    })
  })

  describe('setReady', () => {
    it('sets ready mode with 100% progress', () => {
      useUpdateStore.getState().setReady()
      const state = useUpdateStore.getState()
      expect(state.dialogMode).toBe('ready')
      expect(state.downloadProgress).toBe(100)
    })
  })

  describe('setNoUpdate', () => {
    it('opens dialog in no-update mode', () => {
      useUpdateStore.getState().setNoUpdate('1.0.8')
      const state = useUpdateStore.getState()
      expect(state.dialogOpen).toBe(true)
      expect(state.dialogMode).toBe('no-update')
      expect(state.currentVersion).toBe('1.0.8')
    })
  })

  describe('setError', () => {
    it('opens dialog in error mode with message', () => {
      useUpdateStore.getState().setError('Network failed')
      const state = useUpdateStore.getState()
      expect(state.dialogOpen).toBe(true)
      expect(state.dialogMode).toBe('error')
      expect(state.errorMessage).toBe('Network failed')
    })
  })

  describe('skipVersion', () => {
    it('stores skipped version in state', () => {
      useUpdateStore.getState().skipVersion('1.0.9')
      expect(useUpdateStore.getState().skippedVersion).toBe('1.0.9')
    })

    it('persists to localStorage', () => {
      useUpdateStore.getState().skipVersion('1.0.9')
      expect(localStorage.getItem(SKIPPED_VERSION_KEY)).toBe('1.0.9')
    })

    it('closes the dialog', () => {
      useUpdateStore.setState({ dialogOpen: true })
      useUpdateStore.getState().skipVersion('1.0.9')
      expect(useUpdateStore.getState().dialogOpen).toBe(false)
    })

    it('overwrites previously skipped version', () => {
      useUpdateStore.getState().skipVersion('1.0.9')
      useUpdateStore.getState().skipVersion('1.1.0')
      expect(useUpdateStore.getState().skippedVersion).toBe('1.1.0')
      expect(localStorage.getItem(SKIPPED_VERSION_KEY)).toBe('1.1.0')
    })
  })

  describe('initialization', () => {
    it('reads skippedVersion from localStorage on create', async () => {
      localStorage.setItem(SKIPPED_VERSION_KEY, '1.0.9')

      // Re-import to get a fresh store that reads from localStorage
      // We need to reset the module cache
      vi.resetModules()
      const { useUpdateStore: freshStore } = await import('../updateStore')
      expect(freshStore.getState().skippedVersion).toBe('1.0.9')
    })
  })
})
