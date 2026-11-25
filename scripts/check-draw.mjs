import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  cspHashes,
  cspSourceProblems,
  effectiveHeaders,
  hasCspToken,
  headerValue,
  parseCsp,
  parseHeaders,
} from "./headers.mjs";

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
for (const problem of cspSourceProblems(siteCsp?.value ?? "")) failures.push(`/* CSP ${problem}`);

const inherited = ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"];
for (const path of ["/", "/pricing", "/pricing/", "/blog", "/blog/task-complete-is-a-claim"]) {
  const headers = effectiveHeaders(rules, path);
  const csp = headerValue(headers, "Content-Security-Policy");
  assert(csp.length === 1, `${path} should have exactly one CSP, got ${csp.length}`);
  assert(csp[0] === SITE_CSP, `${path} CSP is not the /* policy`);
  assert(headerValue(headers, "X-Robots-Tag").length === 0, `${path} should not send X-Robots-Tag`);
}

const drawPaths = ["/draw", "/draw/", "/draw/index.html"];
for (const path of drawPaths) {
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
    for (const problem of cspSourceProblems(csp[0])) failures.push(`${path} CSP ${problem}`);
  }
  for (const name of inherited) {
    const values = headerValue(headers, name);
    assert(values.length === 1, `${path} dropped ${name}`);
  }
  assert(
    headerValue(headers, "Cross-Origin-Opener-Policy").join(" | ") === "same-origin",
    `${path} is missing Cross-Origin-Opener-Policy: same-origin`,
  );
  assert(
    headerValue(headers, "X-Robots-Tag").join(" | ") === "noindex, nofollow",
    `${path} is missing X-Robots-Tag: noindex, nofollow`,
  );
}

const drawCsps = drawPaths.map((path) => headerValue(effectiveHeaders(rules, path), "Content-Security-Policy")[0]);
assert(new Set(drawCsps).size === 1, "/draw and /draw/* do not share one CSP");

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

function collectGraph(startUrls, { dynamic = true } = {}) {
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
    for (const match of text.matchAll(/(?:from\s*|import\s+)["'](\.\/[^"']+\.(?:js|css|wasm))["']/g)) {
      specs.add(match[1]);
    }
    if (dynamic) {
      for (const match of text.matchAll(/["'](_astro\/[^"']+\.(?:js|css|wasm))["']/g)) specs.add(`/${match[1]}`);
      for (const match of text.matchAll(/["'](\/_astro\/[^"']+\.(?:js|css|wasm))["']/g)) specs.add(match[1]);
    }
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

function sameMembers(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  assert(
    left.length === right.length && left.every((value, index) => value === right[index]),
    `${label} hash set differs. policy: ${left.join(" ") || "(none)"}. inline: ${right.join(" ") || "(none)"}.`,
  );
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

function gzipOf(urls) {
  let bytes = 0;
  const counted = [];
  for (const url of [...urls].sort()) {
    const file = join(dist, url);
    if (!existsSync(file) || !/\.(?:js|css)$/.test(url)) continue;
    const size = gzipSync(readFileSync(file)).length;
    bytes += size;
    counted.push({ url, gzip: size });
  }
  return { bytes, counted };
}

const REMOTE_HOSTS = [
  { host: "esm.sh", pattern: /esm\.sh/ },
  { host: "unpkg", pattern: /unpkg\.com/ },
  { host: "jsdelivr", pattern: /jsdelivr\.net/ },
  { host: "json.excalidraw.com", pattern: /json\.excalidraw\.com/ },
  { host: "firebase", pattern: /firebase(?:app|io)\.com/ },
  { host: "sentry", pattern: /sentry\.io/ },
  { host: "wss", pattern: /wss:\/\// },
];

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
sameMembers(
  new Set(cspHashes(drawCsp, "script-src")),
  new Set(inlineScripts.map((body) => `'${cspHash(body)}'`)),
  "script-src",
);
sameMembers(
  new Set(cspHashes(drawCsp, "style-src")),
  new Set(inlineStyles.map((body) => `'${cspHash(body)}'`)),
  "style-src",
);
for (const directive of parseCsp(drawCsp)) {
  if (directive.name === "script-src" || directive.name === "style-src") continue;
  assert(
    !directive.values.some((value) => value.startsWith("'sha")),
    `${directive.name} carries a hash`,
  );
}

const drawGraph = collectGraph(assetUrls(drawHtml), { dynamic: true });
const initialGraph = collectGraph(assetUrls(drawHtml), { dynamic: false });
const drawRuntime = [...drawGraph].filter(isDrawRuntime);
assert(drawRuntime.length > 0, "/draw did not reference a React or Excalidraw chunk");

const allowPath = join(root, "scripts/draw-remote-allowlist.json");
const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, "utf8")) : { accepted: [] };
const allowedHosts = new Map();
for (const item of allow.accepted ?? []) {
  assert(item.host && item.reason, "Each remote-host allowlist entry needs host and reason");
  if (item.host && item.reason) allowedHosts.set(item.host, item.reason);
}
for (const url of drawGraph) {
  if (!url.endsWith(".js")) continue;
  const file = join(dist, url);
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const remote of REMOTE_HOSTS) {
    if (!remote.pattern.test(text)) continue;
    if (allowedHosts.has(remote.host)) continue;
    failures.push(`${url} names ${remote.host}`);
  }
}

