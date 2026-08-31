import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  integrations: [svelte()],
  site: 'https://monognuisy.github.io',
  base: '/shibuya-map',
  build: { assets: 'assets' },
  vite: { plugins: [tailwind()] },
});
