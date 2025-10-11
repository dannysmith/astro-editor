use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryInfo {
    pub name: String,          // Just the directory name
    pub relative_path: String, // Path from collection root
    pub full_path: PathBuf,    // Full filesystem path
}

impl DirectoryInfo {
    pub fn new(full_path: PathBuf, collection_root: &PathBuf) -> Result<Self, String> {
        let name = full_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "Invalid directory name".to_string())?
            .to_string();

        let relative_path = if let Ok(rel_path) = full_path.strip_prefix(collection_root) {
            // Convert to string and ensure forward slashes for cross-platform consistency
            rel_path.to_string_lossy().replace('\\', "/")
        } else {
            // If strip_prefix fails, just use the directory name
            name.clone()
        };

        Ok(Self {
            name,
            relative_path,
            full_path,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_directory_info_creation() {
        let collection_root = PathBuf::from("/test/posts");
        let dir_path = PathBuf::from("/test/posts/2024");

        let dir_info = DirectoryInfo::new(dir_path.clone(), &collection_root).unwrap();

        assert_eq!(dir_info.name, "2024");
        assert_eq!(dir_info.relative_path, "2024");
        assert_eq!(dir_info.full_path, dir_path);
    }

    #[test]
    fn test_nested_directory_info() {
        let collection_root = PathBuf::from("/test/posts");
        let dir_path = PathBuf::from("/test/posts/2024/january");

        let dir_info = DirectoryInfo::new(dir_path.clone(), &collection_root).unwrap();

        assert_eq!(dir_info.name, "january");
        assert_eq!(dir_info.relative_path, "2024/january");
        assert_eq!(dir_info.full_path, dir_path);
    }
}
