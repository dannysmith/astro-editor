# Website, docs and marketing for 1.2.0

From issue #382. This doc is now the working checklist. Branch: `website-1.2.0`.

Everything the website and marketing need before we release 1.2.0. Merging website changes publishes them straight away, so this work happens on one branch and merges at release time.

Danny wrote most of the site's copy by hand. Keep edits to existing copy small. New pages and larger rewrites are drafts for him to rewrite.

## Before this starts

- [x] Git panel merged to `main`
- [x] #392 merged in #394 (move deleted files to the Trash, with a global setting)
- [x] #390 looked at: still open and waiting on tao#1414 upstream. The tao 0.37.3 update ships in 1.2.0 but doesn't fix the crash.
- [x] Review pass over the whole app
- [x] Turn this issue into a task doc and start a website branch from `main`

## Decisions

- **Version:** 1.2.0.
- **Git tab:** a headline feature. The Experimental label stays in the app and the docs, and isn't mentioned in the homepage, video or other marketing.
- **Copyediting docs:** one page for the whole Copyedit panel, covering the highlights and the spelling, grammar and style checks, at `editor/copyediting`.
- **Git docs:** a top-level `git` page for the best-case workflow, and `reference/git` for how it works in detail.
- **YouTube walkthrough:** removed from the site. Danny may record a new walkthrough and add it later.
- **Bluesky handle:** `astroeditor.danny.is`.
- **Screenshot headings:** stay pink, from the dev app's heading colour, even though the app's default is now the text colour.
- **Harper's `BoundaryError` label:** stays as it is for 1.2.0, including in the `copyedit-checks` and `copyedit-issue-popover` screenshots.

## Phase 1: Positioning

Settle how we describe the "coder-mode-ish" features first, since the docs, homepage, video and release notes all repeat it. The philosophy stays as it is. The addition is that features like the Git tab and adding MDX imports are there to solve problems you hit **while in writer mode**. The Git tab is for quickly committing the thing you're working on. Changes across lots of files, branches, merges and conflicts still belong in a tool built for them.

- [x] `getting-started/philosophy.mdx`, "No coder-mode stuff": replaced the "no mechanism for committing" bullet and added the explanation above. Drafted on the branch for Danny to rewrite.
- [x] `getting-started/philosophy.mdx`, "Simplicity": covers colour themes. The intro now says Astro Editor is "mostly" concerned with writer-mode steps.
- [x] Root `README.md`: scope wording and the feature list.
- [x] Root `AGENTS.md`: the product principles.

## Phase 2: Screenshot tooling and screenshots

`bun run app shot` already captures the whole window at retina, including our custom traffic lights. What's missing is a repeatable way to get the app into the right state at the right size.

- [x] A shot list: each entry has an output file, project, open file, window size, theme and the app commands that set it up. `bun run app shots [name...]` runs them and writes to `website/src/assets/` under the existing filenames, so pages don't change and we can retake everything after future UI changes.
- [x] A setup-only mode that gets the app into a shot's state and stops, so Danny can take it on the Mac (`--setup <name>`, then `--restore`). Needed for anything the bridge can't capture: native menus, native dialogs and vibrancy.
- [x] Use `test/demo-project` for content, through a throwaway `demo-project` repo built by `bash scripts/make-git-test-repos.sh demo`, with a believable history, a remote and an entry with changed images.
- [x] Check nothing dev-only shows in the window before shooting the batch.

Screenshots known to be out of date:

- [x] Right sidebar without tabs: `ai-intro-screenshot`, `pane-overview`, `frontmatter-sidebar-overview`, `main-demo-image-light`, `main-demo-image-dark`
- [x] Old draft badge: `file-manager-3`, `file-manager-drafts-filter`, `file-manager-sort`
- [x] Old command names: `command-palette`
- [x] Preferences and Project Settings: `prefs-general`, `project-settings-project`, `project-settings-collection`, `project-settings-frontmatter`
- [x] `public/og-image.png`: old UI, with `temp-dummy-astro-project` in the title bar
- [x] Check the remaining shots against the current UI, at thumbnail size. Look closer in the Phase 8 review.

