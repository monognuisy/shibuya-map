import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  integrations: [svelte()],
  site: 'https://monognuisy.github.io',
  base: '/shibuya-map',
  build: { assets: 'assets' },
});
