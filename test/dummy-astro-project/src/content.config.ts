import { defineCollection, z, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Authors collection - file-based JSON collection for reference testing
// NOTE: This uses file() loader, not glob(), so it won't be loaded by Astro Editor
// It only exists for testing reference() fields in other collections
const authors = defineCollection({
  loader: file('./src/content/authors.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    bio: z.string().optional(),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/articles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(3).max(100).describe('This is the title of the article'),
      slug: z.string().min(3).max(50).optional(),
      draft: z.boolean().default(false),
      description: z.string().max(200).describe('A brief description of the article').optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      tags: z.array(z.string()).optional(),
      platform: z.enum(['medium', 'external']).optional(),
      // Reference fields for testing
      author: reference('authors').optional(),
      relatedArticles: z.array(reference('articles')).max(3).optional(),
    }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/notes' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1).max(100).describe('The title of the note'),
      sourceURL: z.string().url().optional(),
      slug: z.string().optional(),
      draft: z.boolean().default(false),
      description: z.string().optional(),
      pubDate: z.coerce.date().optional(),
      tags: z.array(z.string()).optional(),
      // Nullable schema types for testing (Issue #68 follow-up)
      status: z.enum(['draft', 'review', 'published']).nullish(),
      keywords: z.array(z.string()).nullish(),
      scores: z.array(z.number()).nullish(),
      metadata: z
        .object({
          category: z.string().describe('Category for organizing notes'),
          priority: z.number().min(1).max(5).describe('Priority level from 1-5').optional(),
          deadline: z.coerce.date().optional(),
        })
        .optional(),
      coverImage: z
        .object({
          image: image().optional(),
          alt: z.string().max(200).optional(),
        })
        .optional(),
    }),
});

const ideas = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/ideas' }),
  schema: z.object({
    title: z.string().min(1).max(100),
    description: z.string().optional(),
    archived: z.boolean().default(false),
    pubDate: z.coerce.date().optional(),
  }),
});

// Schemaless collection for testing schema indicator (no schema defined)
const schemaless = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/schemaless' }),
});

export const collections = { authors, articles, notes, ideas, schemaless };
