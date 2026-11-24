import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadRepoEnv, mergeEnv, parseEnvFile } from "./env-file.mjs";

const token = "super-secret-token-value";

test("parser keeps the allowlist and drops other names", () => {
  const parsed = parseEnvFile(`
# comment
export CLOUDFLARE_API_TOKEN="${token}"
CLOUDFLARE_ACCOUNT_ID=
PATH=/tmp/evil
OTHER_SECRET='nope'
not a pair
`);
  assert.deepEqual(parsed, {
    CLOUDFLARE_API_TOKEN: token,
  });
});

test("shell values win and a missing file leaves the environment unchanged", () => {
  const merged = mergeEnv(
    { CLOUDFLARE_API_TOKEN: "from-shell" },
    { CLOUDFLARE_API_TOKEN: "from-file", CLOUDFLARE_ACCOUNT_ID: "from-file-account" },
  );
  assert.equal(merged.CLOUDFLARE_API_TOKEN, "from-shell");
  assert.equal(merged.CLOUDFLARE_ACCOUNT_ID, "from-file-account");

  const env = { CLOUDFLARE_API_TOKEN: token };
  assert.equal(loadRepoEnv(env, { exists: () => false, readFile: () => "" }), env);
});

test("load reads .env from the repo root and does not pass the token on a command line", () => {
  const env = loadRepoEnv(
    {},
    {
      cwd: "/repo",
      exists: (path) => path === "/repo/.env",
      readFile: (path) => {
        assert.equal(path, "/repo/.env");
        return `CLOUDFLARE_API_TOKEN=${token}\n`;
      },
    },
  );
  assert.equal(env.CLOUDFLARE_API_TOKEN, token);

  const deploy = readFileSync(new URL("./deploy.mjs", import.meta.url), "utf8");
  assert.equal(deploy.includes("main({ env: loadRepoEnv() })"), true);
  assert.equal(deploy.includes("CLOUDFLARE_API_TOKEN="), false);
});
