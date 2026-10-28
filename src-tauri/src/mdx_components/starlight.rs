//! Starlight's built-in components (`@astrojs/starlight/components`), offered by the
//! component builder in projects that use Starlight. Their props are generated from
//! Starlight's types by `scripts/starlight-components/generate.ts`, rather than read
//! from the project's `node_modules`, whose layout changes between versions.

use crate::models::MdxComponent;
use serde::Deserialize;
use std::fs;
use std::path::Path;

#[derive(Deserialize)]
struct StarlightComponents {
    components: Vec<MdxComponent>,
}

/// Whether the project's `package.json` depends on Starlight
pub fn uses_starlight(project_root: &Path) -> bool {
    let Ok(text) = fs::read_to_string(project_root.join("package.json")) else {
        return false;
    };
    let Ok(package) = serde_json::from_str::<serde_json::Value>(&text) else {
        return false;
    };
    ["dependencies", "devDependencies"]
        .iter()
        .any(|key| package[key].get("@astrojs/starlight").is_some())
}

/// Starlight's components, from the bundled list
pub fn components() -> Vec<MdxComponent> {
    serde_json::from_str::<StarlightComponents>(include_str!("starlight-components.json"))
        .map(|list| list.components)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn bundled_list_loads() {
        let components = components();
        assert_eq!(components.len(), 12);
        assert!(components
            .iter()
            .all(|c| c.import_source.as_deref() == Some("@astrojs/starlight/components")));
    }

    #[test]
    fn detects_starlight_from_package_json() {
        let dir = TempDir::new().unwrap();
        assert!(!uses_starlight(dir.path()));

        let package = dir.path().join("package.json");
        fs::write(&package, r#"{ "dependencies": { "astro": "^7" } }"#).unwrap();
        assert!(!uses_starlight(dir.path()));

        fs::write(
            &package,
            r#"{ "devDependencies": { "@astrojs/starlight": "^0.42" } }"#,
        )
        .unwrap();
        assert!(uses_starlight(dir.path()));
    }
}
