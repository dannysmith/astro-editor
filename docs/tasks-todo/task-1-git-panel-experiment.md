# Task: Git panel experiment

Issue #369. An experimental Git tab in the right sidebar for technical writers who have git and a local checkout: see the state of the open entry, commit it together with the files it uses, and push. It's an experiment to dogfood, switched on per project, and everything it shows lives in that one tab until we've used it for a while. This branch may stay an experiment or become the feature branch; that's decided by using it.

## Why, and for whom

AE is for writer mode, so git earns a place only for the moments a writer hits while writing: "have I changed this, is it committed?", "this piece is finished (draft off), commit it with its images and nothing else", "don't let me forget to push", and maybe "when did this last change?". Branches, pulling, merging and conflicts are where a writer should switch to a git tool, because getting them wrong loses work or breaks a shared repo. Hence the scope rule below: AE only does git operations that can't rewrite the working tree.

Two audiences: a solo blogger with their own repo that deploys on push, and a contributor to a Starlight site that lives in `docs/` of a library's monorepo, with other people's changes, hooks, signing and a protected `main`. So the project folder not being the repo root is the normal case, not an edge case. Non-technical site owners (no terminal, no git config) need AE to own auth and the clone, which is a different product; that's what Gustavo's AE+ fork (`~/dev/astro-editor-plus`) does with libgit2 and GitHub sign-in.

Similar tools: Markdown Monster pre-selects only the active document in its commit dialog and lets you tick more, which is the model here. Obsidian Git shells out to system git; its auto-sync is where its users get conflicts, so nothing here is automatic. Front Matter CMS has one Sync button that commits everything and pulls, wrong for a shared repo. GitHub Desktop labels its button "Commit to <branch>". Decap, Keystatic, Pages CMS and Tina commit through the GitHub API, the non-technical model.

## Scope

**In:** the open entry's state, committing the entry and its assets (or any other changed files you tick), pushing the current branch to its upstream, the entry's history, and a Git section in Project Settings that shows what AE found and whether it works.

**Out:** anything that changes files on disk. No pull, fetch, checkout, discard, stash, merge or rebase. No branch creation, no first push of a new branch, no conflict handling, no sign-in. No git UI outside the tab and Project Settings (no file list dots, no badges, no title bar, no toasts).

Git's own config is the only source of truth. AE stores nothing about git except the on/off setting, and when git doesn't work it says what failed and where to look, rather than working around it.

## Decisions

- **System `git`, run as a child process.** Credentials, SSH agents, hooks, commit signing, LFS, worktrees and submodules all behave as they do in the terminal, and AE needs no auth code. It needs git installed, which is fine for this audience.
- **The switch is a project setting, `gitPanel`,** in a new **Git** group on the project page in Project Settings, with the Experimental badge, the same shape as `addComponentImports`. Git is a per-repository thing: you might want it for your blog but not a work monorepo. No general flag system yet; revisit when there's a global experiment or a third one.
- **While it's off, no git command runs.** No tab, no Cmd+4, no palette command, no detection in Project Settings beyond the switch.
- **Only when the tab is visible.** `RightSidebar` already hides inactive panels with `<Activity>`, which tears down effects, so a hidden Git tab runs no queries. That's both the "panel only" rule and the reason it costs nothing when you're not looking at it.
- **AE never shows git's staging area.** The ticked files *are* the commit. On Commit it runs `git add -- <ticked>` then `git commit -m <message> --only -- <ticked>`, so whatever you've staged in a terminal stays staged and isn't included (checked in a spike). Files are committed whole, never in hunks.
- **The commit button is the confirmation:** "Commit 3 files to main" (GitHub Desktop labels its button with the branch the same way). No modal. Cmd+Enter in the message box does the same.
- **Commit and Push are separate buttons.** Pushing stays a deliberate act. Push needs an upstream; without one the tab says to push the branch from your git tool.
- **Every command that writes takes explicit paths.** Never `add -A`, `commit -a` or anything repo-wide. A site in a folder that a parent repo ignores would otherwise commit into the parent (this happened during research).
- **No automatic fetch.** "Behind" uses the remote refs from your last fetch or pull. A rejected push says so.

## Finding the repository

From the project folder:

