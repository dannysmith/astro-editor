// Fails if the React Compiler leaves any component or hook in src/ uncompiled.
// The compiler skips a function silently when it breaks the Rules of React or
// uses syntax it can't handle yet (try/finally, throw inside try, `?:`, `&&`,
// `||`, `??` or `?.` inside try), so without this check a component can quietly lose
// its memoisation. Run with `bun run compiler:check` (part of check:all).
//
// The fix is usually to move async or try/catch logic out of the component
// into a plain function, which the compiler doesn't touch.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { transformAsync } from '@babel/core'
import reactCompiler from 'babel-plugin-react-compiler'

const SRC = path.join(import.meta.dir, '..', 'src')

// Files allowed to bail out, with the reason
const ALLOWED: Record<string, string> = {
  // Vendored shadcn component: String.raw tagged templates in class names.
  // Editing it would be undone by `shadcn` updates, and it's a leaf
  'components/ui/calendar.tsx': 'vendored shadcn',
}

async function* sourceFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* sourceFiles(full)
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      yield full
  }
}

interface CompilerEvent {
  kind: string
  fnLoc?: { start?: { line?: number } }
  detail?: {
    reason?: string
    loc?: { start?: { line?: number } }
    options?: { reason?: string; loc?: { start?: { line?: number } } }
  }
}

const problems: string[] = []
for await (const file of sourceFiles(SRC)) {
  // Forward slashes on every platform, to match ALLOWED
  const relative = path.relative(SRC, file).split(path.sep).join('/')
  if (relative in ALLOWED) continue

  const logger = {
    logEvent(_filename: string, event: CompilerEvent) {
      if (event.kind !== 'CompileError' && event.kind !== 'CompileSkip') return
      const detail = event.detail
      const reason = detail?.reason ?? detail?.options?.reason ?? ''
      const line =
        detail?.loc?.start?.line ??
        detail?.options?.loc?.start?.line ??
        event.fnLoc?.start?.line
      problems.push(`src/${relative}:${line ?? '?'} ${reason}`)
    },
  }

  await transformAsync(await readFile(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [
      [reactCompiler, { target: '19', logger, panicThreshold: 'none' }],
    ],
  })
}

if (problems.length > 0) {
  console.error(
    `The React Compiler can't compile these (see the comment at the top of scripts/react-compiler-check.ts):\n\n${problems.join('\n')}`
  )
  process.exit(1)
}
console.log('React Compiler: every component and hook compiles')
