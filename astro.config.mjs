import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://softwaredecisionfabric.tech",
  trailingSlash: "never",
  build: {
    format: "directory",
    // Keep styles in files so Content-Security-Policy does not need style 'unsafe-inline'.
    inlineStylesheets: "never",
  },
  vite: {
    build: {
      // Astro inlines script chunks under this byte limit. Zero keeps them as
      // external /_astro/*.js files so script-src can stay 'self'.
      assetsInlineLimit: 0,
    },
  },
  integrations: [mdx(), sitemap()],
});
