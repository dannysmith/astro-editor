// A personal site laid out the way real ones are, for trying project and
// collection settings. See README.md for what each collection checks.
import { defineCollection, reference } from 'astro:content'
import { file, glob } from 'astro/loaders'
import { z } from 'astro/zod'

// The usual blog: every field detected, dated file names, an excluded draft
const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      tags: z.array(z.string()).optional(),
      slug: z.string().optional(),
      author: reference('authors').optional(),
    }),
})

// Field names AE doesn't guess, title-only file names, top-level files only
const notes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/notes' }),
  schema: z.object({
    name: z.string(),
    summary: z.string().optional(),
    created: z.coerce.date(),
    updated: z.coerce.date().optional(),
    hidden: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
  }),
})

// Outside src/content, a folder per page, MDX only, no dates
const docs = defineCollection({
  loader: glob({ pattern: '**/index.mdx', base: './src/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
  }),
})

// A loader AE can't read, whose files aren't where AE looks for them
const journal = defineCollection({
  loader: async () => [],
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date(),
    mood: z.enum(['good', 'okay', 'rough']).optional(),
  }),
})

const authors = defineCollection({
  loader: file('./src/data/authors.json'),
  schema: z.object({ id: z.string(), name: z.string() }),
})

const links = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/data/links' }),
  schema: z.object({ title: z.string(), url: z.string().url() }),
})

export const collections = { blog, notes, docs, journal, authors, links }
