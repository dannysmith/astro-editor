import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'

// Create a custom render function that includes providers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Create a new QueryClient for each test to ensure isolation
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Turn off retries for tests
        retry: false,
        // Turn off refetch on window focus for tests
        refetchOnWindowFocus: false,
      },
    },
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  }
}

// Mock data for tests
export const mockCollections = [
  {
    name: 'posts',
    path: '/test/project/src/content/posts',
    schema: JSON.stringify({
      fields: [
        { name: 'title', type: 'String', optional: false },
        { name: 'date', type: 'Date', optional: false },
        { name: 'draft', type: 'Boolean', optional: true, default: false },
      ],
    }),
  },
  {
    name: 'pages',
    path: '/test/project/src/content/pages',
    schema: JSON.stringify({
      fields: [{ name: 'title', type: 'String', optional: false }],
    }),
  },
]

export const mockFiles = [
  {
    id: 'file1',
    path: '/test/project/src/content/posts/post1.md',
    name: 'post1',
    extension: 'md',
    collection: 'posts',
    frontmatter: {
      title: 'Test Post 1',
      date: '2024-01-01',
      draft: false,
    },
  },
  {
    id: 'file2',
    path: '/test/project/src/content/posts/post2.md',
    name: 'post2',
    extension: 'md',
    collection: 'posts',
    frontmatter: {
      title: 'Test Post 2',
      date: '2024-01-02',
      draft: true,
    },
  },
]

export const mockFileContent = {
  frontmatter: {
    title: 'Test Post',
    date: '2024-01-01',
    draft: false,
  },
  content: '# Test Content\n\nThis is test content.',
  raw_frontmatter:
    '---\ntitle: "Test Post"\ndate: "2024-01-01"\ndraft: false\n---',
  imports: '',
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'