1. Find `git` (below). None: "Git isn't installed".
2. `git rev-parse --show-toplevel --show-prefix --git-dir` from the project folder. Fails: "Not in a git repository". This climbs to parent folders on purpose, so a site in `docs/` of a monorepo works.
3. `git check-ignore -q <project>` against that repo. Ignored: treat it as not in a repository ("This folder is ignored by the repository at `~/dev/thing`").
4. `git rev-parse --show-superproject-working-tree`: when the repo is a submodule, say so in Project Settings and under the Push button ("Pushing doesn't update `parent`'s pointer to this submodule").

The open entry is checked too: if its real path (after symlinks) isn't in the project's repository, which happens with content symlinked in from a vault, content kept as a submodule, or a loader `base` outside the project, the tab says "This entry is in a different repository" and offers nothing for it. Handling the entry's own repo can come later if anyone needs it.

## Finding `git`, and the environment it runs in

Apps opened from the Dock get a minimal PATH, so hooks that call `node`, `bun`, `gpg` or `git-lfs` would fail. Resolve the login shell's PATH once, lazily, off the main thread (`$SHELL -ilc` printing PATH between markers, with a timeout), and use it for every git command. AE+ has this in `env_path.rs`; it's also wanted by the ▶ button in #360 and could replace the folder list in `commands/ide.rs`, so build it as shared code.

`git` is the first one on that PATH. If it's `/usr/bin/git`, check `xcode-select -p` first: without the command line tools that shim opens Apple's install dialog.

The lookup takes 0.5–0.8 s on Danny's Mac (an interactive login zsh), so run it once, the first time git is needed, and keep the result. On Windows and Linux use the process's own PATH; they aren't officially supported.

Every command runs from the repo root with stdin `/dev/null`, `GIT_TERMINAL_PROMPT=0` (a missing credential fails instead of waiting) and `GIT_LITERAL_PATHSPECS=1` (otherwise a file named `a*.md` is a pattern and also matches `ab.md`). Status uses `--no-optional-locks` (as VS Code does) so it never fights a terminal git for `index.lock`. Output is `--porcelain=v2 -z` with `-c core.quotepath=off`. Success is the exit code, never "nothing on stderr", because git prints warnings (line endings, hints) on success. A timeout kills the command: a pinentry or passphrase prompt with nowhere to show can otherwise hang forever. Use a generous one for commit and push, since hooks can run tests.

## The tab

Narrow sidebar, so in order of use:

```
main · 2 to push to origin/main    [Push]
───────────────────────────────────────────
Harbour at dawn
New, not committed yet
☑ harbour-at-dawn.md                 New
☑ 2026-11-16-harbour.jpg             New
☐ Other changes (3)                    ›
┌─────────────────────────────────────────┐
│ Add “Harbour at dawn”                   │
└─────────────────────────────────────────┘
[ Commit 2 files to main ]
───────────────────────────────────────────
History                                  ›
```

- **Branch line**: branch, commits to push, and behind count if any, with Push. Expands to list the unpushed commits' subjects (`git log @{u}..HEAD`), which include commits made elsewhere. With nothing to push: "Up to date with origin/main".
- **Entry state**, in words: "New, not committed yet", "Changed since it was last committed, 3 days ago", "Committed, no changes", "Ignored by git". No open file: just the branch line and other changes.
- **Files**: one list. The entry's group is pre-ticked; "Other changes" (every other changed file in the project folder) starts collapsed and unticked. Ticking from there is how you commit a deleted entry, a stray image, or a second entry. Clicking a changed entry opens it.
- **Message**: prefilled until you edit it. "Add “Title”" for a new entry, "Update “Title”" for a changed one, "Publish “Title”" when the collection's draft field was true in `HEAD` and isn't now. A new prefill replaces an unedited one when the ticked files or the draft field change.
- **After a commit**: an inline "Committed `a1b2c3d`" line; the lists and history refresh.
- **History**, collapsed: `git log --follow` for the entry (subject, author, relative date). Nothing to click in this version.
- **Errors** appear inline in the tab: one sentence plus git's own stderr in a monospace block, and "Details in Project Settings → Git".
- **Read-only states**, where Commit and Push are hidden and the tab says "Finish this in your git tool": detached HEAD, a merge, rebase, cherry-pick or revert in progress (`MERGE_HEAD`, `rebase-merge/`, `rebase-apply/`, `CHERRY_PICK_HEAD`, `REVERT_HEAD` via `rev-parse --git-path`), or conflicted files.

