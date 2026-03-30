# Epic: Project & Collection Settings

GitHub: #82, #87

## Problem

Settings are hard to find, schema status is invisible, and the relationship between Astro content collections and AE's representation of them is unclear.

Specific pain points:

1. **Settings are buried**: Collection-specific settings (sort fields, draft fields, path overrides) are hidden under expandable accordions in a secondary Preferences pane. Users don't discover them.
2. **No schema visibility**: Users can't see how AE has parsed their `content.config.ts`, which fields it understands, or why something isn't working. Schema parse errors are silent.
3. **The entity model is muddled**: The relationship between a folder on disk, an Astro content collection, a parsed schema, and AE's collection concept isn't clear in code or UI. This makes the settings hierarchy confusing.
4. **Three-tier settings are complex**: The current default → project → collection override chain is hard to reason about. Most settings belong at the collection level.
5. **No project management**: Users can't see which projects AE knows about, remove stale ones, or configure a project they haven't opened.
6. **New file naming is inflexible**: Files are named by date, but filenames often become URL slugs. Users need configurable patterns per collection (#87).

## How It Works Today

### Entity Model (Current)

```
Astro Project (on disk)
├── content.config.ts → defines ContentCollections with optional Zod schemas
├── .astro/collections/ → Generated astro schemas
├── src/content/
│   ├── blog/          → content folder (may or may not match a collection name)
│   ├── docs/          → content folder
│   └── authors/       → content folder

AE's Model
├── Project Registry     → tracks all known projects (id, name, path, timestamps)
├── Global Settings      → theme, IDE command, font size, highlights, autoSaveDelay
├── Per-Project Settings → path overrides, frontmatter mappings, default file type
│   └── Per-Collection Settings → subset of project settings, overridable per collection
```

### Settings Architecture (Current)

Three-tier fallback for most settings:

1. **Collection override** (if user has set one)
2. **Project override** (if user has set one)
3. **Hard-coded Astro defaults** (e.g. `src/content/` for content directory)

Persisted in app data directory:
- `preferences/project-registry.json` — all projects metadata
- `preferences/projects/{projectId}.json` — per-project settings (includes collection overrides)
- `preferences/global-settings.json` — global settings

### Preferences UI (Current)

Four-pane dialog:
1. **General** — global settings (theme, IDE, font, highlights)
2. **Project Settings** — project-level overrides (paths, default file type)
3. **Collections** — expandable accordions per collection, showing inherited vs overridden values
4. **Advanced** — debug/testing features

The Collections pane already shows effective values with inheritance indicators, but it's not discoverable and doesn't surface schema information.

### Target Architecture

**Two-tier settings** replacing the current three-tier model:

1. **Collection setting** (if user has explicitly set one)
2. **Global default** (user-configurable in Preferences, pre-populated with Astro conventions)

No project-level settings. Project records in the registry store metadata only (name, path, timestamps), not settings.

**Preferences dialog** (⌘,): General, Defaults, Advanced
- **Defaults pane** holds global defaults for collection-applicable settings (paths, file type, etc.)
- Pre-populated with current hard-coded Astro defaults
- Text fields fall back to hard-coded defaults when cleared

**Projects dialog** (separate): Project list + per-collection settings + schema viewer
- Collection settings show "set" vs "unset (using global default: X)"
- "Copy to all collections" stamps one collection's explicit values onto others

Changing a global default automatically affects all collections that haven't been explicitly configured.

---

## Decisions Made

These are settled based on discussion in #82:

- **Two-tier settings: global defaults → collection.** Eliminate the project-level settings tier entirely. Collections either have an explicit setting or fall back to the global default. Global defaults are user-configurable in a new "Defaults" pane in Preferences (pre-populated with Astro conventions). Project records store metadata only (name, path, timestamps).
- **No `.astro-editor` config file in repos.** AE stores its settings in app data, not in the user's project. AE should be a nice interface on top of an existing project, not intrude on it.
- **Don't validate all project paths on startup.** Only check when the user tries to open a project (per Louise's suggestion). Show errors at that point.
- **"Copy settings to all collections" solves the setup friction.** No need for templates or bulk operations. If you've configured one collection well, you can copy that config.
- **Minimal intrusion during normal use.** Settings/project management should be tucked away. It should surface during first-run and when adding a new project, but not encroach on the writing experience.
- **Project list should be simple.** VSCode/Zed-style project picker — search, open, delete. Not a dashboard.
- **Separate Projects dialog.** Preferences (⌘,) stays focused on global app behaviour (General + Advanced). A new "Projects" dialog handles project list, collection settings, schema viewer, and mapping UI. The current "Project Settings" and "Collections" panes move out of Preferences.

