import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { effectiveHeaders, hasCspToken, headerValue, parseHeaders } from "./headers.mjs";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function rel(file) {
  return file.slice(dist.length).split("\\").join("/");
}

const SITE_CSP =
  "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' mailto:; frame-ancestors 'none'";

const headersText = readFileSync(join(dist, "_headers"), "utf8");
const rules = parseHeaders(headersText);
const siteRule = rules.find((rule) => rule.path === "/*");
assert(siteRule, "/* header block is missing");
const siteCsp = siteRule?.headers.find((header) => header.name === "Content-Security-Policy");
assert(siteCsp?.value === SITE_CSP, "/* Content-Security-Policy changed");

const inherited = ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"];
for (const path of ["/", "/pricing", "/pricing/", "/blog", "/blog/task-complete-is-a-claim"]) {
  const headers = effectiveHeaders(rules, path);
  const csp = headerValue(headers, "Content-Security-Policy");
  assert(csp.length === 1, `${path} should have exactly one CSP, got ${csp.length}`);
  assert(csp[0] === SITE_CSP, `${path} CSP is not the /* policy`);
}

for (const path of ["/draw", "/draw/", "/draw/index.html"]) {
  const headers = effectiveHeaders(rules, path);
  const csp = headerValue(headers, "Content-Security-Policy");
  assert(csp.length === 1, `${path} should have exactly one CSP, got ${csp.length}: ${csp.join(" || ")}`);
  if (csp[0]) {
    assert(csp[0].includes("img-src 'self' data: blob:"), `${path} CSP is missing the measured image sources`);
    assert(csp[0].includes("script-src 'self'"), `${path} CSP is missing script-src 'self'`);
    assert(csp[0].includes("style-src 'self'"), `${path} CSP is missing style-src 'self'`);
    assert(csp[0].includes("frame-src 'none'") || csp[0].includes("frame-src 'self'"), `${path} frame-src widened`);
    assert(!hasCspToken(csp[0], "unsafe-inline"), `${path} CSP uses unsafe-inline`);
    assert(!hasCspToken(csp[0], "unsafe-eval"), `${path} CSP uses unsafe-eval`);
    assert(!/https?:/.test(csp[0]), `${path} CSP names a remote host`);
    assert(csp[0] !== SITE_CSP, `${path} still uses the site-wide CSP`);
  }
  for (const name of inherited) {
    const values = headerValue(headers, name);
    assert(values.length === 1, `${path} dropped ${name}`);
  }
}

const drawPaths = new Set(["/draw", "/draw/"]);
const drawCsps = ["/draw", "/draw/", "/draw/index.html"].map(
  (path) => headerValue(effectiveHeaders(rules, path), "Content-Security-Policy")[0],
);
assert(new Set(drawCsps).size === 1, "/draw and /draw/* do not share one CSP");
assert(!drawPaths.has("/*"), "sanity");

function assetUrls(html) {
  const urls = [];
  for (const match of html.matchAll(
    /\b(?:src|href|component-url|renderer-url|before-hydration-url)="([^"]+)"/g,
  )) {
    const url = match[1];
    if (url.startsWith("/_astro/") && /\.(?:js|css|wasm)$/.test(url)) urls.push(url);
  }
  return urls;
}

function collectGraph(startUrls) {
  const seen = new Set();
  const queue = [...startUrls];
  while (queue.length) {
    const url = queue.pop();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const file = join(dist, url);
    if (!existsSync(file) || !/\.(?:js|css)$/.test(url)) continue;
    const text = readFileSync(file, "utf8");
    const specs = new Set();
    for (const match of text.matchAll(/["'](\.\/[^"']+\.(?:js|css|wasm))["']/g)) specs.add(match[1]);
    for (const match of text.matchAll(/["'](_astro\/[^"']+\.(?:js|css|wasm))["']/g)) specs.add(`/${match[1]}`);
    for (const match of text.matchAll(/["'](\/_astro\/[^"']+\.(?:js|css|wasm))["']/g)) specs.add(match[1]);
    for (const spec of specs) {
      const next = spec.startsWith("/") ? spec : new URL(spec, `https://assets.local${url}`).pathname;
      queue.push(next);
    }
  }
  return seen;
}

function cspHash(body) {
  return `sha256-${createHash("sha256").update(body).digest("base64")}`;
}

