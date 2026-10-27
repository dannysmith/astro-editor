import React, { createContext, useContext, useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeProviderContext {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderContext = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderContext>(initialState)

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

/**
 * Applies the theme: the native window appearance (so menus and dialogs match)
 * and a .light or .dark class on <html>, which sets color-scheme for the
 * light-dark() colour tokens and drives Tailwind's dark: variant.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
  storageKey = 'astro-editor-theme',
}) => {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    // null follows the OS. On macOS and Linux this is app-wide. Skipped when
    // the styleguide is open in a browser, where there's no window to theme
    if (isTauri()) {
      void getCurrentWindow().setTheme(theme === 'system' ? null : theme)
    }

    const root = window.document.documentElement
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved =
        theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : theme
      root.classList.remove('light', 'dark')
      root.classList.add(resolved)
    }

    apply()
    if (theme !== 'system') return

    systemDark.addEventListener('change', apply)
    return () => systemDark.removeEventListener('change', apply)
  }, [theme])

  const handleSetTheme = (theme: Theme) => {
    localStorage.setItem(storageKey, theme)
    setTheme(theme)
  }

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