### Which files belong to the entry

- The entry file.
- Any changed or untracked file in the project folder whose **file name appears in the entry's current text** (from the editor, not disk). That covers markdown images, image fields, MDX imports and component props. AE names dropped files `YYYY-MM-DD-name.ext`, so false matches are unlikely. A file you dropped in and then removed from the text drops back into Other changes, which is right.
- If the entry is `folder/index.md(x)`, changed files in that folder.
- If AE renamed the entry this session, its old path (git sees a deleted file plus a new one, and committing only the new path leaves the deletion behind). After a restart, the deleted path is in Other changes for you to tick.

Submodule entries in the status (porcelain v2 marks them) are left out of every list.

This is a pure function (changed files + entry path + entry text → pre-ticked paths) in `lib/git/`, with tests.

### When the tab refreshes

Expect people to be writing in AE and committing in another app (a terminal, VS Code, GitHub Desktop, lazygit) at the same time, often side by side, so AE may not regain focus. The tab has to notice git changing by itself, but only while it's visible.

The project watcher (`commands/watcher.rs`) can't do it: it watches collection folders, the content config folders and the schemas, emits only for `.md`/`.mdx`, and never sees `.git`. A commit, stage, push, fetch or pull elsewhere only changes files in the git folder.

So, while the tab is visible:

- **A git folder watcher.** Starts when the tab is shown and stops when it's hidden (the `<Activity>` effect lifecycle does this for free), so it costs nothing otherwise. It watches `git rev-parse --git-dir` and `--git-common-dir` (different in a linked worktree; a submodule's lives under the parent's `.git/modules/`), since neither is necessarily inside the project folder. It ignores `objects/`, `logs/` and `*.lock` files (git writes `index.lock` and renames it to `index`, so the rename is the event that matters) and emits one debounced `git-changed` event (a few hundred ms) for anything else: `HEAD`, `index`, `refs/…`, `packed-refs`, `FETCH_HEAD`, `MERGE_HEAD`, `rebase-*`. That covers commits, staging, branch switches, pushes and fetches (remote refs move), and operations starting or finishing.
- **No feedback loop.** Our own status runs with `--no-optional-locks`, so it never writes the index and never triggers the watcher. Other tools' background status *does* refresh the index (VS Code, GitHub Desktop), which means extra refreshes; the debounce absorbs them, and status scoped to the project folder is cheap.
- **Working-tree changes**: AE's own saves (debounced), the project watcher's `file-changed` events (entries edited elsewhere), and window focus. Assets or other non-markdown files changed by another app while AE stays focused aren't seen until the next refresh; the refresh button covers that. If it turns out to matter, the project watcher could emit for any file in the folders it already watches, though the assets folder usually isn't one of them.
- **Also**: when the tab becomes visible, after our own commands, and from the refresh button.

Refreshing replaces the lists but keeps what you've ticked and typed: a ticked path that's still changed stays ticked, one that's been committed elsewhere disappears, and an edited message is never replaced.

## Committing

1. Save the open file if it has unsaved edits. If the save fails, stop.
2. `git add -- <ticked>`, then `git commit -m <message> --only -- <ticked>`.
3. `git reset -q -- <ticked>`. A pre-commit hook that reformats and re-stages a file (lint-staged + prettier) leaves the real index holding the pre-hook version when `--only` is used, so status shows `MM` (seen in a spike). Resetting those paths to the commit fixes it.
4. If the open file on disk now differs from the editor and the editor has no unsaved edits, reload it. A hook may have rewritten it, and `useFileChangeHandler` ignores watcher events for 3 seconds after our own save, so that change would be missed and the next auto-save would undo it.

Editing isn't blocked while it runs. Keystrokes during a commit either make it into the commit or stay as unsaved edits, which "unsaved edits win over disk" already protects. The worst case is a hook's formatting being undone in the working copy, not lost work.

If the files were committed elsewhere since the tab last refreshed, git exits 1 with "nothing to commit": refresh and say so, rather than showing it as an error.

