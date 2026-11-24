import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { copyExcalidrawAssets } from "./scripts/copy-excalidraw-assets.mjs";

const FONT_FALLBACK = "return r.push(new URL(n,jn.ASSETS_FALLBACK_URL)),r";

// Excalidraw appends an esm.sh URL to every FontFace. Chromium requests that
// URL even when the self-hosted file is listed first. Drop the append so the
// drawing page never names a remote host.
function excalidrawSelfHostedFonts() {
  return {
    name: "excalidraw-self-hosted-fonts",
    enforce: "pre",
    transform(code, id) {
      const path = id.split("?")[0];
      if (!path.endsWith("chunk-K2UTITRG.js") || !path.includes("@excalidraw/excalidraw")) return null;
      if (!code.includes(FONT_FALLBACK)) {
        throw new Error("Excalidraw font fallback changed; the CDN URL would be requested");
      }
      return code.replace(FONT_FALLBACK, "return r");
    },
  };
}

// `npm run deploy` calls `astro build` directly, so the copy cannot live only
// in an npm prebuild hook. The hook still runs for `npm run build` and `npm run dev`.
copyExcalidrawAssets();

export default defineConfig({
  site: "https://softwaredecisionfabric.tech",
  trailingSlash: "never",
  build: {
    format: "directory",
    // Keep styles in files so Content-Security-Policy does not need style 'unsafe-inline'.
    inlineStylesheets: "never",
  },
  vite: {
    plugins: [excalidrawSelfHostedFonts()],
    build: {
      // Astro inlines script chunks under this byte limit. Zero keeps them as
      // external /_astro/*.js files so script-src can stay 'self'.
      assetsInlineLimit: 0,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return path !== "/draw" && !path.startsWith("/draw/");
      },
    }),
    react(),
  ],
});
