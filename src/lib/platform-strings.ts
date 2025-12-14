import type { AppPlatform } from '@/hooks/usePlatform'

/**
 * Platform-specific UI strings.
 * Keys are logical identifiers, values are platform-specific strings.
 */
const platformStrings = {
  revealInFileManager: {
    macos: 'Reveal in Finder',
    windows: 'Show in Explorer',
    linux: 'Show in File Manager',
  },
  fileManager: {
    macos: 'Finder',
    windows: 'Explorer',
    linux: 'File Manager',
  },
  preferences: {
    macos: 'Preferences',
    windows: 'Settings',
    linux: 'Preferences',
  },
  trash: {
    macos: 'Trash',
    windows: 'Recycle Bin',
    linux: 'Trash',
  },
} as const

export type PlatformStringKey = keyof typeof platformStrings

/**
 * Get a platform-specific string.
 * Falls back to Linux string if platform is undefined (safest default).
 */
export function getPlatformString(
  key: PlatformStringKey,
  platform: AppPlatform | undefined
): string {
  const strings = platformStrings[key]
  return strings[platform ?? 'linux']
}
