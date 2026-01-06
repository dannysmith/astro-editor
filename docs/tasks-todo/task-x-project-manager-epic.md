# Epic: Project Manager UI

## Overview

Build a comprehensive project management interface that allows users to view, configure, and manage all their registered projects and their content folder settings from a single, intuitive location.

## Problem Statement

### Current Pain Points

1. **Settings are scattered and hidden**: Collection-specific settings (sort fields, draft fields, path overrides) are buried under expandable menus in Preferences. Users don't discover them.

2. **No visibility into project registry**: Users can't see which projects the app knows about, can't delete old projects, can't edit settings for projects that aren't currently open.

3. **Schema-to-folder mapping is implicit**: When Astro site structure doesn't match conventions, users must manually configure path overrides. There's no visual way to "connect" a schema collection to a content folder.

4. **Errors are opaque**: When schema parsing fails or a collection can't be mapped, users don't get clear feedback about what went wrong.

5. **No way to manage multiple projects**: Power users with multiple Astro sites have no way to configure them without opening each one.

### User Feedback

> "The content list is very hard to navigate. The sorting seems haphazard. Custom settings are hidden underneath expandable menus on a secondary menu in preferences."

> "Consider a clear visual indicator for when a content folder has successfully been assigned its corresponding collection schema."

> "Build a proper project manager into the settings which shows all projects which have been opened, allows users to visually map schema content collections to content folders, and clearly shows any errors when reading or merging the schemas."

---

## Goals

1. **Discoverability**: Make project and collection settings obvious and easy to find
2. **Clarity**: Show clear status of schema loading, mapping, and any errors
3. **Control**: Allow users to explicitly map schemas to folders
4. **Flexibility**: Support non-standard Astro site structures without friction
5. **Management**: Enable viewing/editing settings for all registered projects

---

## Requirements

### Must Have

#### R1: Project List View
- Display all registered projects (from project registry)
- Show project name, path, and last opened date
- Indicate current project visually
- Allow switching to a project (opens it)
- Allow removing projects from registry (with confirmation)
- Show if project path no longer exists (stale reference)

#### R2: Project Settings Panel
- Edit settings for any project (not just current)
- Path overrides (content directory, assets directory, MDX components)
- Default file type (md/mdx)
- Asset path preference (absolute/relative)
- Clear inheritance from defaults

#### R3: Content Folder Configuration
- List all content folders discovered in project
- Show schema mapping status for each folder:
  - ✓ Mapped to schema collection
  - ⚠ No matching schema
  - ✗ Schema parse error
- Display which schema collection each folder maps to
- Allow explicit mapping override (folder → schema collection)

#### R4: Schema Status & Errors
- Show parsed schema collections from `content.config.ts`
- Display any parsing errors with helpful messages
- Show which loader type each collection uses (glob, file, etc.)
- Indicate unmapped schema collections (defined but no folder)

#### R5: Per-Folder Settings
- Frontmatter field mappings (date, title, description, draft)
- Path overrides specific to this folder
- Default file type for this folder
- Show which fields exist in the schema for autocomplete

### Should Have

#### R6: Auto-Mapping Suggestions
- When schema defines glob patterns, suggest matching folders
- "This collection uses `src/posts/**` - map to `posts/` folder?"
- One-click to accept suggestion

#### R7: Quick Actions
- "Open in Finder/Explorer" for project path
- "Open in IDE" for project
- "Refresh schema" to re-parse content.config.ts
- "Reset all settings" for a project

#### R8: Search/Filter
- Search projects by name
- Filter to show only projects with errors
- Filter to show only projects with unmapped collections

### Could Have

#### R9: Project Templates
- Save current project settings as template
- Apply template to new projects
- Share templates (export/import)

#### R10: Bulk Operations
- Select multiple projects
- Delete selected from registry
- Apply settings to multiple projects

