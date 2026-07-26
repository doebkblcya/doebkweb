import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.doebkblcya.com',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: "github-light",
    },
  },
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
