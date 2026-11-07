import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DIST_DIR,
  PAGES_PROJECT,
  PRODUCTION_BRANCH,
  deploySteps,
  main,
  uploadPlan,
} from "./deploy.mjs";

const token = "super-secret-token-value";
const account = "00000000000000000000000000000000";

function gitRun(branch, porcelain, { branchStatus = 0, statusStatus = 0 } = {}) {
  const calls = [];
  const run = (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (command === "git" && args[0] === "rev-parse") {
      return { status: branchStatus, stdout: branch, stderr: "" };
    }
    if (command === "git" && args[0] === "status") {
      return { status: statusStatus, stdout: porcelain, stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  return { calls, run };
}

function nonGit(calls) {
  return calls.filter((call) => call.command !== "git");
}

test("build failure does not check or upload", () => {
  const { calls, run } = gitRun("main\n", "");
  const wrapped = (command, args, options) => {
    const result = run(command, args, options);
    if (command !== "git" && nonGit(calls).length === 1) return { status: 7, stdout: "", stderr: "" };
    return result;
  };
  const code = main({
    cwd: "/repo",
    run: wrapped,
    exists: () => true,
    log: silentLog(),
    env: envWithSecret(),
  });
  assert.equal(code, 7);
  assert.equal(nonGit(calls).length, 1);
  assert.equal(nonGit(calls)[0].args.at(-1), "build");
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
});

test("copy check failure does not upload", () => {
  const code = failAtStep(2);
  assert.equal(code.status, 3);
  assert.equal(code.nonGit.length, 2);
  assert.equal(code.nonGit[1].args.at(-1).endsWith("check-constraints.mjs"), true);
  assert.equal(code.calls.some((call) => call.args.includes("deploy")), false);
});

test("jsonld check failure does not upload", () => {
  const code = failAtStep(3);
  assert.equal(code.status, 4);
  assert.equal(code.nonGit.length, 3);
  assert.equal(code.nonGit[2].args.at(-1).endsWith("check-jsonld.mjs"), true);
  assert.equal(code.calls.some((call) => call.args.includes("deploy")), false);
});

test("clean main uploads dist to the named project on main", () => {
  const { calls, run } = gitRun("main\n", "");
  const code = main({
    cwd: "/repo",
    run,
    exists: () => true,
    log: silentLog(),
    env: envWithSecret(),
  });
  assert.equal(code, 0);
  const upload = calls.at(-1);
  assert.equal(upload.command, process.execPath);
  assert.deepEqual(upload.args.slice(1), [
    "pages",
    "deploy",
    DIST_DIR,
    "--project-name",
    PAGES_PROJECT,
    "--branch",
    PRODUCTION_BRANCH,
  ]);
  assert.match(upload.args[0], /\/node_modules\/wrangler\/bin\/wrangler\.js$/);
  assert.equal(upload.options.stdio[0], "ignore");
  assert.equal(upload.options.env.CLOUDFLARE_API_TOKEN, token);
  const rendered = JSON.stringify(upload.args);
  assert.equal(rendered.includes(token), false);
  assert.equal(rendered.includes(account), false);
  assert.equal(rendered.includes("commit-dirty"), false);
  assert.equal(rendered.includes("create"), false);
  assert.equal(rendered.includes("npx"), false);
});

test("another branch is passed through and is not rewritten to main", () => {
  const { calls, run } = gitRun("feature/docs\n", " M src/pages/index.astro\n");
  const code = main({
    cwd: "/repo",
    run,
    exists: () => true,
    log: silentLog(),
    env: envWithSecret(),
  });
  assert.equal(code, 0);
  const upload = calls.at(-1);
  assert.equal(upload.args.at(-1), "feature/docs");
  assert.equal(upload.args.includes(PRODUCTION_BRANCH), false);
});

test("dirty main does not build or upload", () => {
  const { calls, run } = gitRun("main\n", " M README.md\n");
  const code = main({
    cwd: "/repo",
    run,
    exists: () => true,
    log: silentLog(),
    env: envWithSecret(),
  });
  assert.equal(code, 1);
  assert.equal(nonGit(calls).length, 0);
});

test("detached HEAD does not upload", () => {
  const { calls, run } = gitRun("HEAD\n", "");
  const code = main({
    cwd: "/repo",
    run,
    exists: () => true,
    log: silentLog(),
    env: {},
  });
  assert.equal(code, 1);
  assert.equal(nonGit(calls).length, 0);
  assert.equal(uploadPlan({ branch: "HEAD", dirty: false }).upload, false);
});

test("missing local wrangler does not spawn an upload", () => {
  const { calls, run } = gitRun("main\n", "");
  const code = main({
    cwd: "/repo",
    run,
    exists: () => false,
    log: silentLog(),
    env: envWithSecret(),
  });
  assert.equal(code, 1);
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
});

test("an environment project name cannot retarget the upload", () => {
  const plan = uploadPlan({ branch: "main", dirty: false });
  assert.equal(plan.args[plan.args.indexOf("--project-name") + 1], "sdf-landing");
  assert.deepEqual(
    deploySteps("/repo").map(([, args]) => args.at(-1).split("/").at(-1)),
    ["build", "check-constraints.mjs", "check-jsonld.mjs"],
  );
});

test("package pins the local wrangler used by the help check", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lock = readFileSync(new URL("../package-lock.json", import.meta.url), "utf8");
  assert.equal(pkg.devDependencies.wrangler, "4.158.0");
  assert.equal(pkg.scripts.deploy, "node scripts/deploy.mjs");
  assert.match(lock, /"node_modules\/wrangler": \{[\s\S]*?"version": "4\.158\.0"/);
  assert.doesNotMatch(pkg.scripts.deploy, /npx/);
});

function failAtStep(step) {
  const { calls, run } = gitRun("main\n", "");
  const wrapped = (command, args, options) => {
    const result = run(command, args, options);
    if (command !== "git" && nonGit(calls).length === step) {
      return { status: step + 1, stdout: "", stderr: "" };
    }
    return result;
  };
  const status = main({
    cwd: "/repo",
    run: wrapped,
    exists: () => true,
    log: silentLog(),
    env: envWithSecret(),
  });
  return { status, calls, nonGit: nonGit(calls) };
}

function envWithSecret() {
  return {
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: account,
    PAGES_PROJECT: "some-other-project",
  };
}

function silentLog() {
  return { log() {}, error() {} };
}
