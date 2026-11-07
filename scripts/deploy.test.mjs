import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DIST_DIR,
  MISSING_PROJECT_MESSAGE,
  PAGES_PROJECT,
  PRODUCTION_BRANCH,
  deploySteps,
  listedProject,
  main,
  pagesListArgs,
  redact,
  uploadPlan,
} from "./deploy.mjs";

const token = "super-secret-token-value";
const account = "00000000000000000000000000000000";

function projectJson(name = PAGES_PROJECT) {
  return JSON.stringify([
    {
      "Project Name": name,
      "Project Domains": "example.pages.dev",
      "Git Provider": "No",
      "Last Modified": "2026-11-07",
    },
  ]);
}

function runDeploy({
  branch = "main\n",
  porcelain = "",
  listStdout = projectJson(),
  listStatus = 0,
  listStderr = "",
  failAt = 0,
  exists = true,
  env = envWithSecret(),
  log = silentLog(),
} = {}) {
  const calls = [];
  let nonGit = 0;
  const run = (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (command === "git" && args[0] === "rev-parse") {
      return { status: 0, stdout: branch, stderr: "" };
    }
    if (command === "git" && args[0] === "status") {
      return { status: 0, stdout: porcelain, stderr: "" };
    }
    nonGit += 1;
    if (args.includes("list")) {
      return { status: listStatus, stdout: listStdout, stderr: listStderr };
    }
    if (failAt && nonGit === failAt) return { status: 9, stdout: "", stderr: "" };
    return { status: 0, stdout: "", stderr: "" };
  };
  const code = main({ cwd: "/repo", run, exists: () => exists, log, env });
  return { code, calls };
}

function wranglerCalls(calls) {
  return calls.filter((call) => call.args.some((arg) => String(arg).includes("wrangler.js")));
}

function forbidden(calls) {
  const rendered = JSON.stringify(calls.map((call) => call.args));
  assert.equal(rendered.includes(token), false);
  assert.equal(rendered.includes("--force"), false);
  assert.equal(calls.some((call) => call.args[1] === "deploy"), false);
  assert.equal(calls.some((call) => call.args.includes("create")), false);
}

test("build failure does not upload", () => {
  const { code, calls } = runDeploy({ failAt: 2 });
  assert.equal(code, 9);
  assert.equal(wranglerCalls(calls).length, 1);
  assert.deepEqual(wranglerCalls(calls)[0].args.slice(1), pagesListArgs());
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
  forbidden(calls);
});

test("copy check failure does not upload", () => {
  const { code, calls } = runDeploy({ failAt: 3 });
  assert.equal(code, 9);
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
  assert.equal(calls.some((call) => String(call.args.at(-1)).endsWith("check-constraints.mjs")), true);
  forbidden(calls);
});

test("jsonld check failure does not upload", () => {
  const { code, calls } = runDeploy({ failAt: 4 });
  assert.equal(code, 9);
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
  assert.equal(calls.some((call) => String(call.args.at(-1)).endsWith("check-jsonld.mjs")), true);
  forbidden(calls);
});

test("clean main lists the project and then uploads that Pages project", () => {
  const { code, calls } = runDeploy();
  assert.equal(code, 0);
  const uploads = wranglerCalls(calls);
  assert.equal(uploads.length, 2);
  assert.deepEqual(uploads[0].args.slice(1), ["pages", "project", "list", "--json"]);
  assert.deepEqual(uploads[1].args.slice(1), [
    "pages",
    "deploy",
    DIST_DIR,
    "--project-name",
    PAGES_PROJECT,
    "--branch",
    PRODUCTION_BRANCH,
  ]);
  assert.equal(uploads[1].options.stdio[0], "ignore");
  assert.equal(uploads[1].options.env.CLOUDFLARE_API_TOKEN, token);
  assert.equal(uploads[1].options.env.CURSOR_TRACE_ID, "trace");
  assert.equal(uploads[1].options.env.PAGER, "head -n 10000 | cat");
  forbidden(calls);
});

test("another branch is passed through and is not rewritten to main", () => {
  const { code, calls } = runDeploy({
    branch: "feature/docs\n",
    porcelain: " M src/pages/index.astro\n",
  });
  assert.equal(code, 0);
  const upload = wranglerCalls(calls).at(-1);
  assert.equal(upload.args.at(-1), "feature/docs");
  assert.equal(upload.args.includes(PRODUCTION_BRANCH), false);
  forbidden(calls);
});

