// The personal site's collections plus loaders AE can't read from the config,
// for comparing what AE infers with Astro's data store. See README.md.
import { defineCollection, reference } from 'astro:content'
import { file, glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { extendI18nLoaderSchema, i18nLoader } from 'astro-loader-i18n'
import { ObsidianDocumentSchema, ObsidianMdLoader } from 'astro-loader-obsidian'
import { apiRecords, jsonRecords, markdownFolder } from './loaders'
import { podcasts } from './collections/podcasts'
import { extraCollections } from './collections/extra'

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

// An inline loader AE can't read, whose files aren't where AE looks for them
const journal = defineCollection({
  loader: {
    name: 'journal',
    load: context => glob({ pattern: '*.md', base: './writing/journal' }).load(context),
  },
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date(),
    mood: z.enum(['good', 'okay', 'rough']).optional(),
  }),
})

// Entries fetched from an API, so there are no files for AE to edit
function bookmarksLoader(url: string) {
  return {
    name: 'bookmarks',
    load: async () => {
      void url
    },
  }
}

const bookmarks = defineCollection({
  loader: bookmarksLoader('https://example.com/bookmarks.json'),
  schema: z.object({ title: z.string(), url: z.string().url() }),
})

const authors = defineCollection({
  loader: file('./src/data/authors.json'),
  schema: z.object({ id: z.string(), name: z.string() }),
})

const links = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/data/links' }),
  schema: z.object({ title: z.string(), url: z.string().url() }),
})

// A custom loader whose files happen to be where AE looks: src/content/recipes
const recipes = defineCollection({
  loader: markdownFolder('./src/content/recipes'),
  schema: z.object({ title: z.string(), serves: z.number().optional() }),
})

// The same custom loader on a folder outside src/content, with subfolders and MDX
const talks = defineCollection({
  loader: markdownFolder('./talks'),
  schema: z.object({ title: z.string(), date: z.coerce.date(), event: z.string() }),
})

// A third-party loader built on glob(): locales as folders
const pages = defineCollection({
  loader: i18nLoader({ pattern: '**/[^_]*.{md,mdx}', base: './src/i18n-pages' }),
  schema: extendI18nLoaderSchema(z.object({ title: z.string() })),
})

// A third-party loader reading an Obsidian vault outside src
const garden = defineCollection({
  loader: ObsidianMdLoader({ base: 'vault', url: 'garden' }),
  schema: ObsidianDocumentSchema,
})

// A custom loader over one JSON file, a reference target for podcasts
const team = defineCollection({
  loader: jsonRecords('./src/data/team.json'),
  schema: z.object({ id: z.string(), name: z.string(), role: z.string() }),
})

// Records from an API, like an AT Protocol or Notion loader: no files
const scrobbles = defineCollection({
  loader: apiRecords('atproto', [
    { id: '3mw4rhmbwxs26', title: 'Hoochie Coochie Man', artist: 'Muddy Waters', createdAt: '2026-11-20T21:04:00Z' },
    { id: '3mw4rhnglt226', title: 'Crossroads', artist: 'Robert Johnson', createdAt: '2026-11-20T21:08:00Z' },
    { id: '3mw4rhqjtm226', title: 'Born Under a Bad Sign', artist: 'Albert King', createdAt: '2026-11-21T09:30:00Z' },
  ]),
  schema: z.object({ title: z.string(), artist: z.string(), createdAt: z.coerce.date() }),
})

export const collections = {
  blog,
  notes,
  docs,
  journal,
  bookmarks,
  authors,
  links,
  recipes,
  talks,
  pages,
  garden,
  podcasts,
  team,
  scrobbles,
  ...extraCollections,
}