function isDrawRuntime(url) {
  const file = join(dist, url);
  if (!existsSync(file)) return false;
  const text = readFileSync(file);
  const sample = text.subarray(0, Math.min(text.length, 2_000_000)).toString("utf8");
  return (
    sample.includes("excalidraw") ||
    sample.includes("EXCALIDRAW_ASSET_PATH") ||
    sample.includes("react-dom") ||
    sample.includes("react.production")
  );
}

const htmlFiles = walk(dist).filter((file) => file.endsWith(".html"));
const drawHtmlPath = join(dist, "draw/index.html");
assert(existsSync(drawHtmlPath), "dist/draw/index.html is missing");
const drawHtml = existsSync(drawHtmlPath) ? readFileSync(drawHtmlPath, "utf8") : "";
const drawCsp = drawCsps[0] ?? "";
const inlineScripts = [...drawHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .filter((body) => body.trim().length > 0);
const inlineStyles = [...drawHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
  .map((match) => match[1])
  .filter((body) => body.trim().length > 0);
assert(inlineScripts.length > 0, "/draw is missing the Astro island bootstrap script");
assert(inlineStyles.length === 1, "/draw should have exactly the Astro island style element");
for (const body of [...inlineScripts, ...inlineStyles]) {
  const hash = cspHash(body);
  assert(drawCsp.includes(`'${hash}'`), `/draw CSP is missing the hash of an inline block: '${hash}'`);
}
const drawGraph = collectGraph(assetUrls(drawHtml));
const drawRuntime = [...drawGraph].filter(isDrawRuntime);
assert(drawRuntime.length > 0, "/draw did not reference a React or Excalidraw chunk");

for (const file of htmlFiles) {
  const urlPath = rel(file);
  if (urlPath === "/draw/index.html") continue;
  const html = readFileSync(file, "utf8");
  for (const asset of assetUrls(html)) {
    assert(!isDrawRuntime(asset), `${urlPath} references draw runtime ${asset}`);
  }
}

assert(!drawHtml.includes("serviceWorker.register"), "/draw registers a service worker");
assert(
  !walk(dist).some((file) => /service-worker|sw\.js$/.test(file)),
  "A service worker file was emitted",
);

const fontProbe = join(dist, "excalidraw-assets/fonts/Virgil/Virgil-Regular.woff2");
assert(existsSync(fontProbe), "Excalidraw fonts were not copied into dist/excalidraw-assets");

let gzipBytes = 0;
const counted = [];
for (const url of [...drawGraph].sort()) {
  const file = join(dist, url);
  if (!existsSync(file)) continue;
  if (!/\.(?:js|css)$/.test(url)) continue;
  const size = gzipSync(readFileSync(file)).length;
  gzipBytes += size;
  counted.push({ url, gzip: size });
}
assert(gzipBytes > 0, "/draw JS+CSS gzip total was zero");

const budgetPath = join(root, "scripts/draw-bundle-budget.json");
assert(existsSync(budgetPath), "scripts/draw-bundle-budget.json is missing");
if (existsSync(budgetPath)) {
  const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
  const limit = budget.gzipBytes * 1.1;
  assert(
    typeof budget.gzipBytes === "number" && budget.gzipBytes > 0,
    "draw bundle budget must be a positive gzip byte count",
  );
  assert(
    gzipBytes <= limit,
    `/draw JS+CSS gzip is ${gzipBytes} bytes, over the 10% ceiling of ${Math.floor(limit)} (budget ${budget.gzipBytes}). Bump scripts/draw-bundle-budget.json when the growth is intentional.`,
  );
  console.log(
    `/draw JS+CSS gzip ${gzipBytes} bytes across ${counted.length} files (budget ${budget.gzipBytes}, ceiling ${Math.floor(budget.gzipBytes * 1.1)}).`,
  );
}

const sitemap = walk(dist)
  .filter((file) => file.endsWith(".xml"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
assert(!sitemap.includes("/draw"), "Sitemap lists /draw");

if (failures.length) {
  console.error("Draw checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  if (gzipBytes) {
    console.error("Measured /draw JS+CSS gzip bytes:", gzipBytes);
    for (const file of counted.sort((a, b) => b.gzip - a.gzip).slice(0, 12)) {
      console.error(`  ${file.gzip}\t${file.url}`);
    }
  }
  process.exit(1);
}

console.log("Draw checks passed.");
