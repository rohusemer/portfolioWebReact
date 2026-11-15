// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://portfoliowebsite-ccc81.web.app',
  output: 'static',
  integrations: [
    react(),
    tailwind(),
    // Solo las páginas públicas (sin paneles privados)
    sitemap({ filter: (page) => !/\/(admin|mi-cv|perfil)\/?$/.test(page) }),
  ],
});
