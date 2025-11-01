# Task 1: Refactor Data Fetching with TanStack Query

## 1. Objective

To improve application performance, reliability, and developer experience by migrating all backend data fetching from manual `invoke` calls inside `useEffect` hooks to a structured, cached approach using **TanStack Query** (v5).

This refactor will eliminate boilerplate loading/error state management, provide intelligent caching, and create a more robust and predictable data layer.

## 2. Why TanStack Query?

Currently, when we fetch data from the Rust backend (e.g., loading collections), our process looks like this:

1.  A component mounts.
2.  A `useEffect` hook runs.
3.  We manually set `isLoading` to `true`.
4.  We call `invoke(...)`.
5.  In a `.then()`, we set the data and turn `isLoading` off.
6.  In a `.catch()`, we set an error state and turn `isLoading` off.

This is repetitive, error-prone, and has no concept of caching. If we switch away from the component and come back, we have to do it all over again.

**TanStack Query automates this entire process.** It treats data from our Tauri backend as "server state" and handles all the complexity for us. We simply tell it what we want, and it gives us the data, loading status, and error status automatically.

---

## 3. Implementation Plan

This will be a multi-step process. Follow each step carefully to ensure a smooth transition.

### Step 3.1: Installation & Provider Setup

First, we need to add the library and set up its context provider at the root of our application.

1.  **Install the dependency:**

    ```bash
    npm install @tanstack/react-query
    ```

2.  **Set up the `QueryClientProvider`:**
    Open `src/main.tsx` and wrap the main `<App />` component. This provides the cache to every component in our application.

    ```tsx
    // src/main.tsx

    import React from 'react'
    import ReactDOM from 'react-dom/client'
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
    import App from './App'
    import './App.css'

    // Create a client
    const queryClient = new QueryClient()

    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>
    )
    ```

### Step 3.2: Create a Query Key Factory

Query keys are the foundation of TanStack Query's cache. They are arrays that uniquely identify a piece of data. To keep them consistent and prevent typos, we will create a "key factory" object.

**Create a new file:** `src/lib/query-keys.ts`

```typescript
// src/lib/query-keys.ts

export const queryKeys = {
  all: ['project'] as const,
  collections: (projectPath: string) =>
    [...queryKeys.all, projectPath, 'collections'] as const,
  collectionFiles: (projectPath: string, collectionName: string) =>
    [...queryKeys.collections(projectPath), collectionName, 'files'] as const,
  fileContent: (projectPath: string, fileId: string) =>
    [...queryKeys.all, projectPath, 'files', fileId] as const,
  // Add more keys here as needed
}
```

_This allows us to create keys like `queryKeys.collections('/path/to/project')`, ensuring consistency._

### Step 3.3: Refactor a "Read" Operation (`useQuery`)

Let's refactor the logic for loading the list of collections in the sidebar.

1.  **Identify the Target:** The current logic is likely in `useAppStore`'s `loadCollections` action, which is called from a `useEffect` in a component like `Sidebar.tsx`.

2.  **Create the Query Hook:** We will create a custom hook that encapsulates the TanStack Query logic for fetching collections. This is a best practice that keeps our components clean.

    **Create a new file:** `src/hooks/queries/useCollectionsQuery.ts`

    ```typescript
    // src/hooks/queries/useCollectionsQuery.ts

    import { useQuery } from '@tanstack/react-query'
    import { invoke } from '@tauri-apps/api/core'
    import { queryKeys } from '@/lib/query-keys'
    import { Collection } from '@/types/common' // Assuming type exists

    // This is our actual data-fetching function. It's just a wrapper around invoke.
    const fetchCollections = async (
      projectPath: string
    ): Promise<Collection[]> => {
      if (!projectPath) {
        // TanStack Query handles errors, so we can throw
        throw new Error('Project path is required to fetch collections.')
      }
      return invoke('scan_project', { projectPath })
    }

    export const useCollectionsQuery = (projectPath: string) => {
      return useQuery({
        // The queryKey uniquely identifies this query.
        // If projectPath changes, TanStack Query will automatically refetch.
        queryKey: queryKeys.collections(projectPath),

        // The queryFn is the function that fetches the data.
        // TanStack Query automatically provides the context, including the queryKey.
        queryFn: () => fetchCollections(projectPath),

        // We only want to run this query if a projectPath is available.
        enabled: !!projectPath,
      })
    }
    ```

3.  **Use the Hook in the Component:** Now, we replace the old logic in `Sidebar.tsx` (or wherever it lives).

    ```tsx
    // src/components/Layout/Sidebar.tsx (Example)

    import { useCollectionsQuery } from '@/hooks/queries/useCollectionsQuery'
    import { useAppStore } from '@/store' // We still need this for projectPath

    export const Sidebar = () => {
      const projectPath = useAppStore(state => state.projectPath)
      const {
        data: collections,
        isLoading,
        isError,
      } = useCollectionsQuery(projectPath)

      if (isLoading) {
        return <div>Loading collections...</div> // Or a skeleton loader
      }

      if (isError) {
        return <div>Error loading collections.</div>
      }

      return (
        <div>
          {/* Render the list of collections from the `collections` variable */}
          {collections?.map(collection => (
            <div key={collection.name}>{collection.name}</div>
          ))}
        </div>
      )
    }
    ```

