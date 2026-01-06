/**
 * Domain types for Astro Editor.
 *
 * These types are auto-generated from Rust structs via tauri-specta.
 * This file re-exports them with JSDoc documentation for IDE support.
 *
 * @see src-tauri/src/models/ - Rust source structs
 * @see src/lib/bindings.ts - Generated bindings
 */

// Re-export all domain types from generated bindings
// This ensures type safety across the Tauri IPC boundary
export type {
  /**
   * Represents a markdown file in an Astro content collection.
   *
   * This type is auto-generated from the Rust FileEntry struct.
   * @see src-tauri/src/models/file_entry.rs
   *
   * Fields:
   * - `id` - Unique identifier (relative path from collection root without extension)
   * - `path` - Absolute file path
   * - `name` - Display name (filename without extension)
   * - `extension` - File extension ('md' or 'mdx')
   * - `collection` - Collection this file belongs to
   * - `last_modified` - Unix timestamp of last modification (null when unavailable)
   * - `frontmatter` - Parsed frontmatter data (null when not loaded)
   *
   * Note: Draft status is determined in the frontend using the user-configured
   * draft field from settings, accessed via `file.frontmatter[draftField]`.
   */
  FileEntry,
  /**
   * Markdown file content with parsed YAML frontmatter.
   *
   * This type is auto-generated from the Rust MarkdownContent struct.
   * @see src-tauri/src/commands/files.rs
   *
   * Fields:
   * - `frontmatter` - Parsed frontmatter as key-value pairs
   * - `content` - Markdown content (body, without frontmatter)
   * - `raw_frontmatter` - Raw YAML frontmatter text (between --- delimiters)
   * - `imports` - MDX imports at top of file
   */
  MarkdownContent,
  /**
   * Represents an Astro content collection.
   *
   * This type is auto-generated from the Rust Collection struct.
   * @see src-tauri/src/models/collection.rs
   *
   * Fields:
   * - `name` - Collection name (e.g., "posts", "docs")
   * - `path` - Absolute path to collection directory
   * - `complete_schema` - Serialized CompleteSchema from Rust backend
   */
  Collection,
  /**
   * Directory information for nested collection navigation.
   *
   * This type is auto-generated from the Rust DirectoryInfo struct.
   * @see src-tauri/src/models/directory_info.rs
   *
   * Fields:
   * - `name` - Directory name only (e.g., "2024")
   * - `relative_path` - Path relative to collection root (e.g., "2024/january")
   * - `full_path` - Full filesystem path
   */
  DirectoryInfo,
  /**
   * Result of scanning a directory within a collection.
   * Used for nested navigation like posts/2024/january/
   *
   * Fields:
   * - `subdirectories` - Subdirectories in this directory
   * - `files` - Files in this directory
   */
  DirectoryScanResult,
  /**
   * Information about an MDX component discovered in the project.
   *
   * Fields:
   * - `name` - Component name
   * - `file_path` - Path to component file
   * - `props` - Component props information
   * - `has_slot` - Whether component has a slot
   * - `description` - Component description (from JSDoc)
   * - `framework` - Component framework (astro, react, vue, svelte)
   */
  MdxComponent,
  /**
   * Information about a component prop.
   *
   * Fields:
   * - `name` - Prop name
   * - `prop_type` - TypeScript type as string
   * - `is_optional` - Whether prop is optional
   * - `default_value` - Default value if any
   */
  PropInfo,
  /**
   * Supported component frameworks.
   */
  ComponentFramework,
  /**
   * Application info (version, platform).
   */
  AppInfo,
  /**
   * JSON-compatible value type.
   * Used for dynamic frontmatter data.
   */
  JsonValue,
  /**
   * Result type for Tauri commands.
   * Success: { status: "ok", data: T }
   * Error: { status: "error", error: E }
   */
  Result,
} from '@/lib/bindings'

// Re-export commands for convenience
// This allows importing both types and commands from @/types
export { commands } from '@/lib/bindings'
