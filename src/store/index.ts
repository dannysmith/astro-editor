// Re-export types from the new stores for backward compatibility
export type { FileEntry, MarkdownContent } from './editorStore'

// Collection type for backward compatibility
export interface Collection {
  name: string
  path: string
  complete_schema?: string // Complete merged schema from Rust backend
}

// The monolithic useAppStore has been decomposed into:
// - useEditorStore (src/store/editorStore.ts) - file editing state
// - useProjectStore (src/store/projectStore.ts) - project-level state
// - useUIStore (src/store/uiStore.ts) - UI layout state
//
// Import these stores directly instead of using the old useAppStore
