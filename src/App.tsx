import { Layout } from './components/layout'
import { ThemeProvider } from './lib/theme-provider'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { info, error } from '@tauri-apps/plugin-log'
import { listen } from '@tauri-apps/api/event'
import { commands } from '@/lib/bindings'
import { useEffect } from 'react'
import { UpdateDialog } from '@/components/update-dialog'
import { useUpdateStore } from '@/store/updateStore'
import './App.css'

function App() {
  // TODO: REMOVE — temporary test to show update dialog with real release notes
  useEffect(() => {
    const timer = setTimeout(async () => {
      const store = useUpdateStore.getState()
      // Pretend we're on v1.0.0 and latest is current version
      const fakeCurrentVersion = '1.0.0'
      const fakeNewVersion = '1.0.8'

      store.setAvailable(null as never, fakeNewVersion, fakeCurrentVersion)

      // Fetch real release notes from GitHub
      try {
        const result = await commands.fetchReleaseNotes(
          fakeCurrentVersion,
          fakeNewVersion
        )
        if (result.status === 'ok') {
          store.setReleaseNotes(result.data)
        } else {
          store.setReleaseNotesError()
        }
      } catch {
        store.setReleaseNotesError()
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const checkForUpdates = async (): Promise<boolean> => {
      try {
        const update = await check()
        if (update) {
          await info(`Update available: ${update.version}`)

          // Show toast notification or modal
          const shouldUpdate = confirm(
            `Update available: ${update.version}\n\nWould you like to install this update now?`
          )

          if (shouldUpdate) {
            try {
              // Download and install silently with only console logging
              await update.downloadAndInstall(event => {
                switch (event.event) {
                  case 'Started':
                    void info(`Downloading ${event.data.contentLength} bytes`)
                    break
                  case 'Progress':
                    void info(`Downloaded: ${event.data.chunkLength} bytes`)
                    break
                  case 'Finished':
                    void info('Download complete, installing...')
                    break
                }
              })

              // Ask if user wants to restart now
              const shouldRestart = confirm(
                'Update completed successfully!\n\nWould you like to restart the app now to use the new version?'
              )

              if (shouldRestart) {
                await relaunch()
              }
            } catch (updateError) {
              await error(`Update installation failed: ${String(updateError)}`)
              alert(
                `Update failed: There was a problem with the automatic download.\n\n${String(updateError)}`
              )
            }
          }
          return true
        } else {
          await info('No updates available')
          return false
        }
      } catch (checkError) {
        await error(`Update check failed: ${String(checkError)}`)
        return false
      }
    }

    // Check for updates 5 seconds after app loads (silently)
    const timer = setTimeout(() => void checkForUpdates(), 5000)

    // Listen for manual update check from menu
    const unlistenPromise = listen('menu-check-updates', () => {
      void (async () => {
        const updateFound = await checkForUpdates()
        if (!updateFound) {
          // Only show dialog when manually checking and no update is available
          try {
            const result = await commands.getAppVersion()
            if (result.status === 'error') {
              throw new Error(result.error)
            }
            alert(
              `No updates available.\n\nYou are running the latest version (${result.data}).`
            )
          } catch {
            alert(
              'No updates available.\n\nYou are running the latest version.'
            )
          }
        }
      })()
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
