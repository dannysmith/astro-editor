use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FileEntry {
    pub id: String,
    #[specta(type = String)]
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    #[serde(rename = "isDraft")]
    pub is_draft: bool,
    pub collection: String,
    #[specta(type = Option<f64>)]
    pub last_modified: Option<u64>,
    pub frontmatter: Option<IndexMap<String, Value>>, // Basic frontmatter for display → Record<string, unknown>
}

impl FileEntry {
    pub fn new(path: PathBuf, collection: String, collection_root: PathBuf) -> Self {
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        let extension = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        // Calculate relative path from collection root for proper ID generation
        let id = if let Ok(relative_path) = path.strip_prefix(&collection_root) {
            // Convert to string and ensure forward slashes for cross-platform consistency
            let relative_str = relative_path.to_string_lossy().replace('\\', "/");

            // Remove extension from relative path for the ID
            let id_path = if !extension.is_empty() {
                relative_str
                    .strip_suffix(&format!(".{extension}"))
                    .unwrap_or(&relative_str)
            } else {
                &relative_str
            };

            format!("{collection}/{id_path}")
        } else {
            // Fallback to old behavior if strip_prefix fails
            format!("{collection}/{name}")
        };

        // Get file modification time
        let last_modified = std::fs::metadata(&path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs());

        Self {
            id,
            path,
            name,
            extension,
            is_draft: false, // Will be determined by parsing frontmatter
            collection,
            last_modified,
            frontmatter: None, // Will be populated by enhanced scanning
        }
    }

    pub fn with_frontmatter(mut self, frontmatter: IndexMap<String, Value>) -> Self {
        // Check if this file is a draft based on frontmatter
        self.is_draft = frontmatter
            .get("draft")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        self.frontmatter = Some(frontmatter);
        self
    }

    #[allow(dead_code)]
    pub fn is_markdown(&self) -> bool {
        matches!(self.extension.as_str(), "md" | "mdx")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_file_entry_creation() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/hello-world.md");
        let collection = "posts".to_string();

        let entry = FileEntry::new(path.clone(), collection.clone(), collection_root);

        assert_eq!(entry.name, "hello-world");
        assert_eq!(entry.extension, "md");
        assert_eq!(entry.collection, "posts");
        assert_eq!(entry.id, "posts/hello-world");
        assert_eq!(entry.path, path);
        assert!(!entry.is_draft);
        assert!(entry.last_modified.is_none());
    }

    #[test]
    fn test_file_entry_without_extension() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/readme");
        let collection = "docs".to_string();

        let entry = FileEntry::new(path, collection, collection_root);

        assert_eq!(entry.name, "readme");
        assert_eq!(entry.extension, "");
        assert_eq!(entry.id, "docs/readme");
    }

    #[test]
    fn test_is_markdown() {
        let collection_root = PathBuf::from("/test");
        let md_path = PathBuf::from("/test/post.md");
        let mdx_path = PathBuf::from("/test/post.mdx");
        let txt_path = PathBuf::from("/test/post.txt");

        let md_entry = FileEntry::new(md_path, "posts".to_string(), collection_root.clone());
        let mdx_entry = FileEntry::new(mdx_path, "posts".to_string(), collection_root.clone());
        let txt_entry = FileEntry::new(txt_path, "posts".to_string(), collection_root);

        assert!(md_entry.is_markdown());
        assert!(mdx_entry.is_markdown());
        assert!(!txt_entry.is_markdown());
    }

    #[test]
    fn test_special_characters_in_filename() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/hello-world_2024.md");
        let collection = "posts".to_string();

        let entry = FileEntry::new(path, collection, collection_root);

        assert_eq!(entry.name, "hello-world_2024");
        assert_eq!(entry.extension, "md");
        assert_eq!(entry.id, "posts/hello-world_2024");
    }

    #[test]
    fn test_with_frontmatter_draft_detection() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/draft-post.md");
        let collection = "posts".to_string();

        let mut frontmatter = IndexMap::new();
        frontmatter.insert("draft".to_string(), serde_json::Value::Bool(true));
        frontmatter.insert(
            "title".to_string(),
            serde_json::Value::String("Draft Post".to_string()),
        );

        let entry = FileEntry::new(path, collection, collection_root).with_frontmatter(frontmatter);

        assert!(entry.is_draft);
        assert_eq!(
            entry.frontmatter.as_ref().unwrap().get("title").unwrap(),
            "Draft Post"
        );
    }

    #[test]
    fn test_with_frontmatter_no_draft_field() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/published-post.md");
        let collection = "posts".to_string();

        let mut frontmatter = IndexMap::new();
        frontmatter.insert(
            "title".to_string(),
            serde_json::Value::String("Published Post".to_string()),
        );

        let entry = FileEntry::new(path, collection, collection_root).with_frontmatter(frontmatter);

        assert!(!entry.is_draft); // Should default to false when no draft field
    }

    #[test]
    fn test_with_frontmatter_draft_false() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/published-post.md");
        let collection = "posts".to_string();

        let mut frontmatter = IndexMap::new();
        frontmatter.insert("draft".to_string(), serde_json::Value::Bool(false));
        frontmatter.insert(
            "title".to_string(),
            serde_json::Value::String("Published Post".to_string()),
        );

        let entry = FileEntry::new(path, collection, collection_root).with_frontmatter(frontmatter);

        assert!(!entry.is_draft);
    }

    #[test]
    fn test_with_frontmatter_draft_non_boolean() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/weird-draft.md");
        let collection = "posts".to_string();

        let mut frontmatter = IndexMap::new();
        frontmatter.insert(
            "draft".to_string(),
            serde_json::Value::String("true".to_string()),
        );

        let entry = FileEntry::new(path, collection, collection_root).with_frontmatter(frontmatter);

        assert!(!entry.is_draft); // Should default to false when draft field is not boolean
    }

    #[test]
    fn test_nested_file_id_generation() {
        let collection_root = PathBuf::from("/test/posts");
        let path = PathBuf::from("/test/posts/2024/january/my-post.md");
        let collection = "posts".to_string();

        let entry = FileEntry::new(path, collection, collection_root);

        assert_eq!(entry.name, "my-post");
        assert_eq!(entry.extension, "md");
        assert_eq!(entry.id, "posts/2024/january/my-post");
    }
}
