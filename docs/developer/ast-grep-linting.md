# ast-grep Architectural Linting

## Overview

ast-grep is a structural code search and linting tool that enforces architectural patterns that ESLint cannot detect. It's particularly valuable for AI agents because it provides immediate, machine-readable feedback on architectural violations.

## Why ast-grep?

**Traditional linters (ESLint) can't enforce:**
- Directory boundaries (hooks in hooks/, not lib/)
- Structural patterns (destructuring from stores)
- Complex architectural rules (getState() pattern)

**ast-grep advantages:**
- **Extremely fast** - Rust-based, scans codebase in milliseconds
- **Pattern-based** - Matches code structure, not just syntax
- **Auto-fix capable** - Can automatically fix simple violations
- **Machine-readable** - JSON output for programmatic checking
- **Self-documenting** - Rules serve as executable architecture documentation

## Installation

```bash
pnpm add -D @ast-grep/cli
```

## Configuration

### Project Structure

```
.ast-grep/
└── rules/
    ├── zustand/
    │   └── no-destructure.yml
    └── architecture/
        ├── hooks-in-hooks-dir.yml
        └── no-store-subscription-in-lib.yml

sgconfig.yml  # Root configuration
```

### Configuration File (sgconfig.yml)

```yaml
ruleDirs:
  - ./.ast-grep/rules

languageGlobs:
  typescript:
    - "src/**/*.ts"
    - "src/**/*.tsx"

output:
  style: rich
  color: auto
```

## Available Rules

### 1. no-destructure-zustand (CRITICAL)

**What it catches:**
```typescript
// ❌ BAD
const { currentFile, isDirty } = useEditorStore()

// ✅ GOOD
const currentFile = useEditorStore(state => state.currentFile)
const isDirty = useEditorStore(state => state.isDirty)
```

**Why it matters:** Destructuring from Zustand stores causes render cascades and performance issues. Every store update triggers re-renders even if the destructured values haven't changed.

**Severity:** Error
**Files:** All TypeScript files
**Auto-fixable:** No (requires manual refactoring)

---

### 2. hooks-in-hooks-dir

**What it catches:**
```typescript
// ❌ BAD: lib/commands/command-context.ts
export function useCommandContext() {
  // Hook in wrong directory
}

// ✅ GOOD: hooks/commands/useCommandContext.ts
export function useCommandContext() {
  // Hook in correct directory
}
```

**Why it matters:** Enforces directory boundaries. React hooks belong in `hooks/`, not `lib/`. This maintains separation of concerns between pure business logic and React-specific code.

**Severity:** Error
**Files:** `src/lib/**/*.{ts,tsx}` only
**Auto-fixable:** No (requires file move)

---

### 3. no-store-subscription-in-lib

**What it catches:**
```typescript
// ❌ BAD: In lib/ directory
const value = useEditorStore(state => state.value)

// ✅ GOOD: In lib/ directory
const value = useEditorStore.getState().value

// ✅ ALSO GOOD: In hooks/ or components/ directories
const value = useEditorStore(state => state.value)
```

**Why it matters:** `lib/` modules should remain pure and React-independent. Store subscriptions create React coupling and should only exist in components and hooks.

**Severity:** Error
**Files:** `src/lib/**/*.{ts,tsx}` only
**Auto-fixable:** No (requires getState() refactoring)

## Usage

### Running Lints

```bash
# Scan codebase for violations
pnpm run ast:lint

# Auto-fix violations (where possible)
pnpm run ast:fix

# Run all checks (includes ast-grep)
pnpm run check:all

# Run all fixes (includes ast-grep)
pnpm run fix:all
```

### Integration with /check Command

The `/check` command automatically runs `ast:lint` as part of its quality control process:

1. Checks adherence to architecture-guide.md
2. Removes unnecessary comments/console.logs
3. Runs `pnpm check:all` (which includes ast-grep)

### CI/CD Integration

ast-grep is integrated into `check:all` pipeline and will fail builds if violations are found:

```bash
pnpm run check:all
# Runs: typecheck → lint → ast:lint → format:check → clippy → tests
```

## Writing New Rules

### Rule File Structure

