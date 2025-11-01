# Task: Pre Initial Release Tasks

These tasks are necessary before releasing this "to the world".

## In-App

- [x] Add a "Preferences" menu item under "Astro Editor" macoOS menubar menu which opens the settings. The correct coyboard shortcut is `Cmd+,` which already works. Do this in the same way you have with other Tauri menubar items.
- [x] Add "About" dialog and menu item (should include version number, build, release datee etc)
- [x] Update all info in `package.json` and `src-tauri/tauri.conf.json`

## Docs and Files

- [x] Remove all personal-ish demo content from `/test/dummy-astro-project` so it is suitable for other people to use when testing.
- [x] Add LICENSE.md and license info to package.json
- [x] Add standard CONTRIBUTING.md to `/docs`
- [x] Add README.md to `/docs` as index. It should just show the other files/directories along with their purpose
- [x] Add standard SECURITY.md to /docs
- [x] Clean up `docs/archive` as needed
- [x] Clean up `docs/developer` and add any missing guides.
- [x] Add GEMINI.md which references CLAUDE.md
- [x] Review all non-code files - any which can be removed?
- [x] Clean up CLAUDE.md
- [x] Add bare-bones `/.cursor` rules which reference CLAUDE.md

## GitHub Config

- [x] Migrate any outstanding features or known bugs to GitHub Issues
- [x] Migrate Roadmap to GitHub Project
- [x] Clean up any old issues/branches etc

## User Guide, Icons & README

- [x] Add screenshorts etc to User Guide
- [x] Finish editing User Guide
- [x] Update README.md accordingly

- [x] Create and add custom App icons (`src-tauri/icons`)
