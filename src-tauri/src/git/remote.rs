//! Pushing, pulling, and checking the remote can be reached.
//!
//! Pulling only ever does what can't go wrong: it fetches, then fast-forwards,
//! or rebases the branch's own commits onto the upstream's. It refuses before
//! starting when uncommitted changes touch files the upstream changed, and if
//! a rebase stops on a conflict it's aborted, putting everything back. So it
//! never leaves a merge or rebase half done for the writer to sort out.

use std::time::Duration;

use super::repo::{self, GitOperation, Repository};
use super::runner::Git;
use super::{writing, READ_TIMEOUT, WRITE_TIMEOUT};

/// For `ls-remote`, which only has to reach the remote
const CHECK_TIMEOUT: Duration = Duration::from_secs(30);

/// Pushes the branch to its upstream
pub fn push(git: &Git, repository: &Repository) -> Result<(), String> {
    let _writing = writing();
    let output = git.run(&repository.root, &["push", "--quiet"], WRITE_TIMEOUT)?;
    if output.success() {
        return Ok(());
    }
    let said = &output.stderr;
    if said.contains("non-fast-forward") || said.contains("fetch first") {
        return Err(
            "The remote has commits you don't have yet. Pull, then push again.".to_string(),
        );
    }
    Err(output.error_message())
}

/// Fetches, then brings the upstream's new commits into the branch. Returns
/// how many there were (0 when it was already up to date).
pub fn pull(git: &Git, repository: &Repository) -> Result<u32, String> {
    let _writing = writing();
    // So the abort below only ever undoes a rebase AE started
    repo::not_mid_operation(repository)?;
    let root = &repository.root;
    git.read(root, &["fetch", "--quiet"], WRITE_TIMEOUT)?;
    let counts = git.read(
        root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
        READ_TIMEOUT,
    )?;
    let mut counts = counts.split_whitespace().map(|n| n.parse().unwrap_or(0));
    let (ahead, behind): (u32, u32) = (counts.next().unwrap_or(0), counts.next().unwrap_or(0));
    if behind == 0 {
        return Ok(0);
    }

    let theirs = paths(
        git,
        repository,
        &["diff", "--name-only", "-z", "HEAD...@{upstream}"],
    )?;
    let uncommitted = paths(git, repository, &["diff", "--name-only", "-z", "HEAD"])?;
    let both: Vec<&str> = uncommitted
        .iter()
        .filter(|path| theirs.contains(path))
        .map(String::as_str)
        .collect();
    if !both.is_empty() {
        return Err(format!(
            "The remote changed files you have uncommitted changes to: {}. Commit them first, then pull again. Nothing was changed.",
            both.join(", ")
        ));
    }

    if ahead == 0 {
        git.read(
            root,
            &["merge", "--ff-only", "--quiet", "@{upstream}"],
            WRITE_TIMEOUT,
        )?;
        return Ok(behind);
    }

    // Uncommitted changes are put aside and back again; they don't touch the
    // upstream's files, so they come back cleanly
    let rebase = git.run(
        &repository.root,
        &["rebase", "--autostash", "--quiet", "@{upstream}"],
        WRITE_TIMEOUT,
    )?;
    if rebase.success() {
        return Ok(behind);
    }
    if repo::operation_in_progress(repository) != Some(GitOperation::Rebase) {
        // It refused before starting, changing nothing
        return Err(rebase.error_message());
    }
    let conflicts = paths(
        git,
        repository,
        &["diff", "--name-only", "-z", "--diff-filter=U"],
    )
    .unwrap_or_default();
    let abort = git.run(&repository.root, &["rebase", "--abort"], WRITE_TIMEOUT)?;
    if !abort.success() {
        return Err(format!(
            "The pull stopped part way and AE couldn't undo it. Finish or abort the rebase in your git tool. Git said: {}",
            abort.error_message()
        ));
    }
    Err(if conflicts.is_empty() {
        format!(
            "Your commits and the remote's couldn't be combined cleanly, so AE put everything back as it was. Git said: {}",
            rebase.error_message()
        )
    } else {
        format!(
            "Your commits and the remote's both change {}, so AE put everything back as it was. Combine them in your git tool.",
            conflicts.join(", ")
        )
    })
}

/// Checks the branch's remote can be reached with the user's credentials.
/// Returns its URL.
pub fn check(git: &Git, repository: &Repository) -> Result<String, String> {
    let root = &repository.root;
    let branch = git
        .read(
            root,
            &["symbolic-ref", "--short", "-q", "HEAD"],
            READ_TIMEOUT,
        )
        .map_err(|_| "HEAD is detached, so there's no branch to check.".to_string())?;
    let remote_key = format!("branch.{}.remote", branch.trim());
    let remote = git
        .read(root, &["config", "--get", &remote_key], READ_TIMEOUT)
        .map_err(|_| "The branch has no upstream to check.".to_string())?;
    let remote = remote.trim();
    let url = git.read(root, &["remote", "get-url", remote], READ_TIMEOUT)?;
    git.read(
        root,
        &["ls-remote", "--quiet", remote, "HEAD"],
        CHECK_TIMEOUT,
    )?;
    Ok(url.trim().to_string())
}

