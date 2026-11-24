import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { loadRepoEnv } from "./env-file.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const infraDir = fileURLToPath(new URL("../infra/cloudflare", import.meta.url));

export const PAGES_PROJECT_ADDRESS = "cloudflare_pages_project.site";
export const ALLOWED_CREATES = new Set([
  "cloudflare_pages_domain.apex[0]",
  "cloudflare_pages_domain.www[0]",
]);
export const VAR_OVERRIDES = [
  "-var=enable_custom_domain=true",
  "-var=attach_www=true",
  "-var=manage_dns=false",
];
export const PLACEHOLDER_ACCOUNT = "0".repeat(32);

const SECRET_ENV = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
];

export function redact(text, env = {}) {
  let out = String(text ?? "");
  for (const key of SECRET_ENV) {
    const secret = env[key];
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

export function accountIdValue(value) {
  const id = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) return { ok: false, reason: "missing" };
  if (id === PLACEHOLDER_ACCOUNT) return { ok: false, reason: "placeholder" };
  return { ok: true, accountId: id };
}

export function accountIdFromTfvars(text) {
  const match = String(text).match(/^\s*account_id\s*=\s*"([^"]*)"/m);
  if (!match) return { ok: false, reason: "missing" };
  return accountIdValue(match[1]);
}

export function projectNameFromTfvars(text) {
  const match = String(text).match(/^\s*project_name\s*=\s*"([a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?)"/m);
  return match ? match[1] : "sdf-landing";
}

export function terraformVersionOk(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout));
  } catch {
    return false;
  }
  const match = /^(\d+)\.(\d+)\./.exec(parsed?.terraform_version ?? "");
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 1 || (major === 1 && minor >= 11);
}

const R2_ENDPOINT = /^https:\/\/[0-9a-f]{32}(?:\.[a-z0-9-]+)?\.r2\.cloudflarestorage\.com$/;

export function r2Endpoint(value) {
  const endpoint = String(value ?? "").trim().replace(/\/+$/, "");
  if (endpoint === "") return { ok: true, endpoint: "" };
  if (!R2_ENDPOINT.test(endpoint)) return { ok: false, endpoint: "" };
  return { ok: true, endpoint };
}

export const STATE_KEY = "sdf-landingpage/cloudflare/terraform.tfstate";
export const PROVIDER_DIR = ".terraform/providers/registry.terraform.io/cloudflare/cloudflare";

const R2_BUCKET = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

export function r2Bucket(value) {
  const bucket = String(value ?? "").trim();
  if (bucket === "") return { ok: true, bucket: "" };
  if (!R2_BUCKET.test(bucket)) return { ok: false, bucket: "" };
  return { ok: true, bucket };
}

export function backendConfigHcl({ bucket = "", endpoint = "", key = STATE_KEY } = {}) {
  const lines = [];
  if (bucket) {
    lines.push(`bucket = ${JSON.stringify(bucket)}`);
    lines.push(`key = ${JSON.stringify(key)}`);
  }
  if (endpoint) {
    lines.push("endpoints = {");
    lines.push(`  s3 = ${JSON.stringify(endpoint)}`);
    lines.push("}");
  }
  return `${lines.join("\n")}\n`;
}

export function endpointBackendHcl(endpoint) {
  return backendConfigHcl({ endpoint });
}

export function projectInState(stdout) {
  return String(stdout)
    .split("\n")
    .some((line) => line.trim() === PAGES_PROJECT_ADDRESS);
}

// terraform state list exits 1 with this text when the remote state has no resources.
export function stateListEmpty(status, stderr) {
  return status !== 0 && String(stderr).includes("No state file was found");
}

export function reviewPlan(plan) {
  const changes = plan?.resource_changes;
  if (!Array.isArray(changes)) return { ok: false, reason: "unreadable", creates: [], blocked: [] };

  const creates = [];
  const blocked = [];
  for (const change of changes) {
    const address = String(change?.address ?? "");
    const type = String(change?.type ?? "");
    const actions = Array.isArray(change?.change?.actions) ? change.change.actions : [];
    if (type === "cloudflare_dns_record" || address.startsWith("cloudflare_dns_record.")) {
      blocked.push({ address, actions, reason: "dns" });
      continue;
    }
    if (actions.length === 1 && actions[0] === "no-op") continue;
    if (actions.length === 1 && actions[0] === "create" && ALLOWED_CREATES.has(address)) {
      creates.push(address);
      continue;
    }
    blocked.push({ address, actions, reason: "not-domain-create" });
  }

  if (blocked.length > 0) return { ok: false, reason: "rejected", creates, blocked };
  return { ok: true, reason: "ok", creates, blocked };
}

