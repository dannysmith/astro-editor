# Task: The open entry's commit history in the Git tab

The Git tab's entry card shows the entry's last commit, and the repository strip lists commits to push and pull. A writer can't see the entry's earlier commits, or jump to them on GitHub, without a git tool.

Whether this is needed is one of the questions from using the Git panel (`task-1-git-panel-experiment.md`): do I miss a history of the entry's commits?

## Starting points

- `commits()` in `src-tauri/src/git/state.rs` already reads a log for a path (`git log -n … -- <path>`), with `--no-show-signature` so signed repositories don't run gpg per commit. It needs `--follow` for an entry's history through renames.
- **"Open on GitHub":** the remote's URL (`git remote get-url`) turned into a commit URL. Only for hosts whose URL scheme is known (GitHub, GitLab, Codeberg); anything else gets no link rather than a guess.
- **Read-only.** Checking out or reverting to an old version is git-tool territory (see "What it's for" in `docs/developer/git.md`).