---

## Requirements

### R1: Revised Entity Model

Clarify the conceptual model and how it maps to code. The key entities:

| Entity | What it is | Where it lives |
|--------|-----------|----------------|
| **Astro Project** | A directory on disk containing an Astro site | Filesystem |
| **Content Config** | `content.config.ts` defining collections with optional schemas | Filesystem |
| **Content Folder** | A directory containing content files (may not match a collection name) | Filesystem |
| **Content File** | A markdown/MDX file on disk | Filesystem |
| **Schema** | A Zod schema for a content collection, as parsed by AE | Derived from content config |
| **AE Project** | AE's record of a known project + its settings | App data / project registry |
| **AE Collection** | AE's representation of a content collection + its settings | App data / per-project settings |

The mapping between Content Folders and Schema Collections is the crux of the complexity. AE currently infers this by name matching. The new system should make this mapping explicit and visible.

### R2: Collection-Level Settings

Each AE Collection should own these settings, with clear "set" vs "unset (using default/inferred)" status:

| Setting | Description | Default/Inference | Exists Today? |
|---------|-------------|-------------------|---------------|
| Content directory path | Where to find content files | Inferred from collection glob pattern or Astro convention | Yes |
| Assets directory path | Where to find/create assets | Astro convention | Yes |
| MDX components directory | Where to find MDX components | Astro convention | Project-level only |
| Absolute vs relative asset paths | How to write asset/link paths | Relative | Yes |
| Published date field | Which date field to display in sidebar, use for date-based features | Auto-detect field named "date", "pubDate", or "publishedDate" | Yes |
| Draft field | Which boolean field controls draft status | Auto-detect field named "draft" | Yes |
| Title field | Which field to use for search, sidebar title, top frontmatter slot | Auto-detect field named "title" | Yes |
| Description field | Which field gets special treatment in search/frontmatter | Auto-detect field named "description" | Yes |
| Default sort field + order | Which field to sort by in sidebar, and asc/desc | Published date field, descending | No |
| Default file type | MD or MDX for new files | MD | Yes |
| URL pattern | Template for content link URLs (e.g. `"/writing/{slug}"`) | None | Yes |
| Filename pattern for new files | How to generate filenames (#87) | Date-based (current behaviour) | No |
| Ignore list | Patterns for files to ignore (gitignore-style) | None | No |

For each setting, the UI should show:
- Whether it's **set** (user explicitly configured) or **unset** (falling back to default/inference)
- If unset, what value AE is currently using and where it came from
- For fields like "draft": if no matching field exists in the schema, show a warning explaining that draft functionality won't work for this collection

### R3: Schema Visibility

The UI should show the **full schema as parsed by AE** for each collection:

- Each field: name, type, optionality, constraints, default value, description
- How AE interprets each field in the frontmatter sidebar (e.g. "used as date picker", "rendered as textarea", "image field with preview")
- Warnings for fields AE can't fully represent (e.g. complex union types, custom Zod refinements)
- Which loader the collection uses (glob, file, etc.)
- Parse errors, if any, with helpful messages

This gives users confidence that AE understands their schema correctly and helps them debug when it doesn't.

### R4: Schema-to-Folder Mapping

- Show which schema collection maps to which content folder
- Show unmapped collections (schema exists but no folder found) and orphan folders (folder exists but no matching schema)
- Allow explicit mapping override when auto-detection fails
- When a collection's glob pattern suggests a mapping, surface that as a suggestion

### R5: Project List & Switcher

- Show all projects in the registry
- Allow opening, removing (with confirmation), and adding projects
- Show current project distinctly
- If a project's path no longer exists, show error when user tries to open it

### R6: Copy Collection Settings

- "Copy this collection's settings to all other collections in this project"
- Solves the setup friction of configuring multiple similar collections
- Should clearly preview what will be overwritten

### R7: Better New File Naming (#87)

- Per-collection setting for filename pattern
- Options should include: date-based (current), field-based (e.g. slugified title), manual entry
- May require deferring file write until the relevant field is filled, or renaming after
- Detail to be worked out in Phase 3

---

## Open Questions

These should be resolved during Phase 1 (Design):

1. ~~**Where does the Project Manager UI live?**~~ **Decided:** Separate "Projects" dialog, distinct from Preferences. Preferences keeps General + Advanced only. Projects dialog handles project list, per-project config, collection settings, schema viewer, mapping UI.
2. ~~**What happens to project-level settings?**~~ **Decided:** Eliminated entirely. Two-tier model: global defaults (Preferences "Defaults" pane) → collection settings (Projects dialog). Project records are metadata only. "Copy to all collections" handles the "I want the same config across this project" use case.
3. ~~**Settings migration**~~ **Decided:** Automatic migration from v2 → v3 on app startup/project open, no user input needed. We own these files. Bump the version key in the JSON files. Migration logic: take any project-level settings and push them down as explicit collection-level settings for all collections in that project, then remove the project-level settings. Must be factored into Phase 2.
4. ~~**Schema refresh**~~ **Decided:** On project open (current behaviour) + manual "Refresh Schema" button in the Projects dialog. No file watcher — config changes rarely and the added complexity isn't worth it.
5. ~~**Editing non-current projects**~~ **Decided:** Deferred. V1 only supports editing settings/viewing schema for the current project. The project list shows all projects (open, remove, switch), but collection settings and schema viewer require the project to be open. Can revisit later if there's demand.
6. **Filename pattern UX for #87**: Leaning towards rename-after rather than deferring file write (safer). Detail to be worked out in Phase 5.

---

## Phases

### Phase 1: Design & Data Model

**Goal**: Settle the mental model, data structures, UI layout, and settings file format before writing implementation code.

Deliverables:
- Revised entity model with clear definitions and relationships
- New settings file structure (what's stored where, what the JSON looks like)
- Migration plan for existing settings
- UI wireframes/mockups for the settings interface
- Resolution of the open questions above
- Updated requirements based on design decisions

This phase is mostly discussion, documentation, and sketching — not code.

### Phase 2: Settings Architecture Refactor

**Goal**: Implement the new data model and settings backend without changing UI.

- Restructure settings persistence (Rust + TypeScript types)
- Migrate existing settings to new format
- Expose schema information needed for R3
- Ensure backwards compatibility or clean migration path

### Phase 3: Collection Settings UI

**Goal**: Build the core settings UI for collections.

- Collection settings panel (R2)
- Schema viewer (R3)
- Schema-to-folder mapping UI (R4)
- "Copy settings" action (R6)

### Phase 4: Project Management

**Goal**: Add project list and lifecycle features.

- Project list/switcher (R5)
- Add/remove projects
- First-run experience for new installs
- Stale project handling

### Phase 5: New File Naming

**Goal**: Implement configurable filename patterns (#87).

- Per-collection filename pattern setting (already in R2)
- Filename generation logic
- UX for field-based naming (deferred write or rename)

---

## Related Issues

- #82 — Manage Projects UI (primary issue)
- #87 — Better "New" File Naming
- #81 — Original discussion that spawned #82
- #57 — `.astro-editor` config file idea (decided against)

## Success Criteria

1. Users can find and understand collection settings without hunting
2. Users can see exactly how AE interprets their schema
3. Schema-folder mapping is visible and configurable
4. Users with non-standard Astro structures can configure things without confusion
5. Settings are simpler to reason about (collection-level, not three tiers)
6. Multiple projects can be managed from one place
