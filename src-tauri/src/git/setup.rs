//! What Project Settings shows about git for a project: which `git` runs, the
//! repository the project is in, and the config that decides how a commit
//! behaves. All read from git; AE stores none of it.

use serde::Serialize;
use specta::Type;
use std::path::Path;

use super::repo::{self, Discovery, GitOperation, Repository};
use super::runner::{FindError, Git};
use super::status;
use super::READ_TIMEOUT;

/// The hooks that a commit or push from AE runs
const HOOKS_AE_RUNS: [&str; 5] = [
    "pre-commit",
    "prepare-commit-msg",
    "commit-msg",
    "post-commit",
    "pre-push",
];

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitSetup {
    /// `None` when there's no `git` to run
    pub git: Option<GitProgram>,
    /// Why git can't be used for this project, if it can't
    pub problem: Option<GitProblem>,
    /// Set when the project is in a repository git can read
    pub repository: Option<GitRepository>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitProgram {
    pub path: String,
    /// Like `2.56.1` or `2.50.1 (Apple Git-155)`
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GitProblem {
    NotInstalled,
    /// macOS's `/usr/bin/git` needs the command line tools
    CommandLineToolsMissing,
    NotARepository,
    /// The project is in a folder the repository at `root` ignores
    Ignored {
        root: String,
    },
    /// git failed, with its message
    Failed {
        message: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitRepository {
    pub root: String,
    /// The project's folder within the repository, like `docs`. `None` when
    /// the project is the repository's root.
    pub project_folder: Option<String>,
    /// The parent repository, when this one is a submodule
    pub superproject: Option<String>,
    /// `None` when HEAD is detached
    pub branch: Option<String>,
    /// Like `origin/main`
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    /// False until the first commit
    pub has_commits: bool,
    pub operation: Option<GitOperation>,
    pub user_name: Option<GitConfigValue>,
    pub user_email: Option<GitConfigValue>,
    /// The signature format (`openpgp`, `ssh`, `x509`) when commits are signed
    pub signing: Option<String>,
    /// The hooks a commit or push from AE runs, in the order they run
    pub hooks: Vec<String>,
}

/// A config value and the file it comes from
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitConfigValue {
    pub value: String,
    /// Where it's set, as git reports it: a path like `/Users/me/.gitconfig` or
    /// `.git/config`, or `command line`
    pub origin: String,
}

/// Checks git for the project at `project`. Runs the user's shell the first
/// time it's called (see `shell_path`), so call it off the main thread.
pub fn check(project: &Path) -> GitSetup {
    check_with(Git::find(), project)
}

fn check_with(git: Result<Git, FindError>, project: &Path) -> GitSetup {
    let unusable = |git: Option<GitProgram>, problem: GitProblem| GitSetup {
        git,
        problem: Some(problem),
        repository: None,
    };
    let git = match git {
        Ok(git) => git,
        Err(error) => return unusable(None, error.into()),
    };
    let program = match version(&git, project) {
        Ok(version) => GitProgram {
            path: git.program().display().to_string(),
            version,
        },
        Err(message) => return unusable(None, GitProblem::Failed { message }),
    };
    let repository = match open(&git, project) {
        Ok(repository) => repository,
        Err(problem) => return unusable(Some(program), problem),
    };
    match report(&git, &repository) {
        Ok(report) => GitSetup {
            git: Some(program),
            problem: None,
            repository: Some(report),
        },
        Err(message) => unusable(Some(program), GitProblem::Failed { message }),
    }
}

impl From<FindError> for GitProblem {
    fn from(error: FindError) -> GitProblem {
        match error {
            FindError::NotInstalled => GitProblem::NotInstalled,
            FindError::CommandLineToolsMissing => GitProblem::CommandLineToolsMissing,
        }
    }
}

/// The repository the project is in, or why there isn't one git can use
pub fn open(git: &Git, project: &Path) -> Result<Repository, GitProblem> {
    match repo::discover(git, project) {
        Ok(Discovery::Found(repository)) => Ok(repository),
        Ok(Discovery::NotARepository) => Err(GitProblem::NotARepository),
        Ok(Discovery::Ignored { root }) => Err(GitProblem::Ignored {
            root: root.display().to_string(),
        }),
        Err(message) => Err(GitProblem::Failed { message }),
    }
}

/// `git --version` without the `git version ` in front
fn version(git: &Git, dir: &Path) -> Result<String, String> {
    let output = git.run(dir, &["--version"], READ_TIMEOUT)?;
    if !output.success() {
        return Err(output.error_message());
    }
    let text = output.stdout_text();
    let text = text.trim();
    Ok(text
        .strip_prefix("git version ")
        .unwrap_or(text)
        .to_string())
}

fn report(git: &Git, repository: &Repository) -> Result<GitRepository, String> {
    let root = &repository.root;
    // Only the branch is wanted here, so skip looking for untracked files
    let branch = status::read(git, repository, false)?.branch;

    let signing = match config(git, root, &["--type=bool", "commit.gpgsign"])? {
        Some(sign) if sign.value == "true" => Some(
            config(git, root, &["gpg.format"])?
                .map(|format| format.value)
                .unwrap_or_else(|| "openpgp".to_string()),
        ),
        _ => None,
    };

    Ok(GitRepository {
        root: root.display().to_string(),
        project_folder: Some(repository.prefix.trim_end_matches('/'))
            .filter(|folder| !folder.is_empty())
            .map(str::to_string),
        superproject: repository
            .superproject
            .as_ref()
            .map(|path| path.display().to_string()),
        has_commits: branch.commit.is_some(),
        branch: branch.name,
        upstream: branch.upstream,
        ahead: branch.ahead,
        behind: branch.behind,
        operation: repo::operation_in_progress(repository),
        user_name: config(git, root, &["user.name"])?,
        user_email: config(git, root, &["user.email"])?,
        signing,
        hooks: hooks(git, root)?,
    })
}

/// A config value and where it's set. `None` when it isn't set.
fn config(git: &Git, root: &Path, key: &[&str]) -> Result<Option<GitConfigValue>, String> {
    let mut args = vec!["config", "--show-origin", "--get"];
    args.extend(key);
    let output = git.run(root, &args, READ_TIMEOUT)?;
    match output.code {
        Some(0) => {}
        Some(1) => return Ok(None),
        _ => return Err(output.error_message()),
    }
    // `file:/Users/me/.gitconfig<TAB>value`
    let text = output.stdout_text();
    let (origin, value) = text
        .trim_end_matches('\n')
        .split_once('\t')
        .ok_or_else(|| format!("Unexpected output from git config: {text}"))?;
    Ok(Some(GitConfigValue {
        value: value.to_string(),
        origin: origin.strip_prefix("file:").unwrap_or(origin).to_string(),
    }))
}

/// The hooks in `HOOKS_AE_RUNS` that exist and can run, from the hooks folder
/// git uses (`core.hooksPath` when it's set)
fn hooks(git: &Git, root: &Path) -> Result<Vec<String>, String> {
    let output = git.run(
        root,
        &["rev-parse", "--path-format=absolute", "--git-path", "hooks"],
        READ_TIMEOUT,
    )?;
    if !output.success() {
        return Err(output.error_message());
    }
    let folder = std::path::PathBuf::from(output.stdout_text().trim());
    Ok(HOOKS_AE_RUNS
        .iter()
        .filter(|name| is_runnable(&folder.join(name)))
        .map(|name| name.to_string())
        .collect())
}

fn is_runnable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata()
            .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    path.is_file()
}

#[cfg(test)]
mod tests {
    use super::super::test_repos::TestRepos;
    use super::*;
    use std::fs;

    fn report_for(repos: &TestRepos, project: &Path) -> GitRepository {
        let setup = check_with(Ok(repos.git.clone()), project);
        assert_eq!(setup.problem, None);
        assert!(setup.git.is_some());
        setup.repository.unwrap()
    }

    #[test]
    fn reports_a_site_in_a_subfolder_with_its_upstream() {
        let repos = TestRepos::new();
        let remote = repos.root().join("remote.git");
        repos.git_ok(
            repos.root(),
            &["init", "-q", "--bare", remote.to_str().unwrap()],
        );
        let root = repos.init("library");
        let docs = root.join("docs");
        fs::create_dir_all(&docs).unwrap();
        fs::write(docs.join("index.md"), "# Docs\n").unwrap();
        repos.commit_all(&root, "Initial");
        repos.git_ok(
            &root,
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        repos.git_ok(&root, &["push", "-q", "-u", "origin", "main"]);
        repos.commit_all(&root, "Unpushed");

        let report = report_for(&repos, &docs);
        assert_eq!(report.root, root.display().to_string());
        assert_eq!(report.project_folder.as_deref(), Some("docs"));
        assert_eq!(report.branch.as_deref(), Some("main"));
        assert_eq!(report.upstream.as_deref(), Some("origin/main"));
        assert_eq!((report.ahead, report.behind), (1, 0));
        assert!(report.has_commits);
        assert_eq!(report.superproject, None);
        assert_eq!(report.operation, None);
    }

    #[test]
    fn reports_where_the_identity_comes_from() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        let report = report_for(&repos, &site);
        assert_eq!(
            report.user_name,
            Some(GitConfigValue {
                value: "Test Writer".into(),
                origin: ".git/config".into(),
            })
        );
        assert_eq!(report.user_email.unwrap().value, "writer@example.com");
    }

    #[test]
    fn a_missing_identity_is_none() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        repos.git_ok(&site, &["config", "--unset", "user.name"]);
        repos.git_ok(&site, &["config", "--unset", "user.email"]);
        let report = report_for(&repos, &site);
        assert_eq!((report.user_name, report.user_email), (None, None));
    }

    #[test]
    fn reports_signing_and_the_hooks_that_will_run() {
        use std::os::unix::fs::PermissionsExt;
        let repos = TestRepos::new();
        let site = repos.init("site");
        let report = report_for(&repos, &site);
        assert_eq!(report.signing, None);
        // git init adds sample hooks, which don't run
        assert_eq!(report.hooks, Vec::<String>::new());

        repos.git_ok(&site, &["config", "commit.gpgsign", "yes"]);
        repos.git_ok(&site, &["config", "gpg.format", "ssh"]);
        let hooks = site.join(".githooks");
        fs::create_dir_all(&hooks).unwrap();
        for (name, mode) in [
            ("pre-push", 0o755),
            ("pre-commit", 0o755),
            ("commit-msg", 0o644),
        ] {
            fs::write(hooks.join(name), "#!/bin/sh\n").unwrap();
            fs::set_permissions(hooks.join(name), fs::Permissions::from_mode(mode)).unwrap();
        }
        repos.git_ok(&site, &["config", "core.hooksPath", ".githooks"]);
        let report = report_for(&repos, &site);
        assert_eq!(report.signing.as_deref(), Some("ssh"));
        assert_eq!(report.hooks, vec!["pre-commit", "pre-push"]);
    }

    #[test]
    fn a_new_repository_and_a_detached_head() {
        let repos = TestRepos::new();
        let site = repos.init("site");
        let report = report_for(&repos, &site);
        assert!(!report.has_commits);
        assert_eq!(report.branch.as_deref(), Some("main"));

        repos.commit_all(&site, "Initial");
        repos.git_ok(&site, &["checkout", "-q", "--detach"]);
        let report = report_for(&repos, &site);
        assert!(report.has_commits);
        assert_eq!(report.branch, None);
        assert_eq!(report.upstream, None);
    }

    #[test]
    fn problems_have_no_repository() {
        let repos = TestRepos::new();
        let plain = repos.dir("plain");
        let setup = check_with(Ok(repos.git.clone()), &plain);
        assert_eq!(setup.problem, Some(GitProblem::NotARepository));
        assert!(setup.git.is_some());
        assert_eq!(setup.repository, None);

        let setup = check_with(Err(FindError::NotInstalled), &plain);
        assert_eq!(setup.problem, Some(GitProblem::NotInstalled));
        assert_eq!(setup.git, None);
    }
}
