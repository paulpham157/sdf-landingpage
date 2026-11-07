#!/usr/bin/env bash
# Proves Terraform lifecycle semantics with terraform_data only.
# It does not load the Cloudflare provider and does not touch an account.
set -euo pipefail

root=$(cd "$(dirname "$0")" && pwd)
terraform_bin=${TERRAFORM_BIN:-terraform}

if ! command -v "$terraform_bin" >/dev/null 2>&1; then
  echo "terraform is not on PATH" >&2
  exit 1
fi

python3 - "$root" "$terraform_bin" <<'PY'
import json, os, shutil, subprocess, sys, tempfile

root, terraform = sys.argv[1], sys.argv[2]
env = os.environ.copy()
env["TF_IN_AUTOMATION"] = "1"

def run(cwd, args, check=True):
    result = subprocess.run(
        [terraform, *args],
        cwd=cwd,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(f"command failed in {cwd}: terraform {' '.join(args)}")
    return result

def copy_config(src, dst):
    for name in os.listdir(dst):
        if name.endswith(".tf"):
            os.remove(os.path.join(dst, name))
    for name in os.listdir(src):
        if name.endswith(".tf"):
            shutil.copy(os.path.join(src, name), os.path.join(dst, name))

def actions(plan_path, cwd):
    shown = run(cwd, ["show", "-json", plan_path])
    data = json.loads(shown.stdout)
    found = {}
    for change in data.get("resource_changes") or []:
        found[change["address"]] = change["change"]["actions"]
    return found

def require(condition, message):
    if not condition:
        raise SystemExit(message)

work = tempfile.mkdtemp(prefix="sdf-semantics-")
try:
    imported = os.path.join(work, "imported")
    shutil.copytree(os.path.join(root, "mode", "imported"), imported)
    run(imported, ["init", "-input=false", "-no-color"])
    run(imported, ["apply", "-auto-approve", "-input=false", "-no-color", "-var", "recorded_mode=direct_upload"])

    copy_config(os.path.join(root, "mode", "latched"), imported)

    match = run(imported, ["plan", "-input=false", "-no-color", "-detailed-exitcode", "-var", "recorded_mode=direct_upload", "-out=match.tfplan"], check=False)
    require(match.returncode == 2, "matching import plan should change only the new sentinel:\n" + match.stdout + match.stderr)
    match_actions = actions("match.tfplan", imported)
    require(match_actions.get("terraform_data.mode_sentinel") == ["create"], f"sentinel on a matching import must be create, got {match_actions}")
    require(match_actions.get("terraform_data.project") == ["no-op"], f"project on a matching import must be no-op, got {match_actions}")

    mismatch = run(imported, ["plan", "-input=false", "-no-color", "-detailed-exitcode", "-var", "recorded_mode=github", "-out=mismatch.tfplan"], check=False)
    require(mismatch.returncode == 2, "mismatched import plan should succeed as an in-place update:\n" + mismatch.stdout + mismatch.stderr)
    mismatch_actions = actions("mismatch.tfplan", imported)
    require(mismatch_actions.get("terraform_data.mode_sentinel") == ["create"], f"sentinel on a mismatched import must be create, got {mismatch_actions}")
    require(mismatch_actions.get("terraform_data.project") == ["update"], f"project on a mismatched import must be update, not replace, got {mismatch_actions}")

    def latched_flip(initial, flipped):
        path = os.path.join(work, f"latched-{initial}")
        shutil.copytree(os.path.join(root, "mode", "latched"), path)
        run(path, ["init", "-input=false", "-no-color"])
        run(path, ["apply", "-auto-approve", "-input=false", "-no-color", "-var", f"recorded_mode={initial}"])
        flipped_plan = run(path, ["plan", "-input=false", "-no-color", "-var", f"recorded_mode={flipped}"], check=False)
        text = flipped_plan.stdout + flipped_plan.stderr
        require(flipped_plan.returncode != 0, f"flip {initial} -> {flipped} should be rejected:\n" + text)
        require("prevent_destroy" in text and "terraform_data.project" in text, f"flip {initial} -> {flipped} should name prevent_destroy on the project:\n" + text)

    latched_flip("direct_upload", "github")
    latched_flip("github", "direct_upload")

    removal = os.path.join(work, "removal")
    shutil.copytree(os.path.join(root, "removal", "present"), removal)
    run(removal, ["init", "-input=false", "-no-color"])
    run(removal, ["apply", "-auto-approve", "-input=false", "-no-color"])

    def swap(name):
        path = os.path.join(work, name)
        os.makedirs(path, exist_ok=True)
        shutil.copy(os.path.join(removal, "terraform.tfstate"), os.path.join(path, "terraform.tfstate"))
        copy_config(os.path.join(root, "removal", name), path)
        run(path, ["init", "-input=false", "-no-color"])
        return path

    indexed = os.path.join(work, "indexed")
    os.makedirs(indexed)
    shutil.copy(os.path.join(removal, "terraform.tfstate"), os.path.join(indexed, "terraform.tfstate"))
    copy_config(os.path.join(root, "removal", "indexed"), indexed)
    indexed_init = run(indexed, ["init", "-input=false", "-no-color"], check=False)
    indexed_text = indexed_init.stdout + indexed_init.stderr
    require(indexed_init.returncode != 0 and "Resource instance keys not allowed" in indexed_text, "indexed removed.from should be rejected:\n" + indexed_text)

    counted = swap("count-zero")
    counted_plan = run(counted, ["plan", "-input=false", "-no-color"], check=False)
    counted_text = counted_plan.stdout + counted_plan.stderr
    require(counted_plan.returncode != 0 and "Removed resource still exists" in counted_text and "still declared in configuration" in counted_text, "count = 0 plus removed should be rejected:\n" + counted_text)

    bare = swap("bare-delete")
    bare_plan = run(bare, ["plan", "-input=false", "-no-color", "-detailed-exitcode", "-out=bare.tfplan"], check=False)
    require(bare_plan.returncode == 2, "deleting the block without removed should plan a destroy:\n" + bare_plan.stdout + bare_plan.stderr)
    bare_actions = actions("bare.tfplan", bare)
    require(bare_actions.get("terraform_data.record[0]") == ["delete"], f"bare delete must plan delete, got {bare_actions}")

    forget = swap("forget")
    forget_plan = run(forget, ["plan", "-input=false", "-no-color", "-detailed-exitcode", "-out=forget.tfplan"], check=False)
    require(forget_plan.returncode == 2, "removed destroy=false should plan a forget:\n" + forget_plan.stdout + forget_plan.stderr)
    forget_actions = actions("forget.tfplan", forget)
    require(forget_actions.get("terraform_data.record[0]") == ["forget"], f"forget must not be delete, got {forget_actions}")
    run(forget, ["apply", "-auto-approve", "-input=false", "-no-color", "forget.tfplan"])
    listed = run(forget, ["state", "list"])
    require(listed.stdout.strip() == "", f"state should be empty after forget, got {listed.stdout!r}")
finally:
    shutil.rmtree(work, ignore_errors=True)

print("semantics checks passed")
PY
