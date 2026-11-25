import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { copyExcalidrawAssets } from "./scripts/copy-excalidraw-assets.mjs";

const REMOTE_HOST =
  /esm\.sh|unpkg\.com|jsdelivr\.net|json\.excalidraw\.com|firebase(?:app|io)\.com|sentry\.io|wss:\/\//;

// FontFace appends an esm.sh URL after the self-hosted file. Chromium requests
// every source, so the append has to go. Match the call by its content and
// fail the build when this package no longer contains that call.
function stripFontFallback(code) {
  const push =
    /return\s+(\w+)\.push\(new URL\(\w+,\s*\w+\.ASSETS_FALLBACK_URL\)\),\s*\1/g;
  let rewritten = 0;
  let next = code.replace(push, (_match, name) => {
    rewritten += 1;
    return `return ${name}`;
  });
  next = next.replace(/https:\/\/esm\.sh\//g, () => {
    rewritten += 1;
    return "/excalidraw-assets/";
  });
  if (rewritten === 0) {
    throw new Error("Excalidraw font fallback was not rewritten");
  }
  if (REMOTE_HOST.test(next)) {
    throw new Error("Excalidraw font chunk still names a remote host");
  }
  return next;
}

// Collab, AI, and the library backend are compiled in as URLs. Blank them so
// the drawing bundle does not name those hosts. The library control is hidden.
function stripRemoteConfig(code) {
  let rewritten = 0;
  let next = code.replace(/VITE_APP_FIREBASE_CONFIG:(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/, () => {
    rewritten += 1;
    return 'VITE_APP_FIREBASE_CONFIG:"{}"';
  });
  next = next.replace(/https:\/\/[^"'`\\]+/g, () => {
    rewritten += 1;
    return "";
  });
  if (rewritten === 0) {
    throw new Error("Excalidraw env chunk was not rewritten");
  }
  if (REMOTE_HOST.test(next)) {
    throw new Error("Excalidraw env chunk still names a remote host");
  }
  return next;
}

const LIBRARY_EMPTY =
  "Select an item on canvas to add it here, or install a library from the public repository, below.";

const PUBLISH_REQUEST =
  /fetch\(\s*`\$\{[A-Za-z0-9_$]+\.VITE_APP_LIBRARY_BACKEND\}\/submit`\s*,\s*\{\s*method:\s*"post"\s*,\s*body:\s*[A-Za-z0-9_$]+\s*\}\s*\)/;

function disableLibraryPublish(code) {
  if (!PUBLISH_REQUEST.test(code)) {
    throw new Error("Excalidraw library publish request was not found");
  }
  if (!code.includes("https://libraries.excalidraw.com")) {
    throw new Error("Excalidraw library site link was not found");
  }
  return code
    .replace(PUBLISH_REQUEST, 'Promise.reject(new Error("Library publishing is disabled"))')
    .replaceAll("https://libraries.excalidraw.com", "#");
}

function libraryEmptyState(code) {
  if (!code.includes(LIBRARY_EMPTY)) {
    throw new Error("Excalidraw library empty-state copy changed");
  }
  return code.replaceAll(LIBRARY_EMPTY, "Select an item on canvas to add it here.");
}

const appliedPatches = { libraryEmptyState: false, disableLibraryPublish: false };

function excalidrawSelfHosted() {
  return {
    name: "excalidraw-self-hosted",
    enforce: "pre",
    transform(code, id) {
      const path = id.split("?")[0];
      if (!path.includes("@excalidraw/excalidraw")) return null;
      if (path.endsWith("chunk-K2UTITRG.js")) return stripFontFallback(code);
      if (path.endsWith("chunk-ZUYEQ4TG.js")) return stripRemoteConfig(code);
      // Match the source by content so a renamed prod or dev chunk still patches.
      if (code.includes(LIBRARY_EMPTY)) {
        appliedPatches.libraryEmptyState = true;
        return libraryEmptyState(code);
      }
      if (PUBLISH_REQUEST.test(code)) {
        appliedPatches.disableLibraryPublish = true;
        return disableLibraryPublish(code);
      }
      return null;
    },
    closeBundle() {
      if (this.environment?.name && this.environment.name !== "client") return;
      const missing = Object.entries(appliedPatches)
        .filter(([, applied]) => !applied)
        .map(([name]) => name);
      if (missing.length) {
        this.error(`Excalidraw patch target is missing: ${missing.join(", ")}`);
      }
    },
  };
}

// Copy once per process. `astro dev` and `astro build` both load this config,
// including `npm run deploy`, which calls `astro build` directly.
let assetsCopied = false;
function excalidrawAssets() {
  return {
    name: "excalidraw-assets",
    hooks: {
      "astro:config:setup"() {
        if (assetsCopied) return;
        assetsCopied = true;
        copyExcalidrawAssets();
      },
    },
  };
}

export default defineConfig({
  site: "https://softwaredecisionfabric.tech",
  trailingSlash: "never",
  build: {
    format: "directory",
    // Keep styles in files so Content-Security-Policy does not need inline styles.
    inlineStylesheets: "never",
  },
  vite: {
    plugins: [excalidrawSelfHosted()],
    build: {
      // Astro inlines script chunks under this byte limit. Zero keeps them as
      // external /_astro/*.js files so script-src can stay 'self'.
      assetsInlineLimit: 0,
    },
  },
  integrations: [
    excalidrawAssets(),
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
