# Task: Git panel review fixes before shipping

A review of everything on `experiment/git-panel` before it merges to `main` and ships in the next release, still behind the experimental per-project `gitPanel` switch. Three reviewers covered the shared code, gating and docs; the frontend; and the Rust side. Danny has been through the findings; this is the agreed work, in phases. Items keep their review numbers, so they can be referred to by number.

Each phase ends with `bun run check:all` passing and a commit. Each bug gets a test. When every phase is done, PR #391 goes from draft to ready and CodeRabbit runs (Danny's step).

## Phase 1: Discuss before building ✅

Two items where the right behaviour needed agreeing first. **Agreed:** for 8, the first option (relative references resolved exactly, anything else by name). For 9, the commit stays exactly what the card shows; the card adds a line naming files the entry uses that aren't staged ("Uses 1 file that isn't staged: x.jpg"), with Stage again to add them; and Stage isn't offered until the editor has loaded the entry.

**8. Another entry's image can be ticked.** `usedFiles` (`lib/git/entry-files.ts`) matches a changed file when its name appears in the entry's text. AE's dated names make collisions rare for files it copies in, but writers' own names collide easily: `posts/other/cover.jpg` is ticked into `posts/trip/index.md`'s commit. To decide: how much reference-resolving is worth having. Options, simplest first:

- Resolve relative references (`./cover.jpg`, `../images/x.png`, a bare `cover.jpg`) against the entry's folder and match the exact path; match anything else (aliases, absolute paths) by name as now. This fixes the `cover.jpg` case. (Disambiguating only when two changed files share a name doesn't: there, only the other entry's `cover.jpg` is changed.)
- As above, and also resolve aliases (`@assets/…`) through the project's config and absolute paths against `public/`, so the name is never the fallback.

**9. Files the entry starts using after Stage.** Commit stages again only the paths from the Stage click, so an image dropped in while the card is open isn't committed, though the text that references it is. Danny thinks this may be fine as it is: the card shows exactly what will be committed, which is the point of Stage being its own step. To decide: leave it, add files silently at commit, or show them in the card ("1 more file used since staging", with a way to add them). Separately, Stage clicked before the editor has loaded the entry leaves out every image; not offering Stage until it's loaded looks like the simple fix.

## Phase 2: Saving in place again ✅

Done: reverted to `fs::write`, and the race in 1a was real. AE reloads the open entry after every save, and that read can overlap the next save's write. A test reading while saving gets 0 bytes without a lock. `ENTRY_IO` in `commands/files.rs` now serialises AE's entry reads and saves.

**1. Revert atomic saves.** Saves go back to writing the entry in place. Revert `79c2ccc9`: `write_atomically` in `src-tauri/src/utils/fs.rs` and its tests, the call in `commands/files.rs`, and the bullet in `editor.md`. Writing a temp file and renaming it lost Finder tags and extended attributes, the creation date, hard links and ownership on every save, and could leave a temp file in the content folder.

**1a. The empty save it was meant to fix.** Never reproduced; the theory was a reload reading the file while AE's own `fs::write` had emptied it. Look for any path where AE reads an entry while it may be writing it (a reload, the watcher after a save, a scan). If those reads all go through Rust, a per-path lock shared by save and read would close it simply. If there's no such path, note in `editor.md` what was checked and stop.

**33. `editor.md`.** Remove the contradiction about how saves are written, and don't state the empty save's cause as fact.

## Phase 3: Running git ✅

Done as below. `shell_path.rs` is now `shell_env.rs`. Push's rejection check reads git's reason ("non-fast-forward", "fetch first"), which git never translates, so it stays. The two shared structs became `GitHead`, flattened into both (TypeScript sees `… & GitHead`), replacing the frontend's hand-written `BranchState`. `git.md` is updated for all of it.

**2. The whole login-shell environment.** `shell_path.rs` takes only `PATH` from the login shell, so `SSH_AUTH_SOCK` from `.zshrc` (a common 1Password SSH setup), `GIT_SSH_COMMAND`, `GNUPGHOME` and proxy variables are missing and push can fail with `Permission denied (publickey)`. Take the whole environment, as VS Code does, still in the one shell spawn:

