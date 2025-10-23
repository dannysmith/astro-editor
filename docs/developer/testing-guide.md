# Testing Guide

Comprehensive testing strategies for the Astro Editor codebase.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Testing Stack](#testing-stack)
- [Test Types](#test-types)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Component Tests](#component-tests)
- [Testing Frontmatter Field Components](#testing-frontmatter-field-components)
- [Testing Patterns](#testing-patterns)
- [Running Tests](#running-tests)

## Testing Philosophy

**Core Principles:**

1. **Test behavior, not implementation** - Focus on what the code does, not how it does it
2. **Write tests for business logic** - Prioritize testing complex logic over simple UI rendering
3. **Integration over isolation** - Prefer integration tests that verify workflows over isolated unit tests
4. **Test user interactions** - Focus on how users interact with the application

**What to Test:**

- ✅ Business logic and algorithms
- ✅ Complex state management
- ✅ User interactions and workflows
- ✅ Edge cases and error handling
- ✅ Integration between systems

**What NOT to Test:**

- ❌ Simple UI rendering (unless it has business logic)
- ❌ Third-party library internals
- ❌ Trivial getters/setters
- ❌ Implementation details that users don't care about

## Testing Stack

### Frontend (TypeScript/React)

- **Test Runner**: Vitest v3.x
- **React Testing**: React Testing Library
- **Utilities**: @testing-library/user-event, @testing-library/jest-dom

### Backend (Rust)

- **Test Framework**: Cargo's built-in testing (`cargo test`)
- **Test Organization**: Tests live alongside implementation in `#[cfg(test)]` modules

## Test Types

### 1. Unit Tests

**Purpose**: Test individual functions and modules in isolation

**Location**: Alongside implementation or in `__tests__/` directories

**When to Write:**
- Pure functions with complex logic
- Utility functions used across the codebase
- Business logic that can be tested independently

### 2. Integration Tests

**Purpose**: Test how multiple units work together

**Location**:
- Frontend: `src/__tests__/integration/`
- Rust: `src-tauri/tests/`

**When to Write:**
- Testing interactions between stores and queries
- Verifying data flow through multiple layers
- Testing Tauri command integration

### 3. Component Tests

**Purpose**: Test React components with user interactions

**Location**: Next to component files or in `__tests__/` directories

**When to Write:**
- Components with complex user interactions
- Form components with validation
- Components that integrate multiple systems

## Unit Tests

Unit tests focus on testing individual functions and modules in isolation.

### Testing Modules (`lib/`)

```typescript
// lib/editor/markdown/formatting.test.ts
import { describe, it, expect } from 'vitest'
import { toggleMarkdown, wrapSelection } from './formatting'

describe('toggleMarkdown', () => {
  it('should wrap selection with markers', () => {
    const text = 'Hello world'
    const result = toggleMarkdown(text, 0, 5, '**')
    expect(result.text).toBe('**Hello** world')
    expect(result.selectionStart).toBe(2)
    expect(result.selectionEnd).toBe(7)
  })

  it('should remove markers if already wrapped', () => {
    const text = '**Hello** world'
    const result = toggleMarkdown(text, 0, 9, '**')
    expect(result.text).toBe('Hello world')
    expect(result.selectionStart).toBe(0)
    expect(result.selectionEnd).toBe(5)
  })

  it('should handle empty selection', () => {
    const text = 'Hello world'
    const result = toggleMarkdown(text, 5, 5, '**')
    expect(result.text).toBe('Hello**** world')
  })
})
```

### Testing Utilities

```typescript
// lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn, formatDate, slugify } from './utils'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })
})

describe('slugify', () => {
  it('should convert text to URL-safe slug', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('  Spaces  ')).toBe('spaces')
    expect(slugify('Special-Characters!')).toBe('special-characters')
  })
})
```

### Testing Rust Functions

```rust
// src-tauri/src/file_operations.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_read_file_content() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.md");

        fs::write(&file_path, "# Test Content").unwrap();

        let result = read_file_content(file_path.to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "# Test Content");
    }

    #[test]
    fn test_validate_frontmatter() {
        let valid_fm = r#"---
title: "Test"
date: 2024-01-01
---"#;

        assert!(validate_frontmatter(valid_fm).is_ok());

        let invalid_fm = "---\ninvalid yaml: [unclosed\n---";
        assert!(validate_frontmatter(invalid_fm).is_err());
    }
}
```

## Integration Tests

Integration tests verify how multiple parts of the system work together.

### Testing Hooks with React Testing Library

```typescript
// hooks/editor/useEditorHandlers.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorHandlers } from './useEditorHandlers'
import { useEditorStore } from '@/store/editorStore'

describe('useEditorHandlers', () => {
  beforeEach(() => {
    // Reset store state
    useEditorStore.setState({
      currentFile: null,
      editorContent: '',
      isDirty: false,
    })
  })

  it('should save on blur when dirty', async () => {
    const saveSpy = vi.spyOn(useEditorStore.getState(), 'saveFile')

    useEditorStore.setState({
      currentFile: { id: 'test', name: 'test.md' },
      isDirty: true,
    })

    const { result } = renderHook(() => useEditorHandlers())

    await act(async () => {
      await result.current.handleBlur()
    })

    expect(saveSpy).toHaveBeenCalled()
  })

  it('should not save when not dirty', async () => {
    const saveSpy = vi.spyOn(useEditorStore.getState(), 'saveFile')

    useEditorStore.setState({
      currentFile: { id: 'test', name: 'test.md' },
      isDirty: false,
    })

    const { result } = renderHook(() => useEditorHandlers())

    await act(async () => {
      await result.current.handleBlur()
    })

    expect(saveSpy).not.toHaveBeenCalled()
  })
})
```

### Testing Store Integration

```typescript
// store/__tests__/editorStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentFile: null,
      editorContent: '',
      frontmatter: {},
      isDirty: false,
    })
  })

  it('should update frontmatter field', () => {
    useEditorStore.getState().updateFrontmatterField('title', 'Test Title')

    expect(useEditorStore.getState().frontmatter.title).toBe('Test Title')
    expect(useEditorStore.getState().isDirty).toBe(true)
  })

  it('should mark file as dirty when content changes', () => {
    useEditorStore.getState().setEditorContent('New content')

    expect(useEditorStore.getState().editorContent).toBe('New content')
    expect(useEditorStore.getState().isDirty).toBe(true)
  })

  it('should reset dirty flag after save', async () => {
    useEditorStore.setState({
      currentFile: { id: 'test', name: 'test.md', path: '/test.md' },
      isDirty: true,
    })

    await useEditorStore.getState().saveFile()

    expect(useEditorStore.getState().isDirty).toBe(false)
  })
})
```

## Component Tests

Component tests focus on user interactions and integrated behavior.

### Testing with User Events

```typescript
// components/layout/EditorView.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorView } from './EditorView'

describe('EditorView', () => {
  it('should trigger save on Cmd+S', async () => {
    const user = userEvent.setup()
    const saveSpy = vi.spyOn(useEditorStore.getState(), 'saveFile')

    render(<EditorView />)

    const editor = screen.getByRole('textbox')
    await user.type(editor, 'Test content')
    await user.keyboard('{Meta>}s{/Meta}')

    expect(saveSpy).toHaveBeenCalled()
  })

  it('should show unsaved indicator when dirty', async () => {
    const user = userEvent.setup()

    render(<EditorView />)

    const editor = screen.getByRole('textbox')
    await user.type(editor, 'Modified')

    expect(screen.getByText(/unsaved/i)).toBeInTheDocument()
  })
})
```

### Testing Form Components

```typescript
// components/frontmatter/FrontmatterPanel.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FrontmatterPanel } from './FrontmatterPanel'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('FrontmatterPanel', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentFile: {
        id: 'test',
        name: 'test.md',
        collection: 'blog',
      },
      frontmatter: {
        title: 'Test Post',
        date: '2024-01-01',
      },
    })
  })

  it('should display frontmatter fields', () => {
    render(<FrontmatterPanel />, { wrapper: createWrapper() })

    expect(screen.getByLabelText(/title/i)).toHaveValue('Test Post')
    expect(screen.getByLabelText(/date/i)).toHaveValue('2024-01-01')
  })

  it('should update frontmatter on input change', async () => {
    const user = userEvent.setup()

    render(<FrontmatterPanel />, { wrapper: createWrapper() })

    const titleInput = screen.getByLabelText(/title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Title')

    await waitFor(() => {
      expect(useEditorStore.getState().frontmatter.title).toBe('Updated Title')
      expect(useEditorStore.getState().isDirty).toBe(true)
    })
  })
})
```

## Testing Frontmatter Field Components

For complex field components with business logic, use focused unit tests.

### When to Test Field Components

**Test these aspects:**
- Complex validation logic (e.g., ArrayField string-only validation)
- Schema default handling (e.g., BooleanField's `getBooleanValue`)
- Orchestration logic (e.g., FrontmatterField's type selection)
- Edge cases that are hard to reproduce in integration tests

**Don't test:**
- Simple UI rendering
- Third-party component behavior
- CSS styling

### Example: ArrayField Unit Tests

```typescript
// components/frontmatter/fields/__tests__/ArrayField.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArrayField } from '../ArrayField'
import { useEditorStore } from '@/store/editorStore'

describe('ArrayField Component', () => {
  beforeEach(() => {
    useEditorStore.setState({
      frontmatter: {},
    })
  })

  describe('Array Validation Logic', () => {
    it('should handle proper string arrays', async () => {
      const user = userEvent.setup()

      useEditorStore.setState({
        frontmatter: { tags: ['javascript', 'react'] },
      })

      render(<ArrayField name="tags" label="Tags" required={false} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'typescript{Enter}')

      expect(useEditorStore.getState().frontmatter.tags).toEqual([
        'javascript',
        'react',
        'typescript',
      ])
    })

    it('should handle arrays with non-string values', () => {
      useEditorStore.setState({
        frontmatter: { tags: [1, 'two', true, null] },
      })

      render(<ArrayField name="tags" label="Tags" required={false} />)

      // Should convert all values to strings
      const tags = screen.getAllByRole('tag')
      expect(tags).toHaveLength(4)
      expect(tags[0]).toHaveTextContent('1')
      expect(tags[1]).toHaveTextContent('two')
      expect(tags[2]).toHaveTextContent('true')
      expect(tags[3]).toHaveTextContent('null')
    })

    it('should handle undefined and empty arrays', () => {
      useEditorStore.setState({
        frontmatter: { tags: undefined },
      })

      render(<ArrayField name="tags" label="Tags" required={false} />)

      expect(screen.queryByRole('tag')).not.toBeInTheDocument()
    })
  })
})
```

### Example: BooleanField Unit Tests

```typescript
// components/frontmatter/fields/__tests__/BooleanField.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BooleanField } from '../BooleanField'
import { useEditorStore } from '@/store/editorStore'

describe('BooleanField Component', () => {
  describe('getBooleanValue Logic', () => {
    it('should handle explicit boolean values', () => {
      useEditorStore.setState({ frontmatter: { draft: true } })
      render(<BooleanField name="draft" label="Draft" required={false} />)
      expect(screen.getByRole('switch')).toBeChecked()

      useEditorStore.setState({ frontmatter: { draft: false } })
      render(<BooleanField name="draft" label="Draft" required={false} />)
      expect(screen.getByRole('switch')).not.toBeChecked()
    })

    it('should use schema default when value is undefined', () => {
      useEditorStore.setState({ frontmatter: {} })

      const field = {
        type: 'boolean' as const,
        default: true,
      }

      render(<BooleanField name="draft" label="Draft" required={false} field={field} />)
      expect(screen.getByRole('switch')).toBeChecked()
    })

    it('should fall back to false when no value or default', () => {
      useEditorStore.setState({ frontmatter: {} })
      render(<BooleanField name="draft" label="Draft" required={false} />)
      expect(screen.getByRole('switch')).not.toBeChecked()
    })
  })
})
```

## Testing Patterns

### Mocking Tauri Commands

```typescript
// __mocks__/@tauri-apps/api/core.ts
export const invoke = vi.fn()

// In tests
import { invoke } from '@tauri-apps/api/core'

vi.mocked(invoke).mockResolvedValue({ collections: [...] })
```

### Testing with TanStack Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
)

render(<Component />, { wrapper })
```

### Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react'

it('should load data asynchronously', async () => {
  render(<DataComponent />)

  expect(screen.getByText(/loading/i)).toBeInTheDocument()

  await waitFor(() => {
    expect(screen.getByText(/data loaded/i)).toBeInTheDocument()
  })
})
```

### Testing Error States

```typescript
it('should display error message on failure', async () => {
  vi.mocked(invoke).mockRejectedValue(new Error('Failed to load'))

  render(<DataComponent />)

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument()
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  })
})
```

## Running Tests

### Frontend Tests

```bash
# Run all tests in watch mode
pnpm run test

# Run tests once (CI mode)
pnpm run test:run

# Run tests with coverage
pnpm run test:coverage

# Run specific test file
pnpm run test src/components/MyComponent.test.tsx

# Run tests matching pattern
pnpm run test:run --grep "ArrayField"
```

### Rust Tests

```bash
# Run all Rust tests
cargo test

# Run specific test
cargo test test_validate_frontmatter

# Run with output
cargo test -- --nocapture

# Run with backtrace
RUST_BACKTRACE=1 cargo test

# Run integration tests only
cargo test --test integration_tests
```

### Running All Tests

```bash
# Run all checks including tests
pnpm run check:all
```

## Testing Strategy Summary

**Integration Tests** (Preferred):
- Cover happy path and user workflows
- Test real interactions between systems
- Provide confidence in actual behavior

**Unit Tests** (When Needed):
- Test complex business logic
- Cover edge cases
- Test algorithms and utilities

**Component Tests** (Selective):
- Test user interactions
- Verify accessibility
- Test complex UI state

**Focus on**:
- Testing behavior users care about
- Business logic correctness
- Integration between systems
- Error handling

**Avoid**:
- Testing implementation details
- Over-mocking (prefer integration)
- Testing third-party code
- Trivial tests that don't add value

---

**Remember**: Write tests that give you confidence, not just coverage. A few well-written integration tests are worth more than dozens of fragile unit tests.