### Step 3.4: Refactor a "Write" Operation (`useMutation`)

Now let's refactor the `saveFile` action. Mutations are for creating, updating, or deleting data.

1.  **Create the Mutation Hook:**

    **Create a new file:** `src/hooks/mutations/useSaveFileMutation.ts`

    ```typescript
    // src/hooks/mutations/useSaveFileMutation.ts

    import { useMutation, useQueryClient } from '@tanstack/react-query'
    import { invoke } from '@tauri-apps/api/core'
    import { queryKeys } from '@/lib/query-keys'
    import { toast } from '@/lib/toast'

    // The payload for our Tauri command
    interface SaveFilePayload {
      filePath: string
      content: string
      // ... any other fields needed by the Rust command
    }

    const saveFile = (payload: SaveFilePayload) => {
      return invoke('save_markdown_content', payload)
    }

    export const useSaveFileMutation = () => {
      const queryClient = useQueryClient()

      return useMutation({
        mutationFn: saveFile,
        onSuccess: (_, variables) => {
          // This is the magic part!
          // After a successful save, we tell TanStack Query that the data
          // for this file is now stale. It will automatically refetch it
          // the next time it's needed, or immediately if it's on screen.
          queryClient.invalidateQueries({
            queryKey: queryKeys.fileContent(
              variables.projectPath,
              variables.filePath
            ),
          })

          toast.success('File saved!')
        },
        onError: error => {
          toast.error('Failed to save file', { description: error.message })
        },
      })
    }
    ```

2.  **Use the Mutation in a Component:**

    ```tsx
    // In a component like MainEditor.tsx or a new useGlobalShortcuts hook

    import { useSaveFileMutation } from '@/hooks/mutations/useSaveFileMutation'

    // ...
    const { mutate: saveFile, isPending: isSaving } = useSaveFileMutation()

    const handleSave = () => {
      // Construct the payload from the store or component state
      const payload = { filePath: '...', content: '...' }
      saveFile(payload)
    }

    // You can use the `isSaving` boolean to show a saving indicator
    ```

## 4. Migration Checklist

The following pieces of logic need to be refactored to use TanStack Query.

- [ ] **`loadCollections`**: Convert to `useCollectionsQuery`.
- [ ] **`loadCollectionFiles`**: Convert to `useCollectionFilesQuery`.
- [ ] **`openFile` / `parseMarkdownContent`**: Convert to `useFileContentQuery`.
- [ ] **`saveFile`**: Convert to `useSaveFileMutation`.
- [ ] **`createNewFile`**: Convert to `useCreateFileMutation`.
- [ ] **`renameFile`**: Convert to `useRenameFileMutation`.
- [ ] **`deleteFile`**: Convert to `useDeleteFileMutation`.

## 5. The New Role of the Zustand Store

After this refactor, **Zustand should no longer store server state.**

- **REMOVE** `collections`, `files`, `editorContent`, `frontmatter`, etc., from the store's state. This data now lives in the TanStack Query cache.
- **KEEP** pure UI state and identifiers in Zustand. This includes:
  - `projectPath` (identifier used in query keys)
  - `selectedCollectionName` (identifier)
  - `currentFilePath` (identifier)
  - `sidebarVisible` (pure UI state)

By separating server state (in TanStack Query) from client state (in Zustand), our application becomes dramatically simpler, more performant, and easier to reason about.

## BUGS AND TASKS TO FIX

- [x] The File list in the sidebar doesn't update when changes are made to the frontmatter. ie if I change `draft` to true it should update to get a red marker "Draft" pill on it. Same is true of the title. I need to leave the collectiona nd reopen it for this to update.
- [x] If I rename a file in the sidebar (right click menu) it appears to work fine, but if I then edit its **frontmatter** and thenc ome back, it Has created a new fil. Presumably because the Saving functionality isn't aware that the file has been renamed, and so it uses the old file name to make that save, Resulting in duplicates.
- [x] `Cmd + ,` Doesn't open the Preferences When the Markdown editor is focused, it works fine everywhere else.
- [x] `Cmd + W` no longer closes the currently open file
- [x] `Cmd + N` or the + icon Should create a new file in the current collection. It actually shows a toast saying "File creation is temporarily disabled during refactoring". We should fix that since we're not in the middle of refactoring.
- [x] The Frontmatter Field mappings dropdowns in the preferences are all empty.
- [x] There are some test files that still reference the old state structure (collections, files, loadCollections, etc.). These tests will need to be updated to mock TanStack Query instead of the Zustand store for those operations. (Do this last)
- [x] Remove code that triggers save in src/lib/editor/extensions/keymap.ts. This works globally anyway