New screenshots:

- [x] Copyedit panel with highlights on, with checks on, an issue's popover, the Copyedit preferences pane
- [x] Git tab with an entry and its images, an image no longer used, the commit card, the repository strip, Project Settings → Git

## Phase 3: Correct the existing docs

Work through the checklists under **Feature notes** below, re-checking the Git notes against the merged code. These aren't in those notes:

- [x] `file-management/overview.mdx`: the Delete row already describes the Trash, from #394.
- [x] `preferences.mdx`: the delete setting is already there from #394. Its description now includes the Copyedit pane.
- [x] `privacy.mdx`: squared "works entirely offline" with Git's push, pull and Check remote, and updated the "Last updated" date. Danny to read, since it's the privacy policy.
- [x] `getting-started/introduction.mdx`: the Right Sidebar card and the interface section cover all its tabs.
- [x] `frontmatter/overview.mdx`: its description no longer calls it the overview of the right sidebar.
- [x] `reference/troubleshooting.mdx`: added the `[HARPER]` tag and a link to `reference/git`. The Git code has no log tag, because it shows git's messages in the app.
- [x] The notes say checks run "on your computer", since the app also ships for Windows and Linux.
- [x] Light read of every docs page for anything else these features made wrong.

## Phase 4: New docs pages

- [x] **Copyediting** (`editor/copyediting.mdx`, titled something like "Copyediting, Spelling & Grammar"): replaces `editor/copyedit-modes.mdx`. One page for the panel and how it fits the editing stage of writing, with the highlights (keep the existing screenshot and table) and the spelling, grammar and style checks: how to use them, what Harper is, what it checks and deliberately doesn't, and that it all runs locally.
- [x] Redirect `/editor/copyedit-modes` to the new URL, and update the links in `astro.config.mjs`, `reference/commands.mdx`, `reference/advanced-preferences.mdx` and `index.astro`.
- [x] **Git** (`git.mdx`): the best case, for a writer who wants to commit what they've just written. What it's for, switching it on, then write → stage → commit → push, and pulling. Explain why it's deliberately small and when to use another tool.
- [x] **How the Git tab works** (`reference/git.mdx`): for technical users troubleshooting it. Which `git` it runs and with what environment, credentials, hooks and signing, how it picks an entry's files, exactly what Stage, Commit, Push and Pull do, each case where Pull refuses and what to do, read-only states, monorepos, submodules and ignored folders, common errors. `docs/developer/git.md` is the source.
- [x] Mark both Git pages as experimental, with a sidebar badge and a short note at the top saying it may have more bugs than the rest of the app.
- [x] Add the new pages to the sidebar in `astro.config.mjs`, and link them from the editor overview, Project Settings and the philosophy page.
- [ ] Danny to read and rewrite the three new pages.

## Phase 5: Homepage, SEO and social links

