# Git

The Git panel is an experiment: a Git tab in the right sidebar, switched on per project with the `gitPanel` project setting. It's for technical writers who have git and a local checkout: see the open entry's state, commit it with the files it uses, and push. Project Settings shows what AE found out about git for the project. While the setting is off, AE runs no git commands for that project.

## What it's for, and what it isn't

AE is for writing, so git earns a place only for the moments a writer hits while writing: has this entry changed, and is it committed; commit this finished piece with its images and nothing else; bring in what's changed upstream before committing; don't forget to push. Branches, merges and conflicts are where a writer should switch to a git tool, since getting them wrong loses work or breaks a shared repository. So the tab doesn't check out, discard, stash, make merge commits, switch or create branches, push a new branch for the first time, resolve conflicts or sign in. Nothing in it is automatic, and there's no git UI outside the tab and Project Settings, apart from toasts for a finished push or pull.

It's for two kinds of writer: someone with their own blog repository that deploys on push, and a contributor to a docs site in a folder of a library's monorepo, with other people's changes, hooks, signing and a protected `main`. So a project folder that isn't the repository's root is the normal case. Writers with no terminal or git setup would need AE to own sign-in and the clone, which is a different product.

The commit model is Markdown Monster's: only the open document is ticked, and the writer can tick more. Obsidian Git's auto-sync is where its users meet conflicts, and Front Matter CMS's single Sync button commits everything and pulls, which is wrong for a shared repository.

## Using the system `git`

AE runs the user's own `git` as a child process (`src-tauri/src/git/`), rather than a library like libgit2. Credentials (osxkeychain, `gh auth`, SSH agents), hooks, commit signing, `includeIf` configs, LFS, worktrees and submodules then behave as they do in a terminal, and AE needs no auth code. The cost is that git must be installed, which is fine for this audience. Git's config is the only source of truth: AE stores nothing about git except the setting, and when git doesn't work it shows git's own message rather than working around it.

## Finding `git`

An app opened from the Dock gets launchd's bare environment: a `PATH` without Homebrew or the version managers whose `node` a hook may call, and none of what the user's shell sets up, such as `SSH_AUTH_SOCK` for 1Password's SSH agent, `GIT_SSH_COMMAND`, `GNUPGHOME` or a proxy. Without those, push fails with `Permission denied (publickey)` while it works in the terminal. `shell_env::user_environment()` asks the user's shell once, as an interactive login shell (`$SHELL -ilc`, printing `env -0` between markers), and keeps the answer for the app's life, as VS Code does. It takes about half a second, so it runs the first time git is needed, off the main thread. Every git command gets it on top of the app's own environment, apart from the shell's own variables (`PWD`, `SHLVL` and the like); AE's own process never does. It may hold tokens, so only `PATH` is logged. Changes to the user's shell setup are seen after restarting AE.

`git` is the first one on that `PATH`, the same one the terminal runs, so AE reads the same system config (Homebrew's git and Apple's read different ones). On macOS, `/usr/bin/git` is a stand-in that opens Apple's installer dialog when the command line tools are missing, so AE checks `xcode-select -p` before using it. A git older than 2.31 (`runner::MINIMUM_VERSION`, for `rev-parse --path-format`) is reported as too old rather than failing with a confusing message.

`tauri dev` starts the app with the terminal's `PATH`, so a broken lookup can hide in development, where the fallback is nearly complete. Check changes to it in a release build opened from the Dock.

## Running git

`git::runner::Git::run` runs every command the same way:

- **In a new session (`setsid`).** The command has no controlling terminal and its own process group. When AE itself has a terminal (`tauri dev`), an interactive shell or a hook that reads the terminal was otherwise stopped by the system and hung until the timeout. Without a terminal, it fails at once.
- **With a timeout,** which stops the whole process group, hooks included: a passphrase prompt with nowhere to show would otherwise wait forever. They get `SIGTERM` first and two seconds to exit, then `SIGKILL`: git removes its lock files on `SIGTERM`, so a stopped commit doesn't leave an `index.lock` for the next one to fail on. Output is read on its own threads. A hook that leaves something running in the background holds the output pipes open, so after git exits they get half a second, then what's been read is used, and anything printed later is drained and dropped.
- **On Windows, in a job object,** so a timed-out git is ended with the hooks and credential helpers it started, as the process group does on Unix, and without a console window (`CREATE_NO_WINDOW`), which git would otherwise flash each time it runs.
- **Non-interactive:** stdin closed and `GIT_TERMINAL_PROMPT=0`, so a missing credential fails rather than waiting.
- **`GIT_LITERAL_PATHSPECS=1`,** so a file named `a*.md` is that file, not a pattern. `check-ignore` refuses it, and takes plain paths anyway, so it's off for that one command.
- **`GIT_OPTIONAL_LOCKS=0`,** so `status` doesn't write the index: it never competes with a terminal's git for `index.lock`.
- **`-c core.quotepath=off`,** so paths come back as UTF-8, unquoted.
- **`LC_ALL=C`,** so git's messages are in English whatever language the Mac is set to, since AE looks for one ("not a git repository"). Where it can, AE asks git rather than reading its messages: "nothing to commit" is `diff --cached --quiet`.
- **`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_COMMON_DIR`, `GIT_OBJECT_DIRECTORY` and `GIT_ALTERNATE_OBJECT_DIRECTORIES` removed,** since inherited they'd point every command at another repository or its data. So are `GIT_ICASE_PATHSPECS`, `GIT_GLOB_PATHSPECS` and `GIT_NOGLOB_PATHSPECS` for commands that take AE's paths, which they would make unreadable.
- **`git` from an absolute folder on `PATH`,** never a relative one, which would be looked in from AE's folder and run from the project's.

