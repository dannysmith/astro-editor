import { defineCollection } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { changelogsLoader } from 'starlight-changelogs/loader'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  changelogs: defineCollection({
    loader: changelogsLoader([
      {
        provider: 'github',
        base: 'changelog',
        owner: 'dannysmith',
        repo: 'astro-editor',
        process: ({ title }) => {
          return title.replace(/^(Astro Editor )?v/, '')
        },
      },
    ]),
  }),
}
