import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Copy Excalidraw's shipped font files into public/ so the browser loads them
 * from this origin. The directory is gitignored and is not vendored.
 */
export function copyExcalidrawAssets() {
  const entry = require.resolve("@excalidraw/excalidraw");
  const fonts = join(dirname(entry), "fonts");
  const destRoot = join(root, "public/excalidraw-assets");
  const dest = join(destRoot, "fonts");
  rmSync(destRoot, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(fonts, dest, { recursive: true });
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  copyExcalidrawAssets();
}
