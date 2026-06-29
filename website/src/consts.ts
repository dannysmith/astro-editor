/** Shared external URLs for the marketing site. */

export const GITHUB_REPO = 'https://github.com/dannysmith/astro-editor'

const RELEASE_BASE = `${GITHUB_REPO}/releases/latest/download`

export const DOWNLOADS = {
  mac: `${RELEASE_BASE}/astro-editor-latest.dmg`,
  windows: `${RELEASE_BASE}/astro-editor-latest.msi`,
  linuxAppImage: `${RELEASE_BASE}/astro-editor-latest.AppImage`,
  linuxDeb: `${RELEASE_BASE}/astro-editor-latest.deb`,
  linuxRpm: `${RELEASE_BASE}/astro-editor-latest.rpm`,
} as const
