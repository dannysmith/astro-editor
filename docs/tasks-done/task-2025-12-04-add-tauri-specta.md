# Add Tauri-Specta for End-to-End Type Safety

## Summary

Integrate [tauri-specta](https://github.com/specta-rs/tauri-specta) to generate TypeScript bindings from Rust commands, providing compile-time type safety across the Tauri IPC boundary.

## Motivation

### Current Pain Points

1. **No type safety** - Commands invoked via string literals with no IDE autocomplete
2. **Manual type duplication** - `src/types/domain.ts` must be kept in sync with Rust structs manually
3. **Runtime errors** - Typos in command names or argument mismatches only caught at runtime
4. **Parameter mismatches found** - e.g., frontend sends `projectPath` but Rust expects `projectRoot`
5. **Breaking changes invisible** - Renaming a Rust command silently breaks frontend

### Benefits of Migration

1. **Compile-time type checking** - TypeScript catches errors before runtime
2. **Auto-generated types** - No manual sync between Rust and TypeScript
3. **IDE autocomplete** - Full IntelliSense for command names, parameters, and return types
4. **Safe refactoring** - Find all usages, rename safely across the stack
5. **Documentation** - Generated types serve as living documentation

## Scope Analysis

### Rust Backend

| Category | Count | Files |
|----------|-------|-------|
| Commands | 43 | `lib.rs`, `commands/*.rs` |
| Model structs | 4+ | `models/*.rs` |
| Command modules | 8 | `files.rs`, `project.rs`, `watcher.rs`, `preferences.rs`, `diagnostics.rs`, `ide.rs`, `mdx_components.rs`, `clipboard.rs` |

### Frontend

| Category | Count | Location |
|----------|-------|----------|
| Files using `invoke()` | 19 | Throughout `src/` |
| Manual type definitions | 5+ | `src/types/domain.ts` |

## Known Gotchas and Constraints

Before implementation, understand these constraints:

### 1. Field Naming Must Be Preserved Exactly

`FileEntry` has **inconsistent** but intentional naming:
```rust
#[serde(rename = "isDraft")]
pub is_draft: bool,           // → "isDraft" (camelCase)
pub last_modified: Option<u64>, // → "last_modified" (snake_case!)
```

**Do NOT add `#[serde(rename_all = "camelCase")]`** - this would break the frontend API.

### 2. `serde_json::Value` Becomes `unknown` in TypeScript

Commands using `Value` (like `save_recovery_data`) will have `unknown` typed parameters. This is unavoidable but maintains flexibility for dynamic data.

### 3. `PathBuf` May Need Type Override

```rust
// If specta doesn't support PathBuf natively:
#[specta(type = String)]
pub path: PathBuf,
```

### 4. Nine Commands Use `AppHandle`

These require the `tauri` feature on specta:
- `save_recovery_data`, `save_crash_report`, `get_app_data_dir`
- `copy_text_to_clipboard`, `open_preferences_folder`
- `start_watching_project`, `stop_watching_project`, `select_project_folder`

### 5. Bindings Must Exist Before TypeScript Compilation

Either:
- **Commit bindings** (recommended) - simpler CI
- **Generate in CI** - add step before `pnpm run check:all`

---

## Implementation Plan

### Phase 0: Version Verification (Do First!)

Before starting, verify latest compatible versions on [crates.io](https://crates.io/crates/tauri-specta):

```bash
# Check latest versions
cargo search tauri-specta
cargo search specta
```

As of writing, latest known versions:
- `tauri-specta` = `2.0.0-rc.21`
- `specta` = `2.0.0-rc.20` (verify!)

### Phase 1: Setup and Dependencies

**1.1 Add Rust dependencies**

Update `src-tauri/Cargo.toml`:

```toml
[dependencies]
# Verify these versions before using!
specta = { version = "=2.0.0-rc.20", features = ["derive", "indexmap", "tauri"] }
tauri-specta = { version = "=2.0.0-rc.21", features = ["typescript"] }

# Existing tauri line - no changes needed (tauri feature is on specta, not tauri itself)
tauri = { version = "2", features = ["macos-private-api", "protocol-asset"] }
```

**Required features explained**:
- `derive` - enables `#[derive(Type)]` macro
- `indexmap` - you use `IndexMap<String, Value>` in `FileEntry`
- `tauri` - required for `AppHandle` support in 9 commands
- `typescript` - generates `.ts` bindings

**Note**: Use exact versions (`=`) during RC phase to prevent breakage.

**1.2 Create bindings generation module**

Create `src-tauri/src/bindings.rs`:

```rust
use tauri_specta::{collect_commands, Builder};

pub fn generate_bindings() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            // All commands will be listed here
        ])
}
```

### Phase 2: Annotate Rust Code

**2.1 Add `specta::Type` derive to all model structs**

For each struct in `src-tauri/src/models/`:

```rust
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FileEntry {
    pub id: String,
    #[specta(type = String)]  // PathBuf needs type override
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    #[serde(rename = "isDraft")]  // KEEP existing serde attributes!
    pub is_draft: bool,
    pub collection: String,
    pub last_modified: Option<u64>,  // Note: stays snake_case
    pub frontmatter: Option<IndexMap<String, Value>>,  // → Record<string, unknown>
}
```

**Critical**: Preserve ALL existing `#[serde(...)]` attributes. Do not add `rename_all`.

Files to update:
- [ ] `models/file_entry.rs` - `FileEntry` (has PathBuf, IndexMap, mixed naming)
- [ ] `models/collection.rs` - `Collection`
- [ ] `models/directory_info.rs` - `DirectoryInfo`, `DirectoryScanResult`
- [ ] `models/mdx_component.rs` - `MdxComponent`

**2.2 Add `#[specta::specta]` to all commands**

For each command function:

```rust
#[tauri::command]
#[specta::specta]
pub async fn scan_project(project_path: String) -> Result<Vec<Collection>, String> {
    // ... existing implementation
}
```

Commands by module:
- [ ] `lib.rs`: `greet`, `update_format_menu_state`
- [ ] `commands/files.rs`: 21 commands (file operations, markdown parsing)
- [ ] `commands/project.rs`: 8 commands (project scanning, schema reading)
- [ ] `commands/watcher.rs`: 3 commands (file watching) - uses `AppHandle`
- [ ] `commands/preferences.rs`: 2 commands - uses `AppHandle`
- [ ] `commands/diagnostics.rs`: 3 commands
- [ ] `commands/ide.rs`: 2 commands
- [ ] `commands/mdx_components.rs`: 1 command
- [ ] `commands/clipboard.rs`: 1 command - uses `AppHandle`

**2.3 Handle special types**

```rust
// serde_json::Value → becomes `unknown` in TypeScript
// This is expected - no action needed

// PathBuf → needs type override on structs
#[specta(type = String)]
pub path: PathBuf,

// IndexMap<String, Value> → Record<string, unknown>
// Works with `indexmap` feature enabled

// AppHandle → handled by `tauri` feature on specta
// No changes needed to command signatures

// Option<T> → becomes `T | null` in TypeScript
// No changes needed
```

**2.4 Verify compilation**

After annotating each module:
```bash
cargo check
```

Fix any type errors before proceeding. Common issues:
- Missing `Type` derive on nested types
- PathBuf without `#[specta(type = String)]`
- Custom types that need `Type` derive

### Phase 3: Configure Builder

**3.1 Update `lib.rs` to use specta builder**

```rust
mod bindings;

pub fn run() {
    let builder = bindings::generate_bindings();

    // Export bindings - runs in both debug and release
    // We commit the file, so this just ensures it stays up to date
    builder
        .export(
            specta_typescript::Typescript::default()
                .header("// @ts-nocheck\n// Auto-generated by tauri-specta. DO NOT EDIT.\n\n"),
            "../src/lib/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        // ... existing plugins ...
        .invoke_handler(builder.invoke_handler())  // Replace generate_handler!
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Note**: We export in both debug and release mode since we commit the bindings file.

**3.2 Bindings file strategy: COMMIT the file**

**Rationale**: Committing is simpler and avoids CI complexity.

```bash
# Do NOT add to .gitignore
# src/lib/bindings.ts should be committed
```

**Workflow implications**:
1. When changing Rust commands, bindings update automatically on next `cargo run`
2. PR reviewers can see binding changes in diff
3. CI doesn't need special steps - file already exists
4. If bindings are stale, TypeScript will fail (good - catches mistakes)

**Add CI check (optional but recommended)**:
```yaml
# In GitHub Actions workflow
- name: Check bindings are up to date
  run: |
    cargo build
    git diff --exit-code src/lib/bindings.ts || \
      (echo "Bindings are out of date. Run cargo build and commit." && exit 1)
```

### Phase 4: Frontend Migration

**4.1 Create bindings wrapper**

Create `src/lib/tauri-bindings.ts`:

```typescript
// Re-export generated bindings with project conventions
export { commands } from './bindings'
export type * from './bindings'
```

**4.2 Update invoke calls systematically**

Replace string-based `invoke()` calls with typed commands:

```typescript
// Before (no type safety)
import { invoke } from '@tauri-apps/api/core'
const collections = await invoke<Collection[]>('scan_project', { projectPath })

// After (full type safety)
import { commands } from '@/lib/tauri-bindings'
const collections = await commands.scanProject(projectPath)
```

Files to update (prioritized by impact):

**High Priority (query hooks - most used)**:
- [ ] `src/hooks/queries/useCollectionsQuery.ts`
- [ ] `src/hooks/queries/useCollectionFilesQuery.ts`
- [ ] `src/hooks/queries/useFileContentQuery.ts`
- [ ] `src/hooks/queries/useDirectoryScanQuery.ts`

**High Priority (mutation hooks)**:
- [ ] `src/hooks/mutations/useSaveFileMutation.ts`
- [ ] `src/hooks/mutations/useCreateFileMutation.ts`
- [ ] `src/hooks/mutations/useRenameFileMutation.ts`

**Medium Priority (action hooks and stores)**:
- [ ] `src/hooks/editor/useEditorActions.ts`
- [ ] `src/store/projectStore.ts`

**Medium Priority (utilities)**:
- [ ] `src/lib/ide.ts`
- [ ] `src/lib/project-registry/index.ts`
- [ ] `src/lib/project-registry/persistence.ts`
- [ ] `src/lib/recovery/index.ts`

**Lower Priority (components)**:
- [ ] `src/components/preferences/panes/DebugPane.tsx`
- [ ] `src/components/ui/context-menu.tsx`
- [ ] `src/lib/editor/commands/menuIntegration.ts`
- [ ] `src/hooks/useEditorFocusTracking.ts`

**4.3 Remove manual type definitions**

After migration, types in `src/types/domain.ts` become redundant:
- Types are now auto-generated in `src/lib/bindings.ts`
- Update imports throughout codebase to use generated types
- Eventually delete `src/types/domain.ts` (or keep as documentation)

### Phase 5: Update Tests

**5.1 Create test utilities for typed commands**

Create `src/test/mocks/tauri-bindings.ts`:

```typescript
import { vi } from 'vitest'

// Type-safe mock factory for commands
export function createCommandMocks() {
  return {
    scanProject: vi.fn(),
    scanProjectWithContentDir: vi.fn(),
    scanCollectionFiles: vi.fn(),
    readFileContent: vi.fn(),
    saveMarkdownContent: vi.fn(),
    // Add all commands...
  }
}

// Default mock setup
export const mockCommands = createCommandMocks()
```

**5.2 Update test setup**

In `src/test/setup.ts` or test files:

```typescript
// Before: mocking invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// After: mocking commands object
vi.mock('@/lib/tauri-bindings', () => ({
  commands: mockCommands,
}))
```

**5.3 Update individual test files**

```typescript
// Before
import { invoke } from '@tauri-apps/api/core'
vi.mocked(invoke).mockResolvedValue([{ name: 'posts' }])

// After
import { mockCommands } from '@/test/mocks/tauri-bindings'
mockCommands.scanProject.mockResolvedValue([{ name: 'posts' }])
```

**5.4 Files to update**

- [ ] `src/test/setup.ts` - Global mock setup
- [ ] `src/test/mocks/tauri-bindings.ts` - New mock factory
- [ ] `src/store/__tests__/storeQueryIntegration.test.ts`
- [ ] `src/store/__tests__/editorStore.integration.test.ts`
- [ ] Any other files mocking `invoke`

### Phase 6: Documentation and Cleanup

**6.1 Update architecture documentation**

Update these docs to reflect the new pattern:
- [ ] `docs/developer/architecture-guide.md` - Add section on type-safe Tauri commands
- [ ] `CLAUDE.md` - Update Technology Stack section

**6.2 Create tauri-commands.md guide**

New documentation covering:
- How to add new commands with specta
- Generated bindings location and usage
- Testing patterns with typed commands
- Troubleshooting common issues

**6.3 Cleanup**

- [ ] Remove `src/types/domain.ts` (or mark as deprecated)
- [ ] Remove manual type annotations from invoke calls
- [ ] Update ESLint to enforce using typed commands

## Verification Checklist

After each phase:

- [ ] `cargo check` passes
- [ ] `pnpm run check:all` passes
- [ ] Generated bindings file exists and is valid TypeScript
- [ ] IDE autocomplete works for commands
- [ ] All existing functionality works correctly

## Rollback Plan

If issues arise:
1. Revert Cargo.toml changes
2. Revert lib.rs to use `generate_handler!` macro
3. Keep frontend changes (invoke calls) as-is - they still work
4. Remove generated bindings file

## Alternative: Incremental Migration

If full migration feels risky, consider this incremental approach:

### Step 1: Add specta without removing invoke

```typescript
// Both patterns work simultaneously
import { invoke } from '@tauri-apps/api/core'
import { commands } from '@/lib/tauri-bindings'

// Old way (still works)
await invoke('scan_project', { projectPath })

// New way (typed)
await commands.scanProject(projectPath)
```

### Step 2: Migrate one module at a time

1. Start with query hooks (most benefit)
2. Verify in dev, deploy to staging
3. Migrate mutation hooks
4. Migrate utilities and stores
5. Remove old invoke imports

### Step 3: Add lint rule after full migration

```javascript
// eslint.config.js
{
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@tauri-apps/api/core',
        importNames: ['invoke'],
        message: 'Use typed commands from @/lib/tauri-bindings instead.'
      }]
    }]
  }
}
```

---

## Future Enhancement: Typed Events

The current plan doesn't include typed Tauri events, but tauri-specta supports them:

```rust
// In bindings.rs
use tauri_specta::collect_events;

