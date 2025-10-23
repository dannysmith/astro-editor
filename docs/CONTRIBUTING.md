# Contributing to Astro Editor

This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Rust 1.70+
- macOS development environment (for Tauri)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start development server:
   ```bash
   pnpm run dev
   ```

## Development Workflow

### Before Making Changes

1. Read `docs/developer/architecture-guide.md` for core patterns
2. Check `docs/TASKS.md` for current work
3. Review existing code for established patterns

### Code Quality

Always run before committing:

```bash
pnpm run check:all  # TypeScript + Rust + tests
pnpm run fix:all    # Auto-fix issues
```

### Key Patterns

- **State**: TanStack Query for server state, Zustand for client state, useState for local UI
- **Forms**: Use Direct Store Pattern (not React Hook Form)
- **Code extraction**: Move complex logic to `lib/` modules with tests
- **Performance**: Use `getState()` in callbacks to avoid render cascades

See `docs/developer/architecture-guide.md` for detailed patterns.

### Technology Stack

- **Framework:** Tauri v2 (Rust + React)
- **Frontend:** React 19 + TypeScript
- **State:** TanStack Query v5 + Zustand v5
- **Styling:** Tailwind v4 + shadcn/ui
- **Editor:** CodeMirror 6
- **Testing:** Vitest + React Testing Library

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the established patterns
3. Run `pnpm run check:all` and ensure all checks pass
4. Write or update tests as needed
5. Update documentation if you're adding new patterns
6. Submit a pull request with a clear description

## Code Style

**TypeScript/React:**
- Strict TypeScript enabled
- Direct Store Pattern for forms (not React Hook Form)
- Functional components with hooks
- `kebab-case` directories, `PascalCase` files

**Rust:**
- Modern formatting: `format!("{variable}")`
- Follow Clippy recommendations
- Tauri v2 APIs only

## Testing

Write tests for:
- Business logic in `lib/` modules (unit tests)
- User workflows (integration tests)
- Complex field components (component tests)

Use Vitest + React Testing Library.

## Documentation

- Update `docs/developer/architecture-guide.md` when adding new patterns
- Document public APIs with JSDoc
- Keep `CLAUDE.md` current for major architectural changes

## Questions?

- Check existing documentation in `/docs/developer/`
- Review similar patterns in the codebase
- Open an issue for architectural questions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
