//! Tests over the content files in `test/`: the MDX corpus in
//! `test/mdx-imports/` and the frontmatter corpus in `test/frontmatter/`

use super::*;
use std::path::{Path, PathBuf};

/// What `save_markdown_content` writes when the frontmatter hasn't been edited
fn save_unchanged(parsed: &MarkdownContent) -> String {
    assemble(&parsed.raw_frontmatter, &parsed.imports, &parsed.content)
}

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
            let saved = save_unchanged(&parsed);

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

    /// A changed value, as an edit in the frontmatter panel might make it
    fn changed(value: &Value) -> Option<Value> {
        Some(match value {
            Value::String(s) if s.len() == 10 && s.as_bytes()[4] == b'-' => "2031-02-03".into(),
            Value::String(s) if s.contains('\n') => format!("{s}\nmore").into(),
            Value::String(s) => format!("{s} edited").into(),
            Value::Bool(b) => (!b).into(),
            Value::Number(n) => (n.as_f64()? + 1.0).into(),
            Value::Null => "now set".into(),
            Value::Array(items) => {
                let mut items = items.clone();
                items.push(items.first().cloned().unwrap_or_else(|| "new".into()));
                items.into()
            }
            Value::Object(map) => {
                let (key, inner) = map.iter().next()?;
                let mut map = map.clone();
                map.insert(key.clone(), changed(inner)?);
                map.into()
            }
        })
    }

    /// Whether `kept` appears in `lines` in order, perhaps with lines between
    fn in_order(kept: &[&str], lines: &[&str]) -> bool {
        let mut lines = lines.iter();
        kept.iter().all(|k| lines.any(|l| l == k))
    }

    /// Edits each top-level key of every file in turn, deletes each one, and
    /// adds one: what's written must read back as the new values, and keep
    /// every line of the other keys, in order
    #[test]
    fn edits_change_only_the_keys_edited() {
        let mut files = content_files(&test_dir().join("frontmatter/files"));
        files.extend(content_files(&test_dir().join("mdx-imports/files")));
        let schema = FrontmatterSchema::default();
        let mut edits = 0;
        for path in files {
            let name = name(&path);
            let parsed = parse_frontmatter(&std::fs::read_to_string(&path).unwrap());
            if parsed.raw_frontmatter.is_empty() || parsed.frontmatter_error.is_some() {
                continue;
            }
            let raw = &parsed.raw_frontmatter;
            let old = &parsed.frontmatter;
            let block = find_block(raw.lines()).unwrap();
            let lines: Vec<&str> = raw.lines().collect();
            // Files whose keys can't be split apart are written whole
            let entries = write::split(&lines[block.yaml_line..lines.len() - 1]).map(|(e, _)| e);

            let check = |new: &IndexMap<String, Value>, key: &str, deleted: bool| {
                let written = write_block(raw, new, &schema, false)
                    .unwrap_or_else(|e| panic!("{name} [{key}]: {e}"));
                let read = yaml::mapping(&find_block(written.lines()).unwrap().yaml).unwrap();
                assert!(
                    write::same_mapping(&read, new),
                    "{name} [{key}] reads back differently:\n{written}"
                );
                let Some(entries) = &entries else { return };
                let kept: Vec<&str> = lines
                    .iter()
                    .filter(|line| {
                        !entries.iter().any(|e| {
                            e.key == key
                                && (e.lines.iter().any(|l| std::ptr::eq(*l, **line))
                                    || deleted && e.lead.iter().any(|l| std::ptr::eq(*l, **line)))
                        })
                    })
                    .copied()
                    .collect();
                let written_lines: Vec<&str> = written.lines().collect();
                assert!(
                    in_order(&kept, &written_lines),
                    "{name} [{key}] changed other lines:\n{written}"
                );
            };

            for (key, value) in old {
                if let Some(value) = changed(value) {
                    let mut new = old.clone();
                    new.insert(key.clone(), value);
                    check(&new, key, false);
                    edits += 1;
                }
                let mut new = old.clone();
                new.shift_remove(key);
                check(&new, key, true);
            }
            let mut new = old.clone();
            new.insert("addedByTheTest".into(), "hello".into());
            check(&new, "addedByTheTest", false);
        }
        assert!(edits > 200, "Only {edits} edits: is the corpus there?");
    }

    /// With reordering on, an edit puts the keys in schema order, then the
    /// rest alphabetically, and every other key's text moves unchanged. The
    /// schema here is each file's keys backwards, leaving out its last two
    #[test]
    fn reordering_moves_keys_with_their_text() {
        let files = content_files(&test_dir().join("frontmatter/files"));
        let mut reordered = 0;
        for path in files {
            let name = name(&path);
            let parsed = parse_frontmatter(&std::fs::read_to_string(&path).unwrap());
            let old = &parsed.frontmatter;
            if old.len() < 3 || parsed.frontmatter_error.is_some() {
                continue;
            }
            let raw = &parsed.raw_frontmatter;
            let lines: Vec<&str> = raw.lines().collect();
            let block = find_block(raw.lines()).unwrap();
            let Some((entries, _)) = write::split(&lines[block.yaml_line..lines.len() - 1]) else {
                continue;
            };
            let keys: Vec<&String> = old.keys().collect();
            let schema = FrontmatterSchema {
                fields: keys[2..].iter().rev().map(|k| k.to_string()).collect(),
                date_fields: vec![],
            };
            let edited = keys[keys.len() - 1];
            let Some(value) = changed(&old[edited]) else {
                continue;
            };
            let mut new = old.clone();
            new.insert(edited.clone(), value);

            let written = write_block(raw, &new, &schema, true).unwrap();
            let read = yaml::mapping(&find_block(written.lines()).unwrap().yaml).unwrap();
            let mut expected: Vec<&String> = schema.fields.iter().collect();
            let mut rest = vec![keys[0], keys[1]];
            rest.sort();
            expected.extend(rest);
            assert_eq!(
                read.keys().collect::<Vec<_>>(),
                expected,
                "{name}:\n{written}"
            );
            for entry in entries.iter().filter(|e| &e.key != edited) {
                let text = entry.lines.join("\n");
                assert!(
                    written.contains(text.trim_end()),
                    "{name} [{}] changed:\n{written}",
                    entry.key
                );
            }
            reordered += 1;
        }
        assert!(reordered > 15, "Only {reordered} files reordered");
    }
}