export function formatBlocked(blocked) {
  return blocked
    .map((row) => `${row.address || "(unknown)"} [${row.actions.join("+") || "unknown"}]`)
    .join("\n");
}

function spawnCommand(command, args, options = {}) {
  const capture = options.encoding === "utf8";
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    shell: false,
    stdio: capture ? ["ignore", "pipe", "pipe"] : (options.stdio ?? "inherit"),
  });
  if (result.error) {
    return { status: 1, stdout: "", stderr: result.error.message };
  }
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function fail(log, env, message, detail = "") {
  log.error(redact(message, env));
  const extra = redact(detail, env).trim();
  if (extra) log.error(extra);
  return 1;
}

export function main({
  cwd = infraDir,
  env = process.env,
  run = spawnCommand,
  exists = existsSync,
  readFile = readFileSync,
  log = console,
  args = process.argv.slice(2),
  planPath = join(tmpdir(), `sdf-attach-domain-${process.pid}.tfplan`),
  endpointPath = join(tmpdir(), `sdf-r2-endpoint-${process.pid}.hcl`),
  remove = unlinkSync,
  writeFile = writeFileSync,
} = {}) {
  const unknown = args.filter((arg) => arg !== "--yes");
  if (unknown.length > 0) {
    return fail(log, env, `Unknown argument: ${unknown.join(" ")}. The only flag is --yes.`);
  }
  const apply = args.includes("--yes");

  if (!env.CLOUDFLARE_API_TOKEN) {
    return fail(
      log,
      env,
      "CLOUDFLARE_API_TOKEN is not set, so no domain was attached. Create an account token with Pages Edit and export it in this shell.",
    );
  }

  const tfvarsPath = join(cwd, "terraform.tfvars");
  let account;
  let projectName = "sdf-landing";
  if (!exists(tfvarsPath)) {
    account = accountIdValue(env.CLOUDFLARE_ACCOUNT_ID);
    if (!account.ok) {
      return fail(
        log,
        env,
        "CLOUDFLARE_ACCOUNT_ID in .env must be the 32 character hex Cloudflare account id. terraform.tfvars is optional when that variable is set.",
      );
    }
  } else {
    let tfvars;
    try {
      tfvars = readFile(tfvarsPath, "utf8");
    } catch (error) {
      return fail(log, env, "Could not read terraform.tfvars, so no domain was attached.", error.message);
    }
    account = accountIdFromTfvars(tfvars);
    if (!account.ok) {
      const why =
        account.reason === "placeholder"
          ? "terraform.tfvars still has the all-zero account id, so no domain was attached."
          : "terraform.tfvars has no 32-character lowercase hex account_id, so no domain was attached.";
      return fail(log, env, why);
    }
    projectName = projectNameFromTfvars(tfvars);
  }
  const runEnv = { ...env, TF_VAR_account_id: account.accountId };

  const endpoint = r2Endpoint(env.AWS_ENDPOINT_URL_S3);
  if (!endpoint.ok) {
    return fail(
      log,
      env,
      "AWS_ENDPOINT_URL_S3 must be the https R2 S3 API host from the bucket page, such as https://<account_id>.r2.cloudflarestorage.com. Nothing was attached.",
    );
  }
  const bucket = r2Bucket(env.R2_STATE_BUCKET);
  if (!bucket.ok) {
    return fail(
      log,
      env,
      "R2_STATE_BUCKET in .env must be the private R2 bucket name: lowercase letters, digits, and hyphens. Nothing was attached.",
    );
  }

  const version = run("terraform", ["version", "-json"], { cwd, env: runEnv, encoding: "utf8" });
  let reported = "";
  try {
    reported = JSON.parse(String(version.stdout))?.terraform_version ?? "";
  } catch {
    reported = "";
  }
  if (version.status !== 0 || !terraformVersionOk(version.stdout)) {
    const found = reported || version.stderr.trim() || "no Terraform binary";
    return fail(
      log,
      env,
      `Terraform 1.11 or newer is required, so no domain was attached. Found: ${found}.`,
    );
  }

  const backendHcl = join(cwd, "backend.hcl");
  const hasBackendFile = exists(backendHcl);
  // A failed init still leaves .terraform with the backend config and no provider.
  // state list then stops before it reads R2. Init again without -reconfigure.
  const needsInit = !exists(join(cwd, ".terraform")) || !exists(join(cwd, PROVIDER_DIR));
  if (needsInit) {
    if (!hasBackendFile && !bucket.bucket) {
      return fail(
        log,
        env,
        "R2_STATE_BUCKET is not set in .env, so no domain was attached. Put the private R2 bucket name there. backend.hcl is not required.",
      );
    }
    if (!hasBackendFile && !endpoint.endpoint) {
      return fail(
        log,
        env,
        "AWS_ENDPOINT_URL_S3 is not set in .env, so no domain was attached. Paste the S3 API host from the R2 bucket page.",
      );
    }
    const initArgs = ["init", "-input=false"];
    if (hasBackendFile) initArgs.splice(1, 0, "-backend-config=backend.hcl");
    const generated = backendConfigHcl({
      bucket: bucket.bucket,
      endpoint: endpoint.endpoint,
    });
    const writeGenerated = Boolean(bucket.bucket || endpoint.endpoint);
    if (writeGenerated) {
      writeFile(endpointPath, generated);
      initArgs.splice(hasBackendFile ? 2 : 1, 0, `-backend-config=${endpointPath}`);
    }
    try {
      const init = run("terraform", initArgs, { cwd, env: runEnv, encoding: "utf8" });
      if (init.status !== 0) {
        return fail(log, env, "terraform init failed, so no domain was attached.", init.stderr);
      }
    } finally {
      if (writeGenerated) {
        try {
          remove(endpointPath);
        } catch (error) {
          if (error?.code !== "ENOENT") {
            log.error(redact(`Could not remove the endpoint config: ${error.message}`, env));
          }
        }
      }
    }
  }

  const listed = run("terraform", ["state", "list"], { cwd, env: runEnv, encoding: "utf8" });
  if (listed.status !== 0 && !stateListEmpty(listed.status, listed.stderr)) {
    return fail(log, env, "Could not read Terraform state, so no domain was attached.", listed.stderr);
  }
  if (listed.status !== 0 || !projectInState(listed.stdout)) {
    return fail(
      log,
      env,
      [
        "The Pages project is not in Terraform state, so no domain was attached.",
        "Import the existing project, apply a plan that only adds the source-mode sentinel, then run npm run attach-domain.",
        `terraform import ${PAGES_PROJECT_ADDRESS} '${account.accountId}/${projectName}'`,
        "This command does not import and does not create the Pages project.",
      ].join("\n"),
    );
  }

  const planned = run(
    "terraform",
    ["plan", "-input=false", "-detailed-exitcode", `-out=${planPath}`, ...VAR_OVERRIDES],
    { cwd, env: runEnv, encoding: "utf8" },
  );
  try {
    if (planned.status !== 0 && planned.status !== 2) {
      return fail(log, env, "terraform plan failed, so no domain was attached.", planned.stderr);
    }

    const shown = run("terraform", ["show", "-json", planPath], { cwd, env: runEnv, encoding: "utf8" });
    if (shown.status !== 0) {
      return fail(log, env, "Could not read the Terraform plan, so no domain was attached.", shown.stderr);
    }

    let parsed;
    try {
      parsed = JSON.parse(shown.stdout);
    } catch {
      return fail(log, env, "The Terraform plan was not JSON, so no domain was attached.");
    }

    const review = reviewPlan(parsed);
    if (!review.ok) {
      const detail =
        review.reason === "unreadable"
          ? "The plan has no resource_changes array."
          : formatBlocked(review.blocked);
      return fail(
        log,
        env,
        "The plan is not limited to creating Pages custom domains, so nothing was applied. DNS, project settings, and destroys stay untouched.",
        detail,
      );
    }

    if (review.creates.length === 0) {
      log.log("Pages custom domains are already attached. Nothing to apply. DNS was not changed.");
      return 0;
    }

    const lines = review.creates.map((address) => `- ${address}`).join("\n");
    if (!apply) {
      log.log(
        `Plan would create:\n${lines}\nDNS is unchanged. Re-run with --yes to apply. Nothing was applied.`,
      );
      return 0;
    }

    log.log(`Applying Pages custom domains only:\n${lines}`);
    const applied = run("terraform", ["apply", "-input=false", planPath], {
      cwd,
      env: runEnv,
      encoding: "utf8",
    });
    if (applied.status !== 0) {
      return fail(log, env, "terraform apply failed. DNS was not part of this plan.", applied.stderr);
    }
    log.log("Attached Pages custom domains. DNS was not changed. www to apex redirect was not created.");
    return 0;
  } finally {
    try {
      remove(planPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        log.error(redact(`Could not remove the plan file: ${error.message}`, env));
      }
    }
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exit(main({ env: loadRepoEnv() }));
}
