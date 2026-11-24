import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ALLOWED_CREATES,
  PAGES_PROJECT_ADDRESS,
  PLACEHOLDER_ACCOUNT,
  PROVIDER_DIR,
  VAR_OVERRIDES,
  accountIdFromTfvars,
  accountIdValue,
  main,
  projectInState,
  stateListEmpty,
  projectNameFromTfvars,
  r2Bucket,
  r2Endpoint,
  endpointBackendHcl,
  redact,
  reviewPlan,
  terraformVersionOk,
} from "./attach-domain.mjs";

const token = "super-secret-token-value";
const account = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const tfvars = `account_id = "${account}"\nproject_name = "sdf-landing"\n`;
const planPath = "/tmp/sdf-attach-domain-test.tfplan";
const endpointPath = "/tmp/sdf-r2-endpoint-test.hcl";
const r2Host = `https://${account}.r2.cloudflarestorage.com`;

function change(address, actions, type = address.split(".")[0]) {
  return { address, type, change: { actions } };
}

function domainPlan() {
  return {
    resource_changes: [
      change("cloudflare_pages_project.site", ["no-op"], "cloudflare_pages_project"),
      change("terraform_data.pages_source_mode", ["no-op"], "terraform_data"),
      change("cloudflare_pages_domain.apex[0]", ["create"], "cloudflare_pages_domain"),
      change("cloudflare_pages_domain.www[0]", ["create"], "cloudflare_pages_domain"),
    ],
  };
}

function runAttach({
  args = [],
  env = envWithSecret(),
  tfvarsText = tfvars,
  tfvarsExists = true,
  initialized = true,
  providersInstalled = true,
  backendHcl = false,
  version = "1.17.1",
  versionStatus = 0,
  state = `${PAGES_PROJECT_ADDRESS}\n`,
  stateStatus = 0,
  stateStderr = "",
  planStatus = 2,
  planStderr = "",
  showStatus = 0,
  showStdout = JSON.stringify(domainPlan()),
  applyStatus = 0,
  applyStderr = "",
  readError = null,
} = {}) {
  const calls = [];
  const removed = [];
  const lines = [];
  const errors = [];
  const log = {
    log(message) {
      lines.push(String(message));
    },
    error(message) {
      errors.push(String(message));
    },
  };
  const run = (command, commandArgs, options) => {
    calls.push({
      command,
      args: commandArgs,
      accountId: options?.env?.TF_VAR_account_id,
    });
    if (command === "terraform" && commandArgs[0] === "version") {
      return {
        status: versionStatus,
        stdout: JSON.stringify({ terraform_version: version }),
        stderr: "",
      };
    }
    if (commandArgs[0] === "init") return { status: 0, stdout: "", stderr: "" };
    if (commandArgs[0] === "state") return { status: stateStatus, stdout: state, stderr: stateStderr };
    if (commandArgs[0] === "plan") return { status: planStatus, stdout: "", stderr: planStderr };
    if (commandArgs[0] === "show") return { status: showStatus, stdout: showStdout, stderr: "" };
    if (commandArgs[0] === "apply") return { status: applyStatus, stdout: "", stderr: applyStderr };
    return { status: 1, stdout: "", stderr: "unexpected" };
  };
  const exists = (path) => {
    if (path.endsWith("terraform.tfvars")) return tfvarsExists;
    if (path.endsWith(".terraform")) return initialized;
    if (path.endsWith(PROVIDER_DIR)) return initialized && providersInstalled;
    if (path.endsWith("backend.hcl")) return backendHcl;
    return false;
  };
  const readFile = () => {
    if (readError) throw readError;
    return tfvarsText;
  };
  const written = [];
  const code = main({
    cwd: "/repo/infra/cloudflare",
    env,
    run,
    exists,
    readFile,
    log,
    args,
    planPath,
    endpointPath,
    remove(path) {
      removed.push(path);
    },
    writeFile(path, contents) {
      written.push({ path, contents });
    },
  });
  return { code, calls, removed, lines, errors, written };
}

function terraformCalls(calls, name) {
  return calls.filter((call) => call.command === "terraform" && call.args[0] === name);
}

