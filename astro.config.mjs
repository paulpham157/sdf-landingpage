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

const patchesByEnvironment = new Map();

function patchState(environmentName) {
  const key = environmentName || "default";
  let state = patchesByEnvironment.get(key);
  if (!state) {
    state = { libraryEmptyState: false, disableLibraryPublish: false };
    patchesByEnvironment.set(key, state);
  }
  return state;
}

function isExcalidrawModule(path) {
  return path.includes("@excalidraw/excalidraw") || path.includes("@excalidraw_excalidraw");
}

function excalidrawSelfHosted() {
  return {
    name: "excalidraw-self-hosted",
    enforce: "pre",
    buildStart() {
      const state = patchState(this.environment?.name);
      state.libraryEmptyState = false;
      state.disableLibraryPublish = false;
    },
    transform(code, id) {
      const path = id.split("?")[0];
      if (!isExcalidrawModule(path)) return null;
      const state = patchState(this.environment?.name);
      if (path.endsWith("chunk-K2UTITRG.js")) return stripFontFallback(code);
      if (path.endsWith("chunk-ZUYEQ4TG.js")) return stripRemoteConfig(code);
      let next = code;
      let changed = false;
      // One dev prebundle can contain both targets. Patch each by content.
      if (next.includes(LIBRARY_EMPTY)) {
        state.libraryEmptyState = true;
        next = libraryEmptyState(next);
        changed = true;
      }
      if (PUBLISH_REQUEST.test(next)) {
        state.disableLibraryPublish = true;
        next = disableLibraryPublish(next);
        changed = true;
      }
      return changed ? next : null;
    },
    closeBundle() {
      if (this.environment?.name && this.environment.name !== "client") return;
      const state = patchState(this.environment?.name);
      const missing = Object.entries(state)
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
    optimizeDeps: {
      // Serve the package source in dev so the transform sees dist/dev files
      // instead of a prebundle that skips the plugin.
      exclude: ["@excalidraw/excalidraw"],
    },
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