```yaml
id: rule-name
message: |
  Brief description of what's wrong and how to fix it.

  ❌ BAD: example of violation
  ✅ GOOD: example of correct code

severity: error  # or warning
language: typescript
files:  # Optional: restrict to specific files
  - "src/lib/**/*.ts"
  - "src/lib/**/*.tsx"
rule:
  pattern: $PATTERN  # ast-grep pattern
note: |
  Additional context, references to architecture docs, etc.
url: https://link-to-relevant-docs
```

### Pattern Syntax

ast-grep uses a simple pattern language with metavariables:

- `$VAR` - Matches a single AST node
- `$$$` - Matches zero or more nodes
- `$$$ARGS` - Matches argument list

**Examples:**

```yaml
# Match: const { anything } = useStore()
pattern: const { $$$PROPS } = $STORE()

# Match: useStore(anything)
pattern: $STORE($$$)

# Match: export function useAnything()
pattern: export function $HOOK($$$) { $$$ }
```

### Testing Rules

Create test files in `.ast-grep/test/rules/`:

```yaml
# test-rule-name.yml
id: test-rule-name
valid:
  - const value = useStore(state => state.value)  # Should NOT match
invalid:
  - const { value } = useStore()  # Should match
```

Run tests:
```bash
npx ast-grep test
```

## Performance

- **Fast**: ~100ms for entire codebase
- **Incremental**: Only scans changed files in watch mode
- **Parallel**: Processes files concurrently

## Troubleshooting

### ast-grep not found

If you see "ast-grep shim file was executed":

```bash
pnpm rebuild @ast-grep/cli
# or
cd node_modules/@ast-grep/cli && node postinstall.js
```

### Rules not loading

- Verify `sgconfig.yml` is in project root
- Check `ruleDirs` paths are correct
- Validate YAML syntax in rule files

### Pattern not matching

- Use `npx ast-grep run -p 'pattern'` to test patterns
- Check AST structure with `npx ast-grep lsp`
- Verify language is set to `typescript`

## Resources

- [ast-grep Documentation](https://ast-grep.github.io/)
- [Pattern Syntax Guide](https://ast-grep.github.io/guide/pattern-syntax.html)
- [Rule Configuration](https://ast-grep.github.io/guide/rule-config.html)
- [Project Architecture Guide](./architecture-guide.md)
- [State Management Patterns](./state-management.md)
- [Performance Patterns](./performance-patterns.md)

## For AI Agents

When working with this codebase:

1. **Run ast:lint** after making changes to verify architectural compliance
2. **Read violation messages carefully** - they include examples and fix suggestions
3. **Check referenced docs** - violations link to architecture-guide.md sections
4. **Use ast:fix cautiously** - not all violations can be auto-fixed safely
5. **Add new rules** when you identify repeated architectural patterns
6. **Test rules** before committing to ensure they work as intended

ast-grep output is designed to be machine-readable (JSON mode available with `--format json`) for programmatic checking in agent workflows.

## Complementary Tool: Knip

While ast-grep enforces **architectural patterns**, [knip](https://knip.dev/) finds **unused code and dependencies**.

### Knip Configuration

The project includes `knip.json` configured to:
- Scan only `src/` directory (excludes test fixtures, build output)
- Detect unused files, dependencies, and exports
- Ignore false positives (shadcn/ui future components, Tauri integrations)

### Running Knip

```bash
# Run knip manually
pnpm run knip

# Intelligent cleanup (recommended)
/knip-cleanup
```

### The /knip-cleanup Command

Use the `/knip-cleanup` slash command for intelligent cleanup:
- Preserves shadcn/ui components (future use)
- Keeps Radix dependencies used by shadcn components
- Protects Tauri/Rust-called exports
- Auto-removes safe items
- Asks user about ambiguous items

**Note**: knip is NOT included in `check:all` to prevent accidental removal of intentionally unused code. Run it periodically during refactoring sessions via `/knip-cleanup`.

### Knip vs ast-grep

| Tool | Purpose | When to Run | Auto-fixes |
|------|---------|-------------|------------|
| **ast-grep** | Enforce architectural patterns | Always (in check:all) | Some patterns |
| **knip** | Find unused code/deps | Periodically (refactoring) | Via /knip-cleanup |

Both tools are complementary and serve different purposes in maintaining code quality.