**Commands that run hooks** (`commit`, `push`, `merge`, `rebase`, `pull`) get none of the literal pathspecs, optional locks, `quotepath` or language settings, so a hook's messages are in the user's language. Push's check for a rejection reads git's reason for it ("non-fast-forward", "fetch first"), which git never translates. Hooks inherit git's environment, `-c` settings included, and a hook should run as it does in the user's terminal: with `GIT_LITERAL_PATHSPECS=1`, a lint-staged-style hook's `git diff --cached -- '*.md'` matches only a file literally named `*.md`, and quietly does nothing. These commands take no paths from AE, so they don't need them. A few other commands can run rarely used hooks (`add` and `reset` run `post-index-change`, `fetch` runs `reference-transaction`), but they keep AE's settings: `add` and `reset` take AE's paths, which must stay literal.

Success is the exit code, never an empty stderr: git prints warnings and hints when it succeeds.

## Finding the repository

`git::repo::discover` runs `rev-parse` from the project folder, which looks up through parent folders, so a site in `docs/` of a monorepo is found. Then, if the project isn't the repository's root, `check-ignore` asks whether the repository ignores the project's folder. If it does, the project is treated as not being in a repository. Otherwise anything committed from a site kept in an ignored folder would land in the parent repository, which may be a different project altogether.

An entry that belongs to another repository can't be committed from the tab, which says so: one whose real path is outside the repository (a folder symlinked in), or one inside a submodule or other repository nested in it (a folder above it has its own `.git`). Git refuses to answer about a submodule's files from the outer repository, so those are found by looking for `.git`, not by asking git.

Every command that changes the index takes explicit paths. Never `add -A`, `commit -a`, or anything else repository-wide.

## Keeping the Git tab current

People commit from other apps while they write, often side by side, so the tab can't wait for AE to be focused again. While it's showing (`useGitRefresh`), it reads git again when:

- **The git folder changes.** `git_watch_start` watches the git folder, and the shared one in a linked worktree; a submodule's is under the parent's `.git/modules/`, so neither need be in the project. It ignores `objects/`, `logs/` and `*.lock` (git writes `index.lock` and renames it to `index`, so the rename is what matters), and sends one `git-changed` after 300ms of quiet. That covers commits, staging, branch switches, and pushes and fetches, which move remote refs.
- **The project watcher sees a content file change,** AE's own saves included.
- **The window is focused again.** TanStack Query's own refetch on focus listens for `visibilitychange`, which switching apps doesn't fire in a desktop window, so the hooks listen for the window's `focus`.

These often come together (a save, then the watcher's event for it), and each read runs several git commands, so they're gathered into one read 200ms after the last. Only the refresh button spins its icon; reads that happen by themselves are quiet.

Our own status never writes the index (`GIT_OPTIONAL_LOCKS=0`), so reading git can't wake the watcher. Other apps' background status does refresh the index, which just means an extra read. The panel is inside `<Activity>`, so when the tab is hidden its effects are torn down and the watcher stops.

Not seen until one of those happens: images or other non-content files changed by another app while AE stays focused, since the project watcher only reports `.md` and `.mdx`. The refresh button covers it.

## Which files go with the entry

`lib/git/entry-files.ts` decides which changes are ticked for the open entry's commit: the entry, files its text refers to as the editor has it, and the folder of a `folder/index.md` entry. A relative reference counts only for the file it resolves to from the entry's folder, so another entry's `cover.jpg` isn't ticked; an alias or a path from a root counts for any changed file of that name, since resolving it would mean reading the project's config. Other content files never join, even when the entry links to them. The panel works this out in a store selector that returns only the list of paths, so typing doesn't re-render it; only adding or removing a file name does.

A file taken out of the entry's text usually stays on disk, so the tab keeps offering it with the entry, unticked and marked as no longer used, if AE copied it in for that entry this session. `processFileToAssets` records each copy in `gitPanelStore.added` as it happens, at the real path Rust reports (git's paths have symlinks resolved too) (drops, image fields and component image props all go through it), rather than the panel noticing names in the text: a hidden tab's effects don't run, so the panel would miss everything written while it was closed. A file the writer linked that was already in the project isn't recorded, since AE can't tell it belongs to this entry. The list is forgotten when AE quits, and moves with an entry AE renames. The warning sign and the file's right-click menu offer to delete it, after asking, as the sidebar deletes files; not once it's gone, nor while AE has files staged for any entry, since it may be one of them.

