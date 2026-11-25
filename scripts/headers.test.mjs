import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  cspHashes,
  cspSourceProblems,
  effectiveHeaders,
  headerValue,
  parseCsp,
  parseHeaders,
} from "./headers.mjs";

const SITE_CSP =
  "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' mailto:; frame-ancestors 'none'";

test("duplicate headers are comma-joined and ! detaches", () => {
  const rules = parseHeaders(`
/example
  X-Test: one
  X-Test: two
  ! X-Test
  X-Test: three
`);
  assert.deepEqual(headerValue(effectiveHeaders(rules, "/example"), "X-Test"), ["three"]);
  const joined = parseHeaders(`
/example
  X-Test: one
  X-Test: two
`);
  assert.deepEqual(headerValue(effectiveHeaders(joined, "/example"), "X-Test"), ["one, two"]);
});

test("/draw/ and /draw/index.html replace the site policy", () => {
  const rules = parseHeaders(readFileSync(new URL("../public/_headers", import.meta.url), "utf8"));
  const home = headerValue(effectiveHeaders(rules, "/"), "Content-Security-Policy");
  assert.deepEqual(home, [SITE_CSP]);
  assert.deepEqual(headerValue(effectiveHeaders(rules, "/"), "X-Robots-Tag"), []);
  assert.deepEqual(headerValue(effectiveHeaders(rules, "/"), "Cross-Origin-Opener-Policy"), []);

  const policies = ["/draw", "/draw/", "/draw/index.html"].map(
    (path) => headerValue(effectiveHeaders(rules, path), "Content-Security-Policy")[0],
  );
  assert.equal(new Set(policies).size, 1);
  for (const path of ["/draw", "/draw/", "/draw/index.html"]) {
    const headers = effectiveHeaders(rules, path);
    assert.equal(headerValue(headers, "Content-Security-Policy").length, 1);
    assert.deepEqual(headerValue(headers, "Cross-Origin-Opener-Policy"), ["same-origin"]);
    assert.deepEqual(headerValue(headers, "X-Robots-Tag"), ["noindex, nofollow"]);
    assert.equal(headerValue(headers, "X-Content-Type-Options")[0], "nosniff");
    assert.deepEqual(cspSourceProblems(policies[0]), []);
  }
  assert.notEqual(policies[0], SITE_CSP);
  assert.ok(policies[0].includes("'wasm-unsafe-eval'"));
  assert.equal(cspHashes(policies[0], "script-src").length, 2);
  assert.equal(cspHashes(policies[0], "style-src").length, 1);
});

test("CSP source allowlist rejects wildcards, remote hosts, and scheme-less hosts", () => {
  assert.deepEqual(cspSourceProblems("img-src 'self' data: blob:"), []);
  assert.deepEqual(cspSourceProblems("script-src 'self' 'wasm-unsafe-eval'"), []);
  const wildcard = cspSourceProblems("img-src *");
  assert.ok(wildcard.some((problem) => problem.includes("wildcard")));
  const remote = cspSourceProblems("connect-src https://example.com");
  assert.ok(remote.some((problem) => problem.includes("remote")));
  const host = cspSourceProblems("font-src fonts.example.com");
  assert.ok(host.some((problem) => problem.includes("scheme-less")));
  const starHost = cspSourceProblems("img-src *.example.com");
  assert.ok(starHost.some((problem) => problem.includes("wildcard")));
  assert.ok(cspSourceProblems("script-src 'unsafe-inline'").some((problem) => problem.includes("unsafe-inline")));
  assert.ok(cspSourceProblems("script-src 'unsafe-eval'").some((problem) => problem.includes("unsafe-eval")));
  const directives = parseCsp("script-src 'self'; style-src 'self'");
  assert.deepEqual(
    directives.map((directive) => directive.name),
    ["script-src", "style-src"],
  );
});