/// The paths a `-z` command lists
fn paths(git: &Git, repository: &Repository, args: &[&str]) -> Result<Vec<String>, String> {
    Ok(git
        .read(&repository.root, args, READ_TIMEOUT)?
        .split('\0')
        .filter(|path| !path.is_empty())
        .map(String::from)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::super::setup;
    use super::super::test_repos::TestRepos;
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};

    /// A bare remote with one commit, and two clones of it: the writer's and
    /// a collaborator's
    fn shared(repos: &TestRepos) -> (PathBuf, PathBuf) {
        let remote = repos.dir("remote.git");
        repos.git_ok(&remote, &["init", "-q", "--bare", "-b", "main"]);
        let first = repos.init("first");
        fs::write(first.join("entry.md"), "one\n").unwrap();
        fs::write(first.join("other.md"), "one\n").unwrap();
        repos.commit_all(&first, "First");
        repos.git_ok(
            &first,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        repos.git_ok(&first, &["push", "-q", "-u", "origin", "main"]);
        (
            clone(repos, &remote, "writer"),
            clone(repos, &remote, "collaborator"),
        )
    }

    fn clone(repos: &TestRepos, remote: &Path, name: &str) -> PathBuf {
        repos.git_ok(
            repos.root(),
            &["clone", "-q", remote.to_str().unwrap(), name],
        );
        let dir = repos.root().join(name);
        repos.git_ok(&dir, &["config", "user.name", "Test Writer"]);
        repos.git_ok(&dir, &["config", "user.email", "writer@example.com"]);
        repos.git_ok(&dir, &["config", "commit.gpgsign", "false"]);
        dir
    }

    /// Changes a file and commits it, and pushes when `push`
    fn change(repos: &TestRepos, dir: &Path, file: &str, text: &str, push: bool) {
        fs::write(dir.join(file), text).unwrap();
        repos.commit_all(dir, &format!("Change {file}"));
        if push {
            repos.git_ok(dir, &["push", "-q"]);
        }
    }

    fn open(repos: &TestRepos, dir: &Path) -> Repository {
        setup::open(&repos.git, dir).unwrap()
    }

    fn head(repos: &TestRepos, dir: &Path) -> String {
        repos.git_ok(dir, &["rev-parse", "HEAD"])
    }

    #[test]
    fn pushes_and_says_when_the_remote_is_ahead() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &writer, "entry.md", "two\n", false);
        push(&repos.git, &open(&repos, &writer)).unwrap();
        assert!(repos
            .git_ok(&writer, &["status", "-sb"])
            .starts_with("## main...origin/main\n"));

        change(&repos, &collaborator, "other.md", "two\n", false);
        let error = push(&repos.git, &open(&repos, &collaborator)).unwrap_err();
        assert!(error.contains("Pull, then push again"), "{error}");
    }

    #[test]
    fn pull_fast_forwards_and_keeps_unrelated_uncommitted_changes() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        let repository = open(&repos, &writer);
        assert_eq!(pull(&repos.git, &repository), Ok(0));

        change(&repos, &collaborator, "other.md", "two\n", true);
        fs::write(writer.join("entry.md"), "draft\n").unwrap();
        assert_eq!(pull(&repos.git, &repository), Ok(1));
        assert_eq!(
            fs::read_to_string(writer.join("other.md")).unwrap(),
            "two\n"
        );
        assert_eq!(
            fs::read_to_string(writer.join("entry.md")).unwrap(),
            "draft\n"
        );
    }

    #[test]
    fn pull_rebases_the_branchs_own_commits() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "other.md", "two\n", true);
        change(&repos, &writer, "entry.md", "two\n", false);
        fs::write(writer.join("new.md"), "untracked\n").unwrap();

        assert_eq!(pull(&repos.git, &open(&repos, &writer)), Ok(1));
        let log = repos.git_ok(&writer, &["log", "--format=%s"]);
        assert_eq!(log, "Change entry.md\nChange other.md\nFirst\n");
        assert!(repos
            .git_ok(&writer, &["status", "-sb"])
            .contains("[ahead 1]"));
        assert!(writer.join("new.md").exists());
    }

    #[test]
    fn pull_refuses_when_uncommitted_changes_touch_the_remotes_files() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "entry.md", "theirs\n", true);
        fs::write(writer.join("entry.md"), "mine\n").unwrap();
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &open(&repos, &writer)).unwrap_err();
        assert!(error.contains("entry.md"), "{error}");
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(
            fs::read_to_string(writer.join("entry.md")).unwrap(),
            "mine\n"
        );
    }

    #[test]
    fn a_conflicting_rebase_is_put_back() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "entry.md", "theirs\n", true);
        change(&repos, &writer, "entry.md", "mine\n", false);
        fs::write(writer.join("other.md"), "draft\n").unwrap();
        let before = head(&repos, &writer);
        let repository = open(&repos, &writer);

        let error = pull(&repos.git, &repository).unwrap_err();
        assert!(error.contains("both change entry.md"), "{error}");
        assert_eq!(repo::operation_in_progress(&repository), None);
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(
            fs::read_to_string(writer.join("entry.md")).unwrap(),
            "mine\n"
        );
        assert_eq!(
            fs::read_to_string(writer.join("other.md")).unwrap(),
            "draft\n"
        );
    }

    #[test]
    fn checks_the_remote_can_be_reached() {
        let repos = TestRepos::new();
        let (writer, _) = shared(&repos);
        let url = check(&repos.git, &open(&repos, &writer)).unwrap();
        assert!(url.ends_with("remote.git"), "{url}");

        repos.git_ok(
            &writer,
            &["remote", "set-url", "origin", "/nowhere/remote.git"],
        );
        assert!(check(&repos.git, &open(&repos, &writer)).is_err());
    }
}
