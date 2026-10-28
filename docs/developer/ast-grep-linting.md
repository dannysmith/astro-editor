# ast-grep Linting

[ast-grep](https://ast-grep.github.io/) enforces the project's architecture rules: structural patterns and directory boundaries that Oxlint has no rule for. `bun run ast:lint` runs it, and it's part of `check:all`, so a violation fails CI.

## Rules

Rules live in `.ast-grep/rules/`, one YAML file each. Each rule's `message` shows the wrong and right code, so the output explains the fix.

- **`no-destructure-zustand`** (`zustand/no-destructure.yml`): bans `const { a } = useEditorStore()`. Calling a store hook without a selector subscribes to the whole store, so the component re-renders on every change; this once caused about 15 re-renders per keystroke. Destructuring from `getState()` is fine and doesn't match.
- **`no-store-subscription-in-lib`**: bans calling a store hook inside `src/lib/`. `lib/` is plain TypeScript with no React, so it reads stores with `useEditorStore.getState()`.
- **`hooks-in-hooks-dir`**: bans exporting a `use…` function from `src/lib/`, written either as `export function useX` or `export const useX =`. Hooks go in `src/hooks/`. `src/lib/theme-provider.tsx` is ignored by name: it's a context provider and its hook, kept together.
- **`no-palette-colours`**: bans Tailwind palette colours (`text-gray-700`, `bg-black/50`, `dark:text-white`) in any string in `src/`. Every colour is a token in `App.css`; see `color-system.md`. It doesn't catch arbitrary values like `bg-[#fff]`, and nothing else does either.

The two Zustand rules match any hook named `use…Store` by regex rather than a list of stores, so a new store is covered without editing them.

Oxlint covers the rest. One rule worth knowing: `no-console` is an error in `src/`, because release builds strip `console.*` (terser's `drop_console`), so anything logged that way never reaches users' logs. Log through `@tauri-apps/plugin-log` instead.

## Everything Is Parsed as tsx

`sgconfig.yml` maps both `.ts` and `.tsx` to the tsx grammar, and every rule uses `language: tsx`. tsx is a superset of TypeScript, and the typescript grammar can't read JSX, so a rule parsed that way can't see `className` strings or anything else inside JSX.

The `languageGlobs` patterns must not have a path prefix. With `src/**/*.ts`, ast-grep 0.51 never matched them, so `.ts` files fell back to the typescript grammar and every tsx rule silently skipped them. Since most of `src/lib/` is `.ts`, the `lib/` rules checked almost nothing. `**/*.ts` works. Path prefixes are fine in a rule's own `files` list.

## Adding a Rule

1. Add a YAML file under `.ast-grep/rules/` with `language: tsx`, a `message` showing the wrong and right code, and a `files` list if it only applies to part of `src/`.
2. Try the pattern first with `bunx ast-grep run -p '<pattern>' -l tsx src`.
3. Write a sample file that should fail, somewhere its `files` globs match (in `src/lib/` for a `lib/` rule), and run `bunx ast-grep scan -r .ast-grep/rules/<path>.yml <sample>`. Check it reports what you expect, then delete the sample.
4. Run `bun run ast:lint` to check the rule doesn't flag code that's fine.

## Setup

`@ast-grep/cli` is in `trustedDependencies` in `package.json`, because its postinstall swaps the shim for the platform's binary and bun doesn't run install scripts from untrusted packages. Without it, running ast-grep prints "ast-grep shim file was executed".

knip (unused code and dependencies) and jscpd (duplication) are run through the `codebase-hygiene` skill. They stay out of `check:all` because their findings need judgement: plenty of what they flag is unused or duplicated on purpose.