## Staging and committing

The tab follows git's own two steps, so what's committed is never a surprise. **Stage** saves the entry, then `git add`s the entry and the ticked files (`git::commit::stage`; `add` stages a deleted path's removal too). The card then shows everything in the index, read from git (`git diff --cached` across the whole repository, not just the project folder), with anything AE didn't stage marked "staged outside AE": `git commit` takes the whole index, and a monorepo may have work staged outside the site. **Cancel** runs `git reset` on the paths AE staged. **Commit** saves again, stages the same paths again (so edits saved while the card was open go in), and runs a plain `git commit`. The commit is exactly what the card shows: a file the entry starts using after Stage (an image dropped in while writing the message) isn't added, but the card names it with a Stage button. Stage waits until the editor has the entry's text, since the files it uses come from that.

What AE staged, and for which entry, is `gitPanelStore.staging`, worked out into the card's state by `lib/git/staging.ts`. It counts only while git still has some of those paths staged, so committing or unstaging them elsewhere folds the card. It's kept by the entry's path as the editor has it, and moves with an entry AE renames (a new entry is renamed when its title is first written, which can happen with the card open). The entry's new file isn't staged then, so the card names it and Commit waits until it's staged: committing the staged paths alone would commit the old name's removal without the new file. With another entry's files staged, the tab says so, with Open and Cancel.

Plain `commit` rather than `commit --only <paths>` is deliberate: with `--only`, a `pre-commit` hook that reformats and re-stages a file leaves the index holding the pre-hook version, and status shows the file changed straight after committing. After a commit, AE reloads the open entry from disk if it has no unsaved edits, since a hook may have rewritten it and the file watcher ignores changes just after AE's own save.

Writes run one at a time across the app (`git::writing`), with a longer timeout than reads, since hooks and signing can be slow. None of them runs while git is in the middle of a merge, rebase, cherry-pick or revert (`repo::not_mid_operation`): AE would otherwise finish or abort the user's own. A cherry-pick or revert of several commits that stopped between them leaves only `sequencer/`, which counts too. Only one entry can have files staged by AE at a time, since one commit takes everything staged. Git's message is shown as it is: a refusing hook's output, a missing identity, a held `index.lock`.

An entry AE renamed this session (`gitPanelStore.renamedFrom`) brings its old path along, ticked: git sees a rename as the old path deleted and the new one added, and committing only the new one would leave the deletion behind.

## Pushing and pulling

The repository strip at the top of the tab has Pull and Push (`git::remote`), shown when the branch has an upstream and git isn't in the middle of something. Its ↑/↓ counts open the commits to push (`@{upstream}..HEAD`) and to pull (`HEAD..@{upstream}`, as of the last fetch).

**Push** pushes the branch, and only it, to where a plain `git push` would (`for-each-ref` with `%(push:…)` and `%(upstream:…)`, then `git push <remote> HEAD:<ref>`). The remote is the push remote, which is the upstream's unless a fork is set up (`branch.<name>.pushRemote`). The branch on it is the push refspec's if there is one; otherwise, as git does, the upstream's on the upstream's remote, or the same name on a fork. Git leaves `%(push:remoteref)` empty without a refspec, so it can't be relied on alone. A plain `git push` with `push.default=matching` would push every branch the remote has. It's offered when the branch is ahead and not behind. A rejection because the remote has commits we don't gets its own message pointing at Pull; anything else (a `pre-push` hook refusing, credentials) shows git's message.

**Pull** is the only thing in the tab that fetches, so it's always offered. It only ever does what can't go wrong, so a writer is never left with a half-done merge or rebase to sort out in a tool they may not know:

1. Pause editing (`editingPaused`, see "Editing pauses while git rewrites files" in `editor.md`), save the entry, then `git fetch`.
2. Nothing new: done.
3. If uncommitted changes touch files the upstream changed, refuse, changing nothing. (This is what would make the steps below fail part way.) Both lists are read with `--no-renames`: with rename detection, a file the upstream renamed is listed only under its new name, and the writer's changes to the old one would be put back into it with conflict markers by a rebase that still succeeds. When rebasing, the files the upstream changed include the new name of any the writer's own commits renamed, since the rebase carries the upstream's changes into it.
4. If the upstream has a file that's here but not tracked (or ignored), refuse: the fast-forward would overwrite an ignored one, and the rebase, which checks the upstream out first, either. Every file that differs between HEAD and the upstream is checked, not only those the upstream changed, since a file the writer's own commits deleted is checked out again too; and when rebasing, every file those commits touch, since they're replayed one by one (one added and removed again doesn't differ, but is still written over).
5. Only behind: `merge --ff-only`, which keeps whatever's staged.
6. Ahead too: `rebase --autostash` onto the upstream, so the writer's commits go on top, as they'd want before pushing. Refused when the commits to push include a merge, which a rebase would leave out, with anything changed in it; and while anything is staged, whoever staged it, since the autostash brings staged files back unstaged (the tab disables Pull then). Uncommitted changes are put aside and back, and the checks above mean they come back cleanly. If they somehow don't, git still reports success, leaving conflict markers and the changes in its stash, so AE checks for conflicted files afterwards and says so. If the rebase stops on a conflict, or times out, `rebase --abort` puts everything back as it was, and the tab names the files both sides changed. Only AE's own rebase is aborted: AE records HEAD and the upstream before starting, and checks the rebase under way started from them (`rebase-merge/orig-head` and `onto`), so one a terminal started meanwhile is left alone. Git can't say which process started a rebase, so one a terminal starts from the same commits in the instant before AE's would still pass; checking for a rebase under way again just before starting, after the fetch, keeps that instant as short as it can be.
7. Read the entry again from disk, whether or not the pull worked (one that failed part way may have changed it), and resume editing once the editor's store holds what was read, body and frontmatter (`untilLoaded`).