- Print it with `env -0` between the markers, so values containing newlines parse.
- Apply it to git's child processes only (`Command::envs`), never to AE's own process.
- Drop what belongs to the shell or terminal session rather than the user's setup: `PWD`, `OLDPWD`, `SHLVL`, `_`, `TERM_PROGRAM*`, `TERM_SESSION_ID`, `ITERM_*`. Keep removing `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE`, as now.
- Never log the environment: it may hold tokens.
- It's read once per app run, as `PATH` is now, so changes to `.zshrc` need a restart.
- Rename `shell_path` to fit what it now does.

**7. Keep git's output when a pipe is held open.** If a hook or a shell startup file leaves a background process holding the output pipe, `process::run` waits 500ms and discards everything read. Keep what's been read (a shared buffer per stream) instead.

**14. Don't depend on git's English.** `LC_ALL=C` for AE's own commands (not the ones that run hooks, so hooks run as in the terminal). Check "nothing to commit" with `git diff --cached --quiet` rather than reading the message. Check what's left that matches message text ("not a git repository", "non-fast-forward") and either run it under `LC_ALL=C` or replace it with an exit code.

**15. Minimum git version.** `--path-format` needs git 2.31. Check `git --version` in setup and show "too old" as a problem in Project Settings.

**17.** Pass `--no-show-signature` to the commit log, so `log.showSignature` doesn't run gpg on 50 commits every refresh.

**4. Windows.** `CREATE_NO_WINDOW` (`0x0800_0000`) under `cfg(windows)` so git doesn't flash a console window, and `cfg(unix)` on the two tests that don't compile there (`git/state.rs:342`, `git/setup.rs:326`).

**19.** Merge the branch and upstream fields that `GitRepository` and `GitWorkingTree` duplicate.

## Phase 4: Pull safety

**5. Renames get past Pull's pre-check.** The check that refuses when uncommitted files overlap the upstream's changes uses `git diff`, which follows renames: when upstream renames and edits `a.md` as `b.md`, uncommitted edits to `a.md` pass. The rebase exits 0, AE says "Pulled", `b.md` has conflict markers, the edits sit in a stash, and AE reloads the entry with the markers in it. Add `--no-renames` to both diffs (`git/remote.rs:53-58`), check for conflicted files after the rebase and say so plainly, and test the rename case.

**3. Block Pull whenever anything is staged and the branch is ahead,** whoever staged it, since `rebase --autostash` unstages it. This replaces the current block, which counts only files AE staged and forgets them when the project changes.

**6. The editing pause leaks** (`pullBranch` in `lib/git/actions.ts`).

- Set `editingPaused` before the pre-pull save, not after. Anything typed during that save otherwise schedules an auto-save that writes the old text over the pulled changes.
- Read-only blocks only typing: formatting shortcuts, drops, pastes, Harper fixes and `setEditorContent` still change the text. Reject them while paused with a CodeMirror `changeFilter`, except file loads.
- Keep it free while not paused: put the filter in a compartment that's reconfigured only when the pause starts and ends, so ordinary typing never runs it. Gate `setEditorContent` with a plain check.

## Phase 5: Repository edge cases

**13. An entry inside a submodule breaks the tab.** `check-ignore` fails fatally on a path inside a submodule, and the tab shows only "Failed". Show the entry as read-only, "in submodule X".

**16. A deleted entry shows as "outside the repository".** Canonicalising a deleted file fails. Canonicalise its parent folder and add the file name, so the Deleted state appears.

## Phase 6: Committing the right files

**8** and **9** as agreed in Phase 1.

**10. Renaming an entry while it's staged.** A new entry is renamed when its title is first written; if its files were staged first, the card says "Files are staged for old.md", Open fails, and there's no Cancel. Move the staged record with the entry on rename (as `rememberRename` does for added files), and give the "staged elsewhere" banner its own Cancel.

**11. Delete on "no longer used" files.** Don't offer it for a `deleted` change. Disable it whenever AE has files staged, as `git.md` says, not only when they're staged for this entry.

**12. Get the added file's path from Rust.** `copy_file_to_assets` returns the absolute path it wrote as well, and `joinPath` in `lib/files/fileProcessing.ts` goes. Paths rebuilt in TypeScript don't match git's when a project is opened through a symlink.

**32. Test the panel's deciding logic.** Move what's staged for which entry, the rename and the Pull block out of `GitPanel.tsx` into a pure function in `lib/git/`. Test files staged for another entry, the entry renamed while staged, the staged files committed elsewhere, files staged outside AE, and the Pull block.

## Phase 7: UI and behaviour

