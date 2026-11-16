import { useEffect } from 'react'
import { warn } from '@tauri-apps/plugin-log'
import { useProjectStore } from '../store/projectStore'
import { useColourThemesQuery } from './queries/useColourThemesQuery'
import {
  applyColourTheme,
  cacheColourTheme,
  parseColourTheme,
} from '../lib/colour-themes'

/**
 * Applies the colour theme chosen in Preferences, or the default colours when
 * none is chosen or its file is gone. The themes folder is read again when the
 * window regains focus, so a theme being edited updates on switching back.
 * Used once, by Layout.
 */
export function useColourTheme() {
  const settingsLoaded = useProjectStore(state => state.globalSettings !== null)
  const chosen = useProjectStore(
    state => state.globalSettings?.appearance?.colorTheme
  )
  const { data: themes, refetch } = useColourThemesQuery()

  useEffect(() => {
    const reread = () => void refetch()
    window.addEventListener('focus', reread)
    return () => window.removeEventListener('focus', reread)
  }, [refetch])

  useEffect(() => {
    // Until settings are read, and the themes folder if a theme is chosen,
    // the theme cached at launch stays
    if (!settingsLoaded || (chosen && !themes)) return
    const theme = chosen && themes?.find(t => t.name === chosen)
    if (!theme) {
      applyColourTheme({})
      cacheColourTheme(null)
      return
    }
    const { tokens, ignored } = parseColourTheme(theme.css)
    if (ignored.length > 0) {
      void warn(
        `Astro Editor [THEMES] ${theme.name}.css: ignored ${ignored.join(', ')}`
      )
    }
    applyColourTheme(tokens)
    cacheColourTheme(tokens)
  }, [settingsLoaded, chosen, themes])
}
