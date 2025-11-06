import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'

/**
 * Loads the persisted project on mount.
 *
 * This hook handles the initialization of the project state when the app starts,
 * restoring the last opened project from persistent storage.
 */
export function useProjectInitialization() {
  useEffect(() => {
    void useProjectStore.getState().loadPersistedProject()
  }, [])
}
