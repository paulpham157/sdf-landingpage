import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attack, breadcrumbs } from "./jsonld-fixture/payload.js";

const site = "https://softwaredecisionfabric.tech";
const expected = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: attack.close,
      description: attack.comment,
      attack,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: new URL(item.href, site).href,
      })),
    },
  ],
};
const outDir = mkdtempSync(join(tmpdir(), "sdf-jsonld-"));

function fail(message) {
  rmSync(outDir, { recursive: true, force: true });
  console.error(message);
  process.exit(1);
}

const build = spawnSync(
  process.execPath,
  ["node_modules/astro/bin/astro.mjs", "build", "--config", "scripts/jsonld-fixture/astro.config.mjs"],
  {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, JSONLD_OUT: outDir, ASTRO_TELEMETRY_DISABLED: "1" },
    encoding: "utf8",
  },
);
if (build.status !== 0) {
  process.stderr.write(build.stdout ?? "");
  process.stderr.write(build.stderr ?? "");
  fail("JSON-LD fixture build failed");
}

let html;
try {
  html = readFileSync(join(outDir, "jsonld-escape-check/index.html"), "utf8");
} catch (error) {
  fail(`fixture HTML missing: ${error instanceof Error ? error.message : error}`);
}
rmSync(outDir, { recursive: true, force: true });

const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const jsonLdBlocks = blocks.filter((block) =>
  /type\s*=\s*["']application\/ld\+json["']/i.test(block[1]),
);
const inlineScripts = blocks.filter(
  (block) =>
    !/type\s*=\s*["']application\/ld\+json["']/i.test(block[1]) &&
    !/\bsrc\s*=/.test(block[1]),
);
if (jsonLdBlocks.length !== 1) {
  fail(`expected one JSON-LD script node, found ${jsonLdBlocks.length}`);
}
if (inlineScripts.length !== 0) {
  fail(`payload injected ${inlineScripts.length} inline script element(s)`);
}
const body = jsonLdBlocks[0][2];
if (/<\/script/i.test(body) || body.includes("<!--")) {
  fail("JSON-LD body still contains a script closer or an HTML comment");
}
if (!body.includes("\\u003c")) {
  fail("JSON-LD body did not escape '<' as \\\\u003c");
}
if (html.includes(attack.close) || html.includes(attack.mixed) || html.includes("<!--")) {
  fail("raw payload markup was emitted outside the JSON escape");
}

let parsed;
try {
  parsed = JSON.parse(body);
} catch (error) {
  fail(`JSON-LD did not parse: ${error instanceof Error ? error.message : error}`);
}
if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
  fail("JSON.parse(JSON-LD) did not equal the object BaseLayout serializes");
}

const node = parsed["@graph"]?.[0];
if (
  node?.name !== attack.close ||
  node?.description !== attack.comment ||
  node?.attack?.mixed !== attack.mixed ||
  node?.attack?.nested?.items?.[0] !== attack.nested.items[0] ||
  node?.attack?.nested?.items?.[1]?.note !== attack.nested.items[1].note ||
  parsed["@graph"]?.[1]?.itemListElement?.[0]?.name !== attack.mixed
) {
  fail("nested payload strings did not round-trip through the rendered layout");
}

console.log("JSON-LD escape check passed (BaseLayout render).");
