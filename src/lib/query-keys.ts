// src/lib/query-keys.ts

export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), collectionName, 'files'] as const,
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