function envWithSecret() {
  return { CLOUDFLARE_API_TOKEN: token, AWS_SECRET_ACCESS_KEY: "aws-secret-value" };
}

test("review allows domain creates and rejects dns, replace, and other creates", () => {
  const allowed = reviewPlan(domainPlan());
  assert.equal(allowed.ok, true);
  assert.deepEqual(allowed.creates, [...ALLOWED_CREATES]);

  const dns = reviewPlan({
    resource_changes: [
      change("cloudflare_dns_record.apex[0]", ["create"], "cloudflare_dns_record"),
    ],
  });
  assert.equal(dns.ok, false);
  assert.equal(dns.blocked[0].reason, "dns");

  const idleDns = reviewPlan({
    resource_changes: [
      change("cloudflare_dns_record.apex[0]", ["no-op"], "cloudflare_dns_record"),
    ],
  });
  assert.equal(idleDns.ok, false);

  const replaced = reviewPlan({
    resource_changes: [
      change("cloudflare_pages_project.site", ["delete", "create"], "cloudflare_pages_project"),
    ],
  });
  assert.equal(replaced.ok, false);

  const updated = reviewPlan({
    resource_changes: [
      change("cloudflare_pages_project.site", ["update"], "cloudflare_pages_project"),
    ],
  });
  assert.equal(updated.ok, false);

  const sentinel = reviewPlan({
    resource_changes: [change("terraform_data.pages_source_mode", ["create"], "terraform_data")],
  });
  assert.equal(sentinel.ok, false);
  assert.equal(reviewPlan({}).ok, false);
  assert.equal(reviewPlan({ resource_changes: [] }).ok, true);
});

test("tfvars, version, and state parsers stay strict", () => {
  assert.equal(accountIdFromTfvars(tfvars).accountId, account);
  assert.equal(accountIdValue(account.toUpperCase()).accountId, account);
  assert.equal(accountIdValue(PLACEHOLDER_ACCOUNT).reason, "placeholder");
  assert.equal(accountIdFromTfvars(`account_id = "${PLACEHOLDER_ACCOUNT}"`).reason, "placeholder");
  assert.equal(accountIdFromTfvars("account_id = \"not-an-id\"").ok, false);
  assert.equal(projectNameFromTfvars(tfvars), "sdf-landing");
  assert.equal(projectNameFromTfvars('project_name = "Nope"'), "sdf-landing");
  assert.equal(terraformVersionOk(JSON.stringify({ terraform_version: "1.17.1" })), true);
  assert.equal(terraformVersionOk(JSON.stringify({ terraform_version: "1.16.4" })), true);
  assert.equal(terraformVersionOk(JSON.stringify({ terraform_version: "1.10.9" })), false);
  assert.equal(terraformVersionOk("Terraform v1.17.1"), false);
  assert.equal(r2Endpoint("").ok, true);
  assert.equal(r2Endpoint(`https://${account}.eu.r2.cloudflarestorage.com/`).endpoint, `https://${account}.eu.r2.cloudflarestorage.com`);
  assert.equal(r2Endpoint("https://evil.example").ok, false);
  assert.equal(r2Endpoint("http://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com").ok, false);
  assert.equal(projectInState(`data.cloudflare_zone.dns\n${PAGES_PROJECT_ADDRESS}\n`), true);
  assert.equal(projectInState("cloudflare_pages_project.site[0]\n"), false);
  assert.equal(stateListEmpty(1, "\u001b[31mNo state file was found!\n"), true);
  assert.equal(stateListEmpty(1, "403 Forbidden"), false);
  assert.equal(redact(`token ${token}`, envWithSecret()).includes(token), false);
});

test("a missing tfvars file uses CLOUDFLARE_ACCOUNT_ID from the environment", () => {
  const missing = runAttach({ tfvarsExists: false });
  assert.equal(missing.code, 1);
  assert.equal(missing.calls.length, 0);
  assert.equal(missing.errors.join("\n").includes("CLOUDFLARE_ACCOUNT_ID"), true);

  const { code, calls } = runAttach({
    tfvarsExists: false,
    env: { ...envWithSecret(), CLOUDFLARE_ACCOUNT_ID: account.toUpperCase() },
  });
  assert.equal(code, 0);
  assert.equal(terraformCalls(calls, "plan").length, 1);
  assert.equal(terraformCalls(calls, "plan")[0].accountId, account);
  assert.equal(JSON.stringify(calls.map((call) => call.args)).includes(account), false);
});

