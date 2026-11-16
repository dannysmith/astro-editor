// Prints what Astro reads from the frontmatter of each file in files/, in the
// format of values.txt, using the frontmatter parser of an installed Astro
// project. See the README.
//
// Usage: bun test/frontmatter/astro-values.mjs <path to an Astro project>
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const project = process.argv[2]
if (!project) {
  console.error('Usage: bun test/frontmatter/astro-values.mjs <path to an Astro project>')
  process.exit(1)
}
const { parseFrontmatter } = await import(
  join(project, 'node_modules/@astrojs/internal-helpers/dist/frontmatter.js')
)

const files = join(import.meta.dirname, 'files')
const names = readdirSync(files, { recursive: true })
  .filter(name => name.endsWith('.md') || name.endsWith('.mdx'))
  .sort()

// JSON has no infinities or NaN
const replacer = (_key, value) =>
  typeof value === 'number' && !Number.isFinite(value) ? String(value) : value

for (const name of names) {
  let values
  try {
    const { frontmatter, rawFrontmatter } = parseFrontmatter(
      readFileSync(join(files, name), 'utf8')
    )
    values =
      rawFrontmatter === '' ? '(no frontmatter)' : JSON.stringify(frontmatter, replacer, 2)
  } catch (error) {
    values = `(error) ${error.message.split('\n')[0]}`
  }
  console.log(`\n=== ${name}\n${values}`)
}
