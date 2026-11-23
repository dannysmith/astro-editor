//! The Git tab's writes: staging the files ticked for a commit, unstaging them
//! again, and committing.
//!
//! They take explicit paths (relative to the repository root), never `add -A`
//! or `commit -a`, and run one at a time with the other writes (see `writing`).

use std::path::Path;

use super::repo::{self, Repository};
use super::runner::Git;
use super::{writing, READ_TIMEOUT, WRITE_TIMEOUT};

/// Stages `paths` as they are on disk: changed, new or deleted
pub fn stage(git: &Git, repository: &Repository, paths: &[String]) -> Result<(), String> {
    let _writing = writing();
    repo::not_mid_operation(repository)?;
    add(git, repository, paths)
}

/// Takes `paths` out of the index again, leaving the files on disk alone.
/// Anything staged for them before goes too.
pub fn unstage(git: &Git, repository: &Repository, paths: &[String]) -> Result<(), String> {
    let _writing = writing();
    repo::not_mid_operation(repository)?;
    git.read(
        &repository.root,
        &with_paths(&["reset", "-q", "--"], paths),
        WRITE_TIMEOUT,
    )?;
    Ok(())
}

/// Stages `paths` again, so edits saved since they were first staged go in,
/// then commits everything staged with `message`. Returns the new commit's
/// abbreviated hash.
pub fn commit(
    git: &Git,
    repository: &Repository,
    paths: &[String],
    message: &str,
) -> Result<String, String> {
    let _writing = writing();
    repo::not_mid_operation(repository)?;
    add(git, repository, paths)?;
    // Asked rather than read from `commit`'s message, which is in the
    // user's language
    let staged = git.run(
        &repository.root,
        &["diff", "--cached", "--quiet"],
        READ_TIMEOUT,
    )?;
    if staged.success() {
        return Err(
            "There's nothing staged to commit. It may have been committed somewhere else."
                .to_string(),
        );
    }
    let output = git.run(
        &repository.root,
        &["commit", "-q", &format!("--message={message}")],
        WRITE_TIMEOUT,
    )?;
    if !output.success() {
        return Err(output.error_message());
    }
    let head = git.read(
        &repository.root,
        &["rev-parse", "--short", "HEAD"],
        READ_TIMEOUT,
    )?;
    Ok(head.trim().to_string())
}

/// Stages `paths`: changes, new files, and deletions (`add` stages a deleted
/// path's removal). A path that's neither on disk nor in the index is left
/// out, since `add` refuses it: its deletion is already staged.
fn add(git: &Git, repository: &Repository, paths: &[String]) -> Result<(), String> {
    let indexed = git.read(
        &repository.root,
        &with_paths(&["ls-files", "-z", "--cached", "--"], paths),
        READ_TIMEOUT,
    )?;
    let indexed: Vec<&str> = indexed.split('\0').collect();
    let paths: Vec<String> = paths
        .iter()
        .filter(|path| {
            indexed.contains(&path.as_str())
                || Path::new(&repository.root)
                    .join(path)
                    .symlink_metadata()
                    .is_ok()
        })
        .cloned()
        .collect();
    if paths.is_empty() {
        return Ok(());
    }
    git.read(
        &repository.root,
        &with_paths(&["add", "--"], &paths),
        WRITE_TIMEOUT,
    )?;
    Ok(())
}

