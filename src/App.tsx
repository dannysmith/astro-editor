import { Layout } from './components/layout'
import { ThemeProvider } from './lib/theme-provider'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { info, error } from '@tauri-apps/plugin-log'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useEffect } from 'react'
import './App.css'

function App() {
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
            const version = await invoke<string>('get_app_version')
            alert(
              `No updates available.\n\nYou are running the latest version (${version}).`
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
    </ThemeProvider>
  )
}

export default App