- **21.** The commit card focuses only right after Stage is clicked, and selects only the untouched prefill, never a typed message (`CommitCard.tsx`).
- **22.** Show the reasons on disabled Pull and Push: put the `title` on a wrapping span, since `Button` has `disabled:pointer-events-none`.
- **23.** Read git less often: debounce the refresh, and drop the save trigger where the watcher already covers it, so the refresh icon doesn't spin on every auto-save.
- **24.** Keep line breaks in git's messages (`whitespace-pre-wrap` in `Problems.tsx` and the tab's error text), so a refusing hook's output stays readable.
- **25.** Disable the checkboxes when nothing can be committed: no entry open, a read-only state, or an ignored entry.
- **26.** Name `folder/index.md` entries by their folder in the card, the banner and the message prefill.
- **27.** Note an entry's old path after a rename as its old name.
- **28.** Label the ↑/↓ toggle; give the status letter's span `role="img"` so its `aria-label` is read.
- **29.** Build relative commit dates directly, rather than with a regex over another function's wording.
- **30.** Show git's messages in Check remote as plain text, so backticks aren't styled as code.

## Phase 8: Developer docs

- **18.** `git.md`: `add`, `reset` and `fetch` can also run rare hooks, but they take AE's paths and need literal pathspecs, so they stay off the hook list. Correct the wording.
- **34.** Replace history with the reason: `git.md`'s "stray `git add -A`" line, and `ui-patterns.md`'s "measuring in JS missed tabs added after mount".
- **35.** `AGENTS.md`: add `src-tauri/src/git/`, the login-shell module, `process.rs`, `src/lib/git/` and `path-menu.ts` to "Where things live", and describe `git.md` fully.
- **36.** Move the reasons for the tab's scope into `git.md`: writer moments only; no branches, merges, conflicts or auto-sync; why there's no Sync button.
- **37.** Commit `make-test-repos.sh` from `docs/tasks-todo/temporary/git-369/` to `scripts/`, and point `git.md` at it.
- **38.** Finish `task-1-git-panel-experiment.md`: update "Left to do", split "Ideas for later" into `task-x-…` docs, and archive it to `tasks-done/` when this ships.
- Update `git.md` for everything the phases above changed (the environment, the Pull block, submodules, the git version).

## Phase 9: Website docs

**39.** Add a Git tab section to #382: a page for the tab; a Git section in `project-settings.mdx` with the Experimental switch; ⌘4 in `reference/keyboard-shortcuts.mdx`; Toggle Git Panel in `reference/commands.mdx`; a line in `privacy.mdx` (only Pull, Push and Check remote touch the network, through the writer's own git); screenshots; a release note.

## Phase 10: Try it, then ship

**40.** Try in the test repos: the old path following an entry renamed from the sidebar; a refusing `pre-push` hook (`.block-push` in `monorepo`) and a rejected push; Pull with something staged; the rename case from item 5. Then, with a pre-release build opened from the Dock, on a real repo: SSH remotes, signing, credential prompts and the login-shell environment.

Then PR #391 goes to ready, CodeRabbit runs, and its findings are worked through.

**41. After it ships:** delete `~/dev/temp-git-repos-for-ae-testing/` and remove its write path from `.claude/settings.local.json`.

## Decided against

- **20.** A project in the main worktree refreshes whenever any linked worktree changes. It's an extra read, nothing more.
- **31.** ⌘4 is still registered when the switch is off. Nothing else uses it.

## Checked and fine

- **Gating:** with the switch off, nothing git-related runs (no tab, watcher, query or git process; ⌘4, the palette and the menus check the setting). Only the in-memory lists of copied and renamed files are kept. Switching off with the tab showing falls back to Frontmatter. The Rust commands don't check the setting; gating in the frontend is enough.
- **Small shared UI changes, kept:** sidebar tab labels always have a tooltip and drop one at a time when narrow; in the file list's menu, Reveal in Finder selects the file, Open in IDE moved up, and a failed Copy Path shows a toast.
- **Rust:** timeouts and process-group kills (no zombies), credential prompts can't hang, porcelain parsing, the write lock, the mid-operation checks, aborting a conflicting rebase, staging explicit paths, the cached PATH lookup. Linux Clippy is clean.
- **Frontend:** no house-rule violations, nothing the React Compiler skips, and saving before Stage and Commit is sound.
- **No leftovers:** no TODOs, `console.*`, `dbg!` or debug code on the branch.