/// `command` followed by `paths`
fn with_paths<'a>(command: &[&'a str], paths: &'a [String]) -> Vec<&'a str> {
    command
        .iter()
        .copied()
        .chain(paths.iter().map(String::as_str))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::super::setup;
    use super::super::status;
    use super::super::test_repos::TestRepos;
    use super::*;
    use std::fs;
    use std::path::Path;

    fn open(repos: &TestRepos, project: &Path) -> Repository {
        setup::open(&repos.git, project).unwrap()
    }

    fn staged_paths(repos: &TestRepos, repository: &Repository) -> Vec<String> {
        status::read_staged(&repos.git, repository)
            .unwrap()
            .into_iter()
            .map(|change| change.path)
            .collect()
    }

    fn strings(paths: &[&str]) -> Vec<String> {
        paths.iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn stages_and_unstages_only_the_paths_given() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("entry.md"), "one").unwrap();
        fs::write(dir.join("gone.md"), "gone").unwrap();
        repos.commit_all(&dir, "First");
        fs::write(dir.join("entry.md"), "two").unwrap();
        fs::remove_file(dir.join("gone.md")).unwrap();
        fs::write(dir.join("cover.jpg"), "jpg").unwrap();
        fs::write(dir.join("other.md"), "other").unwrap();
        let repository = open(&repos, &dir);

        let paths = strings(&["entry.md", "gone.md", "cover.jpg"]);
        stage(&repos.git, &repository, &paths).unwrap();
        assert_eq!(
            staged_paths(&repos, &repository),
            strings(&["cover.jpg", "entry.md", "gone.md"])
        );

        unstage(&repos.git, &repository, &paths).unwrap();
        assert!(staged_paths(&repos, &repository).is_empty());
        assert_eq!(fs::read_to_string(dir.join("entry.md")).unwrap(), "two");
    }

    #[test]
    fn unstages_before_the_first_commit() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("entry.md"), "one").unwrap();
        let repository = open(&repos, &dir);
        let paths = strings(&["entry.md"]);
        stage(&repos.git, &repository, &paths).unwrap();
        assert_eq!(staged_paths(&repos, &repository), paths);
        unstage(&repos.git, &repository, &paths).unwrap();
        assert!(staged_paths(&repos, &repository).is_empty());
    }

    #[test]
    fn commits_what_is_staged_with_later_edits() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("entry.md"), "one").unwrap();
        fs::write(dir.join("theirs.md"), "one").unwrap();
        repos.commit_all(&dir, "First");
        // Someone else's staged work, which a commit takes too
        fs::write(dir.join("theirs.md"), "two").unwrap();
        repos.git_ok(&dir, &["add", "theirs.md"]);
        fs::write(dir.join("entry.md"), "two").unwrap();
        let repository = open(&repos, &dir);
        let paths = strings(&["entry.md"]);
        stage(&repos.git, &repository, &paths).unwrap();
        // Saved after staging
        fs::write(dir.join("entry.md"), "three").unwrap();

        let hash = commit(&repos.git, &repository, &paths, "Update “Entry”").unwrap();
        assert_eq!(
            repos.git_ok(&dir, &["rev-parse", "--short", "HEAD"]).trim(),
            hash
        );
        assert_eq!(repos.git_ok(&dir, &["show", "HEAD:entry.md"]), "three");
        assert_eq!(repos.git_ok(&dir, &["show", "HEAD:theirs.md"]), "two");
        assert_eq!(
            repos.git_ok(&dir, &["log", "-1", "--format=%s"]).trim(),
            "Update “Entry”"
        );
        assert!(repos.git_ok(&dir, &["status", "--porcelain"]).is_empty());
    }

    #[test]
    fn commits_a_deleted_file_staged_earlier() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("old.md"), "one").unwrap();
        repos.commit_all(&dir, "First");
        fs::remove_file(dir.join("old.md")).unwrap();
        fs::write(dir.join("new.md"), "one").unwrap();
        let repository = open(&repos, &dir);
        let paths = strings(&["new.md", "old.md"]);
        stage(&repos.git, &repository, &paths).unwrap();
        commit(&repos.git, &repository, &paths, "Rename").unwrap();
        assert!(repos.git_ok(&dir, &["status", "--porcelain"]).is_empty());
    }

    #[test]
    fn refuses_while_git_is_in_the_middle_of_something() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("entry.md"), "one").unwrap();
        repos.commit_all(&dir, "First");
        fs::write(
            dir.join(".git/MERGE_HEAD"),
            "0000000000000000000000000000000000000000\n",
        )
        .unwrap();
        fs::write(dir.join("entry.md"), "two").unwrap();
        let repository = open(&repos, &dir);
        let error = stage(&repos.git, &repository, &strings(&["entry.md"])).unwrap_err();
        assert!(error.contains("merge"), "{error}");
        assert!(staged_paths(&repos, &repository).is_empty());
    }

    #[test]
    fn says_when_there_is_nothing_to_commit() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("entry.md"), "one").unwrap();
        repos.commit_all(&dir, "First");
        let repository = open(&repos, &dir);
        let error = commit(&repos.git, &repository, &strings(&["entry.md"]), "Again").unwrap_err();
        assert!(error.contains("nothing staged"), "{error}");
    }

    #[test]
    fn a_hook_that_reformats_and_restages_is_committed_cleanly() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("entry.md"), "one").unwrap();
        repos.commit_all(&dir, "First");
        let hook = dir.join(".git/hooks/pre-commit");
        // Like lint-staged: the staged markdown files, by a glob pathspec
        fs::write(
            &hook,
            "#!/bin/sh\nfor f in $(git diff --cached --name-only -- '*.md'); do printf 'formatted' > \"$f\"; git add -- \"$f\"; done\n",
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
        }
        fs::write(dir.join("entry.md"), "two").unwrap();
        let repository = open(&repos, &dir);
        commit(&repos.git, &repository, &strings(&["entry.md"]), "Update").unwrap();
        assert_eq!(repos.git_ok(&dir, &["show", "HEAD:entry.md"]), "formatted");
        assert!(repos.git_ok(&dir, &["status", "--porcelain"]).is_empty());
    }

    #[test]
    fn a_refusing_hook_shows_its_message() {
        let repos = TestRepos::new();
        let dir = repos.init("site");
        fs::write(dir.join("entry.md"), "one").unwrap();
        repos.commit_all(&dir, "First");
        let hook = dir.join(".git/hooks/pre-commit");
        fs::write(
            &hook,
            "#!/bin/sh\necho 'Spelling check failed' >&2\nexit 1\n",
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
        }
        fs::write(dir.join("entry.md"), "two").unwrap();
        let repository = open(&repos, &dir);
        let error = commit(&repos.git, &repository, &strings(&["entry.md"]), "Update").unwrap_err();
        assert_eq!(error, "Spelling check failed");
    }
}
