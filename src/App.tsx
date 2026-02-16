import { Layout } from './components/layout'
import { ThemeProvider } from './lib/theme-provider'
import { check } from '@tauri-apps/plugin-updater'
import { info, error } from '@tauri-apps/plugin-log'
import { listen } from '@tauri-apps/api/event'
import { commands } from '@/lib/bindings'
import { useEffect } from 'react'
import { UpdateDialog } from '@/components/update-dialog'
import { useUpdateStore } from '@/store/updateStore'
import './App.css'

async function fetchAndSetReleaseNotes(
  currentVersion: string,
  newVersion: string
) {
  const store = useUpdateStore.getState()
  try {
    const result = await commands.fetchReleaseNotes(currentVersion, newVersion)
    if (result.status === 'ok') {
      store.setReleaseNotes(result.data)
    } else {
      store.setReleaseNotesError()
    }
  } catch {
    store.setReleaseNotesError()
  }
}

async function checkForUpdates(manual: boolean): Promise<void> {
  const store = useUpdateStore.getState()

  if (manual) {
    store.setChecking()
  }

  try {
    const update = await check()

    if (update) {
      await info(`Update available: ${update.version}`)

      // For automatic checks, skip if user has skipped this version
      if (!manual && store.skippedVersion === update.version) {
        await info(`Skipping version ${update.version} (user skipped)`)
        return
      }

      const currentVersion = update.currentVersion
      store.setAvailable(update, update.version, currentVersion)

      // Fetch release notes in the background
      void fetchAndSetReleaseNotes(currentVersion, update.version)
    } else {
      await info('No updates available')

      if (manual) {
        const result = await commands.getAppVersion()
        const version =
          result.status === 'ok' ? result.data : 'unknown'
        store.setNoUpdate(version)
      }
    }
  } catch (err) {
    await error(`Update check failed: ${String(err)}`)

    if (manual) {
      store.setError(`Update check failed: ${String(err)}`)
    }
  }
}

function App() {
  useEffect(() => {
    // Check for updates 5 seconds after app loads (silently)
    const timer = setTimeout(() => void checkForUpdates(false), 5000)

    // Listen for manual update check from menu
    const unlistenPromise = listen('menu-check-updates', () => {
      void checkForUpdates(true)
    })

    return () => {
      clearTimeout(timer)
      void unlistenPromise.then(unlisten => unlisten())
    }
  }, [])

  return (
    <ThemeProvider defaultTheme="system" storageKey="astro-editor-theme">
      <Layout />
      <UpdateDialog />
    </ThemeProvider>
  )
}

export default App
