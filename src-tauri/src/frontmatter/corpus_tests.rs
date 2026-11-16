//! Tests over the content files in `test/`: the MDX corpus in
//! `test/mdx-imports/` and the frontmatter corpus in `test/frontmatter/`

use super::*;
use std::path::{Path, PathBuf};

/// Runs the MDX files in `test/mdx-imports` through reading and saving
#[cfg(test)]
mod mdx_corpus_tests {
    use super::*;

    fn corpus() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../test/mdx-imports")
    }

    fn mdx_files(dir: &Path) -> Vec<PathBuf> {
        let mut paths: Vec<PathBuf> = walkdir::WalkDir::new(dir)
            .into_iter()
            .filter_map(Result::ok)
            .map(|entry| entry.into_path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "mdx"))
            .collect();
        paths.sort();
        paths
    }

    fn name(path: &Path) -> String {
        path.strip_prefix(corpus())
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }

    /// What `save_markdown_content` writes when the frontmatter hasn't been edited
    fn save(parsed: &MarkdownContent) -> String {
        if parsed.raw_frontmatter.trim().is_empty() {
            rebuild_markdown_content_only(&parsed.imports, &parsed.content)
        } else {
            rebuild_markdown_with_raw_frontmatter(
                &parsed.raw_frontmatter,
                &parsed.imports,
                &parsed.content,
            )
        }
        .unwrap()
    }

    fn non_blank_lines(text: &str) -> Vec<&str> {
        text.lines()
            .filter(|line| !line.trim().is_empty())
            .collect()
    }

    #[test]
    fn saving_an_unchanged_file_reads_back_the_same() {
        for path in mdx_files(&corpus()) {
            let name = name(&path);
            let original = std::fs::read_to_string(&path).unwrap();
            let parsed = parse_frontmatter(&original);
            let saved = save(&parsed);

            // Only the blank lines between frontmatter, block and body may change
            assert_eq!(
                non_blank_lines(&saved),
                non_blank_lines(&original),
                "{name}: saving changed more than blank lines"
            );
            let reread = parse_frontmatter(&saved);
            assert_eq!(reread.imports, parsed.imports, "{name}: block changed");
            assert_eq!(reread.content, parsed.content, "{name}: body changed");
        }
    }

    /// The block each file in `files/` hides is kept in `files/blocks.txt`. After
    /// a deliberate change, regenerate it with `UPDATE_SNAPSHOTS=1` and review
    /// the diff.
    #[test]
    fn hidden_blocks_match_the_snapshot() {
        let mut actual = String::from(
            "# The ESM block the editor hides in each file here, and the ESM further down\n\
             # that counts as already imported. Checked by `mdx_corpus_tests` in\n\
             # `src-tauri/src/frontmatter/corpus_tests.rs`.\n",
        );
        for path in mdx_files(&corpus().join("files")) {
            let parsed = parse_frontmatter(&std::fs::read_to_string(&path).unwrap());
            let block = if parsed.imports.is_empty() {
                "(none)"
            } else {
                &parsed.imports
            };
            let name = name(&path);
            let name = name.strip_prefix("files/").unwrap();
            actual.push_str(&format!("\n=== {name}\n{block}\n"));
            // Imports further down, which count as already imported
            for esm in crate::mdx_esm::body_esm(&parsed.content) {
                actual.push_str(&format!("--- further down\n{}\n", esm.text));
            }
        }

        let snapshot = corpus().join("files/blocks.txt");
        if std::env::var_os("UPDATE_SNAPSHOTS").is_some() {
            std::fs::write(&snapshot, actual).unwrap();
            return;
        }
        let expected = std::fs::read_to_string(&snapshot).unwrap_or_default();
        let sections = |text: &str| text.split("\n=== ").map(String::from).collect::<Vec<_>>();
        let first_difference = sections(&actual)
            .into_iter()
            .zip(sections(&expected))
            .find(|(a, e)| a != e);
        assert!(
            actual == expected,
            "Hidden blocks differ from files/blocks.txt, first at:\n{first_difference:#?}\nIf that's intended, rerun with UPDATE_SNAPSHOTS=1 and review the diff."
        );
    }
}

