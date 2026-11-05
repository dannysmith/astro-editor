//! A collection's entry pattern: which files under its `base` are entries.
//!
//! Astro matches glob loader patterns with tinyglobby and picomatch. This
//! follows them for the forms people write: `*` doesn't cross `/`, items
//! starting with `!` (but not the extglob `!(`) exclude files, and `./` prefixes
//! and trailing slashes are ignored. Patterns `globset` can't compile, such as
//! extglobs, are an error, and the caller treats the collection as having no
//! readable pattern.

use globset::{Glob, GlobBuilder, GlobSet, GlobSetBuilder};

/// File types AE edits
pub const MARKDOWN_EXTENSIONS: [&str; 2] = ["md", "mdx"];

/// Characters that make a path segment a glob rather than a literal name
const GLOB_CHARS: &[char] = &['*', '?', '[', ']', '{', '}', '(', ')', '!', '+', '@'];

#[derive(Debug, Clone)]
pub struct EntryPattern {
    include: GlobSet,
    exclude: GlobSet,
    /// The literal folders every included path starts with (`blog` for `blog/**/*.md`)
    prefix: String,
    /// The last segment of each included pattern, for guessing file types
    file_globs: Vec<String>,
}

impl EntryPattern {
    pub fn new(patterns: &[String]) -> Result<Self, String> {
        let mut include = GlobSetBuilder::new();
        let mut exclude = GlobSetBuilder::new();
        let mut includes = Vec::new();

        for pattern in patterns {
            let is_negation = pattern.starts_with('!') && !pattern.starts_with("!(");
            let pattern = normalize(if is_negation { &pattern[1..] } else { pattern });
            let glob = compile(&pattern)?;
            if is_negation {
                exclude.add(glob);
            } else {
                include.add(glob);
                includes.push(pattern);
            }
        }

        if includes.is_empty() {
            return Err("The pattern doesn't include any files".to_string());
        }

        Ok(Self {
            include: include.build().map_err(|e| e.to_string())?,
            exclude: exclude.build().map_err(|e| e.to_string())?,
            prefix: common_prefix(&includes),
            file_globs: includes
                .iter()
                .map(|p| p.rsplit('/').next().unwrap_or(p).to_string())
                .collect(),
        })
    }

    /// Astro's pattern for legacy collections, which AE also uses where it can't
    /// read one: every file except those in or named with a leading `_`
    pub fn legacy() -> Self {
        Self::new(&[
            "**/*".to_string(),
            "!**/_*/**".to_string(),
            "!**/_*".to_string(),
        ])
        .expect("the legacy pattern compiles")
    }

    /// Whether a path relative to the collection's base is an entry
    pub fn is_match(&self, relative: &str) -> bool {
        self.include.is_match(relative) && !self.exclude.is_match(relative)
    }

    /// The literal folders every entry is in, relative to the base ("" for none)
    pub fn prefix(&self) -> &str {
        &self.prefix
    }

    /// Whether the pattern could include Markdown or MDX files, rather than only
    /// data files like JSON or YAML. A guess from each pattern's file name part:
    /// one with no extension, or whose extension mentions `md` or `mdx` or is a
    /// wildcard, could.
    pub fn can_match_markdown(&self) -> bool {
        self.file_globs.iter().any(|glob| {
            let Some((_, extension)) = glob.split_once('.') else {
                return true;
            };
            extension
                .split(|c: char| !c.is_ascii_alphanumeric() && c != '*' && c != '?')
                .any(|part| MARKDOWN_EXTENSIONS.contains(&part) || part.contains(['*', '?']))
        })
    }

    /// Which Markdown extensions a new file could have, judged by whether a
    /// file in the prefix folder, or a folder-per-entry `index` file, would match.
    /// Empty when neither would.
    pub fn new_file_extensions(&self) -> Vec<&'static str> {
        MARKDOWN_EXTENSIONS
            .into_iter()
            .filter(|extension| {
                let file = format!("new-file.{extension}");
                let index = format!("new-file/index.{extension}");
                [file, index]
                    .iter()
                    .any(|name| self.is_match(&join(&self.prefix, name)))
            })
            .collect()
    }
}

fn compile(pattern: &str) -> Result<Glob, String> {
    // globset would read extglobs like `@(md|mdx)` as literal text and match nothing
    if pattern.contains('(') {
        return Err(format!(
            "Couldn't read the pattern `{pattern}`: extglobs aren't supported"
        ));
    }
    GlobBuilder::new(pattern)
        .literal_separator(true)
        .build()
        .map_err(|e| format!("Couldn't read the pattern `{pattern}`: {}", e.kind()))
}

/// As tinyglobby does: no leading `./` and no trailing `/`
fn normalize(pattern: &str) -> String {
    let mut pattern = pattern;
    while let Some(rest) = pattern.strip_prefix("./") {
        pattern = rest;
    }
    pattern.trim_end_matches('/').to_string()
}