test("a missing Pages project does not build or deploy", () => {
  const errors = [];
  const { code, calls } = runDeploy({
    listStdout: "[]",
    log: { log() {}, error(message) { errors.push(message); } },
  });
  assert.equal(code, 1);
  assert.equal(wranglerCalls(calls).length, 1);
  assert.deepEqual(wranglerCalls(calls)[0].args.slice(1), pagesListArgs());
  assert.equal(calls.some((call) => call.args.includes("build")), false);
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
  assert.equal(errors.join("\n").includes(MISSING_PROJECT_MESSAGE), true);
  assert.equal(errors.join("\n").includes(token), false);
  forbidden(calls);
});

test("an agent-looking environment still does not deploy when the project is missing", () => {
  const { code, calls } = runDeploy({ listStdout: projectJson("someone-else") });
  assert.equal(code, 1);
  assert.equal(listedProject(projectJson("someone-else")).reason, "missing");
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
  assert.equal(calls.some((call) => call.args.includes("create")), false);
  forbidden(calls);
});

test("a failed or unreadable project list does not deploy and does not print a token", () => {
  const errors = [];
  const failed = runDeploy({
    listStatus: 1,
    listStderr: `denied ${token}`,
    log: { log() {}, error(message) { errors.push(message); } },
  });
  assert.equal(failed.code, 1);
  assert.equal(failed.calls.some((call) => call.args.includes("deploy")), false);
  assert.equal(errors.join("\n").includes(token), false);
  assert.equal(errors.join("\n").includes("[redacted]"), true);

  const unreadable = runDeploy({ listStdout: "not-json" });
  assert.equal(unreadable.code, 1);
  assert.equal(unreadable.calls.some((call) => call.args.includes("deploy")), false);
  assert.equal(listedProject("not-json").reason, "unreadable");
  forbidden(failed.calls);
  forbidden(unreadable.calls);
});

test("dirty main and detached HEAD do not list or upload", () => {
  const dirty = runDeploy({ porcelain: " M README.md\n" });
  assert.equal(dirty.code, 1);
  assert.equal(wranglerCalls(dirty.calls).length, 0);

  const detached = runDeploy({ branch: "HEAD\n" });
  assert.equal(detached.code, 1);
  assert.equal(wranglerCalls(detached.calls).length, 0);
  assert.equal(uploadPlan({ branch: "HEAD", dirty: false }).upload, false);
});

test("missing local wrangler does not spawn an upload", () => {
  const { code, calls } = runDeploy({ exists: false });
  assert.equal(code, 1);
  assert.equal(calls.some((call) => call.args.includes("deploy")), false);
  assert.equal(calls.some((call) => call.args.includes("list")), false);
});

test("project name and check order stay fixed", () => {
  const plan = uploadPlan({ branch: "main", dirty: false });
  assert.equal(plan.args[plan.args.indexOf("--project-name") + 1], "sdf-landing");
  assert.equal(plan.args.includes("--force"), false);
  assert.deepEqual(
    deploySteps("/repo").map(([, args]) => args.at(-1).split("/").at(-1)),
    ["build", "check-constraints.mjs", "check-jsonld.mjs"],
  );
  assert.equal(redact(`see ${token}`, envWithSecret()).includes(token), false);
});

test("package pins the local wrangler used by the help check", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lock = readFileSync(new URL("../package-lock.json", import.meta.url), "utf8");
  assert.equal(pkg.devDependencies.wrangler, "4.158.0");
  assert.equal(pkg.scripts.deploy, "node scripts/deploy.mjs");
  assert.match(lock, /"node_modules\/wrangler": \{[\s\S]*?"version": "4\.158\.0"/);
  assert.doesNotMatch(pkg.scripts.deploy, /npx/);
  assert.doesNotMatch(readFileSync(new URL("./deploy.mjs", import.meta.url), "utf8"), /--force/);
});

function envWithSecret() {
  return {
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: account,
    PAGES_PROJECT: "some-other-project",
    CURSOR_TRACE_ID: "trace",
    PAGER: "head -n 10000 | cat",
  };
}

function silentLog() {
  return { log() {}, error() {} };
}
