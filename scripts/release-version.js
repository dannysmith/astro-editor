// Version helpers shared by prepare-release, test-build and release.yml.
//
// `bun scripts/release-version.js <version>` sets the app's version in every
// file that holds it. release.yml runs it for test builds, which are never
// committed.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.join(import.meta.dirname, '..')

/** `1.2.3` → `1.2.4` */
export function bumpPatch(version) {
  const parts = version.split('.')
  parts[2] = String(Number(parts[2]) + 1)
  return parts.join('.')
}

/** Whether a version is a prerelease, such as a test build (`1.0.21-test.3`) */
export function isPrerelease(version) {
  return version.includes('-')
}

/**
 * The Windows installer version for a prerelease: `1.0.21-test.3` →
 * `1.0.21.3`. WiX only accepts numeric `major.minor.patch.build` versions.
 */
export function wixVersion(version) {
  const match = version.match(/^(\d+\.\d+\.\d+)-[a-z]+\.(\d+)$/)
  if (!match) {
    throw new Error(`Can't make a Windows installer version from ${version}`)
  }
  return `${match[1]}.${match[2]}`
}

/** The highest stable release tag (`v1.0.20`) among the repo's tag names */
export function latestStableTag(tags) {
  const latest = tags
    .map(tag => tag.match(/^v(\d+)\.(\d+)\.(\d+)$/))
    .filter(Boolean)
    .map(match => match.slice(1).map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
    .at(-1)
  if (!latest) throw new Error('No stable release tags found')
  return `v${latest.join('.')}`
}

/**
 * The next test build version, from the repo's tag names: the patch after the
 * latest stable release, numbered after any test builds of it already tagged.
 * Basing it on the next patch means the updater moves testers onto the next
 * stable release, since `1.0.21-test.3` sorts below `1.0.21`.
 */
export function nextTestVersion(tags) {
  const base = bumpPatch(latestStableTag(tags).slice(1))
  const numbers = tags
    .filter(tag => tag.startsWith(`v${base}-test.`))
    .map(tag => Number(tag.slice(`v${base}-test.`.length)))
    .filter(Number.isInteger)

  return `${base}-test.${Math.max(0, ...numbers) + 1}`
}

/**
 * Sets the version in `package.json`, `Cargo.toml` and `tauri.conf.json`, and
 * the Windows installer version for a prerelease. All three matter: the
 * bundles take theirs from `tauri.conf.json`, `get_app_version` from
 * `Cargo.toml`.
 */
export function setVersion(version) {
  const pkgPath = path.join(ROOT, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  console.log(`📝 package.json: ${pkg.version} → ${version}`)
  pkg.version = version
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // The first `version = ` in Cargo.toml is the package's own
  const cargoPath = path.join(ROOT, 'src-tauri/Cargo.toml')
  const cargoToml = fs.readFileSync(cargoPath, 'utf8')
  const oldCargoVersion = cargoToml.match(/version = "([^"]*)"/)?.[1]
  console.log(`📝 Cargo.toml: ${oldCargoVersion ?? 'unknown'} → ${version}`)
  fs.writeFileSync(
    cargoPath,
    cargoToml.replace(/version = "[^"]*"/, `version = "${version}"`)
  )

  const tauriConfigPath = path.join(ROOT, 'src-tauri/tauri.conf.json')
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'))
  console.log(`📝 tauri.conf.json: ${tauriConfig.version} → ${version}`)
  tauriConfig.version = version
  if (isPrerelease(version)) {
    const wix = wixVersion(version)
    console.log(`📝 tauri.conf.json bundle.windows.wix.version: ${wix}`)
    tauriConfig.bundle.windows = {
      ...tauriConfig.bundle.windows,
      wix: { ...tauriConfig.bundle.windows?.wix, version: wix },
    }
  }
  fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2]?.replace(/^v/, '')
  if (!version) {
    console.error('Usage: bun scripts/release-version.js <version>')
    process.exit(1)
  }
  setVersion(version)
}
