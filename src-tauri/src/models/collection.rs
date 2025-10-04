use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub name: String,
    pub path: PathBuf,
    pub schema: Option<String>, // Zod schema as JSON string (fallback)
    pub json_schema: Option<String>, // Astro-generated JSON schema (primary)
}

impl Collection {
    pub fn new(name: String, path: PathBuf) -> Self {
        Self {
            name,
            path,
            schema: None,
            json_schema: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_schema(name: String, path: PathBuf, schema: String) -> Self {
        Self {
            name,
            path,
            schema: Some(schema),
            json_schema: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_json_schema(mut self, json_schema: String) -> Self {
        self.json_schema = Some(json_schema);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_collection_creation() {
        let path = PathBuf::from("/project/src/content/posts");
        let collection = Collection::new("posts".to_string(), path.clone());

        assert_eq!(collection.name, "posts");
        assert_eq!(collection.path, path);
        assert!(collection.schema.is_none());
    }

    #[test]
    fn test_collection_with_schema() {
        let schema = r#"
        z.object({
            title: z.string(),
            description: z.string().optional(),
            pubDate: z.coerce.date(),
            draft: z.boolean().default(false),
        })
        "#;

        let path = PathBuf::from("/project/src/content/blog");
        let collection =
            Collection::with_schema("blog".to_string(), path.clone(), schema.to_string());

        assert_eq!(collection.name, "blog");
        assert_eq!(collection.path, path);
        assert!(collection.schema.is_some());
        assert!(collection.schema.unwrap().contains("title"));
    }
}
