import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Names the Pages upload and the Terraform domain command read from the process
// environment. Anything else in .env is ignored, including PATH and AWS_PROFILE.
export const ENV_FILE_KEYS = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REQUEST_CHECKSUM_CALCULATION",
  "AWS_ENDPOINT_URL_S3",
  "R2_STATE_BUCKET",
];

const ALLOWED = new Set(ENV_FILE_KEYS);

export function parseEnvFile(text) {
  const out = {};
  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const body = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!ALLOWED.has(key)) continue;
    let value = body.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (value !== "") out[key] = value;
  }
  return out;
}

export function mergeEnv(env, fileValues) {
  const next = { ...env };
  for (const [key, value] of Object.entries(fileValues)) {
    if (!next[key]) next[key] = value;
  }
  return next;
}

export function loadRepoEnv(
  env = process.env,
  { cwd = repoRoot, exists = existsSync, readFile = readFileSync } = {},
) {
  const path = join(cwd, ".env");
  if (!exists(path)) return env;
  return mergeEnv(env, parseEnvFile(readFile(path, "utf8")));
}
