import { useQuery } from '@tanstack/react-query'
import { getSystemFonts } from 'tauri-plugin-system-fonts-api'

interface RawFontObject {
  name?: string
  family?: string
}

type RawFont = string | RawFontObject

export const useSystemFontsQuery = () => {
  return useQuery({
    queryKey: ['system-fonts'],
    queryFn: async () => {
      const fonts = (await getSystemFonts()) as RawFont[]
      const fontNames = fonts.map(f =>
        typeof f === 'string' ? f : (f.name ?? f.family ?? '')
      )
      return Array.from(new Set(fontNames.filter(s => s.length > 0))).sort(
        (a, b) => a.localeCompare(b)
      )
    },
    staleTime: Infinity, // System fonts don't change often
  })
}
