// src/lib/query-keys.ts

export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  // Legacy: kept for backward compatibility with existing code
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), collectionName, 'files'] as const,
  // New: For directory contents (replaces collectionFiles)
  directoryContents: (
    projectPath: string,
    collectionName: string,
    subdirectory: string // 'root' or relative path like "2024/january"
  ) =>
    [
      ...queryKeys.all,
      projectPath,
      collectionName,
      'directory',
      subdirectory,
    ] as const,
  fileContent: (projectPath: string, fileId: string) =>
    [...queryKeys.all, projectPath, 'files', fileId] as const,
  mdxComponents: (projectPath: string, mdxDirectory?: string) =>
    [
      ...queryKeys.all,
      projectPath,
      'mdxComponents',
      mdxDirectory || 'default',
    ] as const,
  fileBasedCollection: (projectPath: string, collectionName: string) =>
    [
      ...queryKeys.all,
      projectPath,
      'fileBasedCollection',
      collectionName,
    ] as const,
  // Add more keys here as needed
}
