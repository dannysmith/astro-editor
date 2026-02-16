import { create } from 'zustand'
import type { Update } from '@tauri-apps/plugin-updater'

type DialogMode =
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'no-update'
  | 'error'

const SKIPPED_VERSION_KEY = 'astro-editor-skipped-update-version'

interface UpdateState {
  // Dialog state
  dialogOpen: boolean
  dialogMode: DialogMode

  // Update info
  version: string | null
  currentVersion: string | null
  errorMessage: string | null

  // The Update object from check() — needed for downloadAndInstall()
  // Stored as a non-reactive ref (not serializable, has methods)
  updateRef: Update | null

  // Release notes (fetched via Rust command from GitHub API)
  releaseNotes: string | null
  releaseNotesLoading: boolean
  releaseNotesError: boolean

  // Download progress
  downloadProgress: number
  downloadTotal: number | null

  // Skip tracking (persisted to localStorage)
  skippedVersion: string | null

  // Actions
  openDialog: () => void
  closeDialog: () => void
  setChecking: () => void
  setAvailable: (
    update: Update,
    version: string,
    currentVersion: string
  ) => void
  setReleaseNotes: (notes: string) => void
  setReleaseNotesError: () => void
  setDownloading: () => void
  setProgress: (downloaded: number, total: number) => void
  setReady: () => void
  setNoUpdate: (currentVersion: string) => void
  setError: (message: string) => void
  skipVersion: (version: string) => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
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

  skippedVersion: localStorage.getItem(SKIPPED_VERSION_KEY),

  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () =>
    set({
      dialogOpen: false,
      releaseNotes: null,
      releaseNotesLoading: false,
      releaseNotesError: false,
      downloadProgress: 0,
      downloadTotal: null,
    }),

  setChecking: () =>
    set({ dialogOpen: true, dialogMode: 'checking', errorMessage: null }),

  setAvailable: (update, version, currentVersion) =>
    set({
      dialogOpen: true,
      dialogMode: 'available',
      updateRef: update,
      version,
      currentVersion,
      releaseNotesLoading: true,
      releaseNotesError: false,
      releaseNotes: null,
      errorMessage: null,
    }),

  setReleaseNotes: (notes) =>
    set({ releaseNotes: notes, releaseNotesLoading: false }),

  setReleaseNotesError: () =>
    set({ releaseNotesLoading: false, releaseNotesError: true }),

  setDownloading: () =>
    set({ dialogMode: 'downloading', downloadProgress: 0, downloadTotal: null }),

  setProgress: (downloaded, total) =>
    set({
      downloadProgress: total > 0 ? Math.round((downloaded / total) * 100) : 0,
      downloadTotal: total,
    }),

  setReady: () => set({ dialogMode: 'ready', downloadProgress: 100 }),

  setNoUpdate: (currentVersion) =>
    set({
      dialogOpen: true,
      dialogMode: 'no-update',
      currentVersion,
      errorMessage: null,
    }),

  setError: (message) =>
    set({ dialogOpen: true, dialogMode: 'error', errorMessage: message }),

  skipVersion: (version) => {
    localStorage.setItem(SKIPPED_VERSION_KEY, version)
    set({ skippedVersion: version, dialogOpen: false })
  },
}))
