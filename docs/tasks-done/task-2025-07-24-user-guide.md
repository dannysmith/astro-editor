# Task: User Guide

Finish `docs/user-guide.md` user-facing guide. Will eventually be used to build simple documentation sites. Must also look good when rendered on GitHub.

## Content Gaps Identified

The current user guide has good foundations but needs substantial completion in these areas:

### 1. Getting Started (Critical)

**Missing sections that need writing:**
- **Quick Start**: Step-by-step guide to opening first project and getting editing
- **Interface Overview**: Annotated diagram/description of three-panel layout, toolbar, status bar
- **Your First Project**: Walking through opening an Astro project and understanding the UI

### 2. Core Editor Features (High Priority)

**Sections needing expansion:**
- **Writing Markdown**: Basic editing, bold/italic, lists, HTML/JSX highlighting
- **Inserting Images & Files**: Complete drag & drop workflow, asset directory handling
- **Inserting Astro Components**: Full MDX component builder documentation
- **Auto-save vs Manual Save**: Explain 2-second auto-save, manual save feedback

### 3. File Management (High Priority)

**Missing critical functionality:**
- **Creating New Files**: Cmd+N workflow, collection selection, file naming
- **File Operations**: Context menu (right-click), renaming, duplication, revealing
- **Draft System**: How drafts are detected, visual indicators, filtering toggle
- **File Organization**: How files are sorted, title display, date handling

### 4. Command Palette (High Priority)

**Needs comprehensive coverage:**
- **Basic Usage**: Cmd+K to open, fuzzy search, categories
- **File Search**: Searching across all collections, quick file switching
- **Available Commands**: Complete list with descriptions organized by category
- **Context Sensitivity**: How available commands change based on current state

### 5. Frontmatter System (Medium Priority)

**Sections needing detail:**
- **Schema Integration**: How Zod schemas become forms, validation
- **Field Types**: Complete mapping table (string, number, boolean, date, enum, array)
- **Required vs Optional**: Visual indicators, validation feedback
- **Field Behavior**: Auto-expand textareas, date pickers, enum dropdowns
- **Frontmatter Order**: How fields are written to files, defaults handling

### 6. Project Settings & Preferences (Medium Priority)

**Missing comprehensive coverage:**
- **Global Preferences**: Theme, IDE command, default project settings
- **Project-Specific Settings**: Path overrides, frontmatter mappings
- **Path Overrides**: Content directory, assets directory, MDX components directory
- **Frontmatter Mappings**: Title, date, description, draft field configuration
- **Settings Persistence**: How settings are saved, project registry

### 7. Advanced Features (Medium Priority)

**Needs better documentation:**
- **Focus Mode**: Sentence-by-sentence highlighting, toolbar toggle
- **Typewriter Mode**: Centered cursor, scrolling behavior, reliability warning
- **Copyedit Mode**: Parts of speech highlighting, individual toggles, performance
- **URL Detection**: Alt+hover, Alt+click to open, markdown link handling

### 8. Technical Requirements (Low Priority)

**Needs expansion:**
- **Astro Version Compatibility**: 5+ requirement, potential 4+ issues
- **Content Collection Requirements**: glob loader, schema requirement, single directory
- **Project Structure**: Required files, directory structure, asset organization

## Writing Style Guidelines

**To avoid AI-generated tone:**
1. **Use concrete examples** instead of abstract descriptions
2. **Include specific steps** rather than general guidance  
3. **Add context about why** features work the way they do
4. **Use natural transitions** between sections
5. **Include troubleshooting tips** from real user scenarios
6. **Vary sentence structure** and avoid formulaic patterns
7. **Include screenshots/diagrams** where helpful (user will add these)

## Completion Strategy

### Phase 1: Core User Workflows
1. Complete Quick Start with step-by-step project opening
2. Write Interface Overview with clear component descriptions
3. Document basic file management (create, open, save, rename)
4. Complete Command Palette documentation

### Phase 2: Feature Deep Dives  
1. Comprehensive frontmatter system documentation
2. Complete editor features (markdown, images, components)
3. Document all writing modes with use cases
4. Complete keyboard shortcuts integration

### Phase 3: Configuration & Advanced
1. Full preferences and project settings documentation
2. Advanced features and customization options
3. Troubleshooting and recovery systems
4. Performance tips and best practices

## Key Areas for Screenshots (User to Add)

- Opening a project for the first time
- Three-panel interface layout
- Frontmatter form examples for different field types
- Command palette in action
- Context menus and file operations
- Focus mode and copyedit mode in action
- Preferences screens (global and project-specific)

## Success Criteria

- **Comprehensive**: Covers all user-facing features identified in codebase review
- **Practical**: Users can accomplish real tasks following the documentation  
- **Natural**: Reads like human technical writing, not AI-generated content
- **Visual**: Includes placeholder indicators for screenshots where needed
- **Accessible**: Works for both new users and those seeking specific feature help
