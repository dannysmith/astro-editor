# Git

The Git panel is an experiment: a Git tab in the right sidebar, switched on per project with the `gitPanel` project setting. It's for technical writers who have git and a local checkout: see the open entry's state, commit it with the files it uses, and push. Project Settings shows what AE found out about git for the project. While the setting is off, AE runs no git commands for that project.

## Using the system `git`

AE runs the user's own `git` as a child process (`src-tauri/src/git/`), rather than a library like libgit2. Credentials (osxkeychain, `gh auth`, SSH agents), hooks, commit signing, `includeIf` configs, LFS, worktrees and submodules then behave as they do in a terminal, and AE needs no auth code. The cost is that git must be installed, which is fine for this audience. Git's config is the only source of truth: AE stores nothing about git except the setting, and when git doesn't work it shows git's own message rather than working around it.

## Finding `git`

An app opened from the Dock gets a bare `PATH`, without Homebrew or the version managers whose `node` a hook may call. `shell_path::user_path()` asks the user's shell once, as an interactive login shell (`$SHELL -ilc`, printing `PATH` between markers), and keeps the answer for the app's life. It takes about half a second, so it runs the first time git is needed, off the main thread. `git` is the first one on that `PATH`, the same one the terminal runs, so AE reads the same system config (Homebrew's git and Apple's read different ones).

On macOS, `/usr/bin/git` is a stand-in that opens Apple's installer dialog when the command line tools are missing, so AE checks `xcode-select -p` before using it.

`tauri dev` starts the app with the terminal's `PATH`, so a broken lookup can hide in development, where the fallback is nearly complete. Check changes to it in a release build opened from the Dock.

## Running git

`git::runner::Git::run` runs every command the same way:

- **In a new session (`setsid`).** The command has no controlling terminal and its own process group. When AE itself has a terminal (`tauri dev`), an interactive shell or a hook that reads the terminal was otherwise stopped by the system and hung until the timeout. Without a terminal, it fails at once.
- **With a timeout,** which kills the whole process group, hooks included: a passphrase prompt with nowhere to show would otherwise wait forever. Output is read on its own threads, and a hook that leaves something running in the background can't hold the result up.
- **Non-interactive:** stdin closed and `GIT_TERMINAL_PROMPT=0`, so a missing credential fails rather than waiting.
- **`GIT_LITERAL_PATHSPECS=1`,** so a file named `a*.md` is that file, not a pattern. `check-ignore` refuses it, and takes plain paths anyway, so it's off for that one command.
- **`GIT_OPTIONAL_LOCKS=0`,** so `status` doesn't write the index: it never competes with a terminal's git for `index.lock`.
- **`-c core.quotepath=off`,** so paths come back as UTF-8, unquoted.
- **`GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` removed,** since inherited they'd point every command at another repository.

Success is the exit code, never an empty stderr: git prints warnings and hints when it succeeds.

## Finding the repository

`git::repo::discover` runs `rev-parse` from the project folder, which looks up through parent folders, so a site in `docs/` of a monorepo is found. Then, if the project isn't the repository's root, `check-ignore` asks whether the repository ignores the project's folder. If it does, the project is treated as not being in a repository. Otherwise anything committed from a site kept in an ignored folder would land in the parent repository, which is exactly what a stray `git add -A` did once while this was being researched.

Every command that writes takes explicit paths. Never `add -A`, `commit -a`, or anything else repository-wide.

## Keeping the Git tab current

People commit from other apps while they write, often side by side, so the tab can't wait for AE to be focused again. While it's showing (`useGitRefresh`), it reads git again when:

- **The git folder changes.** `git_watch_start` watches the git folder, and the shared one in a linked worktree; a submodule's is under the parent's `.git/modules/`, so neither need be in the project. It ignores `objects/`, `logs/` and `*.lock` (git writes `index.lock` and renames it to `index`, so the rename is what matters), and sends one `git-changed` after 300ms of quiet. That covers commits, staging, branch switches, and pushes and fetches, which move remote refs.
- **AE saves the open file,** or the project watcher sees a content file change.
- **The window is focused again.** TanStack Query's own refetch on focus listens for `visibilitychange`, which switching apps doesn't fire in a desktop window, so the hooks listen for the window's `focus`.

Our own status never writes the index (`GIT_OPTIONAL_LOCKS=0`), so reading git can't wake the watcher. Other apps' background status does refresh the index, which just means an extra read. The panel is inside `<Activity>`, so when the tab is hidden its effects are torn down and the watcher stops.

Not seen until one of those happens: images or other non-content files changed by another app while AE stays focused, since the project watcher only reports `.md` and `.mdx`. The refresh button covers it.

## Which files go with the entry

`lib/git/entry-files.ts` decides which changes are ticked for the open entry's commit: the entry, files whose name appears in its text as the editor has it, and the folder of a `folder/index.md` entry. Other content files never join, even when the entry links to them. The panel works this out in a store selector that returns only the list of paths, so typing doesn't re-render it; only adding or removing a file name does.

## Testing

Rust tests build throwaway repositories with the real `git` (`git::test_repos`): a temp folder git can't look above (`GIT_CEILING_DIRECTORIES`), with the global and system config ignored, so they never read the developer's config or touch their repositories.

For trying it in the app, use repositories outside this checkout. This checkout is itself a git repository, and its test projects are inside it, so a Git panel opened on them would see, and could commit to, astro-editor itself.
