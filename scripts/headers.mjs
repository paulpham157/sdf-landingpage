/**
 * Cloudflare Pages `_headers` parser.
 * Later matching rules override earlier ones. `! Header-Name` detaches a header.
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
        existing.value = entry.value;
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
