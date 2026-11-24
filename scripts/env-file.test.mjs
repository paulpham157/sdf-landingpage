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
AWS_PROFILE=default
AWS_SECRET_ACCESS_KEY='r2-secret'
AWS_REQUEST_CHECKSUM_CALCULATION=when_required
AWS_ENDPOINT_URL_S3=https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com
not a pair
`);
  assert.deepEqual(parsed, {
    CLOUDFLARE_API_TOKEN: token,
    AWS_SECRET_ACCESS_KEY: "r2-secret",
    AWS_REQUEST_CHECKSUM_CALCULATION: "when_required",
    AWS_ENDPOINT_URL_S3: "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com",
  });
});

test("shell values win and a missing file leaves the environment unchanged", () => {
  const merged = mergeEnv(
    { CLOUDFLARE_API_TOKEN: "from-shell" },
    { CLOUDFLARE_API_TOKEN: "from-file", AWS_ACCESS_KEY_ID: "r2-key" },
  );
  assert.equal(merged.CLOUDFLARE_API_TOKEN, "from-shell");
  assert.equal(merged.AWS_ACCESS_KEY_ID, "r2-key");

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

  const attach = readFileSync(new URL("./attach-domain.mjs", import.meta.url), "utf8");
  const deploy = readFileSync(new URL("./deploy.mjs", import.meta.url), "utf8");
  assert.equal(attach.includes("main({ env: loadRepoEnv() })"), true);
  assert.equal(deploy.includes("main({ env: loadRepoEnv() })"), true);
  assert.equal(attach.includes(`-var=CLOUDFLARE_API_TOKEN`), false);
});
