/**
 * Domain types for Astro Editor.
 *
 * These types mirror Rust structs from src-tauri/src/models/ and are used
 * to represent data passed between the Tauri backend and React frontend.
 */

/**
 * Represents a markdown file in an Astro content collection.
 *
 * This type mirrors the Rust FileEntry struct from src-tauri/src/models/file_entry.rs
 * and is returned by Tauri commands like scan_collection_files.
 */
export interface FileEntry {
  /** Unique identifier (relative path from collection root without extension) */
  id: string

  /** Absolute file path */
  path: string

  /** Display name (filename without extension) */
  name: string

  /** File extension ('md' or 'mdx') */
  extension: string

  /** Is this file marked as draft? (from frontmatter or naming convention) */
  isDraft: boolean

  /** Collection this file belongs to */
  collection: string

  /** Unix timestamp of last modification */
  last_modified?: number

  /** Parsed frontmatter data (optional - not always loaded) */
  frontmatter?: Record<string, unknown>
}

/**
 * Markdown file content with parsed YAML frontmatter.
 *
 * This type mirrors the Rust MarkdownContent struct and is returned
 * by the read_file_content Tauri command.
 */
export interface MarkdownContent {
  /** Parsed frontmatter as key-value pairs */
  frontmatter: Record<string, unknown>

  /** Markdown content (body, without frontmatter) */
  content: string

  /** Raw YAML frontmatter text (between --- delimiters) */
  raw_frontmatter: string

  /** MDX imports at top of file */
  imports: string
}

/**
 * Represents an Astro content collection.
 *
 * This type mirrors the Rust Collection struct from src-tauri/src/models/collection.rs
 * Collections are discovered from src/content/config.ts
 */
export interface Collection {
  /** Collection name (e.g., "posts", "docs") */
  name: string

  /** Absolute path to collection directory */
  path: string

  /**
   * Serialized CompleteSchema from Rust backend.
   * Deserialize with deserializeCompleteSchema() from src/lib/schema.ts
   */
  complete_schema?: string
}

/**
 * Directory information for nested collection navigation.
 *
 * Mirrors Rust DirectoryInfo struct from src-tauri/src/models/directory_info.rs
 */
export interface DirectoryInfo {
  /** Directory name only (e.g., "2024") */
  name: string

  /** Path relative to collection root (e.g., "2024/january") */
  relative_path: string

  /** Full filesystem path */
  full_path: string
}

/**
 * Result of scanning a directory within a collection.
 * Used for nested navigation like posts/2024/january/
 */
export interface DirectoryScanResult {
  /** Subdirectories in this directory */
  subdirectories: DirectoryInfo[]

  /** Files in this directory */
  files: FileEntry[]
}
