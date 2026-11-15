// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://portfoliowebsite-ccc81.web.app',
  output: 'static',
  integrations: [react(), tailwind()],
});
