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

/// Pushes the branch, and only it, to where a plain `git push` would: its
/// push remote if one's set (a fork), otherwise its upstream. Plain `git
/// push` with `push.default=matching` would push every branch the remote has.
pub fn push(git: &Git, repository: &Repository) -> Result<(), String> {
    let _writing = writing();
    let root = &repository.root;
    let branch = git.read(root, &["symbolic-ref", "-q", "HEAD"], READ_TIMEOUT)?;
    let branch = branch.trim_end_matches('\n');
    let target = git.read(
        root,
        &[
            "for-each-ref",
            "--format=%(push:remotename)%00%(push:remoteref)%00%(upstream:remotename)%00%(upstream:remoteref)",
            branch,
        ],
        READ_TIMEOUT,
    )?;
    let fields: Vec<&str> = target.trim_end_matches('\n').split('\0').collect();
    let [push_remote, push_ref, upstream_remote, upstream_ref] = fields[..] else {
        return Err(format!("Unexpected output from git for-each-ref: {target}"));
    };
    // The remote first (the push remote, which is the upstream's unless a
    // fork is set up), then the branch on it. Git leaves `push:remoteref`
    // empty without a push refspec, and then pushes to the upstream's branch
    // on the upstream's remote, or the same name on any other
    let remote = if push_remote.is_empty() {
        upstream_remote
    } else {
        push_remote
    };
    let destination = if !push_ref.is_empty() {
        push_ref
    } else if remote == upstream_remote {
        upstream_ref
    } else {
        branch
    };
    if remote.is_empty() || destination.is_empty() {
        return Err("The branch has no upstream to push to.".to_string());
    }
    let refspec = format!("HEAD:{destination}");
    let output = git.run(root, &["push", "--quiet", remote, &refspec], WRITE_TIMEOUT)?;
    if output.success() {
        return Ok(());
    }
    // A rejected ref's reason is printed untranslated, whatever the language.
    // `push` runs hooks, so it keeps the user's language (see `runner`)
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
    // A merge or rebase under way is the writer's to finish
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

    // Without renames, a file the upstream renamed is listed under its old
    // path too, so uncommitted changes to it are caught. With them, only the
    // new path is, and the rebase below would put the writer's changes back
    // into the renamed file with conflict markers, and still succeed
    let theirs = paths(
        git,
        repository,
        &[
            "diff",
            "--name-only",
            "--no-renames",
            "-z",
            "HEAD...@{upstream}",
        ],
    )?;
    // What the upstream's changes land in: their files, and, when rebasing,
    // the new name of any the writer's own commits renamed, which the rebase
    // carries the changes into
    let mut changing = theirs.clone();
    if ahead > 0 {
        changing.extend(renamed_by_own_commits(git, repository, &theirs)?);
    }
    let uncommitted = paths(
        git,
        repository,
        &["diff", "--name-only", "--no-renames", "-z", "HEAD"],
    )?;
    let both: Vec<&str> = uncommitted
        .iter()
        .filter(|path| changing.contains(path))
        .map(String::as_str)
        .collect();
    if !both.is_empty() {
        return Err(format!(
            "The remote changed files you have uncommitted changes to: {}. Commit them first, then pull again. Nothing was changed.",
            both.join(", ")
        ));
    }

    // Files here that git doesn't track (or ignores) where the upstream has
    // one: the fast-forward would overwrite ignored ones, and the rebase,
    // which checks the upstream out first, either. Every file that differs
    // between HEAD and the upstream, not just those the upstream changed: a
    // file the writer's own commits deleted is checked out again too
    let mut differ = paths(
        git,
        repository,
        &[
            "diff",
            "--name-only",
            "--no-renames",
            "-z",
            "HEAD",
            "@{upstream}",
        ],
    )?;
    // And, when rebasing, every file the writer's own commits touch, since
    // they're replayed one by one: one added then removed again doesn't
    // differ, but would still be written over and deleted
    if ahead > 0 {
        for path in paths(
            git,
            repository,
            &[
                "log",
                "--no-renames",
                "--name-only",
                "--format=",
                "-z",
                "@{upstream}..HEAD",
            ],
        )? {
            if !differ.contains(&path) {
                differ.push(path);
            }
        }
    }
    if !differ.is_empty() {
        let mut args = vec!["ls-files", "-z", "--others", "--"];
        args.extend(differ.iter().map(String::as_str));
        let in_the_way = paths(git, repository, &args)?;
        if !in_the_way.is_empty() {
            return Err(format!(
                "The remote has files you have here but not in git: {}. Move them aside, then pull again. Nothing was changed.",
                in_the_way.join(", ")
            ));
        }
    }

    if ahead == 0 {
        git.read(
            root,
            &["merge", "--ff-only", "--quiet", "@{upstream}"],
            WRITE_TIMEOUT,
        )?;
        return Ok(behind);
    }

    // A rebase replays commits one by one and leaves merges out, and with
    // them anything changed in the merge itself
    let merges = git.read(
        root,
        &["rev-list", "--count", "--merges", "@{upstream}..HEAD"],
        READ_TIMEOUT,
    )?;
    if merges.trim() != "0" {
        return Err(
            "Your commits to push include a merge, which pulling here would undo. Pull in your git tool. Nothing was changed."
                .to_string(),
        );
    }

    // The rebase's autostash brings staged files back unstaged, whoever staged
    // them
    if super::commit::anything_staged(git, repository)? {
        return Err(
            "Pulling would unstage the files that are staged. Commit or unstage them, then pull again. Nothing was changed."
                .to_string(),
        );
    }

    // So a rebase left under way can be told apart from one a terminal
    // started meanwhile, which isn't AE's to abort. Git can't say which
    // process started a rebase, and one started from these same commits in
    // the moment before AE's would look like it, so the check at the top is
    // made again here, after the fetch, leaving that moment as short as it
    // can be
    repo::not_mid_operation(repository)?;
    let head = git.read(root, &["rev-parse", "HEAD"], READ_TIMEOUT)?;
    let onto = git.read(root, &["rev-parse", "@{upstream}"], READ_TIMEOUT)?;
    let (head, onto) = (head.trim(), onto.trim());
    // Uncommitted changes are put aside and back again; the checks above mean
    // they don't touch what changes, so they come back cleanly
    let failure = match git.run(
        root,
        &["rebase", "--autostash", "--quiet", "@{upstream}"],
        WRITE_TIMEOUT,
    ) {
        Ok(rebase) if rebase.success() => {
            // Should the uncommitted changes not have come back cleanly, git
            // still says it worked
            let conflicted = conflicted_files(git, repository);
            if !conflicted.is_empty() {
                return Err(format!(
                    "AE pulled the remote's commits, but your uncommitted changes to {files} clash with them. Git left {files} with conflict markers, and kept your changes in its stash. Sort it out in your git tool.",
                    files = conflicted.join(", ")
                ));
            }
            return Ok(behind);
        }
        Ok(rebase) => rebase.error_message(),
        // Timed out (a hung hook), maybe part way
        Err(error) => error,
    };
    if !rebase_is_ours(repository, head, onto) {
        if repo::operation_in_progress(repository) == Some(GitOperation::Rebase) {
            return Err(format!(
                "A rebase that AE didn't start is under way. Finish it in your git tool. Git said: {failure}"
            ));
        }
        // It refused before starting, changing nothing
        return Err(failure);
    }
    let conflicts = conflicted_files(git, repository);
    let abort = git.run(root, &["rebase", "--abort"], WRITE_TIMEOUT)?;
    if !abort.success() {
        return Err(format!(
            "The pull stopped part way and AE couldn't undo it. Finish or abort the rebase in your git tool. Git said: {}",
            abort.error_message()
        ));
    }
    Err(if conflicts.is_empty() {
        format!(
            "Your commits and the remote's couldn't be combined cleanly, so AE put everything back as it was. Git said: {failure}"
        )
    } else {
        format!(
            "Your commits and the remote's both change {}, so AE put everything back as it was. Combine them in your git tool.",
            conflicts.join(", ")
        )
    })
}

