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

---

## Decisions Made

These are settled based on discussion in #82:

- **Push most settings to collection level.** Simplify/eliminate the three-tier cascade where possible. Collections own their settings; project-level settings become minimal.
- **No `.astro-editor` config file in repos.** AE stores its settings in app data, not in the user's project. AE should be a nice interface on top of an existing project, not intrude on it.
- **Don't validate all project paths on startup.** Only check when the user tries to open a project (per Louise's suggestion). Show errors at that point.
- **"Copy settings to all collections" solves the setup friction.** No need for templates or bulk operations. If you've configured one collection well, you can copy that config.
- **Minimal intrusion during normal use.** Settings/project management should be tucked away. It should surface during first-run and when adding a new project, but not encroach on the writing experience.
- **Project list should be simple.** VSCode/Zed-style project picker — search, open, delete. Not a dashboard.

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

| Setting | Description | Default/Inference |
|---------|-------------|-------------------|
| Content directory path | Where to find content files | Inferred from collection glob pattern or Astro convention |
| Assets directory path | Where to find/create assets | Astro convention |
| MDX components directory | Where to find MDX components | Astro convention |
| Absolute vs relative asset paths | How to write asset/link paths | Relative |
| Draft field | Which boolean field controls draft status | Auto-detect field named "draft" |
| Title field | Which field to use for search, sidebar title, top frontmatter slot | Auto-detect field named "title" |
| Description field | Which field gets special treatment in search/frontmatter | Auto-detect field named "description" |
| Default sort field + order | Which field to sort by in sidebar, and asc/desc | Date field, descending |
| Default file type | MD or MDX for new files | MD |
| Filename pattern for new files | How to generate filenames (#87) | Date-based (current behaviour) |
| Ignore list | Patterns for files to ignore (gitignore-style) | None |

For each setting, the UI should show:
- Whether it's **set** (user explicitly configured) or **unset** (falling back to default/inference)
- If unset, what value AE is currently using and where it came from
- For fields like "draft": if no matching field exists in the schema, show a warning explaining that draft functionality won't work for this collection

### R3: Schema Visibility

The UI should show the **full schema as parsed by AE** for each collection:

- Each field: name, type, optionality, constraints, default value, description
- How AE interprets each field (e.g. "used as date picker", "rendered as textarea", "image field with preview")
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
- If a project's path no longer exists, show error when user tries to open it (not on startup)
- Simple search/filter for users with many projects

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

1. **Where does the Project Manager UI live?** Options: new pane in Preferences, separate window/modal, replaces Preferences entirely. Leaning towards integrating into a redesigned Preferences.
2. **What happens to project-level settings?** If most settings move to collection level, what remains at the project level? Just root path and content config path?
3. **Settings migration**: How do we handle existing projects with project-level settings? Auto-migrate to collection level? Prompt users?
4. **Schema refresh**: When should AE re-parse `content.config.ts`? On project open only? File watcher? Manual button?
5. **Editing non-current projects**: Can we edit settings for projects without fully opening them? What minimal data do we need?
6. **Filename pattern UX for #87**: Hold file write until field is set, or rename after? What patterns are supported?

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
- Integrate with existing Preferences or replace as decided in Phase 1

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
