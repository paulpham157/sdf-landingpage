import { defineConfig } from "astro/config";

const outDir = process.env.JSONLD_OUT;
if (!outDir) {
  throw new Error("JSONLD_OUT is required");
}

// Separate root so `astro build` of the site does not emit this page.
export default defineConfig({
  site: "https://softwaredecisionfabric.tech",
  srcDir: new URL(".", import.meta.url).pathname,
  publicDir: new URL("./public", import.meta.url).pathname,
  outDir,
  trailingSlash: "never",
  build: {
    inlineStylesheets: "never",
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