Failures just show git's message. The common ones are no identity ("Author identity unknown"), a hook refusing, signing failing, `index.lock` held by another git process, and `safe.directory` refusing the repo.

## Pushing

`git push` with no arguments, only when the branch has an upstream (from `--porcelain=v2 --branch`). A rejection shows git's message, and for a non-fast-forward adds "The remote has commits you don't have. Pull in your git tool, then push again." A `pre-push` hook that fails shows its output, which is how someone who wants a build check before pushing gets one.

## Project Settings → Git

A **Git** group on the project page, following how the page already shows what it read from the content config, with problems as callouts:

- **Git panel** switch (Experimental). Everything below only shows, and only runs, when it's on.
- **Git**: the path and version found (`/opt/homebrew/bin/git`, 2.56.1), or "Git isn't installed".
- **Repository**: its root, the project's folder within it when that isn't the root, and whether it's a submodule. Or the "not in a repository" or "ignored" message.
- **Branch**: branch and upstream, or "no upstream".
- **Commit as**: `user.name <user.email>` with where each comes from (`git config --show-origin`, so "from `~/.gitconfig`"), or a problem: "Set `user.name` and `user.email`".
- **Signing**: "Commits are signed (ssh)" when `commit.gpgsign` is on, so a slow or prompting commit makes sense.
- **Hooks**: which ones will run (executable files in `core.hooksPath` or the hooks folder), for the same reason.
- **Check remote** button: `git ls-remote --exit-code <upstream remote> HEAD` with a timeout, showing success or git's message. Runs only when pressed, because it touches the network and credentials.

One Rust command returns all of this. Nothing here is editable: fixing git is done in git.

## Edge cases

Handled by git with no code from us: the project in a subfolder of a repo, worktrees, sparse checkouts, LFS (given the PATH), signing, credential helpers and SSH agents, `includeIf` configs, unicode file names (with `-z` and `quotepath=off`).

Handled by one small check each, all covered above: git missing (and the `/usr/bin/git` dialog), not a repo, ignored by a parent repo, the repo being a submodule, the entry in another repository, submodules inside the project, detached HEAD and operations in progress, conflicted files, no upstream, renames within a session, hooks that re-stage, hooks that rewrite the open file, prompts that would hang.

Everything else is git's own error message in the tab: no identity, bad credentials, rejected pushes, protected branches, `index.lock`, `safe.directory`, broken repos, failed hooks. No special handling.

## Checked in spikes

The scripts are in `docs/tasks-todo/temporary/git-369/spikes/` in the main checkout (gitignored, so not in worktrees); the findings below are what matters, and the Rust tests should cover them. Run the scripts outside the agent sandbox, which blocks writing `.git` folders inside the checkout. Each sets `GIT_CEILING_DIRECTORIES` so git can't reach a parent repo; spike 3 also ignores the global and system config. Without that, a failed `git init` in a subfolder lets the next `git add -A && git commit` land in the parent repo, which happened once during research.

- Scoped status in a monorepo, and `add` + `commit --only` leaving other staged and unstaged work alone (spike 1).
- Renames need both paths; `log --follow` follows them; a re-staging hook leaves `MM`; a refusing `pre-push` hook gives its stderr and exit 1 (spike 2).
- `git reset -q -- <paths>` after the commit clears the `MM` (spike 3).
- Ticking a deleted file works with `add` + `commit --only`. Ticked files that turn out unchanged are fine alongside changed ones; if all are unchanged, exit 1.
- A repo with no commits yet: status shows `# branch.oid (initial)`, the first `commit --only` works, and `git log` **fails** (exit 128), so history treats it as empty.
- No upstream: no `# branch.upstream` or `# branch.ab` lines, and `@{u}` fails. Read upstream state from those lines only.
- `check-ignore -q` says a folder is ignored with or without a trailing slash, and for folders inside an ignored one.
- A submodule inside the project shows as `1 .M S.M. 160000 …` (the `S` marks it). From inside a submodule, `--show-superproject-working-tree` gives the parent.
- In a linked worktree, `rev-parse --git-path MERGE_HEAD` gives that worktree's own path, so in-progress checks work there.
- `config --show-origin --get user.email` gives `file:<path>\t<value>`, and exits 1 when unset.

