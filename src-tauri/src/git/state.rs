//! What the Git tab shows: the branch, the changes in the project folder, and
//! the state of the open entry.

use serde::Serialize;
use specta::Type;
use std::path::Path;

use super::repo::{self, GitOperation, Repository};
use super::runner::Git;
use super::setup::{self, GitProblem};
use super::status::{self, GitChange, GitChangeKind};
use super::READ_TIMEOUT;

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitState {
    /// Why git can't be used for the project, if it can't
    pub problem: Option<GitProblem>,
    /// Set when the project is in a repository git can read
    pub tree: Option<GitWorkingTree>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitWorkingTree {
    pub root: String,
    /// The project folder within the root, like `docs/`. Empty at the root.
    pub prefix: String,
    /// `None` when HEAD is detached
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub has_commits: bool,
    pub operation: Option<GitOperation>,
    /// Changed, new and conflicted files in the project folder, without
    /// submodules. Paths are relative to `root`.
    pub changes: Vec<GitChange>,
    /// The open entry, when one was asked about
    pub entry: Option<GitEntry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitEntry {
    /// Relative to the repository root. Empty when it's outside the repository.
    pub path: String,
    pub state: GitEntryState,
    /// The last commit that changed it, if it's been committed
    pub last_commit: Option<GitCommit>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum GitEntryState {
    New,
    Modified,
    Deleted,
    Renamed,
    Conflicted,
    /// Committed, with no changes since
    Unchanged,
    Ignored,
    /// Its real path (after symlinks) is outside the project's repository
    OutsideRepository,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    /// Abbreviated
    pub hash: String,
    pub subject: String,
    pub author: String,
    /// Seconds since the Unix epoch
    pub time: i64,
}

/// The state of the project at `project`, and of the entry at `entry` (an
/// absolute path) if one's given
pub fn read(project: &Path, entry: Option<&Path>) -> GitState {
    match Git::find() {
        Ok(git) => read_with(&git, project, entry),
        Err(error) => GitState {
            problem: Some(error.into()),
            tree: None,
        },
    }
}

fn read_with(git: &Git, project: &Path, entry: Option<&Path>) -> GitState {
    let unusable = |problem| GitState {
        problem: Some(problem),
        tree: None,
    };
    let repository = match setup::open(git, project) {
        Ok(repository) => repository,
        Err(problem) => return unusable(problem),
    };
    match working_tree(git, &repository, entry) {
        Ok(tree) => GitState {
            problem: None,
            tree: Some(tree),
        },
        Err(message) => unusable(GitProblem::Failed { message }),
    }
}

fn working_tree(
    git: &Git,
    repository: &Repository,
    entry: Option<&Path>,
) -> Result<GitWorkingTree, String> {
    let status = status::read(git, repository, true)?;
    let changes: Vec<GitChange> = status
        .changes
        .into_iter()
        .filter(|change| !change.submodule)
        .collect();
    let entry = match entry {
        Some(path) => Some(entry_state(git, repository, &changes, path)?),
        None => None,
    };
    Ok(GitWorkingTree {
        root: repository.root.display().to_string(),
        prefix: repository.prefix.clone(),
        has_commits: status.branch.commit.is_some(),
        branch: status.branch.name,
        upstream: status.branch.upstream,
        ahead: status.branch.ahead,
        behind: status.branch.behind,
        operation: repo::operation_in_progress(repository),
        changes,
        entry,
    })
}

fn entry_state(
    git: &Git,
    repository: &Repository,
    changes: &[GitChange],
    entry: &Path,
) -> Result<GitEntry, String> {
    let Some(path) = path_in_repository(repository, entry) else {
        return Ok(GitEntry {
            path: String::new(),
            state: GitEntryState::OutsideRepository,
            last_commit: None,
        });
    };
    let changed = changes.iter().find(|change| change.path == path);
    let state = match changed.map(|change| change.kind) {
        Some(GitChangeKind::New) => GitEntryState::New,
        Some(GitChangeKind::Modified) => GitEntryState::Modified,
        Some(GitChangeKind::Deleted) => GitEntryState::Deleted,
        Some(GitChangeKind::Renamed) => GitEntryState::Renamed,
        Some(GitChangeKind::Conflicted) => GitEntryState::Conflicted,
        // Untracked files are in the changes, so this one is committed or ignored
        None if is_ignored(git, repository, &path)? => GitEntryState::Ignored,
        None => GitEntryState::Unchanged,
    };
    let last_commit = match state {
        GitEntryState::New | GitEntryState::Ignored => None,
        _ => last_commit(git, repository, &path)?,
    };
    Ok(GitEntry {
        path,
        state,
        last_commit,
    })
}

/// `entry`'s path relative to the repository root, with `/` separators, or
/// `None` when its real path is outside the repository (content symlinked in)
fn path_in_repository(repository: &Repository, entry: &Path) -> Option<String> {
    let real = dunce::canonicalize(entry).ok()?;
    let relative = real.strip_prefix(&repository.root).ok()?;
    Some(
        relative
            .components()
            .map(|c| c.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/"),
    )
}

fn is_ignored(git: &Git, repository: &Repository, path: &str) -> Result<bool, String> {
    let output = git.run(
        &repository.root,
        &["check-ignore", "-q", "--", path],
        READ_TIMEOUT,
    )?;
    match output.code {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(output.error_message()),
    }
}

/// The last commit that changed `path`. `None` before the repository's first
/// commit (when `git log` fails) or when no commit has touched it.
fn last_commit(
    git: &Git,
    repository: &Repository,
    path: &str,
) -> Result<Option<GitCommit>, String> {
    let output = git.run(
        &repository.root,
        &["log", "-1", "--format=%h%x00%ct%x00%an%x00%s", "--", path],
        READ_TIMEOUT,
    )?;
    if !output.success() {
        return Ok(None);
    }
    let text = output.stdout_text();
    let mut fields = text.trim_end_matches('\n').splitn(4, '\0');
    let (Some(hash), Some(time), Some(author), Some(subject)) =
        (fields.next(), fields.next(), fields.next(), fields.next())
    else {
        return Ok(None);
    };
    Ok(Some(GitCommit {
        hash: hash.to_string(),
        subject: subject.to_string(),
        author: author.to_string(),
        time: time.parse().unwrap_or(0),
    }))
}

#[cfg(test)]
mod tests {
    use super::super::test_repos::TestRepos;
    use super::*;
    use std::fs;

    fn tree(repos: &TestRepos, project: &Path, entry: Option<&Path>) -> GitWorkingTree {
        let state = read_with(&repos.git, project, entry);
        assert_eq!(state.problem, None);
        state.tree.unwrap()
    }

    #[test]
    fn lists_only_the_project_folders_changes() {
        let repos = TestRepos::new();
        let root = repos.init("library");
        let docs = root.join("docs");
        fs::create_dir_all(docs.join("src")).unwrap();
        fs::write(docs.join("src/guide.md"), "# Guide\n").unwrap();
        fs::write(root.join("README.md"), "# Library\n").unwrap();
        repos.commit_all(&root, "Initial");

        fs::write(docs.join("src/guide.md"), "# Guide\n\nMore.\n").unwrap();
        fs::write(docs.join("src/2026-11-16-map.png"), "png").unwrap();
        fs::write(root.join("README.md"), "# Changed\n").unwrap();

        let tree = tree(&repos, &docs, None);
        assert_eq!(tree.prefix, "docs/");
        let paths: Vec<&str> = tree.changes.iter().map(|c| c.path.as_str()).collect();
        assert_eq!(paths, ["docs/src/guide.md", "docs/src/2026-11-16-map.png"]);
        assert_eq!(tree.entry, None);
    }

    #[test]
    fn says_what_state_the_entry_is_in() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        let posts = site.join("posts");
        fs::create_dir_all(&posts).unwrap();
        fs::write(posts.join("old.md"), "old\n").unwrap();
        fs::write(posts.join("changed.md"), "one\n").unwrap();
        fs::write(site.join(".gitignore"), "drafts/\n").unwrap();
        repos.commit_all(&site, "Add posts");
        fs::write(posts.join("changed.md"), "two\n").unwrap();
        fs::write(posts.join("new.md"), "new\n").unwrap();
        fs::create_dir_all(site.join("drafts")).unwrap();
        fs::write(site.join("drafts/secret.md"), "shh\n").unwrap();

        let state_of = |file: &Path| tree(&repos, &site, Some(file)).entry.unwrap();

        let old = state_of(&posts.join("old.md"));
        assert_eq!(old.path, "posts/old.md");
        assert_eq!(old.state, GitEntryState::Unchanged);
        let commit = old.last_commit.unwrap();
        assert_eq!(commit.subject, "Add posts");
        assert_eq!(commit.author, "Test Writer");
        assert!(commit.time > 1_700_000_000);

        let changed = state_of(&posts.join("changed.md"));
        assert_eq!(changed.state, GitEntryState::Modified);
        assert!(changed.last_commit.is_some());

        let new = state_of(&posts.join("new.md"));
        assert_eq!(new.state, GitEntryState::New);
        assert_eq!(new.last_commit, None);

        let ignored = state_of(&site.join("drafts/secret.md"));
        assert_eq!(ignored.state, GitEntryState::Ignored);
    }

    #[test]
    fn an_entry_symlinked_in_from_elsewhere_is_outside_the_repository() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        let vault = repos.dir("vault");
        fs::write(vault.join("note.md"), "note\n").unwrap();
        std::os::unix::fs::symlink(&vault, site.join("notes")).unwrap();
        let entry = tree(&repos, &site, Some(&site.join("notes/note.md")))
            .entry
            .unwrap();
        assert_eq!(entry.state, GitEntryState::OutsideRepository);
        assert_eq!(entry.path, "");
    }

    #[test]
    fn a_new_repository_has_no_commits_or_history() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        fs::write(site.join("first.md"), "first\n").unwrap();
        repos.git_ok(&site, &["add", "first.md"]);
        let tree = tree(&repos, &site, Some(&site.join("first.md")));
        assert!(!tree.has_commits);
        let entry = tree.entry.unwrap();
        assert_eq!(entry.state, GitEntryState::New);
        assert_eq!(entry.last_commit, None);
    }

    #[test]
    fn leaves_out_submodules() {
        let repos = TestRepos::new();
        let theme = repos.init("theme");
        repos.commit_all(&theme, "Theme");
        let site = repos.init("site");
        repos.git_ok(
            &site,
            &[
                "-c",
                "protocol.file.allow=always",
                "submodule",
                "add",
                theme.to_str().unwrap(),
                "theme",
            ],
        );
        repos.commit_all(&site, "Add theme");
        fs::write(site.join("theme/extra.md"), "extra\n").unwrap();
        assert_eq!(tree(&repos, &site, None).changes, Vec::new());
    }
}
