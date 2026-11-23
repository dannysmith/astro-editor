# Task: Git panel experiment

Issue #369. An experimental Git tab in the right sidebar for technical writers who have git and a local checkout: see the state of the open entry, commit it together with the files it uses, and push and pull. It's switched on per project and everything lives in that one tab. This branch may stay an experiment or become the feature branch; that's decided by dogfooding it. How it works, and why, is in `docs/developer/git.md`.

## Why, and for whom

AE is for writer mode, so git earns a place only for the moments a writer hits while writing: "have I changed this, is it committed?", "this piece is finished, commit it with its images and nothing else", "bring in what's changed upstream before I commit", "don't let me forget to push". Branches, merges and conflicts are where a writer should switch to a git tool, because getting them wrong loses work or breaks a shared repo.

Two audiences: a solo blogger with their own repo that deploys on push, and a contributor to a Starlight site in `docs/` of a library's monorepo, with other people's changes, hooks, signing and a protected `main`. So the project folder not being the repo root is the normal case. Non-technical site owners (no terminal, no git config) need AE to own auth and the clone, which is a different product: Gustavo's AE+ fork (`~/dev/astro-editor-plus`) does that with libgit2 and GitHub sign-in.

Similar tools: Markdown Monster pre-selects only the active document in its commit dialog and lets you tick more, which is the model here. Obsidian Git's auto-sync is where its users get conflicts, so nothing here is automatic. Front Matter CMS's one Sync button commits everything and pulls, wrong for a shared repo.

## Scope

**In:** the open entry's state; staging and committing it with its assets (or any other changed file you tick); pushing the branch to its upstream; pulling when it can be done cleanly; a Git group in Project Settings showing what AE found and whether it works.

**Out:** checkout, discard, stash, merge commits, branches, the first push of a new branch, conflict handling, sign-in, the entry's history (phase 6). No git UI outside the tab and Project Settings, apart from toasts for a finished push or pull.

## Decisions

- **System `git` as a child process,** found on the login shell's PATH, so credentials, SSH agents, hooks, signing, LFS and worktrees behave as in the terminal and AE needs no auth code. Git's config is the only source of truth; when git fails, AE shows git's message rather than working around it.
- **A project setting, `gitPanel`,** in a Git group in Project Settings with the Experimental badge. While it's off no git command runs: no tab, no ⌘4, no palette command. Git runs only while the tab is visible (`<Activity>` tears down its effects when hidden).
- **Staging is shown and is its own step,** as in git: Stage, then a card with the message, what git has staged (including anything staged outside AE, marked), Cancel and Commit. No confirmation dialog; the open card is the confirmation.
- **Writes take explicit paths,** never `add -A` or `commit -a`. A site in a folder a parent repo ignores is treated as not in a repository, or it would commit into the parent (this happened during research).
- **Pull only does what can't go wrong:** fast-forward, or rebase the branch's own commits; refuse up front if uncommitted changes touch the upstream's files; abort a rebase that conflicts. Pull is the only thing that fetches; nothing is automatic.
- **Hooks run as in the terminal.** Commands that run hooks get none of AE's own git environment settings.

## What's built

The tab, top to bottom:

```
⎇ main  origin/main ↑2          [Pull] [Push]
This entry                          articles
┌─────────────────────────────────────────┐
│ ● first-article.md             Modified │
│   Last committed on 28 Oct by Sam       │
└─────────────────────────────────────────┘
[            Stage 2 files              ]
Files it uses
☑ 2026-11-17-harbour.jpg                 U
☐ 2026-11-17-old-map.jpg               ⚠ U
  No longer used in the entry
› Other changes 1
───────────────────────────────────────────
Updates as git changes                   ↻
```

- **Repository strip:** branch, upstream, ↑/↓ counts that open the commits to push and pull, Pull and Push.
- **This entry:** its status in git's words with a coloured dot, and its last commit.
- **Stage** opens the commit card. The typed message is kept per entry while the project is open; the prefill is "Add “Title”" or "Update “Title”".
- **Files it uses:** files the entry's text names, ticked; files AE copied in for it this session (dropped in, or picked for an image field or prop) that its text no longer names, unticked with a warning (clicking it, or Delete… in its right-click menu, deletes the file after asking); an entry renamed this session brings its old path. Statuses as VS Code's letters.
- **Other changes,** folded and unticked, for anything else in the project folder.
- **Right-click** any file for Reveal in Finder, Open in IDE and Copy Path. Clicking a content file opens it.
- **Read-only states** (detached HEAD, an operation in progress, conflicts) hide Stage, Pull and Push and say to finish in a git tool.
- **Refreshing:** a watcher on the git folder while the tab is visible, AE's saves, the project watcher, window focus, and the refresh button, which never fetches.
- **Project Settings → Git:** the switch, the git found, repository, branch, identity with where it's set, signing, hooks, Check remote, and problems with fixes.

Phases, all on `experiment/git-panel`: 0 setup, 1 the Rust side, 2 the switch and an empty tab, 3 the read-only tab, 3a the layout with Danny, 4 committing, 5 pushing, 5a pulling, 5b context menus. Along the way:

