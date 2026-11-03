import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { answerQuitRequest } from '../lib/quit'

/** Saves unsaved edits whenever the app is asked to quit, then quits. */
export function useSaveOnQuit() {
  useEffect(() => {
    const unlisten = listen('quit-requested', () => {
      void answerQuitRequest()
    })
    return () => {
      void unlisten.then(fn => fn())
    }
  }, [])
}
