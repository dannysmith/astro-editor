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

## Open questions

From task 3:

- **One Settings window?** Preferences and Project Settings could be one window, with "App" (General, Advanced) and "This Project" (the project, then each collection) in its sidebar. ⌘, and every project entry point would open it at the right page, the two near-identical dialog shells would become one, and Preferences' link to Project Settings would go away. Against it: project settings are mostly an explanation of the project, opened from project places. A strong project identity in the dialog argues for keeping two windows.
- **Drop the "Default" source label?** On an untouched project nearly every row says "Default". Showing a source only when it says something (set by you, from the config, detected, project, global, missing) would be calmer, and fits a pill for overrides.

New:

- **More than one MDX components folder?** The folder is project-wide. The realistic need seems to be several folders rather than one per collection: maggieappleton.com uses `src/components/mdx` and `src/components/unique` side by side, and none of Danny's sites has a components folder per collection.
- **Where does the project's name come from?** The title bar and project list use the folder name. Alternatives are `package.json`'s name or the site's title in `astro.config`, but those mean reading more of the project.

## First thoughts

To discuss before building anything.

- **Group the collection page by what the writer is doing,** not by AE's model: "Where its files are" (folder, the files the pattern leaves out), "New files" (type and name pattern), "Frontmatter" (the four fields), "Images and links", then "Schema" as reference. Status becomes a sentence at the top ("A glob of `**/*.md` in `src/content/blog`, with a generated schema"), with problems as callouts.
- **One setting row pattern:** label, the control, one line of help, and a source shown only when it's not the default. An override gets a pill with a reset in it. A missing value gets a warning line.
- **File names:** keep the presets and the live examples, and move the token reference to a "Pattern syntax" link to the user guide.
- **Project identity:** read `public/favicon.{svg,png,ico}` in Rust and return it with the scan. Without one (maggieappleton.com keeps its favicon in `public/images/favicon/`), show the folder name's first letter on a colour derived from the path. Nothing to store, so nothing to set.
- **The sidebar button:** the project's identity, which opens Project Settings, rather than a generic icon.
- **Collection icon:** something like Lucide's `Files` or `Library`, to sit beside `Database` for data.
- **Copy:** rewrite every label and description against Danny's writing guide, then have it reviewed cold.

## Work

- [ ] Settle the open questions and the layout, with mockups in the styleguide.
- [ ] Project identity: favicon or colour, in the list, the sidebar and the dialog.
- [ ] The dialog's header, icons, and data collection pages.
- [ ] The setting row pattern, override pill and toggles.
- [ ] Rewrite the copy.
- [ ] Update `project-settings.mdx` and `ui-patterns.md`, then take task 3's screenshots.