test("missing token or a placeholder account does not run terraform", () => {
  const missingToken = runAttach({ env: {} });
  assert.equal(missingToken.code, 1);
  assert.equal(missingToken.calls.length, 0);

  const placeholder = runAttach({ tfvarsText: `account_id = "${PLACEHOLDER_ACCOUNT}"\n` });
  assert.equal(placeholder.code, 1);
  assert.equal(placeholder.calls.length, 0);
  assert.equal(placeholder.errors.join("\n").includes(token), false);
});

test("a project missing from state prints import and does not plan or apply", () => {
  const { code, calls, errors, removed } = runAttach({
    state: "",
    stateStatus: 1,
    stateStderr: "No state file was found!\n\nState management commands require a state file.",
  });
  assert.equal(code, 1);
  assert.equal(terraformCalls(calls, "plan").length, 0);
  assert.equal(terraformCalls(calls, "apply").length, 0);
  assert.equal(terraformCalls(calls, "import").length, 0);
  assert.equal(errors.join("\n").includes("Could not read Terraform state"), false);
  assert.equal(errors.join("\n").includes(`terraform import ${PAGES_PROJECT_ADDRESS} '${account}/sdf-landing'`), true);
  assert.equal(removed.length, 0);
  assert.equal(JSON.stringify(calls).includes(token), false);

  const denied = runAttach({ stateStatus: 1, stateStderr: "403 Forbidden" });
  assert.equal(denied.code, 1);
  assert.equal(denied.errors.join("\n").includes("Could not read Terraform state"), true);
  assert.equal(terraformCalls(denied.calls, "plan").length, 0);
});

test("an acceptable plan without --yes does not apply", () => {
  const { code, calls, lines, removed } = runAttach();
  assert.equal(code, 0);
  assert.equal(terraformCalls(calls, "apply").length, 0);
  assert.equal(terraformCalls(calls, "init").length, 0);
  const plan = terraformCalls(calls, "plan")[0];
  assert.deepEqual(plan.args.slice(plan.args.indexOf("-detailed-exitcode") + 1), [
    `-out=${planPath}`,
    ...VAR_OVERRIDES,
  ]);
  assert.equal(plan.args.includes("-var=manage_dns=true"), false);
  assert.equal(lines.join("\n").includes("cloudflare_pages_domain.apex[0]"), true);
  assert.equal(lines.join("\n").includes("Nothing was applied"), true);
  assert.deepEqual(removed, [planPath]);
});

test("--yes applies only after the domain gate passes", () => {
  const { code, calls, lines } = runAttach({ args: ["--yes"] });
  assert.equal(code, 0);
  const apply = terraformCalls(calls, "apply")[0];
  assert.deepEqual(apply.args, ["apply", "-input=false", planPath]);
  assert.equal(lines.join("\n").includes("DNS was not changed"), true);

  const dns = runAttach({
    args: ["--yes"],
    showStdout: JSON.stringify({
      resource_changes: [
        change("cloudflare_dns_record.apex[0]", ["create"], "cloudflare_dns_record"),
      ],
    }),
  });
  assert.equal(dns.code, 1);
  assert.equal(terraformCalls(dns.calls, "apply").length, 0);
  assert.equal(dns.errors.join("\n").includes("cloudflare_dns_record.apex[0]"), true);

  const destroy = runAttach({
    args: ["--yes"],
    showStdout: JSON.stringify({
      resource_changes: [
        change("cloudflare_pages_domain.www[0]", ["delete"], "cloudflare_pages_domain"),
      ],
    }),
  });
  assert.equal(destroy.code, 1);
  assert.equal(terraformCalls(destroy.calls, "apply").length, 0);
});

