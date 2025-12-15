//! Path normalization utilities for cross-platform consistency.
//!
//! Windows uses backslashes (`C:\Users\foo`) but our frontend assumes forward slashes.
//! By normalizing paths during serialization, the frontend works unchanged regardless
//! of the underlying platform.

use serde::{self, Serialize, Serializer};
use std::path::Path;

/// Normalizes a path to use forward slashes for consistent frontend handling.
/// Windows paths like `C:\Users\foo` become `C:/Users/foo`.
pub fn normalize_path_for_serialization(path: &Path) -> String {
    path.display().to_string().replace('\\', "/")
}

/// Serialize a PathBuf as a normalized string with forward slashes.
/// Use with `#[serde(serialize_with = "serialize_path")]`
pub fn serialize_path<S>(path: &Path, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    normalize_path_for_serialization(path).serialize(serializer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    #[test]
    fn test_normalize_unix_path() {
        let path = Path::new("/Users/danny/projects/test");
        assert_eq!(
            normalize_path_for_serialization(path),
            "/Users/danny/projects/test"
        );
    }

    #[test]
    fn test_normalize_windows_path() {
        // Test with a string that contains backslashes (simulating Windows path)
        let path_str = r"C:\Users\danny\projects\test";
        let path = Path::new(path_str);
        let normalized = normalize_path_for_serialization(path);

        // On Unix, PathBuf treats backslashes as part of the filename,
        // but our normalize function still replaces them
        assert!(!normalized.contains('\\'), "Should not contain backslashes");
        assert!(normalized.contains('/'), "Should contain forward slashes");
    }

    #[test]
    fn test_normalize_mixed_path() {
        // Path with mixed separators
        let path_str = r"C:\Users/danny\projects/test";
        let path = Path::new(path_str);
        let normalized = normalize_path_for_serialization(path);

        assert!(!normalized.contains('\\'), "Should not contain backslashes");
    }

    #[test]
    fn test_normalize_relative_path() {
        let path = Path::new("posts/2024/my-post.md");
        assert_eq!(
            normalize_path_for_serialization(path),
            "posts/2024/my-post.md"
        );
    }

    #[test]
    fn test_normalize_windows_relative_path() {
        let path_str = r"posts\2024\my-post.md";
        let path = Path::new(path_str);
        let normalized = normalize_path_for_serialization(path);

        assert!(!normalized.contains('\\'), "Should not contain backslashes");
    }

    #[test]
    fn test_normalize_empty_path() {
        let path = Path::new("");
        assert_eq!(normalize_path_for_serialization(path), "");
    }

    #[test]
    fn test_normalize_root_only() {
        let path = Path::new("/");
        assert_eq!(normalize_path_for_serialization(path), "/");
    }

    #[test]
    fn test_serialize_path() {
        use serde_json;

        #[derive(Serialize)]
        struct TestStruct {
            #[serde(serialize_with = "serialize_path")]
            path: PathBuf,
        }

        let test = TestStruct {
            path: PathBuf::from("/test/path"),
        };

        let json = serde_json::to_string(&test).unwrap();
        assert_eq!(json, r#"{"path":"/test/path"}"#);
    }

    #[test]
    fn test_serialize_windows_path() {
        use serde_json;

        #[derive(Serialize)]
        struct TestStruct {
            #[serde(serialize_with = "serialize_path")]
            path: PathBuf,
        }

        // Simulate a Windows-style path string
        let test = TestStruct {
            path: PathBuf::from(r"C:\Users\test\file.md"),
        };

        let json = serde_json::to_string(&test).unwrap();
        // The path should be normalized to forward slashes
        assert!(
            !json.contains("\\\\"),
            "JSON should not contain escaped backslashes"
        );
    }

    #[test]
    fn test_normalize_windows_drive_letter() {
        // Test Windows drive letter paths (simulated)
        let path_str = r"C:\Users\danny\projects\astro-site";
        let path = Path::new(path_str);
        let normalized = normalize_path_for_serialization(path);

        // Should convert backslashes to forward slashes
        assert!(
            normalized.contains("C:") || normalized.contains("/"),
            "Path should preserve drive letter or have slashes"
        );
        assert!(!normalized.contains('\\'), "Should not contain backslashes");
    }

    #[test]
    fn test_normalize_deeply_nested_path() {
        let path_str = r"posts\2024\01\15\my-first-post.md";
        let path = Path::new(path_str);
        let normalized = normalize_path_for_serialization(path);

        // Count the number of forward slashes - should have 4
        let slash_count = normalized.chars().filter(|&c| c == '/').count();
        assert_eq!(
            slash_count, 4,
            "Should have 4 forward slashes in deeply nested path"
        );
        assert!(!normalized.contains('\\'), "Should not contain backslashes");
    }

    #[test]
    fn test_normalize_path_with_spaces() {
        let path_str = r"C:\Users\Some User\My Documents\project";
        let path = Path::new(path_str);
        let normalized = normalize_path_for_serialization(path);

        assert!(normalized.contains("Some User"), "Should preserve spaces");
        assert!(
            normalized.contains("My Documents"),
            "Should preserve spaces in path"
        );
        assert!(!normalized.contains('\\'), "Should not contain backslashes");
    }

    #[test]
    fn test_normalize_preserves_special_characters() {
        let path = Path::new("posts/hello-world_2024.md");
        let normalized = normalize_path_for_serialization(path);

        assert!(normalized.contains('-'), "Should preserve hyphens");
        assert!(normalized.contains('_'), "Should preserve underscores");
        assert!(normalized.contains('.'), "Should preserve dots");
    }

    #[test]
    fn test_serialize_collection_style_path() {
        use serde_json;

        #[derive(Serialize)]
        struct Collection {
            name: String,
            #[serde(serialize_with = "serialize_path")]
            path: PathBuf,
        }

        let collection = Collection {
            name: "posts".to_string(),
            path: PathBuf::from("/Users/danny/project/src/content/posts"),
        };

        let json = serde_json::to_string(&collection).unwrap();
        assert!(json.contains("/Users/danny/project/src/content/posts"));
        assert!(!json.contains("\\\\"));
    }
}
