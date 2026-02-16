use serde::Deserialize;

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    body: Option<String>,
    draft: bool,
    prerelease: bool,
}

/// Parse a version string like "1.0.8" or "v1.0.8" into (major, minor, patch)
fn parse_version(version: &str) -> Option<(u64, u64, u64)> {
    let v = version.strip_prefix('v').unwrap_or(version);
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

/// Compare two version tuples. Returns Ordering.
fn version_cmp(a: (u64, u64, u64), b: (u64, u64, u64)) -> std::cmp::Ordering {
    a.0.cmp(&b.0)
        .then(a.1.cmp(&b.1))
        .then(a.2.cmp(&b.2))
}

/// Fetch release notes from GitHub Releases API for all versions between
/// current_version (exclusive) and new_version (inclusive).
/// Returns combined markdown bodies in reverse chronological order.
#[tauri::command]
#[specta::specta]
pub async fn fetch_release_notes(
    current_version: String,
    new_version: String,
) -> Result<String, String> {
    let current = parse_version(&current_version)
        .ok_or_else(|| format!("Invalid current version: {current_version}"))?;
    let new = parse_version(&new_version)
        .ok_or_else(|| format!("Invalid new version: {new_version}"))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("astro-editor")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let releases: Vec<GitHubRelease> = client
        .get("https://api.github.com/repos/dannysmith/astro-editor/releases")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse releases: {e}"))?;

    // Filter to published releases between current and new version
    let mut relevant: Vec<_> = releases
        .into_iter()
        .filter(|r| !r.draft && !r.prerelease)
        .filter_map(|r| {
            let v = parse_version(&r.tag_name)?;
            // Include versions: current < v <= new
            if version_cmp(v, current) == std::cmp::Ordering::Greater
                && version_cmp(v, new) != std::cmp::Ordering::Greater
            {
                Some((v, r.body.unwrap_or_default()))
            } else {
                None
            }
        })
        .collect();

    // Sort reverse chronologically (newest first)
    relevant.sort_by(|a, b| version_cmp(b.0, a.0));

    if relevant.is_empty() {
        return Ok(String::new());
    }

    // Concatenate release bodies separated by horizontal rules
    let combined = relevant
        .into_iter()
        .map(|(_, body)| body)
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    Ok(combined)
}
