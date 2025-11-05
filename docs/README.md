# Documentation Index

This directory contains all documentation for the Astro Editor project.

## Developer Documentation Philosophy

**Purpose**: Developer docs exist to help both human developers and AI agents understand architectural patterns, make consistent decisions, and implement features correctly.

**Key Principles**:

1. **Progressive Disclosure** - Start with `architecture-guide.md` for core patterns, then dive into focused topic docs only when needed
2. **Flat Structure** - No subdirectories. AI agents shouldn't hunt through folders. Clear file naming indicates content.
3. **Right-Sized Docs** - Balance between monolithic (context window bloat) and fragmented (too many tiny docs)
   - Core guides: ~400-500 lines (comprehensive overview)
   - Topic docs: ~150-300 lines (focused deep-dive)
   - Deep references: ~500-1000+ lines (when you need all details)
4. **Single Responsibility** - Each doc covers one focused topic or system
5. **Pattern-Based Naming** - File names describe WHAT docs cover, not implementation details
   - ✅ `state-management.md` (what it covers)
   - ❌ `zustand-guide.md` (implementation detail)
6. **Architecture Guide as Hub** - Most important patterns + references to specialized docs. AI agents regularly check this for compliance.
7. **Avoid Component-Specific Docs** - Component details belong in code comments, not separate docs. Exception: feature implementation examples showing how patterns work together.

**When to Create a New Doc**:

- Topic is fundamental architectural pattern
- System is complex and specific to Astro Editor
- Content is deep reference material (Astro schemas, decisions log)
- Feature serves as implementation example for a feature we are likeley to use as reference for other features in the future, or which significantly diverges from standard patterns in this app (eg. image preview)

**When NOT to Create a New Doc**:

- Component-specific implementation details (use self-documenting code and/or succinct code comments eg JSDoc etc)
- Simple utilities or helpers (self-documenting)
- Temporary patterns that may change
- Fundamental patterns which belong in architecture-guide.md

## Non-Developer Documentation

These files live in `docs/` and are predominantly for humans.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Guidance for contributors to this project.
- **[SECURITY.md](SECURITY.md)** - Standard security policy
- **[user-guide.md](user-guide.md)** - End-user documentation for the application

## Developer Documentation

The docs in `docs/developer` are evergreen reference for humans and AI Agents working on this codebase.

### Core Guides (Start Here)

The most important developer docs.

- **[developer/architecture-guide.md](developer/architecture-guide.md)** - ESSENTIAL architectural patterns used in Astro Editor.
- **[developer/performance-guide.md](developer/performance-guide.md)** - Important patterns & guidance for maintaining performance.
- **[developer/testing-guide.md](developer/testing-guide.md)** - Testing strategies and patterns

### System Documentation

Other fundamenal developer documentation.

- **[developer/form-patterns.md](developer/form-patterns.md)** - Frontmatter field components and settings forms
- **[developer/schema-system.md](developer/schema-system.md)** - Rust-based schema parsing and merging
- **[developer/keyboard-shortcuts.md](developer/keyboard-shortcuts.md)** - Implementing keyboard shortcuts with react-hotkeys-hook
- **[developer/preferences-system.md](developer/preferences-system.md)** - Three-tier settings hierarchy and management
- **[developer/color-system.md](developer/color-system.md)** - Color tokens, CSS variables, and dark mode
- **[developer/toast-system.md](developer/toast-system.md)** - Notification system (Rust ↔ TypeScript)
- **[developer/editor-styles.md](developer/editor-styles.md)** - Custom CodeMirror syntax highlighting and typography
- **[developer/recovery-system.md](developer/recovery-system.md)** - Crash recovery and auto-save resilience
- **[developer/logging.md](developer/logging.md)** - Logging system
- **[developer/release-process.md](developer/release-process.md)** - Release workflow and versioning

### Reference Documentation

Very detailed background context which may occasonally be needed and is difficult to get via web searches and fetches.

- **[developer/astro-generated-contentcollection-schemas.md](developer/astro-generated-contentcollection-schemas.md)** - Comprehensive Astro JSON Schema generation reference
- **[developer/apple-signing-setup.md](developer/apple-signing-setup.md)** - macOS code signing and notarization

### Feature & Component Documentation

Feature or component-specific docs which experience has proven important for AI Agents working in these areas. Keep these to a minimum.

- **[developer/unified-title-bar.md](developer/unified-title-bar.md)** - Main toolbar component implementation
- **[developer/image-preview-implementation.md](developer/image-preview-implementation.md)** - Image field preview and path resolution

### Historical Context

- **[developer/decisions.md](developer/decisions.md)** - Partical Record of architectural decisions and trade-offs. THIS IS UNLIKELEY TO BE ANYWHERE NEAR COMPLETE.

## Task Management

- **[tasks.md](tasks.md)** - Task Management Instructions & Rules for AI Agents.
- **[tasks-done/](tasks-done/)** - Completed tasks. Historical record of completed features and improvements. Will obviously contain outdated information.
- **[tasks-todo/](tasks-todo/)** - Pending project tasks: the backlog. See [tasks.md](tasks.md) for how this works.

## Archive

- **[archive/](archive/)** - Old documents which should almost always be ignored.
