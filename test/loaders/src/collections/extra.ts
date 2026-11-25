// Collections spread into the content config's export
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/guides' }),
  schema: z.object({ title: z.string(), order: z.number().optional() }),
})

export const extraCollections = { guides }
