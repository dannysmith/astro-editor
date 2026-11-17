//! The Git tab's writes: staging the files ticked for a commit, unstaging them
//! again, and committing.
//!
//! They take explicit paths (relative to the repository root), never `add -A`
//! or `commit -a`, and run one at a time with the other writes (see `writing`).

use std::time::Duration;

use super::repo::Repository;
use super::runner::{Git, GitOutput};
use super::{writing, READ_TIMEOUT, WRITE_TIMEOUT};

/// Stages `paths` as they are on disk: changed, new or deleted
pub fn stage(git: &Git, repository: &Repository, paths: &[String]) -> Result<(), String> {
    let _writing = writing();
    add(git, repository, paths)
}

/// Takes `paths` out of the index again, leaving the files on disk alone.
/// Anything staged for them before goes too.
pub fn unstage(git: &Git, repository: &Repository, paths: &[String]) -> Result<(), String> {
    let _writing = writing();
    let output = run(git, repository, &["reset", "-q", "--"], paths, READ_TIMEOUT)?;
    succeeded(output)
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
    add(git, repository, paths)?;
    let output = git.run(
        &repository.root,
        &["commit", "-q", &format!("--message={message}")],
        WRITE_TIMEOUT,
    )?;
    if !output.success() {
        let said = output.stdout_text();
        if said.contains("nothing to commit") || said.contains("nothing added to commit") {
            return Err(
                "There's nothing staged to commit. It may have been committed somewhere else."
                    .to_string(),
            );
        }
        return Err(output.error_message());
    }
    let head = git.run(
        &repository.root,
        &["rev-parse", "--short", "HEAD"],
        READ_TIMEOUT,
    )?;
    if !head.success() {
        return Err(head.error_message());
    }
    Ok(head.stdout_text().trim().to_string())
}

fn add(git: &Git, repository: &Repository, paths: &[String]) -> Result<(), String> {
    // `add` stages a deleted path's removal too
    let output = run(git, repository, &["add", "--"], paths, WRITE_TIMEOUT)?;
    succeeded(output)
}

fn run(
    git: &Git,
    repository: &Repository,
    command: &[&str],
    paths: &[String],
    timeout: Duration,
) -> Result<GitOutput, String> {
    let args: Vec<&str> = command
        .iter()
        .copied()
        .chain(paths.iter().map(String::as_str))
        .collect();
    git.run(&repository.root, &args, timeout)
}

fn succeeded(output: GitOutput) -> Result<(), String> {
    if output.success() {
        Ok(())
    } else {
        Err(output.error_message())
    }
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