const drawCss = [...drawGraph]
  .filter((url) => url.endsWith(".css"))
  .map((url) => readFileSync(join(dist, url), "utf8"))
  .join("\n");
assert(drawCss.includes(".library-menu-browse-button"), "draw CSS does not hide Browse libraries");
assert(drawCss.includes("lib-dropdown--remove"), "draw CSS does not hide the Publish library entry");

for (const file of htmlFiles) {
  const urlPath = rel(file);
  if (urlPath === "/draw/index.html") continue;
  const html = readFileSync(file, "utf8");
  const graph = collectGraph(assetUrls(html), { dynamic: true });
  for (const asset of graph) {
    assert(!isDrawRuntime(asset), `${urlPath} reaches draw runtime ${asset}`);
  }
}

assert(!drawHtml.includes("serviceWorker.register"), "/draw registers a service worker");
assert(
  !walk(dist).some((file) => /service-worker|sw\.js$/.test(file)),
  "A service worker file was emitted",
);

const fontProbe = join(dist, "excalidraw-assets/fonts/Virgil/Virgil-Regular.woff2");
assert(existsSync(fontProbe), "Excalidraw fonts were not copied into dist/excalidraw-assets");

const total = gzipOf(drawGraph);
const initial = gzipOf(initialGraph);
const gzipBytes = total.bytes;
assert(gzipBytes > 0, "/draw JS+CSS gzip total was zero");
assert(initial.bytes > 0, "/draw initial JS+CSS gzip was zero");

const budgetPath = join(root, "scripts/draw-bundle-budget.json");
assert(existsSync(budgetPath), "scripts/draw-bundle-budget.json is missing");
if (existsSync(budgetPath)) {
  const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
  assert(
    typeof budget.gzipBytes === "number" && budget.gzipBytes > 0,
    "draw bundle budget must be a positive gzip byte count",
  );
  assert(
    typeof budget.initialGzipBytes === "number" && budget.initialGzipBytes > 0,
    "draw initial-load budget must be a positive gzip byte count",
  );
  const limit = budget.gzipBytes * 1.1;
  const initialLimit = budget.initialGzipBytes * 1.1;
  assert(
    gzipBytes <= limit,
    `/draw JS+CSS gzip is ${gzipBytes} bytes, over the 10% ceiling of ${Math.floor(limit)} (budget ${budget.gzipBytes}). Bump scripts/draw-bundle-budget.json when the growth is intentional.`,
  );
  assert(
    initial.bytes <= initialLimit,
    `/draw initial JS+CSS gzip is ${initial.bytes} bytes, over the 10% ceiling of ${Math.floor(initialLimit)} (budget ${budget.initialGzipBytes}). Bump scripts/draw-bundle-budget.json when the growth is intentional.`,
  );
  console.log(
    `/draw JS+CSS gzip ${gzipBytes} bytes across ${total.counted.length} files (budget ${budget.gzipBytes}, ceiling ${Math.floor(limit)}).`,
  );
  console.log(
    `/draw initial JS+CSS gzip ${initial.bytes} bytes across ${initial.counted.length} files (budget ${budget.initialGzipBytes}, ceiling ${Math.floor(initialLimit)}).`,
  );
}

const sitemap = walk(dist)
  .filter((file) => file.endsWith(".xml"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
assert(!sitemap.includes("/draw"), "Sitemap lists /draw");

const robots = readFileSync(join(dist, "robots.txt"), "utf8");
assert(!robots.includes("Disallow: /draw"), "robots.txt Disallow /draw hides the page from crawlers that would otherwise see noindex");

if (failures.length) {
  console.error("Draw checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  if (gzipBytes) {
    console.error("Measured /draw JS+CSS gzip bytes:", gzipBytes);
    console.error("Measured /draw initial JS+CSS gzip bytes:", initial.bytes);
    for (const file of total.counted.sort((a, b) => b.gzip - a.gzip).slice(0, 12)) {
      console.error(`  ${file.gzip}\t${file.url}`);
    }
  }
  process.exit(1);
}

console.log("Draw checks passed.");
