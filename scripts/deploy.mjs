import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

// Same project name as infra/cloudflare. The upload does not read Terraform.
export const PAGES_PROJECT = "sdf-landing";
export const PRODUCTION_BRANCH = "main";
export const DIST_DIR = "dist";

// Pages branch names are the same shape the Terraform variable already allows.
const BRANCH_NAME = /^[A-Za-z0-9._/-]+$/;

export function uploadPlan({ branch, dirty }) {
  const name = String(branch ?? "").trim();
  if (name === "" || name === "HEAD") {
    return {
      upload: false,
      message:
        "This checkout is not on a branch, so nothing was uploaded. Check out main for production, or another branch for a preview, then run npm run deploy.",
    };
  }
  if (!BRANCH_NAME.test(name)) {
    return {
      upload: false,
      message: `Branch ${name} is not a Pages branch name, so nothing was uploaded.`,
    };
  }
  if (name === PRODUCTION_BRANCH && dirty) {
    return {
      upload: false,
      message:
        "main has uncommitted changes. A production upload would ship those files, so nothing was uploaded. Commit or stash, then run npm run deploy.",
    };
  }
  return {
    upload: true,
    branch: name,
    production: name === PRODUCTION_BRANCH,
    args: [
      "pages",
      "deploy",
      DIST_DIR,
      "--project-name",
      PAGES_PROJECT,
      "--branch",
      name,
    ],
  };
}

// Documented read-only command. It does not create a project.
export function pagesListArgs() {
  return ["pages", "project", "list", "--json"];
}

export function listedProject(stdout, projectName = PAGES_PROJECT) {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout).trim());
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: "unreadable" };
  const found = parsed.some((row) => row && row["Project Name"] === projectName);
  return found ? { ok: true } : { ok: false, reason: "missing" };
}

export const MISSING_PROJECT_MESSAGE = [
  `Cloudflare Pages project "${PAGES_PROJECT}" is not in this account, so nothing was built or uploaded.`,
  `Create it yourself in a normal terminal, not from an agent session: npm exec wrangler -- pages project create ${PAGES_PROJECT} --production-branch ${PRODUCTION_BRANCH}`,
  "Wrangler 4.158.0 keeps that command on Pages in a normal terminal. In an agent session, the same command can create a Worker when the Pages project is missing.",
  "The dashboard can also create the Direct Upload project: Workers & Pages → Create application → Get started → Drag and drop your files, with this project name. The dashboard does not offer a production-branch control for Direct Upload.",
  "npm run deploy does not create a project.",
].join("\n");

export function redact(text, env = {}) {
  let out = String(text ?? "");
  for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY"]) {
    const secret = env[key];
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

export function deploySteps(cwd) {
  return [
    [process.execPath, [join(cwd, "node_modules/astro/bin/astro.mjs"), "build"]],
    [process.execPath, [join(cwd, "scripts/check-constraints.mjs")]],
    [process.execPath, [join(cwd, "scripts/check-jsonld.mjs")]],
  ];
}

export function spawnCommand(command, args, options = {}) {
  const capture = options.encoding === "utf8";
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    shell: false,
    stdio: capture ? ["ignore", "pipe", "pipe"] : (options.stdio ?? "inherit"),
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function main({
  cwd = root,
  env = process.env,
  run = spawnCommand,
  exists = existsSync,
  log = console,
} = {}) {
  const branchResult = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd,
    encoding: "utf8",
  });
  if (branchResult.status !== 0) {
    log.error("npm run deploy could not read the git branch, so nothing was uploaded.");
    return branchResult.status || 1;
  }
  const statusResult = run("git", ["status", "--porcelain"], {
    cwd,
    encoding: "utf8",
  });
  if (statusResult.status !== 0) {
    log.error("npm run deploy could not read git status, so nothing was uploaded.");
    return statusResult.status || 1;
  }

  const plan = uploadPlan({
    branch: branchResult.stdout,
    dirty: statusResult.stdout.length > 0,
  });
  if (!plan.upload) {
    log.error(plan.message);
    return 1;
  }

  const wrangler = join(cwd, "node_modules/wrangler/bin/wrangler.js");
  if (!exists(wrangler)) {
    log.error("Local Wrangler is not installed. Run npm install. Nothing was uploaded.");
    return 1;
  }

  // Read-only. A missing Pages project must not reach `pages deploy` or `pages project create`.
  const listed = run(process.execPath, [wrangler, ...pagesListArgs()], {
    cwd,
    env,
    encoding: "utf8",
  });
  if (listed.status !== 0) {
    log.error("Could not list Cloudflare Pages projects, so nothing was built or uploaded.");
    const detail = redact(listed.stderr, env).trim();
    if (detail) log.error(detail);
    return listed.status || 1;
  }
  const found = listedProject(listed.stdout);
  if (!found.ok) {
    log.error(
      found.reason === "missing"
        ? MISSING_PROJECT_MESSAGE
        : "The Pages project list was not readable, so nothing was built or uploaded.",
    );
    return 1;
  }

  for (const [command, args] of deploySteps(cwd)) {
    const result = run(command, args, { cwd, env });
    if (result.status !== 0) return result.status || 1;
  }

  const target = plan.production ? "production" : "a preview";
  log.log(
    `Uploading ${DIST_DIR}/ to the existing Cloudflare Pages project ${PAGES_PROJECT} on branch ${plan.branch} (${target}).`,
  );

  // stdin is not a TTY, so Wrangler cannot prompt to create a project or pick an account.
  const uploaded = run(process.execPath, [wrangler, ...plan.args], {
    cwd,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  return uploaded.status === 0 ? 0 : uploaded.status || 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exit(main());
}
