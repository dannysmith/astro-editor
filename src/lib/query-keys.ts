// src/lib/query-keys.ts

export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  // Every file in a collection, with its frontmatter, for entry pickers
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), collectionName, 'files'] as const,
  // The files and folders in one folder of a collection, for the sidebar
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
  projectDependencies: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'dependencies'] as const,
  // Add more keys here as needed
}
