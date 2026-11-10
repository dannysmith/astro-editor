// Collections laid out in the ways Astro Editor has to read from the loaders
// rather than assume `src/content/<name>`. See README.md.
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const postSchema = z.object({
  title: z.string(),
  pubDate: z.coerce.date(),
  unpublished: z.boolean().default(false),
})

// Content outside src/content, with an unusual draft field
const posts = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/posts' }),
  schema: postSchema,
})

// A base relative to this file, and a pattern that leaves files out
const notes = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/README.md', '!archive/**'],
    base: new URL('./notes', import.meta.url),
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
  }),
})

// The pattern's fixed prefix picks one folder of a shared base, and only MDX
const guides = defineCollection({
  loader: glob({ pattern: 'guides/**/*.mdx', base: './content' }),
  schema: z.object({ title: z.string(), order: z.number() }),
})

// A folder per entry
const projects = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './content/projects' }),
  schema: z.object({ title: z.string(), status: z.enum(['active', 'done']) }),
})

// A loader Astro Editor can't read, so it looks in src/content/<name>
const feed = defineCollection({
  loader: async () => [],
  schema: z.object({ title: z.string() }),
})

export const collections = { posts, 'field-notes': notes, guides, projects, feed }
