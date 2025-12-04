/**
 * Project registry utilities for identification and path management
 */

import { commands } from '@/lib/bindings'
import { ProjectMetadata } from './types'
import { safeLog } from '../diagnostics'

/**
 * Simple hash function for generating project IDs
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 6)
}

/**
 * Generate a unique project ID from package.json name and path
 */
export function generateProjectId(
  name: string,
  path: string,
  existingIds: Set<string>
): string {
  // Clean the name to be filesystem-safe
  const cleanName = name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()

  // If the clean name is unique, use it
  if (!existingIds.has(cleanName)) {
    return cleanName
  }

  // If there's a conflict, add a hash suffix
  const pathHash = simpleHash(path)
  const uniqueId = `${cleanName}-${pathHash}`

  return uniqueId
}

/**
 * Discover project information from a given path
 */
export async function discoverProject(
  projectPath: string,
  existingIds: Set<string>
): Promise<ProjectMetadata> {
  try {
    // Try to read package.json
    const packageJsonPath = `${projectPath}/package.json`
    await safeLog.debug(
      `Astro Editor [PROJECT_DISCOVERY] Reading package.json: ${packageJsonPath}`
    )

    const result = await commands.readFileContent(packageJsonPath, projectPath)
    if (result.status === 'error') {
      throw new Error(result.error)
    }
    const packageJsonContent = result.data

    const packageJson = JSON.parse(packageJsonContent) as { name?: string }
    const name =
      packageJson.name || projectPath.split('/').pop() || 'unknown-project'

    await safeLog.info(
      `Astro Editor [PROJECT_DISCOVERY] Project name found: ${name}`
    )
    const projectId = generateProjectId(name, projectPath, existingIds)
    await safeLog.debug(
      `Astro Editor [PROJECT_DISCOVERY] Generated project ID: ${projectId}`
    )

    return {
      id: projectId,
      name,
      path: projectPath,
      lastOpened: new Date().toISOString(),
      created: new Date().toISOString(),
    }
  } catch (error) {
    // Fallback if package.json doesn't exist or is invalid
    await safeLog.error(
      `Astro Editor [PROJECT_DISCOVERY] Package.json read failed for ${projectPath}: ${String(error)}`
    )
    await safeLog.info(
      `Astro Editor [PROJECT_DISCOVERY] Using fallback discovery for: ${projectPath}`
    )

    const name = projectPath.split('/').pop() || 'unknown-project'
    const projectId = generateProjectId(name, projectPath, existingIds)
    await safeLog.debug(
      `Astro Editor [PROJECT_DISCOVERY] Fallback project ID: ${projectId}`
    )

    return {
      id: projectId,
      name,
      path: projectPath,
      lastOpened: new Date().toISOString(),
      created: new Date().toISOString(),
    }
  }
}

/**
 * Check if a path appears to be the same project (for migration)
 */
export async function isSameProject(
  projectMetadata: ProjectMetadata,
  newPath: string
): Promise<boolean> {
  try {
    const packageJsonPath = `${newPath}/package.json`
    const result = await commands.readFileContent(packageJsonPath, newPath)
    if (result.status === 'error') {
      throw new Error(result.error)
    }
    const packageJsonContent = result.data

    const packageJson = JSON.parse(packageJsonContent) as { name?: string }
    return packageJson.name === projectMetadata.name
  } catch {
    // If we can't read package.json, fall back to directory name comparison
    const newName = newPath.split('/').pop() || ''
    return newName === projectMetadata.name
  }
}
