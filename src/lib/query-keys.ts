// src/lib/query-keys.ts

export const queryKeys = {
  all: ['project'] as const,
  // Every registered project, for the project list. Not under `all`, which
  // is one project's data
  projectList: ['project-list'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  // Every file in a collection, with its frontmatter, for entry pickers
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), collectionName, 'files'] as const,
  // The path of the template new files in a collection start from, or null.
  // The new file type decides which of two templates is used
  newFileTemplate: (
    projectPath: string,
    collectionName: string,
    newFileType: string
  ) =>
    [
      ...queryKeys.collections(projectPath),
      collectionName,
      'template',
      newFileType,
    ] as const,
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
  // How many files each collection has, for the sidebar's collection list
  collectionCounts: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collectionCounts'] as const,
  // By path: an entry's id leaves out its extension, so `post.md` and
  // `post.mdx` share one
  fileContent: (projectPath: string, filePath: string) =>
    [...queryKeys.all, projectPath, 'files', filePath] as const,
  mdxComponents: (projectPath: string, mdxDirectories: string[]) =>
    [...queryKeys.all, projectPath, 'mdxComponents', mdxDirectories] as const,
  fileBasedCollection: (projectPath: string, collectionName: string) =>
    [
      ...queryKeys.all,
      projectPath,
      'fileBasedCollection',
      collectionName,
    ] as const,
  projectDependencies: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'dependencies'] as const,
  // What Project Settings shows about git for the project
  gitSetup: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'gitSetup'] as const,
  // What the Git tab shows, for each entry it's asked about
  gitStates: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'gitState'] as const,
  gitState: (projectPath: string, entryPath: string | null) =>
    [...queryKeys.gitStates(projectPath), entryPath] as const,
  // A loadable URL for an image path as written in a file. Relative paths
  // depend on the file, so it's part of the key
  imageSrc: (projectPath: string, filePath: string | null, imagePath: string) =>
    [...queryKeys.all, projectPath, 'imageSrc', filePath, imagePath] as const,
  // Not tied to a project
  appVersion: ['appVersion'] as const,
  // The colour themes in the app data folder's themes/ folder
  colourThemes: ['colourThemes'] as const,
  // Add more keys here as needed
}

/**
 * Whether a query lists the project's files: a folder's contents, a
 * collection's files, or the collections' file counts. Files being added,
 * removed or renamed make them stale, as do settings and content config
 * changes that move a collection or change which files are its entries.
 */
export function isFileListing(
  queryKey: readonly unknown[],
  projectPath: string
): boolean {
  return (
    queryKey[0] === queryKeys.all[0] &&
    queryKey[1] === projectPath &&
    (queryKey[2] === 'collectionCounts' ||
      queryKey[3] === 'directory' ||
      queryKey[4] === 'files')
  )
}