Pull doesn't offer a merge commit, or a way through conflicts. Those are for the writer's git tool.

**Check remote** in Project Settings runs `git ls-remote` against the branch's remote, only when pressed, since it uses the network and credentials.

Project Settings shows who commits are made as the way git decides it: `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`, then `author.*`, then `user.*` (and `EMAIL` for the email), with where each is set. With none set, git guesses one from the Mac's account (`git var GIT_AUTHOR_IDENT`) and commits with it anyway, so that's a warning; only when git won't guess is it an error. The hooks it lists are those a commit or push runs, in order, `reference-transaction` included, since it can refuse a commit.

## Testing

Rust tests build throwaway repositories with the real `git` (`git::test_repos`): a temp folder git can't look above (`GIT_CEILING_DIRECTORIES`), with the global and system config ignored, so they never read the developer's config or touch their repositories.

For trying it in the app, use repositories outside this checkout. This checkout is itself a git repository, and its test projects are inside it, so a Git panel opened on them would see, and could commit to, astro-editor itself. Never try it on a real site's repository either.

`bash scripts/make-git-test-repos.sh`, from this checkout and outside the agent sandbox (it writes to `~/dev`), builds throwaway repositories in `~/dev/temp-git-repos-for-ae-testing/`, wiping any already there. Each site is a copy of a `test/` project with its `.astro/` committed and `bun install` run, so AE reads it and it builds.

| Repo | Open in AE | For |
| --- | --- | --- |
| `blog` | `blog` | The happy path: history by two authors (with a rename), a bare remote, a commit to push, an uncommitted change |
| `blog-collaborator` | (not opened) | A second clone of the same remote, to play another writer: commit and push here, then pull in `blog` |
| `monorepo` | `monorepo/docs` | A Starlight site in `docs/`, with someone's staged and unstaged work outside it and a staged `docs/astro.config.mjs`. Hooks in `.githooks/`: `pre-commit` strips trailing whitespace and re-stages; `pre-push` refuses while `.block-push` exists |
| `ignored-site` | `ignored-site/site` | A site in a folder the parent repo ignores |
| `no-repo` | `no-repo` | No git at all |
| `submodule-parent` | `submodule-parent/site` | The site as a submodule; `checkout --detach` it for detached HEAD |

Remotes are bare repositories in `remotes/`, so pushing works offline. Play "another app" with `git -C ~/dev/temp-git-repos-for-ae-testing/<repo> …`, always with the full path, never `cd` and a bare `git`. Open one with `bun run app open-project ~/dev/temp-git-repos-for-ae-testing/blog`, and check `bun run app state` shows a project there before driving the app.