#### R11: Project Health Dashboard
- Overview of all projects
- Aggregate stats (total files, collections, errors)
- Quick access to projects needing attention

---

## Open Questions

### UX Questions

1. **Where does this UI live?**
   - New tab in Preferences dialog?
   - Separate window/modal?
   - Replace current Preferences entirely?
   - Accessible from sidebar header?

2. **How prominent should it be?**
   - Always visible in some form?
   - Only accessible via menu/preferences?
   - First-run wizard for new projects?

3. **How do we handle the current project vs other projects?**
   - Same UI for both?
   - Current project in main preferences, others in "Project Manager"?
   - Visual distinction when editing non-current project?

4. **What's the interaction model for schema-folder mapping?**
   - Drag and drop?
   - Dropdown selectors?
   - Two-column list with connect lines?
   - Table with mapping column?

### Technical Questions

1. **Schema refresh trigger**
   - When should we re-parse schemas?
   - File watcher on content.config.ts?
   - Manual refresh button only?
   - On project open?

2. **Settings scope**
   - Can we edit settings for closed projects without loading them fully?
   - What minimal data do we need from a project to show its settings?

3. **Error handling**
   - How do we store/display schema parse errors?
   - Should errors persist or be recalculated on each view?

4. **Migration path**
   - How do we handle existing projects with implicit mappings?
   - Do we auto-migrate or prompt users?

---

## Technical Considerations

### Existing Infrastructure

**Project Registry** (`src/lib/project-registry/`):
- Already tracks all registered projects
- Stores project ID, name, path, timestamps
- Per-project settings files in `preferences/projects/{id}.json`
- Three-tier settings fallback (collection → project → default)

**Settings System**:
- `usePreferences` hook for accessing/updating settings
- `useEffectiveSettings` for resolved values
- Deep merge for partial updates
- Query cache invalidation on changes

**Collection Data**:
- `useCollectionsQuery` returns parsed collections with schema info
- `complete_schema` field contains serialized Zod schema
- Collections know their loader type and path patterns

### New Components Needed

1. **ProjectListPane** - List of all registered projects
2. **ProjectDetailPane** - Settings for a single project
3. **ContentFolderList** - Folders with mapping status
4. **SchemaMappingUI** - Visual mapping interface
5. **SchemaStatusBadge** - Error/success indicators

### Data Flow

```
Project Registry (disk)
    ↓
projectStore (state)
    ↓
useProjects() hook (list of all projects)
    ↓
ProjectListPane → ProjectDetailPane → ContentFolderList
                                           ↓
                                    SchemaMappingUI
```

### Potential Challenges

1. **Loading project data without opening project**: May need lightweight "peek" at project settings without full initialization

2. **Schema parsing for non-current projects**: Currently schema parsing happens on project open. May need to support parsing for any project on demand.

3. **Stale project detection**: How to efficiently check if project paths still exist without blocking UI

4. **Settings sync**: If editing settings for current project, need to ensure main app updates

---

## Related Work

### Prerequisites
- [ ] Fix draft field override bug (task-x-collection-sorting-filtering-fixes)
- [ ] Rename "Collections" → "Content Folders" (same task)
- [ ] Add schema status indicator (same task)

### Related Tasks (Could Be Done Separately)
- Sort controls in sidebar
- Search/filter in sidebar
- CSV collection support for references

### Future Enhancements
- Cloud sync for settings
- Team/shared settings
- Plugin system for custom loaders

---

## Success Criteria

1. Users can find and modify collection settings without hunting through menus
2. Users understand which folders have schema mappings at a glance
3. Users with non-standard Astro structures can configure mapping without confusion
4. Schema parsing errors are visible and actionable
5. Users can manage multiple projects from one place

---

## Notes

This is a significant feature that touches settings persistence, schema parsing, and core UI patterns. Should be broken into smaller implementation phases once requirements are solidified.

Consider doing user research or mockups before implementation to validate the UX approach.