/// The new names of files in `paths` that the branch's own commits (those
/// not on the upstream) renamed
fn renamed_by_own_commits(
    git: &Git,
    repository: &Repository,
    paths: &[String],
) -> Result<Vec<String>, String> {
    let output = git.read(
        &repository.root,
        &["diff", "--name-status", "-M", "-z", "@{upstream}...HEAD"],
        READ_TIMEOUT,
    )?;
    let mut fields = output.split('\0').filter(|f| !f.is_empty());
    let mut renamed = Vec::new();
    while let Some(status) = fields.next() {
        if status.starts_with('R') || status.starts_with('C') {
            let (Some(from), Some(to)) = (fields.next(), fields.next()) else {
                break;
            };
            if paths.iter().any(|path| path == from) {
                renamed.push(to.to_string());
            }
        } else {
            fields.next();
        }
    }
    Ok(renamed)
}

/// Files with conflicts, if git can say
fn conflicted_files(git: &Git, repository: &Repository) -> Vec<String> {
    paths(
        git,
        repository,
        &["diff", "--name-only", "-z", "--diff-filter=U"],
    )
    .unwrap_or_default()
}

/// Whether the rebase under way is the one AE started, of `head` onto
/// `onto`: git records both when it starts one
fn rebase_is_ours(repository: &Repository, head: &str, onto: &str) -> bool {
    ["rebase-merge", "rebase-apply"].iter().any(|folder| {
        let read = |name: &str| {
            std::fs::read_to_string(repository.git_dir.join(folder).join(name))
                .map(|text| text.trim().to_string())
                .unwrap_or_default()
        };
        read("orig-head") == head && read("onto") == onto
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
    fn pull_refuses_to_rebase_while_anything_is_staged() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "other.md", "two\n", true);
        change(&repos, &writer, "entry.md", "two\n", false);
        fs::write(writer.join("new.md"), "staged\n").unwrap();
        repos.git_ok(&writer, &["add", "new.md"]);
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &open(&repos, &writer)).unwrap_err();
        assert!(error.contains("unstage"), "{error}");
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(
            repos.git_ok(&writer, &["diff", "--cached", "--name-only"]),
            "new.md\n"
        );

        // Only behind, it fast-forwards and keeps what's staged
        repos.git_ok(&writer, &["reset", "-q", "--hard", "origin/main~1"]);
        fs::write(writer.join("new.md"), "staged\n").unwrap();
        repos.git_ok(&writer, &["add", "new.md"]);
        assert_eq!(pull(&repos.git, &open(&repos, &writer)), Ok(1));
        assert_eq!(
            repos.git_ok(&writer, &["diff", "--cached", "--name-only"]),
            "new.md\n"
        );
    }

    #[test]
    fn pull_refuses_when_the_remote_renamed_a_file_with_uncommitted_changes() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        // Long enough for git to see the rename below as one
        let lines: String = (1..=10).map(|n| format!("line {n}\n")).collect();
        change(&repos, &collaborator, "entry.md", &lines, true);
        let repository = open(&repos, &writer);
        assert_eq!(pull(&repos.git, &repository), Ok(1));

        // The remote renames it and changes its first line. The writer has a
        // commit of their own, and an uncommitted change to the same line
        repos.git_ok(&collaborator, &["mv", "entry.md", "renamed.md"]);
        let theirs = lines.replacen("line 1", "theirs", 1);
        change(&repos, &collaborator, "renamed.md", &theirs, true);
        change(&repos, &writer, "other.md", "two\n", false);
        let mine = lines.replacen("line 1", "mine", 1);
        fs::write(writer.join("entry.md"), &mine).unwrap();
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &repository).unwrap_err();
        assert!(error.contains("entry.md"), "{error}");
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(fs::read_to_string(writer.join("entry.md")).unwrap(), mine);
        assert!(!writer.join("renamed.md").exists());
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
    fn pushes_only_the_current_branch() {
        let repos = TestRepos::new();
        let (writer, _) = shared(&repos);
        // Another branch on the remote, with a commit of its own not pushed
        repos.git_ok(&writer, &["checkout", "-q", "-b", "other"]);
        change(&repos, &writer, "other.md", "two\n", false);
        repos.git_ok(&writer, &["push", "-q", "-u", "origin", "other"]);
        change(&repos, &writer, "other.md", "three\n", false);
        repos.git_ok(&writer, &["checkout", "-q", "main"]);
        change(&repos, &writer, "entry.md", "two\n", false);
        // Where a plain `git push` would push every branch the remote has
        repos.git_ok(&writer, &["config", "push.default", "matching"]);

        push(&repos.git, &open(&repos, &writer)).unwrap();
        let remote =
            |branch: &str| repos.git_ok(&writer, &["rev-parse", &format!("origin/{branch}")]);
        repos.git_ok(&writer, &["fetch", "-q"]);
        assert_eq!(remote("main"), head(&repos, &writer));
        assert_ne!(
            remote("other"),
            repos.git_ok(&writer, &["rev-parse", "other"])
        );
    }

    #[test]
    fn pushes_to_a_fork_when_one_is_set_up() {
        let repos = TestRepos::new();
        let (writer, _) = shared(&repos);
        let fork = repos.dir("fork.git");
        repos.git_ok(&fork, &["init", "-q", "--bare", "-b", "main"]);
        repos.git_ok(&writer, &["remote", "add", "fork", fork.to_str().unwrap()]);
        // The usual contributor set-up: pull from the project, push to a fork
        repos.git_ok(&writer, &["config", "branch.main.pushRemote", "fork"]);
        change(&repos, &writer, "entry.md", "two\n", false);
        let upstream_before = repos.git_ok(&writer, &["rev-parse", "origin/main"]);

        push(&repos.git, &open(&repos, &writer)).unwrap();
        assert_eq!(
            repos.git_ok(&fork, &["rev-parse", "main"]),
            head(&repos, &writer)
        );
        repos.git_ok(&writer, &["fetch", "-q", "origin"]);
        assert_eq!(
            repos.git_ok(&writer, &["rev-parse", "origin/main"]),
            upstream_before
        );
    }

    #[test]
    fn pull_refuses_to_overwrite_a_local_file_git_does_not_track() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "draft.md", "theirs\n", true);
        change(&repos, &collaborator, "notes.md", "theirs\n", true);
        // One untracked, one ignored
        fs::write(writer.join("draft.md"), "mine\n").unwrap();
        fs::write(writer.join(".git/info/exclude"), "notes.md\n").unwrap();
        fs::write(writer.join("notes.md"), "mine too\n").unwrap();
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &open(&repos, &writer)).unwrap_err();
        assert!(
            error.contains("draft.md") && error.contains("notes.md"),
            "{error}"
        );
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(
            fs::read_to_string(writer.join("draft.md")).unwrap(),
            "mine\n"
        );
        assert_eq!(
            fs::read_to_string(writer.join("notes.md")).unwrap(),
            "mine too\n"
        );
    }

    #[test]
    fn pull_refuses_when_the_rebase_would_restore_a_file_kept_here_untracked() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "other.md", "two\n", true);
        // The writer's own commit deletes entry.md, which they then keep
        // locally as an ignored file. The upstream still has it, and the
        // rebase checks the upstream out first
        repos.git_ok(&writer, &["rm", "-q", "entry.md"]);
        repos.commit_all(&writer, "Remove entry");
        fs::write(writer.join(".git/info/exclude"), "entry.md\n").unwrap();
        fs::write(writer.join("entry.md"), "kept\n").unwrap();
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &open(&repos, &writer)).unwrap_err();
        assert!(error.contains("entry.md"), "{error}");
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(
            fs::read_to_string(writer.join("entry.md")).unwrap(),
            "kept\n"
        );
    }

    #[test]
    fn pull_refuses_when_its_own_commits_add_and_remove_a_file_kept_here_untracked() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "other.md", "two\n", true);
        // Added in one commit and removed in the next: HEAD and the upstream
        // don't differ there, but the rebase replays both
        change(&repos, &writer, "scratch.md", "added\n", false);
        repos.git_ok(&writer, &["rm", "-q", "scratch.md"]);
        repos.commit_all(&writer, "Remove scratch");
        fs::write(writer.join(".git/info/exclude"), "scratch.md\n").unwrap();
        fs::write(writer.join("scratch.md"), "kept\n").unwrap();
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &open(&repos, &writer)).unwrap_err();
        assert!(error.contains("scratch.md"), "{error}");
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(
            fs::read_to_string(writer.join("scratch.md")).unwrap(),
            "kept\n"
        );
    }

    #[test]
    fn pull_refuses_to_rebase_a_merge() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        change(&repos, &collaborator, "other.md", "two\n", true);
        repos.git_ok(&writer, &["checkout", "-q", "-b", "side"]);
        change(&repos, &writer, "side.md", "side\n", false);
        repos.git_ok(&writer, &["checkout", "-q", "main"]);
        change(&repos, &writer, "entry.md", "two\n", false);
        repos.git_ok(
            &writer,
            &["merge", "-q", "--no-ff", "-m", "Merge side", "side"],
        );
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &open(&repos, &writer)).unwrap_err();
        assert!(error.contains("merge"), "{error}");
        assert_eq!(head(&repos, &writer), before);
    }

    #[test]
    fn pull_refuses_when_its_own_commits_renamed_a_file_the_remote_changed() {
        let repos = TestRepos::new();
        let (writer, collaborator) = shared(&repos);
        let lines: String = (1..=10).map(|n| format!("line {n}\n")).collect();
        change(&repos, &collaborator, "entry.md", &lines, true);
        assert_eq!(pull(&repos.git, &open(&repos, &writer)), Ok(1));

        // The writer renames it in a commit and keeps editing it; the remote
        // changes the same line under the old name
        repos.git_ok(&writer, &["mv", "entry.md", "renamed.md"]);
        repos.commit_all(&writer, "Rename");
        let mine = lines.replacen("line 1", "mine", 1);
        fs::write(writer.join("renamed.md"), &mine).unwrap();
        let theirs = lines.replacen("line 1", "theirs", 1);
        change(&repos, &collaborator, "entry.md", &theirs, true);
        let before = head(&repos, &writer);

        let error = pull(&repos.git, &open(&repos, &writer)).unwrap_err();
        assert!(error.contains("renamed.md"), "{error}");
        assert_eq!(head(&repos, &writer), before);
        assert_eq!(fs::read_to_string(writer.join("renamed.md")).unwrap(), mine);
    }

    #[test]
    fn only_a_rebase_aes_own_is_aborted() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        let repository = open(&repos, &site);
        assert!(!rebase_is_ours(&repository, "aaa", "bbb"));
        let state = site.join(".git/rebase-merge");
        fs::create_dir_all(&state).unwrap();
        fs::write(state.join("orig-head"), "aaa\n").unwrap();
        fs::write(state.join("onto"), "bbb\n").unwrap();
        assert!(rebase_is_ours(&repository, "aaa", "bbb"));
        assert!(!rebase_is_ours(&repository, "aaa", "ccc"));
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
