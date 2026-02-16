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
    a.0.cmp(&b.0).then(a.1.cmp(&b.1)).then(a.2.cmp(&b.2))
}

/// Filter and combine release notes from a list of GitHub releases.
/// Returns bodies for versions between current (exclusive) and new (inclusive),
/// sorted reverse chronologically and joined with horizontal rules.
fn filter_and_combine_releases(
    releases: Vec<GitHubRelease>,
    current: (u64, u64, u64),
    new: (u64, u64, u64),
) -> String {
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

    relevant
        .into_iter()
        .map(|(_, body)| body)
        .collect::<Vec<_>>()
        .join("\n\n---\n\n")
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
    let new =
        parse_version(&new_version).ok_or_else(|| format!("Invalid new version: {new_version}"))?;

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

    Ok(filter_and_combine_releases(releases, current, new))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cmp::Ordering;

    // -- parse_version tests --

    #[test]
    fn parse_version_basic() {
        assert_eq!(parse_version("1.0.8"), Some((1, 0, 8)));
    }

    #[test]
    fn parse_version_with_v_prefix() {
        assert_eq!(parse_version("v1.0.8"), Some((1, 0, 8)));
    }

    #[test]
    fn parse_version_large_numbers() {
        assert_eq!(parse_version("10.20.300"), Some((10, 20, 300)));
    }

    #[test]
    fn parse_version_zero() {
        assert_eq!(parse_version("0.0.0"), Some((0, 0, 0)));
    }

    #[test]
    fn parse_version_invalid_empty() {
        assert_eq!(parse_version(""), None);
    }

    #[test]
    fn parse_version_invalid_two_parts() {
        assert_eq!(parse_version("1.0"), None);
    }

    #[test]
    fn parse_version_invalid_four_parts() {
        assert_eq!(parse_version("1.0.0.0"), None);
    }

    #[test]
    fn parse_version_invalid_non_numeric() {
        assert_eq!(parse_version("1.0.beta"), None);
    }

    #[test]
    fn parse_version_invalid_just_v() {
        assert_eq!(parse_version("v"), None);
    }

    // -- version_cmp tests --

    #[test]
    fn version_cmp_equal() {
        assert_eq!(version_cmp((1, 0, 8), (1, 0, 8)), Ordering::Equal);
    }

    #[test]
    fn version_cmp_patch_less() {
        assert_eq!(version_cmp((1, 0, 7), (1, 0, 8)), Ordering::Less);
    }

    #[test]
    fn version_cmp_patch_greater() {
        assert_eq!(version_cmp((1, 0, 9), (1, 0, 8)), Ordering::Greater);
    }

    #[test]
    fn version_cmp_minor_takes_precedence() {
        assert_eq!(version_cmp((1, 1, 0), (1, 0, 9)), Ordering::Greater);
    }

    #[test]
    fn version_cmp_major_takes_precedence() {
        assert_eq!(version_cmp((2, 0, 0), (1, 9, 9)), Ordering::Greater);
    }

    // -- filter_and_combine_releases tests --

    fn make_release(tag: &str, body: &str, draft: bool, prerelease: bool) -> GitHubRelease {
        GitHubRelease {
            tag_name: tag.to_string(),
            body: Some(body.to_string()),
            draft,
            prerelease,
        }
    }

    #[test]
    fn filter_single_release_in_range() {
        let releases = vec![make_release("v1.0.8", "Notes for 1.0.8", false, false)];
        let result = filter_and_combine_releases(releases, (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "Notes for 1.0.8");
    }

    #[test]
    fn filter_multiple_releases_reverse_chronological() {
        let releases = vec![
            make_release("v1.0.6", "Notes 1.0.6", false, false),
            make_release("v1.0.8", "Notes 1.0.8", false, false),
            make_release("v1.0.7", "Notes 1.0.7", false, false),
        ];
        let result = filter_and_combine_releases(releases, (1, 0, 5), (1, 0, 8));
        assert_eq!(result, "Notes 1.0.8\n\n---\n\nNotes 1.0.7\n\n---\n\nNotes 1.0.6");
    }

    #[test]
    fn filter_excludes_current_version() {
        let releases = vec![
            make_release("v1.0.7", "Notes 1.0.7", false, false),
            make_release("v1.0.8", "Notes 1.0.8", false, false),
        ];
        let result = filter_and_combine_releases(releases, (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "Notes 1.0.8");
    }

    #[test]
    fn filter_includes_new_version() {
        let releases = vec![make_release("v1.0.8", "Notes 1.0.8", false, false)];
        let result = filter_and_combine_releases(releases, (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "Notes 1.0.8");
    }

    #[test]
    fn filter_excludes_versions_above_new() {
        let releases = vec![
            make_release("v1.0.8", "Notes 1.0.8", false, false),
            make_release("v1.0.9", "Notes 1.0.9", false, false),
        ];
        let result = filter_and_combine_releases(releases, (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "Notes 1.0.8");
    }

    #[test]
    fn filter_excludes_drafts() {
        let releases = vec![
            make_release("v1.0.8", "Draft notes", true, false),
            make_release("v1.0.7", "Published notes", false, false),
        ];
        let result = filter_and_combine_releases(releases, (1, 0, 6), (1, 0, 8));
        assert_eq!(result, "Published notes");
    }

    #[test]
    fn filter_excludes_prereleases() {
        let releases = vec![
            make_release("v1.0.8", "Prerelease notes", false, true),
            make_release("v1.0.7", "Stable notes", false, false),
        ];
        let result = filter_and_combine_releases(releases, (1, 0, 6), (1, 0, 8));
        assert_eq!(result, "Stable notes");
    }

    #[test]
    fn filter_no_matching_releases_returns_empty() {
        let releases = vec![make_release("v1.0.5", "Old notes", false, false)];
        let result = filter_and_combine_releases(releases, (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "");
    }

    #[test]
    fn filter_empty_releases_returns_empty() {
        let result = filter_and_combine_releases(vec![], (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "");
    }

    #[test]
    fn filter_skips_unparseable_tags() {
        let releases = vec![
            make_release("nightly", "Nightly notes", false, false),
            make_release("v1.0.8", "Notes 1.0.8", false, false),
        ];
        let result = filter_and_combine_releases(releases, (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "Notes 1.0.8");
    }

    #[test]
    fn filter_handles_empty_body() {
        let releases = vec![GitHubRelease {
            tag_name: "v1.0.8".to_string(),
            body: None,
            draft: false,
            prerelease: false,
        }];
        let result = filter_and_combine_releases(releases, (1, 0, 7), (1, 0, 8));
        assert_eq!(result, "");
    }
}