/// The literal folders all the patterns share
fn common_prefix(patterns: &[String]) -> String {
    let literal_dirs = |pattern: &String| -> Vec<String> {
        let mut segments: Vec<&str> = pattern.split('/').collect();
        segments.pop(); // the file name part
        segments
            .into_iter()
            .take_while(|segment| !segment.is_empty() && !segment.contains(GLOB_CHARS))
            .map(str::to_string)
            .collect()
    };

    let mut prefix = literal_dirs(&patterns[0]);
    for pattern in &patterns[1..] {
        let dirs = literal_dirs(pattern);
        let shared = prefix.iter().zip(&dirs).take_while(|(a, b)| a == b).count();
        prefix.truncate(shared);
    }
    prefix.join("/")
}

pub fn join(prefix: &str, relative: &str) -> String {
    if prefix.is_empty() {
        relative.to_string()
    } else {
        format!("{prefix}/{relative}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pattern(patterns: &[&str]) -> EntryPattern {
        EntryPattern::new(&patterns.iter().map(|p| p.to_string()).collect::<Vec<_>>()).unwrap()
    }

    #[test]
    fn matches_like_astro() {
        let p = pattern(&["**/[^_]*.{md,mdx}"]);
        assert!(p.is_match("post.md"));
        assert!(p.is_match("2024/post.mdx"));
        assert!(!p.is_match("_draft.md"));
        assert!(!p.is_match("2024/_draft.md"));
        assert!(!p.is_match("post.json"));

        // `*` stays within a folder
        let p = pattern(&["*.md"]);
        assert!(p.is_match("post.md"));
        assert!(!p.is_match("2024/post.md"));
    }

    #[test]
    fn negated_items_exclude_files() {
        let p = pattern(&["**/*.md", "!**/drafts/**", "!README.md"]);
        assert!(p.is_match("post.md"));
        assert!(!p.is_match("drafts/post.md"));
        assert!(!p.is_match("README.md"));
        assert!(p.is_match("docs/README.md"));
    }

    #[test]
    fn ignores_leading_dot_slash_and_trailing_slash() {
        let p = pattern(&["./blog/*.md", "./notes/"]);
        assert!(p.is_match("blog/post.md"));
        assert!(p.is_match("notes"));
    }

    #[test]
    fn legacy_pattern_skips_underscores() {
        let p = EntryPattern::legacy();
        assert!(p.is_match("post.md"));
        assert!(p.is_match("2024/post.md"));
        assert!(!p.is_match("_draft.md"));
        assert!(!p.is_match("_drafts/post.md"));
        assert!(!p.is_match("2024/_drafts/deep/post.md"));
    }

    #[test]
    fn finds_the_literal_prefix() {
        assert_eq!(pattern(&["blog/**/*.md"]).prefix(), "blog");
        assert_eq!(pattern(&["content/blog/*.md"]).prefix(), "content/blog");
        assert_eq!(pattern(&["**/*.md"]).prefix(), "");
        assert_eq!(pattern(&["*.md"]).prefix(), "");
        assert_eq!(pattern(&["{blog,notes}/**/*.md"]).prefix(), "");
        assert_eq!(pattern(&["blog/a/*.md", "blog/b/*.md"]).prefix(), "blog");
        assert_eq!(pattern(&["blog/*.md", "!blog/_*"]).prefix(), "blog");
    }

    #[test]
    fn tells_markdown_from_data() {
        assert!(pattern(&["**/*.md"]).can_match_markdown());
        assert!(pattern(&["**/[^_]*.{md,mdx}"]).can_match_markdown());
        assert!(pattern(&["**/*"]).can_match_markdown());
        assert!(pattern(&["**/index.mdx"]).can_match_markdown());
        assert!(pattern(&["**/*.m*"]).can_match_markdown());
        assert!(!pattern(&["**/*.json"]).can_match_markdown());
        assert!(!pattern(&["**/*.{json,yaml,yml}"]).can_match_markdown());
        assert!(!pattern(&["**/*.mdoc"]).can_match_markdown());
    }

    #[test]
    fn works_out_new_file_extensions() {
        assert_eq!(pattern(&["**/*.md"]).new_file_extensions(), ["md"]);
        assert_eq!(
            pattern(&["**/*.{md,mdx}"]).new_file_extensions(),
            ["md", "mdx"]
        );
        assert_eq!(pattern(&["blog/**/*.mdx"]).new_file_extensions(), ["mdx"]);
        assert_eq!(pattern(&["**/index.md"]).new_file_extensions(), ["md"]);
        assert!(pattern(&["**/[0-9]*.md"]).new_file_extensions().is_empty());
    }

    #[test]
    fn rejects_what_globset_cant_read() {
        assert!(EntryPattern::new(&["**/*.@(md|mdx)".to_string()]).is_err());
        assert!(EntryPattern::new(&["!**/*.md".to_string()]).is_err());
    }
}