- [x] Add feature sections for Copyedit and Git, in the same format as the existing ones. Copyedit moves up from the "plenty more" cards, so that row needs a new third card (the Content Finder is the obvious one).
- [x] Hero copy: stays as it is, without mentioning editing or committing (Danny's call).
- [x] Remove the "See it in action" YouTube section, along with `YouTubeFacade.astro`, `video-poster.jpg` and their styles.
- [x] Update the intro video's `aria-label`, which says "one-minute tour".
- [x] **OG image on every page.** Docs pages currently declare `summary_large_image` with no image at all. Add `og:image` and `twitter:image` to Starlight's `head` config, and change the default in `Layout.astro` from the favicon to `/og-image.png`.
- [x] Review the site description, homepage title and description, and the JSON-LD for the new features. Add `sameAs` with GitHub and Bluesky.
- [x] Bluesky links to `https://bsky.app/profile/astroeditor.danny.is`: Starlight's `social` config, `SiteHeader`, `SiteFooter`, the root README. Keep the URL in `consts.ts`.

## Phase 6: Marketing video

A longer video (two to two and a half minutes) that follows **one article from first draft to commit**, so the features appear in the order a writer needs them.

1. **Why it exists.** The current opening: too many distractions, then the app. Possibly a line more of the philosophy.
2. **It understands your project.** Schema becomes a form.
3. **Write.** Type a good chunk with typewriter and focus mode. Drag in images. Insert a short and a long MDX component. Fill in some frontmatter.
4. **Link.** Search for another article and insert a link to it. Show the command palette somewhere here.
5. **Edit.** Switch to the Copyedit panel, turn on a couple of highlights, fix a few spelling and grammar issues. Remove one of the images.
6. **Commit.** Open the Git tab. It has ticked the entry and its images, and lists the removed image as no longer used. Stage, write a message, commit.
7. **End card,** with the remaining features and where to get it.

- [ ] Agree a storyboard and script before building anything.
- [ ] Restructure the source first. Captions, camera moves, scrolling and sound cues all use absolute times, and the soundtrack ends at 60s, so adding a scene means retiming everything after it. Give each chapter its own start time and relative timings, and split `index.html` by chapter.
- [ ] Build the Copyedit and Git scenes, recreating the UI in HTML as the current scenes do.
- [ ] Extend the soundtrack.
- [ ] Iterate with stills and section renders, and commit only the final MP4, since every committed render stays in the repo's history.
- [ ] Update `website/video/README.md`.
- [ ] Export short clips of the Copyedit and Git chapters for social posts.

## Phase 7: Release notes

Written for the GitHub release, so they cover everything since 1.1.0 and not only what's on the website. Same format as 1.1.0, using the **Feature notes** below.

- **Intro**, plus anything to know when upgrading: Delete now moves files to the Trash by default (#392), and heading colours follow the text colour until you pick one.
- **Copyedit panel**, with the right sidebar's tabs and shortcuts
- **Spelling, grammar and style**
- **Git tab**, with how to switch it on
- **Frontmatter read like Astro, and edited in place:** only the edited field changes, unreadable frontmatter is shown rather than overwritten, Reorder frontmatter
- **Move to Trash**
- **File name patterns**
- **Colour themes**
- **Other improvements**
- **Bug fixes.** Don't list the Screen Time crash (#390), which is still open.
- **Under the hood:** speed in large collections, telemetry from official builds only, never reading an entry mid-save, dependency updates

- [ ] Go through every commit since `v1.1.0` for anything these notes miss.
- [ ] Use absolute links to the new docs pages.

## Phase 8: Final review and release

- [ ] Light review of all website copy for correctness.
- [ ] `bun run check` and a production build in `website/`, then check links, images and OG tags.
- [ ] Commit this branch's work and switch to an up-to-date `main`, since `prepare-release` refuses a dirty working tree.
- [ ] Run `bun run prepare-release v1.2.0` (it proposes a patch otherwise) and put the notes in the draft release.
- [ ] Merge the website PR just before publishing, so links in the notes and the update dialog work.
- [ ] Publish the release. This generates the website's release page once, so later edits to the GitHub notes don't reach it.
- [ ] Add screenshots and the video to the generated page, as we did for 1.1.0.
- [ ] Post the release on Bluesky.

## Separate task: Bluesky account

[The account](https://bsky.app/profile/astroeditor.danny.is) is somewhere to mention Astro Editor from and to share releases, updates and sneak peeks. It has a name, avatar, bio and its custom domain handle, and no posts yet.

- [x] Switch the handle to `astroeditor.danny.is` with a DNS record.
- [x] Change the bio's link from `http://` to `https://`.
- [x] Make a banner: 1500×500 (or 3000×1000), under 1 MB, with the important part central because the avatar covers the bottom left and mobile crops the sides.
- [x] Research a follow list for Danny to pick from: Astro and Starlight people, Harper, Tauri, and writers publishing with Astro.

## Feature notes

### Right sidebar tabs (#381) and the Copyedit panel

- [x] `reference/keyboard-shortcuts.mdx`: ⌘1 toggles the left sidebar; ⌘2 (Frontmatter) and ⌘3 (Copyedit) open the right sidebar on their tab, or close it if that tab is showing.
- [x] `reference/commands.mdx`: Toggle Left Sidebar, Toggle Right Sidebar, Toggle Frontmatter Panel and Toggle Copyedit Panel; the Highlights group is now called Copyedit.
- [x] `editor/copyediting.mdx`: the highlights can be switched on and off in the Copyedit panel, not only from the palette. In the panel they're one dropdown at the top, which names the highlights that are on and has Show All and Hide All.
- [x] Screenshots that show the right sidebar, which now has a tab bar.

### Spelling, grammar and style checks (#265)

- [x] The spelling, grammar and style part of `editor/copyediting.mdx`, linked from the editor overview:
  - Switch Spelling, Grammar and Style on in the Copyedit panel. Issues are underlined in red, blue and green, the same colours as the highlights.
  - Hover an underline, or click an issue in the panel's list, for Harper's message and its suggested fixes. Click a suggestion to apply it; **Add to Dictionary** (spelling only) and **Ignore** are below.
  - The panel lists the open file's issues in order, with the kind of issue when it says more than the colour (Word Choice, Repetition, …).
  - What isn't checked: frontmatter, code, URLs (a link's text is checked), images, HTML and component tags, MDX imports and `{expressions}`, paths and file names. Text inside components is checked.
  - It stays out of the way on purpose: acronyms and capitalised words inside a sentence (names) aren't flagged, nor are house-style choices like the Oxford comma or "config". So it misses some mistakes rather than nag.
  - An ignored issue stays hidden wherever the same words appear, in any file.
  - Checks run on your computer with [Harper](https://writewithharper.com); nothing is sent anywhere. The checker loads the first time a check runs, so there's a short "Starting checks…" pause.
  - English only.
- [x] `preferences.mdx`: a new **Copyedit** pane: the English dialect for spelling and grammar (American, British, Canadian, Australian, Indian), the dictionary of added words, and **Clear Ignored Issues**.
- [x] `reference/advanced-preferences.mdx`: `global-settings.json` also holds which checks are on, the dialect and the dictionary; ignored issues are kept in the app's own storage, and **Reset All Preferences** clears them too.
- [x] `privacy.mdx`, The Desktop App: spelling and grammar checks run locally and send nothing.
- [x] Screenshots of the Copyedit panel with checks on, an issue's popover, and the Copyedit preferences pane.

### Colour themes (#387)

The website docs are already in #387 (`reference/advanced-preferences.mdx#colour-themes` and `preferences.mdx`), so they go live when it merges. Nothing to do here but the release notes:

- [ ] Mention colour themes in the release notes, linking to the docs.
- [ ] Heading colours now follow the text colour until you pick one. Anyone with a theme whose headings don't match it can click **Reset** next to the heading colours in Preferences.

### Frontmatter read like Astro, and edited in place (#389)

The website docs are already in #389 (`frontmatter/overview.mdx`, `project-settings.mdx`, `reference/settings.mdx` and `reference/yaml.mdx`). Nothing to do here but the release notes:

- [ ] Editing a field changes only that field. Other fields keep their text and comments, an edited field keeps its quotes, list style and trailing comment, and a new field goes where the schema puts it. Before, one edit rewrote the whole block. (#370)
- [ ] Frontmatter is read as Astro reads it. The YAML parser is now serde-saphyr, set up to match Astro's own `yaml` package, and finding and editing the frontmatter block is our own code rather than a parse and rewrite. Checked with 12,416 edits across eight real Astro sites, each read back by Astro's parser.
- [ ] Frontmatter that can't be read (invalid YAML, a field twice) shows the error and its line number in the frontmatter panel. The body is still editable, and saving leaves the frontmatter as it was. Before, the file opened blank and typing in it overwrote the file. (#388)
- [ ] A new project setting, **Reorder frontmatter** (off by default), puts an edited file's fields in schema order, then the rest alphabetically. Link to `project-settings/` and `reference/yaml/#reordering`.

### File name patterns (#384)

The website docs are already in #384 (the token table in `project-settings.mdx#file-names`). Nothing to do here but the release notes:

- [ ] `{slug}` is now the full title slug, `{shortSlug}` the shortened one. Saved patterns using `{title}` keep working.
- [ ] Date and time tokens (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `X` and so on) for timestamp IDs, and `{index}` / `{index:2}` for numbered files like `01-welcome.md`.
- [ ] Renaming a file from its pattern keeps the time and number already in its name.

### Speed (#386)

- [ ] Release notes, under the hood: file lists and new file names in large collections are faster, long scans no longer hold up saves, and saving an edit to the body no longer re-reads the sidebar's folder.

### Git tab, experimental (#391)

An experimental Git tab in the right sidebar, switched on per project. It's for writers who already use git: see the open entry's state, commit it with the files it uses, and push and pull. It uses your own `git`, so your credentials, SSH agent, hooks and signing work as they do in your terminal.

- [x] The `git.mdx` page:
  - Switch it on in **Project Settings → Git** (marked Experimental). It needs git installed and the project in a git repository; a site in a folder of a bigger repository (a docs site in a monorepo) is fine. While it's off, AE runs no git at all for that project.
  - **The repository strip:** the branch, its upstream, and how many commits are to push (↑) and pull (↓); click the counts for the commits. **Push** pushes the branch, and only it, to where a plain `git push` would. With git's default settings it refuses a branch whose upstream has a different name, such as a draft made from `origin/main`, so a draft can't be published by accident. **Pull** fetches, then brings new commits in only when that can be done cleanly: it refuses, changing nothing, when your uncommitted changes touch files that changed upstream, when an untracked or ignored file would be overwritten, when it would have to rebase while files are staged, or when the commits to push include a merge; a rebase that conflicts is undone. Merges and conflicts are for your git tool.
  - **This entry:** its state in git (new, modified, committed, ignored, in another repository) and its last commit.
  - **Files it uses:** files the entry refers to (images, imports, image fields, component props) are ticked to go with it. Images you dropped in and then took out are listed unticked, marked "No longer used in the entry"; the warning sign or the right-click menu moves one to the Trash, or with **Permanently delete files** on, removes it after asking. Anything else changed in the project is under **Other changes**, to tick if you want it.
  - **Stage, then Commit:** Stage opens a card with the message (prefilled "Add “Title”" or "Update “Title”") and exactly what will be committed, including anything staged outside AE. **Cancel** unstages. Only one entry can have files staged at a time, since one commit takes everything staged.
  - **Read-only states:** in the middle of a merge or rebase, on a detached HEAD, or with conflicts, the tab won't commit or push, and says to finish in your git tool.
  - Right-click any file for Reveal in Finder, Open in IDE and Copy Path. Click a content file to open it.
  - It updates as git changes, including commits from other apps; the refresh button re-reads without fetching.
  - What it doesn't do: branches, checkout, discard, stash, merge commits, the first push of a new branch, conflicts, signing in. Nothing is automatic.
- [x] `project-settings.mdx`: a **Git** section: the Experimental switch, and what it shows: the `git` found and its version, the repository, branch, who you commit as and where that's set, signing, the hooks that will run, **Check remote**, and problems with fixes (git not installed, too old (2.31 or later is needed), not a repository, the project in a folder the repository ignores).
- [x] `reference/settings.mdx`: the Git panel switch in the project settings table.
- [x] `reference/keyboard-shortcuts.mdx`: ⌘4 opens the right sidebar on the Git tab, or closes it if that tab is showing (only when the Git tab is switched on).
- [x] `reference/commands.mdx`: Toggle Git Panel (only when the Git tab is switched on).
- [x] `privacy.mdx`, The Desktop App: the Git tab sends nothing to us. Only Pull, Push and Check remote use the network, through your own git, to your own remote.
- [x] Screenshots: the tab with an entry and its images, the commit card, and Project Settings → Git.
- [ ] Release notes: the Git tab, off by default, with how to switch it on and a link to its page.
- [ ] Release notes, under the hood: AE no longer reloads an entry while it's saving it. Rarely, a save straight after another could load the entry into the editor empty, and the next save would write that back.


