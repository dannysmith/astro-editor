# Project settings UX

GitHub: #82

Task 3 built the Project Settings dialog. Using it, it works but reads as a form an AI laid out: the settings are named and explained by what they do internally, not by what a writer is trying to do, and project settings look almost the same as Preferences. This task rethinks it with a UX designer's eye before the user guide screenshots (task 3) are taken.

## Principle

The structure and names should carry the mental model: AE reads your project and shows what it found; you only correct what it got wrong. Help text should back that up in a sentence a person would write, not explain the mechanism. If a setting needs a paragraph, its name or its place is wrong.

## Feedback from using it

- **The sidebar button's icon** (`FolderCog`, a folder with a small cog) doesn't read as project settings. A cog would do, but Preferences already uses `Settings` (a cog) in its sidebar. Something with a large cog, or the project's own icon (below).
- **No heading in the dialog's sidebar.** The top entry is just the folder name, and the page heading repeats it in a plain breadcrumb. It should say clearly that these are the settings for this project, e.g. "Project Settings" with the project's name, perhaps in monospace.
- **Copy reads as AI-written.** For example, "Files the Pattern Leaves Out" is a dropdown of "Hide them" and "Show them dimmed". It should be a toggle with a short explanation of what it does. The File Names help text ("How new files are named. `{title}` is the title as a slug, added when you first give a new file a title. Other placeholders are dates…") is another example. Go through every label and description.
- **The data collections in the sidebar can't be clicked.** Listing them is right, but they should open a page: at least the schema we already read, and an Open in IDE button when an IDE is configured. Probably not the data itself.
- **Other Loaders** (added since): collections whose loader AE can't read and whose folder it can't find, like `atprotoLoader()` ones fetching from an API, now have their own sidebar group after Data, with a plug icon and no status. Their page shows only the loader's name, a note, the Folder setting and the schema (`isUnreadLoader` in `lib/project-settings/status.ts`). The sidebar now has five groups (Collections, Not in the File List, Data, Other Loaders, Settings for Removed Collections), which the redesign should look at as a whole.
- **Tell Project Settings and Preferences apart at a glance.** Give each project an identity: its favicon from `public/` if it has one, otherwise a colour. Use it in the project list, in place of the sidebar's folder button, and prominently in Project Settings, perhaps with an accent colour taken from it.
- **Collections need an icon** in the dialog's sidebar, as data collections have the database icon. Not on the "Collections" heading.
- **Overrides aren't obvious.** "Set by you · Reset" is easy to miss. Something like a pill when a setting is overridden. Rethink how settings are laid out generally, not just the label.
- **New patterns go in the styleguide.** A setting row with its source and reset, the toggle with explanation, the project identity and so on. Try them in the styleguide first if that helps.

## The copy

Going through the test plan, the labels and controls work, but nearly every description reads as machine-written. Why:

- **It explains the mechanism in AE's own words:** loader, pattern, entries, "readable content config". A writer thinks in files and folders. ("Where collections are looked for when their loader doesn't say, and whose folders become collections when there's no readable content config.")
- **Descriptions repeat the label** as a noun phrase: "The components the component builder offers in MDX files." "The folder you browse in the file list."
- **One sentence shape everywhere.** All four field warnings are "No X field, so Y". Four settings end "Collections can override this."
- **The same fact three times.** A missing title says "Not found" next to the label, "Automatic: none" in the dropdown and "No string `title` field…" under it, with a warning triangle, for something that's often fine.
- **Odd constructions:** "Loader: One Astro Editor can't read", "Shown dimmed, they open and edit as usual."
- **The app names itself** ("Astro Editor can't read this collection's loader…"). Mac settings rarely do.
- **On journal's page, the error and the Folder help say the same thing** one above the other.
- **Raw errors show through:** an unreadable pattern shows "Couldn't read the pattern \`*.@(md|mdx)\`: extglobs aren't supported", backticks and all, in a code box.

How to fix it:

- **Most settings need no description.** A clear label and a placeholder showing the value in use are enough for MDX Components Folder. Where there is one, it says when you'd change the setting, or what you'll notice, not how AE works. "Components here can be inserted with ⌘/."
- **Let the control explain itself.** Image paths becomes a choice between "Relative to the file" and "From the project root", each with its example path. Files the pattern leaves out becomes a toggle: "Show files Astro skips", with "Such as drafts named `_draft.md`. They're shown dimmed."
- **Say things once.** "Collections can change these" goes once on the project's Images heading. When the status at the top shows a problem, the setting below it only offers the fix: a Choose Folder… button in the error itself.
- **Missing isn't a warning.** "None" in the dropdown, and one grey line about what you won't get: "Without one, there's no draft badge or filter." Warnings are for things that are broken.
- **Name things by what they are:** a custom loader is "Custom", and "Every Markdown file, except ones starting with `_`" says it's assumed: "Not known, so every `.md` and `.mdx` file except those starting with `_`."
- **Mechanism goes in the user guide,** with one Learn more per section.

