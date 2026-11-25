/**
 * Production audit gate. `npm audit --audit-level=high --omit=dev` fails the
 * build on a high or critical advisory. Low and moderate advisories are named
 * in the log and accepted in the PR; they do not fail this gate.
 *
 * An explicit allowlist (scripts/audit-allowlist.json) is consulted only when
 * that file exists. Each entry needs a ghsa id and a reason. A high advisory
 * that is not listed still fails.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const allowPath = new URL("./audit-allowlist.json", import.meta.url);
const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, "utf8")) : { accepted: [] };
const accepted = new Map();
for (const item of allow.accepted ?? []) {
  if (!item.ghsa || !item.reason) {
    console.error("Each accepted advisory needs a ghsa id and a reason");
    process.exit(1);
  }
  accepted.set(item.ghsa, item.reason);
}

function run(args) {
  return spawnSync("npm", args, { encoding: "utf8", shell: false });
}

const json = run(["audit", "--omit=dev", "--json"]);
let report = {};
try {
  report = JSON.parse(json.stdout || "{}");
} catch {
  process.stderr.write(json.stderr ?? "");
  process.exit(json.status ?? 1);
}

const highs = [];
const lower = [];
for (const [name, info] of Object.entries(report.vulnerabilities ?? {})) {
  const vias = Array.isArray(info.via) ? info.via : [];
  for (const via of vias) {
    if (!via || typeof via !== "object") continue;
    const ghsa = String(via.url ?? "").split("/").filter(Boolean).pop() || String(via.source);
    const item = { name, severity: info.severity, ghsa, title: via.title ?? "" };
    if (info.severity === "high" || info.severity === "critical") highs.push(item);
    else lower.push(item);
  }
}

const unaccepted = highs.filter((item) => !accepted.has(item.ghsa));
if (unaccepted.length) {
  console.error("High or critical production advisories are not allowlisted:");
  for (const item of unaccepted) {
    console.error(`- ${item.severity} ${item.name} ${item.ghsa} ${item.title}`);
  }
  process.exit(1);
}

if (accepted.size === 0) {
  const gate = run(["audit", "--audit-level=high", "--omit=dev"]);
  process.stdout.write(gate.stdout ?? "");
  process.stderr.write(gate.stderr ?? "");
  if (gate.status !== 0) process.exit(gate.status ?? 1);
} else {
  console.log("High audit gate passed with an explicit allowlist:");
  for (const [ghsa, reason] of accepted) console.log(`- ${ghsa}: ${reason}`);
}

if (lower.length) {
  console.log("Accepted below the high gate (documented in the PR):");
  for (const item of lower) console.log(`- ${item.severity} ${item.name} ${item.ghsa} ${item.title}`);
}
