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

  for (const [command, args] of deploySteps(cwd)) {
    const result = run(command, args, { cwd, env });
    if (result.status !== 0) return result.status || 1;
  }

  const wrangler = join(cwd, "node_modules/wrangler/bin/wrangler.js");
  if (!exists(wrangler)) {
    log.error("Local Wrangler is not installed. Run npm install. Nothing was uploaded.");
    return 1;
  }

  const target = plan.production ? "production" : "a preview";
  log.log(
    `Uploading ${DIST_DIR}/ to Cloudflare Pages project ${PAGES_PROJECT} on branch ${plan.branch} (${target}).`,
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
