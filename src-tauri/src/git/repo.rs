//! Finding the repository a project is in.
//!
//! Git looks up from the project folder, so a site in `docs/` of a monorepo is
//! found. A folder the repository ignores is treated as not being in it:
//! otherwise anything committed from a site kept in an ignored folder would go
//! into the parent repository.

use serde::Serialize;
use specta::Type;
use std::path::{Path, PathBuf};

use super::runner::Git;
use super::READ_TIMEOUT;

#[derive(Debug, Clone, PartialEq)]
pub struct Repository {
    /// The working tree's root
    pub root: PathBuf,
    /// The project folder within the root, like `docs/`. Empty at the root.
    pub prefix: String,
    /// This working tree's git folder (a linked worktree has its own)
    pub git_dir: PathBuf,
    /// The git folder shared by all of the repository's worktrees
    pub common_dir: PathBuf,
    /// The parent repository's working tree, when this one is a submodule
    pub superproject: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Discovery {
    Found(Repository),
    NotARepository,
    /// The project is in a folder that the repository at `root` ignores
    Ignored {
        root: PathBuf,
    },
}

/// Something git is in the middle of, which only a git tool should finish
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum GitOperation {
    Merge,
    Rebase,
    CherryPick,
    Revert,
}

/// The repository `project` is in. `Err` with git's message when git can't
/// tell, such as a repository owned by another user (`safe.directory`).
pub fn discover(git: &Git, project: &Path) -> Result<Discovery, String> {
    if !project.is_dir() {
        return Err(format!("{} isn't a folder", project.display()));
    }
    let output = git.run(
        project,
        &[
            "rev-parse",
            "--path-format=absolute",
            "--show-toplevel",
            "--show-prefix",
            "--git-dir",
            "--git-common-dir",
            // Prints nothing unless this is a submodule, so it goes last
            "--show-superproject-working-tree",
        ],
        READ_TIMEOUT,
    )?;
    if !output.success() {
        let message = output.error_message();
        if message.contains("not a git repository") {
            return Ok(Discovery::NotARepository);
        }
        return Err(message);
    }

    let text = output.stdout_text();
    let lines: Vec<&str> = text.lines().collect();
    let [root, prefix, git_dir, common_dir, rest @ ..] = &lines[..] else {
        return Err(format!("Unexpected output from git rev-parse: {text}"));
    };
    let repository = Repository {
        root: PathBuf::from(root),
        prefix: prefix.to_string(),
        git_dir: PathBuf::from(git_dir),
        common_dir: PathBuf::from(common_dir),
        superproject: rest
            .first()
            .filter(|line| !line.is_empty())
            .map(PathBuf::from),
    };

    if !repository.prefix.is_empty()
        && is_ignored(
            git,
            &repository.root,
            repository.prefix.trim_end_matches('/'),
        )?
    {
        return Ok(Discovery::Ignored {
            root: repository.root,
        });
    }
    Ok(Discovery::Found(repository))
}

/// Whether the repository at `root` ignores `path` (relative to it)
pub fn is_ignored(git: &Git, root: &Path, path: &str) -> Result<bool, String> {
    let output = git.run(root, &["check-ignore", "-q", "--", path], READ_TIMEOUT)?;
    match output.code {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(output.error_message()),
    }
}

/// Refuses to write while git is in the middle of something, since AE would
/// otherwise finish or abort the user's own merge or rebase
pub fn not_mid_operation(repository: &Repository) -> Result<(), String> {
    let Some(operation) = operation_in_progress(repository) else {
        return Ok(());
    };
    let name = match operation {
        GitOperation::Merge => "merge",
        GitOperation::Rebase => "rebase",
        GitOperation::CherryPick => "cherry-pick",
        GitOperation::Revert => "revert",
    };
    Err(format!(
        "Git is in the middle of a {name}. Finish it in your git tool first."
    ))
}

/// A merge, rebase, cherry-pick or revert that's been started and not finished
pub fn operation_in_progress(repository: &Repository) -> Option<GitOperation> {
    let exists = |name: &str| repository.git_dir.join(name).exists();
    if exists("rebase-merge") || exists("rebase-apply") {
        Some(GitOperation::Rebase)
    } else if exists("MERGE_HEAD") {
        Some(GitOperation::Merge)
    } else if exists("CHERRY_PICK_HEAD") {
        Some(GitOperation::CherryPick)
    } else if exists("REVERT_HEAD") {
        Some(GitOperation::Revert)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_repos::TestRepos;
    use super::*;
    use std::fs;

    #[test]
    fn finds_a_repository_at_the_project_root() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        let Discovery::Found(repository) = discover(&repos.git, &site).unwrap() else {
            panic!("not found");
        };
        assert_eq!(repository.root, site);
        assert_eq!(repository.prefix, "");
        assert_eq!(repository.git_dir, site.join(".git"));
        assert_eq!(repository.common_dir, site.join(".git"));
        assert_eq!(repository.superproject, None);
    }

    #[test]
    fn finds_the_repository_above_a_site_in_a_subfolder() {
        let repos = TestRepos::new();
        let root = repos.init("library");
        let docs = root.join("docs");
        fs::create_dir_all(&docs).unwrap();
        let Discovery::Found(repository) = discover(&repos.git, &docs).unwrap() else {
            panic!("not found");
        };
        assert_eq!(repository.root, root);
        assert_eq!(repository.prefix, "docs/");
    }

    #[test]
    fn a_folder_with_no_repository() {
        let repos = TestRepos::new();
        let folder = repos.dir("plain");
        assert_eq!(
            discover(&repos.git, &folder).unwrap(),
            Discovery::NotARepository
        );
    }

    #[test]
    fn a_folder_the_repository_ignores_is_not_in_it() {
        let repos = TestRepos::new();
        let root = repos.init("parent");
        fs::write(root.join(".gitignore"), "site/\n").unwrap();
        let site = root.join("site/src");
        fs::create_dir_all(&site).unwrap();
        // The ignored folder itself, and a folder inside it
        for folder in [root.join("site"), site] {
            assert_eq!(
                discover(&repos.git, &folder).unwrap(),
                Discovery::Ignored { root: root.clone() }
            );
        }
    }

    #[test]
    fn a_submodule_knows_its_parent() {
        let repos = TestRepos::new();
        let library = repos.init("library");
        repos.commit_all(&library, "Initial");
        let parent = repos.init("parent");
        repos.git_ok(
            &parent,
            &[
                "-c",
                "protocol.file.allow=always",
                "submodule",
                "add",
                library.to_str().unwrap(),
                "site",
            ],
        );
        let Discovery::Found(repository) = discover(&repos.git, &parent.join("site")).unwrap()
        else {
            panic!("not found");
        };
        assert_eq!(repository.root, parent.join("site"));
        assert_eq!(repository.superproject, Some(parent.clone()));
        assert_eq!(repository.git_dir, parent.join(".git/modules/site"));
    }

    #[test]
    fn a_linked_worktree_has_its_own_git_folder() {
        let repos = TestRepos::new();
        let main = repos.init("main");
        repos.commit_all(&main, "Initial");
        let linked = repos.root().join("linked");
        repos.git_ok(
            &main,
            &[
                "worktree",
                "add",
                "-q",
                "-b",
                "other",
                linked.to_str().unwrap(),
            ],
        );
        let Discovery::Found(repository) = discover(&repos.git, &linked).unwrap() else {
            panic!("not found");
        };
        assert_eq!(repository.root, linked);
        assert_eq!(repository.git_dir, main.join(".git/worktrees/linked"));
        assert_eq!(repository.common_dir, main.join(".git"));
    }

    #[test]
    fn notices_a_merge_in_progress() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        let Discovery::Found(repository) = discover(&repos.git, &site).unwrap() else {
            panic!("not found");
        };
        assert_eq!(operation_in_progress(&repository), None);
        fs::write(site.join(".git/MERGE_HEAD"), "abc\n").unwrap();
        assert_eq!(
            operation_in_progress(&repository),
            Some(GitOperation::Merge)
        );
        fs::create_dir_all(site.join(".git/rebase-merge")).unwrap();
        assert_eq!(
            operation_in_progress(&repository),
            Some(GitOperation::Rebase)
        );
    }
}
