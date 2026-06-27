/**
 * Central registry of links to the public documentation site.
 *
 * Kept in one place so URLs are easy to update if the docs are restructured.
 * Used by the native Help menu, the command palette, and inline "Learn more"
 * links in the preferences panes. All are opened externally via `openPath`
 * from `@tauri-apps/plugin-opener`.
 */
const DOCS_BASE = 'https://astroeditor.danny.is'

export const DOCS_URLS = {
  userGuide: `${DOCS_BASE}/getting-started/`,
  keyboardShortcuts: `${DOCS_BASE}/reference/keyboard-shortcuts/`,
  overrides: `${DOCS_BASE}/reference/overrides/`,
  ideIntegration: `${DOCS_BASE}/file-management/ide-integration/`,
  advancedPreferences: `${DOCS_BASE}/reference/advanced-preferences/`,
} as const
