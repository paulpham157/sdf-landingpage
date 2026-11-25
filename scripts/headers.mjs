/**
 * Cloudflare Pages `_headers`.
 * Matching rules combine. Setting the same header again joins the values with
 * a comma. `! Header-Name` detaches that header before later rules run.
 * A `*` matches across slashes, including the empty string.
 */

export function parseHeaders(text) {
  const rules = [];
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    if (!/^\s/.test(rawLine)) {
      current = { path: rawLine.trim(), headers: [] };
      rules.push(current);
      continue;
    }
    if (!current) throw new Error(`Header line outside a path block: ${rawLine}`);
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("!")) {
      current.headers.push({ detach: trimmed.slice(1).trim() });
      continue;
    }
    const splitAt = trimmed.indexOf(":");
    if (splitAt < 0) throw new Error(`Header line has no colon: ${trimmed}`);
    current.headers.push({
      name: trimmed.slice(0, splitAt).trim(),
      value: trimmed.slice(splitAt + 1).trim(),
    });
  }
  return rules;
}

function patternMatches(pattern, path) {
  const body = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}$`).test(path);
}

function headerKey(name) {
  return name.toLowerCase();
}

/** Effective headers for one request path, in first-seen order. */
export function effectiveHeaders(rules, path) {
  const ordered = [];
  const byName = new Map();
  for (const rule of rules) {
    if (!patternMatches(rule.path, path)) continue;
    for (const entry of rule.headers) {
      if (entry.detach) {
        const key = headerKey(entry.detach);
        const existing = byName.get(key);
        if (!existing) continue;
        ordered.splice(ordered.indexOf(existing), 1);
        byName.delete(key);
        continue;
      }
      const key = headerKey(entry.name);
      const existing = byName.get(key);
      if (existing) {
        existing.name = entry.name;
        existing.value = `${existing.value}, ${entry.value}`;
        continue;
      }
      const created = { name: entry.name, value: entry.value };
      byName.set(key, created);
      ordered.push(created);
    }
  }
  return ordered;
}

export function headerValue(headers, name) {
  const found = headers.filter((header) => header.name.toLowerCase() === name.toLowerCase());
  return found.map((header) => header.value);
}

export function hasCspToken(policy, token) {
  return new RegExp(`(?<![\\w-])${token}(?![\\w-])`).test(policy);
}

const HASH_SOURCE = /^'sha(?:256|384|512)-[A-Za-z0-9+/]+=*'$/;
const ALLOWED_SOURCES = new Set(["'self'", "'none'", "'wasm-unsafe-eval'", "data:", "blob:", "mailto:"]);

/** Split a policy into directives. Values are the source list after the name. */
export function parseCsp(policy) {
  const directives = [];
  for (const part of String(policy).split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    directives.push({ name: tokens[0].toLowerCase(), values: tokens.slice(1) });
  }
  return directives;
}

/**
 * Sources must be a keyword, a hash, or data/blob/mailto.
 * A wildcard, a remote URL, or a host without a scheme is rejected.
 */
export function cspSourceProblems(policy) {
  const problems = [];
  const seen = new Set();
  for (const directive of parseCsp(policy)) {
    if (seen.has(directive.name)) problems.push(`duplicate directive ${directive.name}`);
    seen.add(directive.name);
    for (const value of directive.values) {
      if (value === "'unsafe-inline'" || value === "'unsafe-eval'") {
        problems.push(`${directive.name} uses ${value}`);
        continue;
      }
      if (ALLOWED_SOURCES.has(value) || HASH_SOURCE.test(value)) continue;
      if (value === "*" || value.includes("*")) {
        problems.push(`${directive.name} wildcard ${value}`);
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        problems.push(`${directive.name} remote source ${value}`);
        continue;
      }
      problems.push(`${directive.name} scheme-less host ${value}`);
    }
  }
  return problems;
}

export function cspHashes(policy, directiveName) {
  const directive = parseCsp(policy).find((directive) => directive.name === directiveName);
  return (directive?.values ?? []).filter((value) => HASH_SOURCE.test(value));
}
