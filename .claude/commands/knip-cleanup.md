---
allowed-tools: [Read, Bash, Glob, Grep, Edit, Write, AskUserQuestion]
description: 'Run knip and intelligently clean up unused code and dependencies'
---

# /knip-cleanup - Intelligent Knip Cleanup

## Purpose

Run knip to find unused files, dependencies, and exports, then intelligently clean up the codebase while preserving:
- shadcn/ui components (future use)
- Radix dependencies used by shadcn components
- Barrel exports (intentionally export everything)
- Tauri/Rust-called exports

## Execution Steps

### 1. Run Knip

```bash
pnpm run knip
```

Capture and parse the output.

### 2. Analyze shadcn/ui Components

Check which shadcn/ui components exist (used or unused):

```bash
grep -r "from '@radix-ui" src/components/ui/*.tsx
```

Build a mapping of:
- Which Radix packages are imported by shadcn components
- Which shadcn components are unused (from knip output)

### 3. Check Tauri/Rust Integration

For each unused export, check if it's referenced in Rust:

```bash
# Check if export name appears in Rust files
grep -r "export_name" src-tauri/
```

Exports that might be called from Rust:
- Toast methods (success, error, warning, etc.)
- Any hooks that start with `useTauri`
- Functions in files that have Tauri imports

### 4. Categorize Items

**KEEP (DO NOT REMOVE):**
- All files in `src/components/ui/` (shadcn/ui components - future use)
- Radix dependencies used by ANY shadcn component (used or unused)
- All barrel exports (`index.ts` files exporting other modules)
- Any exports confirmed to be called from Rust/Tauri
- Dependencies: `@tauri-apps/*`, `zod`, `react-hook-form`, `@hookform/resolvers`, `next-themes`, `date-fns`

**SAFE TO AUTO-REMOVE:**
- Unused non-shadcn files that have no imports anywhere
- Radix dependencies NOT used by any shadcn component
- Dependencies with zero usage in codebase
- Unused devDependencies for tools we don't use

**NEEDS USER REVIEW:**
- Unused files outside `src/components/ui/` that might be planned features
- Exports that MIGHT be Tauri-called but unclear
- Dependencies where usage is ambiguous
- Type exports (might be used by external consumers)

### 5. Auto-Remove Safe Items

For each item in SAFE TO AUTO-REMOVE:

**Unused dependencies:**
```bash
pnpm remove <package-name>
```

**Unused files:**
```bash
rm -f <file-path>
```

### 6. Present Review Items to User

For NEEDS USER REVIEW items, provide:
- What the item is
- Why it's flagged
- Context about potential usage
- Your recommendation

Use AskUserQuestion to confirm removal if you have >70% confidence it's safe.

For items with <70% confidence, present the information and ask user to decide.

## Intelligence Guidelines

### shadcn/ui Radix Dependency Mapping

Common mappings (check actual imports in files):
- `alert.tsx` → `@radix-ui/react-alert-dialog`
- `dropdown-menu.tsx` → `@radix-ui/react-dropdown-menu`
- `hover-card.tsx` → `@radix-ui/react-hover-card`
- `radio-group.tsx` → `@radix-ui/react-radio-group`
- `scroll-area.tsx` → `@radix-ui/react-scroll-area`
- `toggle.tsx` → `@radix-ui/react-toggle`
- `toggle-group.tsx` → `@radix-ui/react-toggle-group`

**DO NOT** remove a Radix package if the corresponding shadcn component exists, even if unused.

### Tauri Integration Detection

Files/exports likely called from Rust:
- Anything in `src/lib/rust-toast-bridge.ts`
- Functions that match Tauri event names
- Exports from files that import `@tauri-apps/*`

Check Rust files for:
```rust
invoke("function_name")
emit("event_name")
```

### Barrel Export Rules

Files like:
- `src/components/ui/index.ts`
- `src/hooks/index.ts`
- `src/lib/editor/index.ts`

These SHOULD export everything from their directory, even if not all exports are used elsewhere. This is intentional API design. **NEVER** remove unused exports from barrel files.

## Output Format

Provide a summary:

```
# Knip Cleanup Summary

## Auto-Removed (X items)
- [file/package] - reason

## Kept (X items)
- [file/package] - reason (shadcn component / Radix dep / barrel export / etc.)

## Needs Your Review (X items)

### [Item Name]
- Type: [file/dependency/export]
- Current Status: Unused by knip
- Context: [why it might still be needed]
- Recommendation: [remove/keep with confidence level]
- Question: Should I remove this?
```

## When in Doubt

**ALWAYS ask the user rather than removing something questionable.**

Better to keep unused code than break the app. This command runs periodically during refactoring sessions, so conservative cleanup now can be more aggressive next time once patterns are clearer.

## After Cleanup

Run verification:
```bash
pnpm run check:all
```

Ensure nothing broke.