## Where it touches the code

- **Sidebar tabs.** `RIGHT_SIDEBAR_TABS` (`lib/right-sidebar.ts`) is read in five places: `RightSidebar.tsx`, `unified-title-bar/WindowsMenu.tsx`, `hooks/useMenuEvents.ts`, `hooks/useKeyboardShortcuts.ts` and `lib/commands/app-commands.ts`. The native menu items are written by hand in `src-tauri/src/lib.rs`. Add one non-React function in `lib/right-sidebar.ts` that returns the tabs available for the open project (reading the project settings with `getState()`) and use it in all five. If the Git tab is showing when you switch to a project without it, `uiStore` needs to fall back to Frontmatter.
- **The switch.** `ProjectSettings` in `src-tauri/src/models/preferences.rs` (next to `add_component_imports`), resolved with a source like the others; the UI goes in `project-settings/ProjectPage.tsx`, which already has the `Setting` + Experimental badge pattern and `ProblemCallout` for problems.
- **Saving first.** `saveUnsavedEdits()` in `lib/quit.ts` saves the open file if it's dirty and says whether it worked. Reuse it.
- **The 3-second window** is in `useFileChangeHandler` (see "Unsaved edits win over disk" in `editor.md`).
- **Renames this session.** `lib/files/rename.ts` does every rename of the open file (and the sidebar's). It needs to record old → new paths for the session, so the tab can pre-tick the old path.
- **"Publish" prefill.** The draft field is resolved per collection (`draftField` in the scan, `fieldMappings()` in `lib/project-scan.ts`). `git_state` can take the draft field name and return whether the entry was a draft in `HEAD`, reading `git show HEAD:<path>` with the existing frontmatter reader (`src-tauri/src/frontmatter/`, YAML through `yaml.rs` as always).
- **No schema warning in this experiment.** Upstream has no frontmatter validation. AE+ has one (`src/lib/frontmatter-validation.ts`, used by its `lib/git/publish-check.ts`); if that comes upstream as its own feature, the warning is easy to add.
- **PATH.** AE+'s `src-tauri/src/dev_server/env_path.rs` (about 420 lines with tests) has the `-ilc` lookup with markers, a guard variable, a timeout and well-known folders as a fallback. Take the lookup and the marker parsing; the fallback folder list probably isn't needed for git.

## Implementation notes

- Rust: `src-tauri/src/git/` with a runner (PATH, environment, timeout, one command at a time per repository), a porcelain v2 parser, and `commands/git.rs`. Commands: `git_setup(project)` for Project Settings, `git_state(project, entry)` for the tab (status, branch, push counts, entry repository check, operation in progress), `git_commit(project, paths, message)`, `git_push(project)`, `git_file_log(project, path)`, `git_check_remote(project)`, and `git_watch_start(project)` / `git_watch_stop(project)` for the git folder watcher (the same `notify` setup and debounced event loop as `commands/watcher.rs`, in its own state map).
- Rust tests build temporary repos with the real `git`, with `GIT_CEILING_DIRECTORIES` set to the temp folder, `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`, and an identity in each repo's config, so they never touch the developer's repos or config. Cover: scoped status in a monorepo, `--only` leaving other staged work alone, renames, a re-staging hook, an ignored project folder, a refusing pre-push hook, operations in progress.
- Frontend: TanStack queries under `queryKeys` for the project (watch the `'files'` index-4 convention), enabled only while the tab is visible and the setting is on. A `GitPanel` container and a presentational view, so the styleguide can show every state.
- `RIGHT_SIDEBAR_TABS` gets an optional condition; the tab bar, Cmd+digit shortcuts and palette commands filter on it. The native View menu items are written by hand in `lib.rs`; leave the Git tab out of the menu for the experiment.
- Docs: `docs/developer/git.md` for the rules above (explicit paths, no working-tree changes, the `--only` index fix, why not libgit2). A short website page for the experimental setting can wait until it's been dogfooded.

## Phases

A rough order, not a contract: expect to change it as we learn. Rust first, because everything in the tab is a view of what the Rust side reports, and it can be tested against real repos before there's any UI. Then the switch and an empty tab, so the gating is right from the start, then the tab grows one job at a time: see, commit, push, history.

Each phase ends with `bun run check:all` passing and a commit on `experiment/git-panel`. Stop for Danny to try it after phases 3 and 4, the first time the tab shows real state and the first time it writes to a repo.

### Phase 0: setup (done)

- Research and spikes: the exploration doc and spike scripts in `docs/tasks-todo/temporary/git-369/` (gitignored), with the findings in this doc.
- The `experiment/git-panel` branch, off `main` after the frontmatter work landed.
- This task doc.
- The test repos in `~/dev/temp-git-repos-for-ae-testing/` and the script that rebuilds them (see Testing), checked to open properly in the dev app.
- The agent sandbox can write to the test repos (a temporary entry in Danny's `.claude/settings.local.json`), so an agent can play the other app without prompting.

### Phase 1: the Rust side of git (done)

No UI. A `src-tauri/src/git/` module that later phases only call into.

1. **Running git.** Find `git` (the login-shell PATH lookup taken from AE+'s `env_path.rs`, done once and cached, and the `xcode-select -p` check for `/usr/bin/git`), and one function that runs a git command from a folder with the fixed environment, a timeout, and stdin closed, returning exit code, stdout and stderr. Serialise commands per repository.
2. **The porcelain v2 parser.** `status --porcelain=v2 -z --branch --untracked-files=all` into typed changes (ordinary, renamed, unmerged, untracked, submodule) and the branch header (oid, head, upstream, ahead/behind). Pure, with unit tests from captured output.
3. **Finding the repository.** The steps in "Finding the repository": root, prefix, git dir and common dir, ignored by a parent, submodule, operation in progress.
4. **`git_setup(project)`**, returning everything Project Settings shows, and its tests: temp repos with `GIT_CEILING_DIRECTORIES`, no global or system config, for a repo at the root, a site in a subfolder, an ignored folder, no repo, a submodule.
5. Regenerate the bindings, and add the new types to `src/types/domain.ts`.

Done as `src-tauri/src/shell_path.rs` (the PATH lookup) and `src-tauri/src/git/` (`runner`, `status`, `repo`, `setup`, and `test_repos` for the tests), with `git_setup` in `commands/git.rs`. Serialising commands per repository is left for phase 4, the first time anything writes. What it turned up:

- **The shell and git run in a new session (`setsid`), not just their own process group.** Under `tauri dev` the app has a controlling terminal, and an interactive zsh in a background process group was stopped by the system until the 8-second timeout, so the lookup failed every time. A hook that wants the terminal (a passphrase prompt) would hang the same way. With no terminal, they fail at once. With it, the first `git_setup` takes about 450ms (the shell lookup) and later ones about 110ms.
- **`git check-ignore` refuses `GIT_LITERAL_PATHSPECS=1`** ("pathspec magic not supported"). It takes plain paths, so the runner turns it off for that one command.
- `tauri dev` starts the app with the terminal's PATH, so a broken lookup can still hide in development (the fallback PATH is nearly complete there). Check it once in a release build opened from the Dock.

### Phase 2: the switch and an empty tab (done)

1. **The `gitPanel` project setting** in `ProjectSettings` (`models/preferences.rs`), resolved in `collections.rs` like `add_component_imports`, and the Git group in `ProjectPage.tsx` with the switch and the Experimental badge.
2. **The setup report under the switch**, from `git_setup`, shown only while it's on: git path and version, repository, branch and upstream, identity with sources, signing, hooks, and the problems as `ProblemCallout`s. The Check remote button can wait for phase 5. Add the states to the styleguide's Project Settings section.
3. **The tab, gated.** An optional condition on `RIGHT_SIDEBAR_TABS` entries, one function that returns the tabs available for the open project, and all five readers using it. Fall back to Frontmatter when the Git tab is showing and the project changes to one without it. A placeholder panel.

Check it against every test repo: each one's report in Project Settings, and that with the switch off nothing appears and no git runs.

Done: `gitPanel` in the project settings; `GitSettings` (container) and `GitSettingsView` in `components/project-settings/`, with `lib/git/setup.ts` turning the report into problems with fixes; the `git-settings` and `git-settings-problems` styleguide sections; the Git tab (⌘4) gated by `isRightSidebarTabAvailable` in the tab bar, shortcut, palette and Windows menu, falling back to Frontmatter; a placeholder `GitPanel`; and `docs/developer/git.md`. The setup report is read again on window focus and with a Check again button, since git gets fixed in another app. Checked in the app against `blog`, `monorepo/docs`, `ignored-site/site` and `no-repo`.

### Phase 3: the read-only tab (done)

1. **`git_state(project, entry)`** with tests: the branch line, the changes in the project folder, the entry's state, whether the entry is in another repository, the read-only states.
2. **Which files belong to the entry:** the pure function in `lib/git/` and its tests.
3. **The view:** `GitPanel` container and a presentational view: branch line, entry state, the file list with the entry's group ticked and Other changes collapsed, read-only states and errors. Every state in the styleguide. Ticking works but nothing commits yet.
4. **Refreshing:** the query enabled only while the tab is visible, refreshed on save, `file-changed`, window focus and becoming visible, and the refresh button. Then `git_watch_start`/`git_watch_stop` and the debounced `git-changed` event.

Check the watcher by committing, staging, pushing and fetching in `blog` and `blog-collaborator` from Bash while AE shows the tab, without touching AE. Then hand over to Danny.

Done: `git_state` (`git/state.rs`), `git_watch_start`/`git_watch_stop` in `commands/git.rs`, `lib/git/entry-files.ts`, `useGitStateQuery`, `useGitRefresh`, and `GitPanel` with `GitPanelView` (styleguide section `git-panel`). Checked in the app: a commit, a push, and a collaborator's push plus fetch from Bash all updated the tab within a couple of seconds without touching AE; typing a reference to a new image ticked it; the monorepo shows only `docs/` changes. Differences from the plan:

- **Other content files never join the entry's group,** even when the entry links to them by file name. Committing another article because this one links to it would be a surprise.
- **Window focus is a `focus` listener,** not TanStack's `refetchOnWindowFocus`, which only listens for `visibilitychange`.
- **The entry's title comes from its frontmatter** (the collection's title field), falling back to the file name.
- **The branch line is two lines,** the branch, then how it stands against the upstream, since one sentence wrapped badly at sidebar width.
- Renames within a session (pre-ticking the old path) moved to phase 4, where they matter.

### Phase 4: committing

1. **`git_commit(project, paths, message)`** doing the four steps in "Committing", with tests: `--only` leaving other staged work alone, a deleted file, a rename with both paths, the re-staging hook and the `reset` after it, "nothing to commit".
2. **The message box** with the prefill (Add, Update, Publish) and its "edited" state, and the commit button labelled with the count and branch. Cmd+Enter.
3. **Around the commit:** save first with `saveUnsavedEdits()`, then afterwards reload the open file if a hook rewrote it, the inline "Committed `a1b2c3d`" line, and git's errors in the tab.
4. **Renames this session**, recorded in `lib/files/rename.ts` so the old path comes pre-ticked.

Check it in `monorepo/docs` (hooks, someone else's staged work) and `blog`, then hand over to Danny for the first real commits.

### Phase 5: pushing

`git_push`, the Push button on the branch line, the list of unpushed commits, the non-fast-forward message, the submodule note, and the Check remote button in Project Settings. Check it with `blog-collaborator` (rejected push) and `.block-push` in `monorepo` (refusing hook).

### Phase 6: history

`git_file_log` with `--follow`, an empty history for a repo with no commits, and the collapsed History section.

### Phase 7: dogfood and decide

Danny uses it on `~/dev/dannyis-astro-content` for real writing, with the questions in "What to find out by using it". Write `docs/developer/git.md`. Then decide: keep it as an experiment, turn this branch into the feature, or drop it.

## Testing

**Never test in the astro-editor checkout or a real site's repo.** This checkout is a git repo with other work in it, and its test projects (`temp-dummy-astro-project` and the like) sit inside it, so a Git tab opened on them would show and commit into astro-editor itself. Test only in the throwaway repos in `~/dev/temp-git-repos-for-ae-testing/`, which nothing else uses.

Build or rebuild them with `bash docs/tasks-todo/temporary/git-369/make-test-repos.sh`, run from the main checkout outside the agent sandbox (it writes to `~/dev`). The script wipes the folder and starts again, so rerun it whenever a repo gets into a state you don't want. It's a throwaway script in the gitignored temporary folder, not tooling; copy it across if this work moves to a worktree. Each site is a copy of a project in `test/`, including its generated `.astro/` (committed, so clones have it), plus `bun install`, so AE reads them properly and they build.

| Repo | Open in AE | For |
| --- | --- | --- |
| `blog` | `blog` | The happy path: the dummy project at the repo root, a few weeks of history by two authors (including a rename, for `log --follow`), a local bare remote with one commit to push, and one uncommitted change to `first-article.md` |
| `blog-collaborator` | (not opened) | Another clone of the same remote, to play a second writer: commit and push here, then `git -C …/blog fetch`, and `blog` is behind and its push is rejected |
| `monorepo` | `monorepo/docs` | A Starlight site in `docs/` of a library repo. Someone's work in progress is already there: a staged change outside `docs/`, an unstaged one outside `docs/`, and a staged change to `docs/astro.config.mjs`, all of which a commit from AE must leave alone. Hooks in `.githooks/`: `pre-commit` strips trailing whitespace from staged markdown and re-stages it (the `MM` case, and a hook rewriting the open file); `pre-push` refuses while a `.block-push` file exists at the repo root |
| `ignored-site` | `ignored-site/site` | A site in a folder the parent repo ignores: should say it isn't in a repository |
| `no-repo` | `no-repo` | No git at all |
| `submodule-parent` | `submodule-parent/site` | The site as a submodule. Detach it (`git -C …/site checkout --detach`) for the detached HEAD state |

Every remote is a bare repo in `remotes/`, so pushing works offline and touches nothing real. Commits use your global identity, so Project Settings shows "from `~/.gitconfig`"; the script's own setup commits are unsigned and skip global hooks.

Playing "another app" is plain git from Bash, always as `git -C ~/dev/temp-git-repos-for-ae-testing/<repo> …` with the full path, never `cd` and a bare `git` (one slip and it runs in astro-editor). Before driving the app, check `bun run app state` shows a project under that folder. Opening one: `bun run app open-project ~/dev/temp-git-repos-for-ae-testing/blog`. The other states (merge in progress, conflicts, a missing identity with `git -C … config user.name ""`) are quick to make by hand in `blog` when a phase needs them.

The Rust tests don't use these: they build their own repos in a temp folder (see Implementation notes).

## First dogfood target

`~/dev/dannyis-astro-content`: identity from `~/.gitconfig`, commit signing off (only tags are signed, and the tab never tags), no hooks at all, HTTPS remote on github.com. So it exercises the happy path only: hooks, signing and SSH need a second test repo (one of the `test/` projects with a husky hook and a signing key in its local config would do). The credential helper is `osxkeychain`, set in Homebrew git's system config (`/opt/homebrew/etc/gitconfig`). Only Homebrew's `git` reads that file; Apple's `/usr/bin/git` reads its own system config instead. So which `git` AE runs changes what config applies, and finding the same `git` the terminal uses (the login-shell PATH) is what makes AE behave like the terminal. Project Settings should show the git path, and `--show-origin` sources, for exactly this reason. On this Mac it happens not to matter for credentials: Apple's git sets `osxkeychain` too, in Xcode's own `gitconfig`, and both read the same Keychain items.

## What to find out by using it

- Do I commit from AE, or still switch to a terminal? If the latter, why?
- Is the pre-ticked set right? How often do I untick or tick from Other changes?
- Do I keep the prefilled message?
- Is the tab enough for "don't forget to push", or does that one job need to show up outside the tab (a badge on the tab is the smallest step)?
- Is the history worth its space?
- What did git do that the tab didn't explain well?

## Ideas for later, not this experiment

- A count badge on the Git tab while there are unpushed commits, and status dots in the file list.
- `pull --ff-only` when nothing local would conflict.
- "Open on GitHub" from the history list.
- Showing the entry's changes since the last commit in the editor (`@codemirror/merge` against `HEAD:<path>`), the most writer-friendly diff there is.
- Opening a terminal at the project (the ▶ button idea in #360), which shares the login-shell PATH code.
