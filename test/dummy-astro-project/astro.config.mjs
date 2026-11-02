// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), react(), svelte(), vue()],
});
