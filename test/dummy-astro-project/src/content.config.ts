import { defineCollection, z, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Authors collection - file-based JSON collection for reference testing
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
      title: z.string().describe('This is the title of the article'),
      slug: z.string().optional(),
      draft: z.boolean().default(false),
      description: z.string().optional(),
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
  schema: z.object({
    title: z.string(),
    sourceURL: z.string().url().optional(),
    slug: z.string().optional(),
    draft: z.boolean().default(false),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { authors, articles, notes };
