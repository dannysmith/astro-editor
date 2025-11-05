# Developer Documentation Restructure

## Goal

Restructure developer documentation to combine Tauri Template's clear organization with Astro Editor's rich implementation details. Focus on progressive disclosure, clear naming, and right-sized docs for AI agents and human developers.

## Reference Materials

**Tauri Template Repository**: https://github.com/dannysmith/tauri-template

**Key Template Files to Reference**:

- `docs/developer/bundle-optimization.md` - For creating optimization.md
- `docs/developer/state-management.md` - For structure/organization inspiration
- `docs/developer/command-system.md` - For structure/organization inspiration

**CRITICAL**: Do NOT simply copy template content without editing it to ensure it matches Astro Editor's ACTUAL implementation. Much will be similar.

## Actions Required

### Phase 1: Add New Files (4 files)

#### 1.1 Create `docs/developer/state-management.md`

**Extract from**: `architecture-guide.md` (State Management section, lines ~40-140)

**Reference Template**: https://github.com/dannysmith/tauri-template/blob/main/docs/developer/state-management.md (for structure)

**Content to Extract** (~200-250 lines):

- The "Onion" pattern (TanStack Query → Zustand → useState) - CRITICAL PATTERN
- Decision tree for state placement (when to use each layer)
- Why decomposed stores? (editor/project/ui) - our specific architecture
- Server state (TanStack Query) patterns
  - Query keys factory pattern
  - Automatic cache invalidation
  - Our specific queries (collections, files, content)
- Client state (Zustand) patterns
  - Store decomposition strategy
  - Why three stores not one?
  - getState() pattern for stable references - CRITICAL
- Local state (useState) patterns
  - When to use
  - Common pitfalls
- Integration patterns between layers
  - Bridge pattern (store → query via events)
  - How stores and queries interact
- Real examples from editorStore, projectStore, uiStore

**Critical Content to Preserve**:

- All getState() examples and rationale
- The "Onion" metaphor and decision tree
- Bridge pattern explanation (store can't use hooks)
- Performance implications of each layer

**Goal**: Deep dive into fundamental state architecture. Referenced constantly in code reviews, deserves dedicated doc.

#### 1.2 Create `docs/developer/command-system.md`

**Extract from**: `architecture-guide.md` (Command Pattern section, lines ~200-280)

**Reference Template**: https://github.com/dannysmith/tauri-template/blob/main/docs/developer/command-system.md (for structure)

**Content to Extract** (~150-200 lines):

- Command pattern overview - what and why
- Command registry architecture (globalCommandRegistry)
- Why command pattern? (single source of truth for actions)
  - Used by keyboard shortcuts
  - Used by native menus
  - Used by command palette
  - Decouples UI from logic
- Command structure (id, name, group, execute function)
- Registering commands
  - When to register (app initialization)
  - Where to register (app-commands.ts)
  - Command groups ('file', 'navigation', 'edit', etc.)
- Executing commands
  - From keyboard shortcuts: `globalCommandRegistry.execute('toggleBold')`
  - From menus: via Tauri events
  - From command palette: user selection
  - With parameters: `execute('formatHeading', 1)`
- getState() pattern in commands - CRITICAL
  - Commands need editor state but can't use hooks
  - Example: Save command gets currentFile via getState()
- Integration points
  - keyboard-shortcuts.md (react-hotkeys-hook calls commands)
  - Native menus (Tauri menu emits events → executes commands)
  - Command palette (shows registered commands, executes on select)
- Adding new commands (step-by-step)
- Real examples from editor commands (toggleBold, formatHeading, insertLink)

**Critical Content to Preserve**:

- globalCommandRegistry pattern and rationale
- All integration point explanations
- getState() usage in commands
- Real code examples from our codebase

**Goal**: Explain command pattern and its integrations. Foundation for keyboard/menu/palette systems.

#### 1.3 Create `docs/developer/optimization.md`

**Reference Template**: https://github.com/dannysmith/tauri-template/blob/main/docs/developer/bundle-optimization.md

**IMPORTANT**: This is NEW content (not extracted). Use template for as a starting point, but ensure it's reflective to Astro Editor's reality.

**Content to Create** (~150-200 lines):

- **Overview**: Why optimization matters for desktop apps
  - Bundle size affects download size and updates
  - Startup time affects user experience
  - Memory usage affects performance on older machines

- **Current Optimizations**:
  - React optimizations we currently use:
    - Production builds (check package.json scripts)
    - Tree shaking (Vite default)
    - React.memo usage (check codebase for examples)
  - Tauri optimizations:
    - Bundle configuration (check tauri.conf.json)
    - Asset handling strategy
    - Binary size (check current .app or .dmg size)
  - Build optimizations:
    - Production builds
    - Minification
    - Source map strategy

- **Bundle Size Analysis**:
  - How to check current bundle size
    - Command: `pnpm run build` then check dist folder size
    - Tools: rollup-plugin-visualizer or vite-plugin-analyze
  - What to look for:
    - Large dependencies (check package.json)
    - Duplicate code
    - Unused imports
  - How to analyze:
    - Add vite-plugin-visualizer to see bundle composition
    - Use vite build --mode analyze

- **Lazy Loading Strategy** (for future):
  - Component lazy loading with React.lazy
  - Route-based code splitting (if we add routing)
  - When to lazy load vs eager load

- **Future Optimization Opportunities**:
  - Dynamic imports for heavy components (PreferencesDialog, CommandPalette)
  - Asset optimization (compress images, use WebP)
  - Font subsetting (if we add custom fonts)
  - Rust/WASM for computationally intensive tasks
  - Virtual scrolling for very long file lists

- **Performance Budgets** (future):
  - Target bundle sizes
  - Target startup time
  - How to measure

- **Related Documentation**:
  - Reference performance-patterns.md for React performance
  - Reference releases.md for build process

**Goal**: Document current optimization state, provide framework for future optimization work as app grows.

#### 1.4 Create `docs/developer/ui-patterns.md`

**Content Source**: Extract SVG positioning fix from `unified-title-bar.md` (lines 80-102)

**IMPORTANT**: This is a NEW guide that will serve as home for common UI patterns. Start with the SVG fix, but structure it to accommodate future patterns.

**Content to Create** (~100-150 lines initially, will grow over time):

- **Overview**: Purpose of this guide
  - Common UI patterns across the application
  - ShadCN/ui best practices specific to our app
  - Solutions to common rendering/styling issues

- **ShadCN/ui Patterns**:
  - Brief intro to shadcn/ui usage in our app
  - How we customize components
  - Common component patterns we use

- **Icon Button Patterns** (from unified-title-bar.md):
  - SVG positioning fix for disabled buttons
  - Problem: 1-pixel shift when disabled attribute applied
  - Solution: Always apply transform fix
  - Example code showing the pattern
  - Explanation of why it works

- **Future Patterns** (placeholder sections for growth):
  - Form field patterns
  - Dialog patterns
  - Layout patterns
  - Animation patterns

**Critical Content to Preserve** (from unified-title-bar.md lines 80-102):

````markdown
## Icon Button Patterns

### SVG Icon Positioning Fix

**Problem**: SVG icons in disabled buttons experience a 1-pixel shift due to browser rendering differences when the `disabled` attribute is applied. This is a known issue with shadcn/ui buttons.

**Solution**: Always apply the CSS transform fix for ALL icon buttons:

```tsx
<Button
  disabled={someCondition}
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
>
  <Save className="size-4" />
</Button>
```

**Explanation**:
- `[&_svg]:transform-gpu` enables hardware acceleration for SVG rendering
- `[&_svg]:scale-100` applies `transform: scale(1)` to stabilize positioning
- Prevents pixel shifts when button's disabled state changes
````

**Goal**: Create dedicated home for UI patterns and shadcn/ui best practices. Provides place to document common solutions as we discover them.

---

### Phase 2: Rename Files (5 files)

Update file names for clarity and consistency:

1. `performance-guide.md` → `performance-patterns.md`
2. `toast-system.md` → `notifications.md`
3. `testing-guide.md` → `testing.md`
4. `release-process.md` → `releases.md`
5. `image-preview-implementation.md` → `feature-image-preview.md`

**Update all cross-references** in:

- `CLAUDE.md`
- `docs/README.md`
- Other developer docs that reference these files
- Root `README.md` if applicable

---

### Phase 3: Remove & Consolidate (1 file)

#### 3.1 Remove `docs/developer/unified-title-bar.md`

**Valuable content to preserve**: SVG icon positioning fix (from lines 80-102)

**Where to move it**: Move to new `ui-patterns.md` guide (see Phase 1.4)

**Why remove this doc**:
- Too component-specific (violates philosophy in docs/README.md)
- Most content is self-evident from component code
- Only unique value is the SVG fix, which fits better as a pattern in architecture guide
- Does not serve as feature implementation example (unlike image-preview)

---

### Phase 4: Update Existing Files

#### 4.1 Update `architecture-guide.md`
**Current size**: 612 lines
**Target size**: ~450-500 lines

**Simplify these sections** (move details to specialized docs, keep essential rules):

1. **State Management section** (lines ~40-140, ~100 lines):
   - **Keep in architecture-guide.md**:
     - What the "Onion" pattern is (brief explanation)
     - When to use each layer (quick decision rules)
     - Basic getState() explanation for callbacks
   - **Move to state-management.md**:
     - Detailed store decomposition rationale
     - Comprehensive getState() examples
     - Deep dive into bridge pattern
     - Integration patterns between layers
     - Real-world examples from all three stores
   - **Add reference at end of simplified section**:
     ```markdown
     For comprehensive coverage including store decomposition strategy,
     bridge pattern details, and extensive examples, see
     [state-management.md](./state-management.md).
     ```

2. **Command Pattern section** (lines ~200-280, ~80 lines):
   - **Keep in architecture-guide.md**:
     - What command pattern is and why we use it
     - Basic command registry usage (one simple example)
     - Quick note on integration with keyboard/menus/palette
   - **Move to command-system.md**:
     - Detailed command structure
     - How to register commands
     - All integration point details
     - Multiple examples
     - Step-by-step guide for adding commands
   - **Add reference at end of simplified section**:
     ```markdown
     For detailed command implementation guide including registration,
     integration with keyboard shortcuts and menus, and examples,
     see [command-system.md](./command-system.md).
     ```

**CRITICAL - Keep these sections** (do NOT remove):

- Overview and Tech Stack
- Directory Boundaries (essential architecture rule)
- Direct Store Pattern (critical for forms)
- Event-Driven Communication patterns
- Bridge Pattern (store → query communication)
- TanStack Query patterns (query keys, cache invalidation) - keep high-level overview even though detailed coverage moves to state-management.md
- Code Extraction Patterns
- Testing patterns (high-level overview, detail in testing.md)
- Best Practices
- Key Files Reference
- All important warnings and gotchas

**Result**: More focused architecture guide that serves as hub with references to specialized topics.

#### 4.2 Update `keyboard-shortcuts.md`

**Changes**:

- Add reference to command-system.md for understanding integration
- Keep all current content (implementation guide)

#### 4.3 Update `docs/README.md`

**Changes**:

User has already updated this file. Verify it matches final structure:

**Core Guides section should include**:

- architecture-guide.md ✓
- state-management.md (ADD)
- command-system.md (ADD)
- ui-patterns.md (ADD)
- performance-patterns.md (update from performance-guide.md)
- testing.md (update from testing-guide.md)

**System Documentation section should include**:

- notifications.md (update from toast-system.md)
- All other existing system docs

**Implementation section should include**:

- testing.md (update from testing-guide.md)
- optimization.md (ADD)

**Feature & Component Documentation section should include**:

- feature-image-preview.md (update from image-preview-implementation.md)
- Remove unified-title-bar.md

**Operational section should include**:

- releases.md (update from release-process.md)
- apple-signing-setup.md ✓

---

### Phase 5: Update Project Root Files

#### 5.1 Update `CLAUDE.md`

**Changes**:

- Update all doc references to new file names
- Update "Documentation Structure" section to reference new files
- Ensure specialized guides list includes new files
- Update any inline references to old file names

#### 5.2 Update root `README.md` (if applicable)

**Changes**:

- Update any developer doc references

---

## Final Structure (20 files)

### Core Architecture (5)

1. `architecture-guide.md` - Main guide, most important patterns, references
2. `state-management.md` ← NEW - The "Onion" pattern deep dive
3. `command-system.md` ← NEW - Command pattern + integrations
4. `ui-patterns.md` ← NEW - Common UI patterns and shadcn/ui best practices
5. `performance-patterns.md` ← RENAMED

### System Documentation (9)

6. `keyboard-shortcuts.md` - Keep
7. `notifications.md` ← RENAMED
8. `logging.md` - Keep
9. `preferences-system.md` - Keep
10. `schema-system.md` - Keep
11. `form-patterns.md` - Keep
12. `color-system.md` - Keep
13. `editor-styles.md` - Keep
14. `recovery-system.md` - Keep

### Implementation (2)

15. `testing.md` ← RENAMED
16. `optimization.md` ← NEW

### Reference & Decisions (2)

17. `decisions.md` - Keep
18. `astro-generated-contentcollection-schemas.md` - Keep

### Feature Examples (1)

19. `feature-image-preview.md` ← RENAMED

### Operational (2)

20. `releases.md` ← RENAMED
21. `apple-signing-setup.md` - Keep

---

## Implementation Order

### Step 1: Create New Files

1. Create `state-management.md` (extract from architecture-guide.md)
2. Create `command-system.md` (extract from architecture-guide.md)
3. Create `optimization.md` (based on template)
4. Create `ui-patterns.md` (new guide, extract SVG fix from unified-title-bar.md)

### Step 2: Update architecture-guide.md

1. Simplify State Management section (keep essential rules, move details to state-management.md)
2. Simplify Command Pattern section (keep basic explanation, move details to command-system.md)
3. Add references to detailed guides
4. Verify all important patterns remain

### Step 3: Rename Files

1. Rename 5 files using `git mv` to preserve history
2. Verify renames successful

### Step 4: Update Cross-References

1. **Update `docs/README.md`** - Verify matches final structure (user already updated)
2. **Update `CLAUDE.md`** - Update all doc references:
   - Search for: `performance-guide|toast-system|testing-guide|release-process|image-preview-implementation|unified-title-bar`
   - Replace with new names
   - Add references to new docs (state-management.md, command-system.md, ui-patterns.md, optimization.md)
   - Update "Documentation Structure" section
3. **Update `keyboard-shortcuts.md`**:
   - Add reference to command-system.md in Integration section
   - Explain that shortcuts execute commands from registry
4. **Search for all references to renamed/removed files**:
   ```bash
   rg "performance-guide|toast-system|testing-guide|release-process|image-preview-implementation|unified-title-bar" docs/ --type md
   ```
5. **Update all found references** to new file names
6. **Search root README.md**:
   ```bash
   rg "performance-guide|toast-system|testing-guide|release-process|image-preview-implementation|unified-title-bar" README.md
   ```
7. **Update any found references** in root README

### Step 5: Remove Obsolete

1. Delete `unified-title-bar.md`
2. Verify SVG fix preserved in ui-patterns.md

### Step 6: Verify

1. Check all internal links work
2. Verify docs/README.md index is complete
3. Check CLAUDE.md references are accurate
4. Run `/check` to ensure no issues

---

## Success Criteria

- [ ] 4 new files created (state-management, command-system, ui-patterns, optimization)
- [ ] 5 files renamed successfully using `git mv`
- [ ] 1 file removed (unified-title-bar.md)
- [ ] SVG positioning fix preserved in ui-patterns.md
- [ ] architecture-guide.md simplified and streamlined (~450-500 lines)
- [ ] All valuable Astro Editor content preserved:
  - [ ] Onion pattern and getState() examples
  - [ ] Direct Store Pattern explanation
  - [ ] Bridge pattern (store → query)
  - [ ] Command registry pattern
  - [ ] All performance gotchas and warnings
- [ ] All cross-references updated:
  - [ ] docs/README.md verified (already updated by user)
  - [ ] CLAUDE.md updated
  - [ ] keyboard-shortcuts.md references command-system.md
  - [ ] No references to old file names remain
- [ ] No broken internal links (verify all .md links work)
- [ ] Git history preserved for all renamed files
- [ ] Structure follows philosophy in docs/README.md
- [ ] Progressive disclosure works: architecture-guide → specialized docs
- [ ] All commands run successfully:
  - [ ] `rg "performance-guide|toast-system|testing-guide|release-process|image-preview-implementation|unified-title-bar" docs/ --type md` returns no matches
  - [ ] `/check` passes
- [ ] Final file count: 20 developer docs (up from 18, but better organized)

---

## Important Warnings

### Content Preservation

**CRITICAL**: Do NOT lose any valuable Astro Editor content during this refactor:

- All performance patterns and gotchas
- All Direct Store Pattern examples and rationale
- All getState() usage and explanations
- Bridge pattern for store/query communication
- Command registry implementation details
- All warnings about infinite loops, render cascades, etc.

### What NOT to Copy from Template

- Do NOT copy template code examples (use Astro Editor examples)
- Do NOT copy template-specific content (use for structure only)
- Template is a starter - Astro Editor has real implementation details to preserve

### File Operations

- **ALWAYS use `git mv`** for renames to preserve history
- **NEVER use `rm` + new file** - this loses git history
- Verify renames worked: `git log --follow <new-filename>`

### Verification

- Search comprehensively for old file references before completing
- Ensure SVG positioning fix is preserved in ui-patterns.md
- Test all internal markdown links work
- Verify CLAUDE.md works with new structure
- Run `/check` as final verification

### Future Considerations

- Consider adding menus.md later if command-system.md doesn't cover native menus adequately
- Consider splitting optimization.md if it grows beyond 300 lines
- Keep monitoring docs/README.md philosophy as we learn what works