/// Tests over the frontmatter corpus in `test/frontmatter/` (see its README)
#[cfg(test)]
mod frontmatter_corpus_tests {
    use super::*;

    fn test_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../test")
    }

    /// Every Markdown and MDX file under `dir`, sorted
    fn content_files(dir: &Path) -> Vec<PathBuf> {
        let mut paths: Vec<PathBuf> = walkdir::WalkDir::new(dir)
            .into_iter()
            .filter_map(Result::ok)
            .map(|entry| entry.into_path())
            .filter(|path| {
                path.extension()
                    .is_some_and(|ext| ext == "md" || ext == "mdx")
            })
            .collect();
        paths.sort();
        paths
    }

    fn name(path: &Path) -> String {
        path.strip_prefix(test_dir())
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }

    /// What `save_markdown_content` writes when the frontmatter hasn't been edited
    fn save_unchanged(parsed: &MarkdownContent) -> String {
        if parsed.raw_frontmatter.trim().is_empty() {
            rebuild_markdown_content_only(&parsed.imports, &parsed.content)
        } else {
            rebuild_markdown_with_raw_frontmatter(
                &parsed.raw_frontmatter,
                &parsed.imports,
                &parsed.content,
            )
        }
        .unwrap()
    }

    /// Including files whose frontmatter can't be read. Files with an MDX
    /// import block are left to `mdx_corpus_tests`, since the blank lines
    /// around the block may change
    #[test]
    fn saving_unchanged_writes_the_file_back_as_it_was() {
        let mut files = content_files(&test_dir().join("frontmatter/files"));
        files.extend(content_files(&test_dir().join("mdx-imports/files")));
        let mut failures = vec![];
        for path in files {
            // Files are read with LF line endings, and saved with them
            let original = std::fs::read_to_string(&path)
                .unwrap()
                .replace("\r\n", "\n");
            let parsed = parse_frontmatter(&original);
            if parsed.imports.is_empty() && save_unchanged(&parsed) != original {
                failures.push(name(&path));
            }
        }
        assert!(
            failures.is_empty(),
            "Changed by saving: {}",
            failures.join(", ")
        );
    }

    /// What each file in `frontmatter/files/` reads as is kept in
    /// `frontmatter/values.txt`. After a deliberate change, regenerate it with
    /// `UPDATE_SNAPSHOTS=1` and review the diff.
    #[test]
    fn values_match_the_snapshot() {
        let mut actual = String::from(
            "# What the frontmatter of each file in files/ reads as. Checked by\n\
             # `frontmatter_corpus_tests` in `src-tauri/src/frontmatter/corpus_tests.rs`.\n",
        );
        for path in content_files(&test_dir().join("frontmatter/files")) {
            let parsed = parse_frontmatter(&std::fs::read_to_string(&path).unwrap());
            let values = match parsed.frontmatter_error {
                _ if parsed.raw_frontmatter.is_empty() => "(no frontmatter)".to_string(),
                Some(e) => format!("(unreadable) {e}"),
                None => serde_json::to_string_pretty(&parsed.frontmatter).unwrap(),
            };
            let name = name(&path);
            let name = name.strip_prefix("frontmatter/files/").unwrap();
            actual.push_str(&format!("\n=== {name}\n{values}\n"));
        }

        let snapshot = test_dir().join("frontmatter/values.txt");
        if std::env::var_os("UPDATE_SNAPSHOTS").is_some() {
            std::fs::write(&snapshot, actual).unwrap();
            return;
        }
        let expected = std::fs::read_to_string(&snapshot).unwrap_or_default();
        let sections = |text: &str| text.split("\n=== ").map(String::from).collect::<Vec<_>>();
        let first_difference = sections(&actual)
            .into_iter()
            .zip(sections(&expected))
            .find(|(a, e)| a != e);
        assert!(
            actual == expected,
            "Values differ from frontmatter/values.txt, first at:\n{first_difference:#?}\nIf that's intended, rerun with UPDATE_SNAPSHOTS=1 and review the diff."
        );
    }
}
