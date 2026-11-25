// A collection defined outside the content config and imported into it
import { defineCollection, reference } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

export const podcasts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/podcasts' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    host: reference('team'),
  }),
})