- **The tab bar's labels** now hide with CSS (each label wraps out of a one-line clipped box when its tab is too narrow), replacing a `ResizeObserver` that missed tabs added after mount. A container query keyed on the tab count is the alternative if labels going one at a time ever looks wrong.
- **AE never reads an entry while saving one.** An entry was once saved empty during testing. The likely cause, a reload after one save reading the file while the next save's `fs::write` had emptied it, reproduces in a Rust test, and a lock shared by AE's entry reads and saves closes it. Saves are still written in place.

## Left to do, or to revisit

- **Not tried in the app:** renaming an entry from the sidebar and seeing its old path ticked (unit test only); a refusing `pre-push` hook (`.block-push` in `monorepo`) and a rejected push (Rust tests only); SSH remotes, signing and credential prompts (the test repos have none, so the first dogfood repo is the first real test). The login-shell PATH lookup should be checked once in a release build opened from the Dock, since `tauri dev` inherits the terminal's PATH.
- **Deliberately left:** a right-click menu for the rest of the tab (everything is a button); images changed by another app while AE stays focused aren't seen until a refresh or focus (the project watcher only reports `.md`/`.mdx`); whether this entry, rather than the branch, is behind; a "Publish" prefill when the draft field was turned off.
- **Phase 6, history:** not doing for now. The entry card shows the last commit and the strip lists unpushed ones, which may be enough. `commits()` in `git/state.rs` already reads a log if it comes back.
- **Phase 7, dogfood and decide:** Danny uses it on `~/dev/dannyis-astro-content` with the questions below, then decides: keep it as an experiment, make it the feature, or drop it.

## Testing

**Never test in the astro-editor checkout or a real site's repo.** Its test projects sit inside this repo, so a Git tab on them would commit into astro-editor. Use the throwaway repos in `~/dev/temp-git-repos-for-ae-testing/`.

Rebuild them with `bash docs/tasks-todo/temporary/git-369/make-test-repos.sh`, from the main checkout, outside the agent sandbox. It wipes the folder and starts again. It's a throwaway script in the gitignored temporary folder, so copy it across if this work moves to a worktree. Each site is a copy of a `test/` project with its `.astro/` committed and `bun install` run, so AE reads it and it builds. The original research notes (`git-integration-exploration.md`) are alongside it.

| Repo | Open in AE | For |
| --- | --- | --- |
| `blog` | `blog` | The happy path: history by two authors (with a rename), a bare remote, a commit to push, an uncommitted change |
| `blog-collaborator` | (not opened) | A second clone of the same remote, to play another writer: commit and push here, then pull in `blog` |
| `monorepo` | `monorepo/docs` | A Starlight site in `docs/`, with someone's staged and unstaged work outside it and a staged `docs/astro.config.mjs`. Hooks in `.githooks/`: `pre-commit` strips trailing whitespace and re-stages; `pre-push` refuses while `.block-push` exists |
| `ignored-site` | `ignored-site/site` | A site in a folder the parent repo ignores |
| `no-repo` | `no-repo` | No git at all |
| `submodule-parent` | `submodule-parent/site` | The site as a submodule; `checkout --detach` it for detached HEAD |

Remotes are bare repos in `remotes/`, so pushing works offline. Play "another app" with `git -C ~/dev/temp-git-repos-for-ae-testing/<repo> …`, always with the full path, never `cd` and a bare `git`. Open one with `bun run app open-project ~/dev/temp-git-repos-for-ae-testing/blog`, and check `bun run app state` shows a project there before driving the app. The Rust tests build their own repos in a temp folder (`git::test_repos`).

When this ships or is dropped: delete `~/dev/temp-git-repos-for-ae-testing/`, and remove its entry from the sandbox's allowed write paths in `.claude/settings.local.json`, which lets agents play "another app" in the test repos without prompting.

## First dogfood target

`~/dev/dannyis-astro-content`: identity from `~/.gitconfig`, no commit signing, no hooks, HTTPS remote on github.com with `osxkeychain` set in Homebrew git's system config. Only Homebrew's `git` reads that file, so which `git` AE finds changes what config applies; that's why Project Settings shows the git path and where config comes from. It exercises the happy path only.

## What to find out by using it

- Do I commit from AE, or still switch to a terminal? If the latter, why?
- Is the pre-ticked set right? How often do I untick, or tick from Other changes?
- Do I keep the prefilled message?
- Is the tab enough for "don't forget to push", or does that need to show outside the tab (a badge is the smallest step)?
- Do I miss a history of the entry's commits?
- What did git do that the tab didn't explain well?

## Ideas for later, not this experiment

- A count badge on the Git tab while there are unpushed commits.
- The entry's history, and "Open on GitHub" from it.
- The entry's changes since its last commit, shown in the editor (`@codemirror/merge` against `HEAD:<path>`).
- Opening a terminal at the project (the ▶ button in #360), which shares the login-shell PATH code.