test("already-attached, failed plan, old terraform, and missing backend do not apply", () => {
  const idle = runAttach({
    args: ["--yes"],
    planStatus: 0,
    showStdout: JSON.stringify({
      resource_changes: [
        change("cloudflare_pages_project.site", ["no-op"], "cloudflare_pages_project"),
      ],
    }),
  });
  assert.equal(idle.code, 0);
  assert.equal(terraformCalls(idle.calls, "apply").length, 0);

  const failed = runAttach({ planStatus: 1, planStderr: `denied ${token}` });
  assert.equal(failed.code, 1);
  assert.equal(terraformCalls(failed.calls, "show").length, 0);
  assert.equal(failed.errors.join("\n").includes(token), false);
  assert.equal(failed.errors.join("\n").includes("[redacted]"), true);

  const old = runAttach({ version: "1.10.0" });
  assert.equal(old.code, 1);
  assert.equal(terraformCalls(old.calls, "state").length, 0);

  const uninitialized = runAttach({ initialized: false, backendHcl: false });
  assert.equal(uninitialized.code, 1);
  assert.equal(terraformCalls(uninitialized.calls, "init").length, 0);
  assert.equal(uninitialized.errors.join("\n").includes("R2_STATE_BUCKET"), true);

  const fromEnv = runAttach({
    initialized: false,
    backendHcl: false,
    env: {
      ...envWithSecret(),
      AWS_ENDPOINT_URL_S3: r2Host,
      R2_STATE_BUCKET: "sdf-landing-state",
    },
  });
  assert.equal(fromEnv.code, 0);
  assert.deepEqual(terraformCalls(fromEnv.calls, "init")[0].args, [
    "init",
    `-backend-config=${endpointPath}`,
    "-input=false",
  ]);
  assert.equal(fromEnv.written[0].contents.includes('"sdf-landing-state"'), true);
  assert.equal(fromEnv.written[0].contents.includes(r2Host), true);
  assert.equal(JSON.stringify(fromEnv.calls.map((call) => call.args)).includes(r2Host), false);

  const missingProvider = runAttach({
    initialized: true,
    providersInstalled: false,
    backendHcl: false,
    env: {
      ...envWithSecret(),
      AWS_ENDPOINT_URL_S3: r2Host,
      R2_STATE_BUCKET: "sdf-landing-state",
    },
  });
  assert.equal(missingProvider.code, 0);
  assert.equal(terraformCalls(missingProvider.calls, "init").length, 1);
  assert.equal(
    terraformCalls(missingProvider.calls, "init")[0].args.includes("-reconfigure"),
    false,
  );

  const init = runAttach({ initialized: false, backendHcl: true });
  assert.equal(init.code, 0);
  assert.deepEqual(terraformCalls(init.calls, "init")[0].args, [
    "init",
    "-backend-config=backend.hcl",
    "-input=false",
  ]);
});

test("an R2 endpoint from the environment overrides backend.hcl on init", () => {
  const bad = runAttach({
    env: { ...envWithSecret(), AWS_ENDPOINT_URL_S3: "https://evil.example" },
  });
  assert.equal(bad.code, 1);
  assert.equal(bad.calls.length, 0);

  const { code, calls, written, removed } = runAttach({
    initialized: false,
    backendHcl: true,
    env: { ...envWithSecret(), AWS_ENDPOINT_URL_S3: r2Host },
  });
  assert.equal(code, 0);
  assert.deepEqual(terraformCalls(calls, "init")[0].args, [
    "init",
    "-backend-config=backend.hcl",
    `-backend-config=${endpointPath}`,
    "-input=false",
  ]);
  assert.deepEqual(written, [{ path: endpointPath, contents: endpointBackendHcl(r2Host) }]);
  assert.equal(removed.includes(endpointPath), true);
  assert.equal(JSON.stringify(calls).includes(r2Host), false);
});

test("package script stays a local node entry and CI tests it", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const workflow = readFileSync(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
  assert.equal(pkg.scripts["attach-domain"], "node scripts/attach-domain.mjs");
  assert.equal(pkg.scripts["test:attach-domain"], "node --test scripts/attach-domain.test.mjs");
  assert.equal(workflow.includes("npm run test:attach-domain"), true);
  assert.equal(pkg.scripts.deploy.includes("attach-domain"), false);
  const source = readFileSync(new URL("./attach-domain.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("wrangler"), false);
  assert.equal(source.includes("manage_dns=true"), false);
  assert.equal(source.includes("pages project create"), false);
});