## Decisions

Agreed with Danny, and approved from the mockup (`src/styleguide/ProjectSettingsMockup.tsx`, the styleguide's "Project settings (mockup)" section, to be removed once the real dialog matches it):

- **Two dialogs, as now.** Project Settings stays separate from Preferences. They can look different: they're different parts of the app, and the project identity is what tells them apart.
- **A readout, not a form.** Rows grouped in rounded boxes like macOS System Settings: the label (and any help) on the left, the value in use and its control on the right. Wide controls (the file name pattern with its presets and examples) take the full width below their label. Preferences keeps its stacked layout.
- **The project's name is its folder name.** `package.json`'s name is usually a slug too, and `astro.config`'s `site` is a URL.
- **Several MDX components folders, in this branch.** `mdxComponentsDirectory` becomes a list. The version 3 settings file hasn't shipped, so changing its shape now costs no migration. The change is small: the setting's type in Rust, the scan looping over the folders, the component builder's query, a list control on the Project page, and the docs. If it turns out bigger than that, raise an issue and defer it.
- **The sidebar:** the project's identity and "Project Settings" as its header; Project; Collections (including those not in the file list, which already carry an error icon); Other Collections (data with `Database`, other loaders with `Plug`, all clickable). Collections get Lucide's `Files`. Settings saved for removed collections move to the bottom of the Project page, with Clear. The breadcrumb goes; each page has a real heading.
- **Project identity:** `public/favicon.{svg,png,ico}`, returned by the scan as a path and shown through the asset protocol. Without one, the folder name's first letter on one of about eight colour tokens picked from the path. No accent colour taken from the favicon. Shown in the project list, in place of the `FolderCog` button in the file list header, and in the dialog's header.

### Sources

The goal is that people can tell where each value comes from, without every row saying "Default". Each source is shown once, where it's useful:

| Source | Shown as |
| --- | --- |
| Set by you | A pill in the row, with a reset in it. Its tooltip says what it goes back to. |
| Project setting, global preference | The control's first choice names it: "Project setting: relative to the file", "Global preference: Markdown". |
| Content config, schema | The status line at the top says what came from the config and schema; the first choice says "Detected: `title`". |
| Default (convention) | Just the value. The user guide lists the defaults. |
| Missing | "None", and one grey line saying what you won't get. |

Choosing the first choice is the same as resetting.

## Thoughts on the details

- **Group the collection page by what the writer is doing,** not by AE's model: Files (folder, files Astro skips, sort), New files (type and name pattern), Frontmatter (the four fields), Images and links, then Schema as reference. Status becomes a sentence at the top ("`glob()` in `src/content.config.ts`, with a generated schema of 14 fields"), with problems as callouts carrying their fix.
- **Project page:** the config sentence and problems; MDX Components (folders, Add Imports as experimental); Images ("Collections can change these" once, on the heading); Content folder last; removed collections' settings at the bottom.
- **Data and other-loader pages:** where it comes from, one line on why AE doesn't edit it, Open in IDE when an IDE is set, and the schema.
- **File names:** keep the presets and the live examples, and move the token reference to a "Pattern syntax" link to the user guide.
- **Copy:** rewrite every label and description against Danny's writing guide once the layout is settled, then have it reviewed cold.

## Work

- [x] Mockups in the styleguide: the setting row in each state, a collection page, the dialog sidebar with the identity. Approved.
- [x] Test favicons: `personal-site` (SVG), `dummy-astro-project` (PNG), `unusual-structure` (ICO); `starlight-minimal` has none, for the letter.
- [x] Project identity: favicon or colour, in the list, the sidebar and the dialog.
- [x] The dialog's sidebar, header, icons, and data and other-loader pages.
- [x] The setting rows, sources, override pill and toggles.
- [x] Several MDX components folders.
- [x] Rewrite the copy. Each frontmatter field has one line saying what it drives (agreed with Danny), which also covers the missing case.
- [ ] Have the copy reviewed cold, and apply what Danny agrees with.
- [x] Update `project-settings.mdx`, `overrides.mdx`, `app-data.md`, `mdx-components.md`, `ui-patterns.md` and `test/personal-site/README.md`.
- [ ] Take task 3's screenshots for the user guide.
- [x] Remove the mockup. `ProjectSettingsSection` shows the real collection page.
- [ ] Danny tries it in the app, including the folder pickers and Add Folder…, which agents can't drive.
