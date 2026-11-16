//! Reading `git status --porcelain=v2 -z --branch`.
//!
//! Paths are relative to the repository root and unquoted (`-z`). The format is
//! documented in `git help status`, under "Porcelain Format Version 2".

use serde::Serialize;
use specta::Type;

use super::repo::Repository;
use super::runner::Git;
use super::READ_TIMEOUT;

/// The status of the project's folder in `repository`. Untracked files are
/// listed one by one when `untracked`, and left out otherwise (quicker, for
/// when only the branch is wanted).
pub fn read(git: &Git, repository: &Repository, untracked: bool) -> Result<Status, String> {
    let pathspec = if repository.prefix.is_empty() {
        "."
    } else {
        repository.prefix.as_str()
    };
    let output = git.run(
        &repository.root,
        &[
            "status",
            "--porcelain=v2",
            "-z",
            "--branch",
            if untracked {
                "--untracked-files=all"
            } else {
                "--untracked-files=no"
            },
            "--",
            pathspec,
        ],
        READ_TIMEOUT,
    )?;
    if !output.success() {
        return Err(output.error_message());
    }
    Ok(parse(&output.stdout))
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Status {
    pub branch: BranchStatus,
    pub changes: Vec<GitChange>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct BranchStatus {
    /// `None` before the first commit
    pub commit: Option<String>,
    /// `None` when HEAD is detached
    pub name: Option<String>,
    /// Like `origin/main`. `None` when the branch has no upstream
    pub upstream: Option<String>,
    /// Commits on the branch that aren't on the upstream, and the other way
    /// round. Both 0 without an upstream, or when it's gone from the remote.
    pub ahead: u32,
    pub behind: u32,
}

/// One changed, new or conflicted file
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitChange {
    /// Relative to the repository root
    pub path: String,
    /// For a rename or copy, the path it came from
    pub original_path: Option<String>,
    pub kind: GitChangeKind,
    /// A submodule rather than a file
    pub submodule: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum GitChangeKind {
    /// Untracked, or added to the index but not committed
    New,
    Modified,
    Deleted,
    Renamed,
    /// Has unresolved conflicts
    Conflicted,
}

/// Parses the output of the `status` command in `read`. Lines it doesn't know are skipped, so a
/// newer git adding to the format doesn't break it.
pub fn parse(output: &[u8]) -> Status {
    let text = String::from_utf8_lossy(output);
    let mut fields = text.split('\0').filter(|f| !f.is_empty());
    let mut status = Status::default();

    while let Some(field) = fields.next() {
        if let Some(header) = field.strip_prefix("# ") {
            read_header(header, &mut status.branch);
            continue;
        }
        let (tag, rest) = field.split_once(' ').unwrap_or((field, ""));
        match tag {
            // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
            "1" => {
                let parts: Vec<&str> = rest.splitn(8, ' ').collect();
                if let [xy, sub, _, _, _, _, _, path] = parts[..] {
                    status.changes.push(GitChange {
                        path: path.to_string(),
                        original_path: None,
                        kind: ordinary_kind(xy),
                        submodule: sub.starts_with('S'),
                    });
                }
            }
            // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <path>, then the
            // original path as the next field
            "2" => {
                let parts: Vec<&str> = rest.splitn(9, ' ').collect();
                let original = fields.next().map(str::to_string);
                if let [_, sub, _, _, _, _, _, _, path] = parts[..] {
                    status.changes.push(GitChange {
                        path: path.to_string(),
                        original_path: original,
                        kind: GitChangeKind::Renamed,
                        submodule: sub.starts_with('S'),
                    });
                }
            }
            // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
            "u" => {
                let parts: Vec<&str> = rest.splitn(10, ' ').collect();
                if let [_, sub, _, _, _, _, _, _, _, path] = parts[..] {
                    status.changes.push(GitChange {
                        path: path.to_string(),
                        original_path: None,
                        kind: GitChangeKind::Conflicted,
                        submodule: sub.starts_with('S'),
                    });
                }
            }
            "?" => status.changes.push(GitChange {
                path: rest.to_string(),
                original_path: None,
                kind: GitChangeKind::New,
                submodule: false,
            }),
            _ => {}
        }
    }
    status
}

fn read_header(header: &str, branch: &mut BranchStatus) {
    let (key, value) = header.split_once(' ').unwrap_or((header, ""));
    match key {
        "branch.oid" if value != "(initial)" => branch.commit = Some(value.to_string()),
        "branch.head" if value != "(detached)" => branch.name = Some(value.to_string()),
        "branch.upstream" => branch.upstream = Some(value.to_string()),
        "branch.ab" => {
            for count in value.split(' ') {
                if let Some(n) = count.strip_prefix('+') {
                    branch.ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = count.strip_prefix('-') {
                    branch.behind = n.parse().unwrap_or(0);
                }
            }
        }
        _ => {}
    }
}

/// The kind of an ordinary change from its index (X) and worktree (Y) letters.
/// AE doesn't show the staging area, so the two are read together.
fn ordinary_kind(xy: &str) -> GitChangeKind {
    let mut letters = xy.chars();
    let (x, y) = (letters.next().unwrap_or('.'), letters.next().unwrap_or('.'));
    if x == 'D' || y == 'D' {
        GitChangeKind::Deleted
    } else if x == 'A' {
        GitChangeKind::New
    } else {
        GitChangeKind::Modified
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn change(path: &str, kind: GitChangeKind) -> GitChange {
        GitChange {
            path: path.to_string(),
            original_path: None,
            kind,
            submodule: false,
        }
    }

    #[test]
    fn reads_the_branch_headers() {
        let output = b"# branch.oid 1a2b3c\0# branch.head main\0# branch.upstream origin/main\0# branch.ab +2 -5\0";
        assert_eq!(
            parse(output).branch,
            BranchStatus {
                commit: Some("1a2b3c".into()),
                name: Some("main".into()),
                upstream: Some("origin/main".into()),
                ahead: 2,
                behind: 5,
            }
        );
    }

    #[test]
    fn a_new_repository_and_a_detached_head_have_no_commit_or_name() {
        let output = b"# branch.oid (initial)\0# branch.head (detached)\0";
        assert_eq!(parse(output).branch, BranchStatus::default());
    }

    #[test]
    fn reads_each_kind_of_change() {
        let output = concat!(
            "# branch.oid abc\0# branch.head main\0",
            "1 .M N... 100644 100644 100644 aaa aaa docs/changed file.md\0",
            "1 A. N... 000000 100644 100644 000 bbb docs/added.md\0",
            "1 .D N... 100644 100644 000000 ccc ccc docs/gone.md\0",
            "1 MM N... 100644 100644 100644 ddd eee docs/both.md\0",
            "2 R. N... 100644 100644 100644 fff fff R100 docs/new name.md\0docs/old name.md\0",
            "u UU N... 100644 100644 100644 100644 a b c docs/conflict.md\0",
            "1 .M S.M. 160000 160000 160000 ggg ggg vendor/theme\0",
            "? docs/2026-11-16-harbour.jpg\0",
            "? docs/a*.md\0",
        );
        let changes = parse(output.as_bytes()).changes;
        assert_eq!(
            changes,
            vec![
                change("docs/changed file.md", GitChangeKind::Modified),
                change("docs/added.md", GitChangeKind::New),
                change("docs/gone.md", GitChangeKind::Deleted),
                change("docs/both.md", GitChangeKind::Modified),
                GitChange {
                    original_path: Some("docs/old name.md".into()),
                    ..change("docs/new name.md", GitChangeKind::Renamed)
                },
                change("docs/conflict.md", GitChangeKind::Conflicted),
                GitChange {
                    submodule: true,
                    ..change("vendor/theme", GitChangeKind::Modified)
                },
                change("docs/2026-11-16-harbour.jpg", GitChangeKind::New),
                change("docs/a*.md", GitChangeKind::New),
            ]
        );
    }

    #[test]
    fn unknown_lines_are_skipped() {
        let output = b"# branch.future x\0! ignored.md\0z what\0? new.md\0";
        assert_eq!(
            parse(output).changes,
            vec![change("new.md", GitChangeKind::New)]
        );
    }
}
