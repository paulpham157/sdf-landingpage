/**
 * Excalidraw reads this at module init. This module is imported before
 * `@excalidraw/excalidraw` so the assignment runs first. Fonts are copied to
 * `public/excalidraw-assets/fonts` by scripts/copy-excalidraw-assets.mjs.
 */
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

window.EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";

export {};