Builder::<tauri::Wry>::new()
    .commands(collect_commands![...])
    .events(collect_events![
        FileChangedEvent,
        MenuBoldEvent,
        // etc.
    ])
```

Consider adding this in a follow-up task after commands are stable.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| RC status instability | Lock exact versions (`=`), test thoroughly before updating |
| Build process change | Commit bindings file, no CI changes needed |
| PathBuf/IndexMap/Value issues | Test first command module thoroughly before continuing |
| Breaking field naming | Preserve ALL existing serde attributes exactly |
| Test mock refactoring | Create mock factory first, update tests incrementally |
| Learning curve | Document patterns, provide examples |
| Version compatibility | Run `cargo search` to verify versions before starting |

## Success Criteria

1. All 43 commands have TypeScript bindings generated
2. All 19 files using `invoke()` migrated to typed commands
3. No manual type duplication between Rust and TypeScript
4. `pnpm run check:all` passes
5. IDE provides full autocomplete for Tauri commands
6. Documentation updated with new command workflow
7. Test mocks updated and all tests pass

---

## Post-Migration: Adding New Commands

After migration, follow this workflow for new commands:

### 1. Define command in Rust

```rust
// src-tauri/src/commands/my_module.rs
#[tauri::command]
#[specta::specta]
pub async fn my_new_command(arg: String) -> Result<MyType, String> {
    // implementation
}
```

### 2. Add to bindings.rs

```rust
.commands(collect_commands![
    // ... existing
    my_new_command,
])
```

### 3. Regenerate bindings

```bash
cargo build  # or cargo run
# bindings.ts is updated automatically
```

### 4. Use in frontend

```typescript
import { commands } from '@/lib/tauri-bindings'

const result = await commands.myNewCommand('arg')
// Full type safety and autocomplete!
```

### 5. Commit both Rust changes and bindings.ts

---

## References

- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta)
- [Specta documentation](https://specta.dev/docs/tauri-specta/v2)
- [specta crate docs](https://docs.rs/specta/latest/specta/) - Feature flags reference
- [crates.io/tauri-specta](https://crates.io/crates/tauri-specta) - Version history
