import { useShallow } from 'zustand/react/shallow'
import { useUIStore } from '../store/uiStore'

/** How the sidebar is showing a collection: its filters, search and sort */
export function useCollectionView(collectionName: string) {
  // Ephemeral and per-collection
  const showDraftsOnly = useUIStore(
    state => state.draftFilterByCollection[collectionName] ?? false
  )
  const view = useUIStore(
    useShallow(state => state.getCollectionViewState(collectionName))
  )
  return {
    ...view,
    showDraftsOnly,
    searchActive: view.searchQuery.trim() !== '',
    sortActive: view.sortMode !== 'default',
  }
}
