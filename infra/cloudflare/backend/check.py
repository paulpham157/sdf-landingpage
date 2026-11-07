#!/usr/bin/env python3
"""Offline checks for the optional R2 remote-state backend.

Parses the committed backend block and example file, then runs Terraform
1.17.1 against a stand-in on 127.0.0.1. The stand-in records request
headers. It is not Cloudflare R2, and this script does not init a live
backend, apply the Pages configuration, or read credentials from the
environment that launched it.
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
TERRAFORM = os.environ.get("TERRAFORM_BIN", "terraform")
STATE_KEY = "sdf-landingpage/cloudflare/terraform.tfstate"
PROBE_BUCKET = "probe-bucket"
REQUIRED = {
    "region": '"auto"',
    "use_lockfile": "true",
    "encrypt": "false",
    "use_path_style": "true",
    "skip_credentials_validation": "true",
    "skip_metadata_api_check": "true",
    "skip_region_validation": "true",
    "skip_requesting_account_id": "true",
    "skip_s3_checksum": "true",
}
FORBIDDEN_BACKEND_NAMES = {
    "access_key",
    "secret_key",
    "token",
    "profile",
    "shared_credentials_file",
    "shared_credentials_files",
    "shared_config_files",
    "kms_key_id",
    "sse_customer_key",
    "dynamodb_table",
    "dynamodb_endpoint",
    "acl",
    "assume_role",
    "assume_role_with_web_identity",
    "bucket",
    "key",
    "endpoint",
    "endpoints",
    "force_path_style",
    "insecure",
}


def fail(message):
    raise SystemExit(message)


def require(condition, message):
    if not condition:
        fail(message)


def strip_comments(text):
    out = []
    i = 0
    while i < len(text):
        if text[i] in "\"'":
            quote = text[i]
            out.append(quote)
            i += 1
            while i < len(text):
                out.append(text[i])
                if text[i] == "\\":
                    i += 1
                    if i < len(text):
                        out.append(text[i])
                        i += 1
                    continue
                if text[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            require(end != -1, "unterminated block comment")
            out.append(" " * (end + 2 - i))
            i = end + 2
            continue
        if text[i] == "#" or text.startswith("//", i):
            end = text.find("\n", i)
            if end == -1:
                end = len(text)
            out.append(" " * (end - i))
            i = end
            continue
        out.append(text[i])
        i += 1
    return "".join(out)


def extract_backend_block(text):
    match = re.search(r'backend\s+"s3"\s*\{', text)
    require(match, 'versions.tf is missing backend "s3"')
    start = match.start()
    body_at = match.end()
    depth = 1
    i = body_at
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    require(depth == 0, "backend block is not closed")
    return text[start:i], text[body_at : i - 1]


def assignments(body):
    found = {}
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        require("=" in line, f"backend block has a non-assignment line: {line}")
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        require(name not in found, f"backend argument repeated: {name}")
        found[name] = value
    return found


def header(event, name):
    for key, value in event["headers"].items():
        if key.lower() == name.lower():
            return value
    return None


def puts(events, suffix):
    return [
        event
        for event in events
        if event["method"] == "PUT" and event["path"].endswith(suffix)
    ]


class StandIn:
    def __init__(self):
        self.events = []
        self.store = {}
        handler = self._handler()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def _handler(self):
        parent = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, fmt, *args):
                return

            def _read(self):
                length = int(self.headers.get("Content-Length", "0") or 0)
                if length:
                    return self.rfile.read(length)
                if "chunked" in self.headers.get("Transfer-Encoding", "").lower():
                    data = b""
                    while True:
                        line = self.rfile.readline()
                        size = int(line.split(b";", 1)[0], 16)
                        if size == 0:
                            self.rfile.readline()
                            break
                        data += self.rfile.read(size)
                        self.rfile.read(2)
                    return data
                return b""

            def _record(self, method, body):
                kept = {}
                for key, value in self.headers.items():
                    lower = key.lower()
                    if lower in ("authorization", "x-amz-security-token"):
                        continue
                    if lower.startswith("x-amz") or lower in (
                        "if-none-match",
                        "if-match",
                        "content-md5",
                        "content-type",
                    ):
                        kept[key] = value
                parent.events.append(
                    {
                        "method": method,
                        "path": self.path.split("?", 1)[0],
                        "query": self.path.split("?", 1)[1] if "?" in self.path else "",
                        "headers": kept,
                        "body_len": len(body),
                    }
                )

            def _xml(self, code, payload):
                data = payload.encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/xml")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("x-amz-request-id", "probe")
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                self._record("GET", b"")
                if "list-type=2" in (self.path.split("?", 1)[1] if "?" in self.path else ""):
                    self._xml(
                        200,
                        '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'
                        "<KeyCount>0</KeyCount><IsTruncated>false</IsTruncated></ListBucketResult>",
                    )
                    return
                key = self.path.split("?", 1)[0]
                if key not in parent.store:
                    self._xml(
                        404,
                        "<Error><Code>NoSuchKey</Code><Message>missing</Message></Error>",
                    )
                    return
                body, content_type = parent.store[key]
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("ETag", '"probe"')
                self.send_header("x-amz-request-id", "probe")
                self.end_headers()
                self.wfile.write(body)

            def do_HEAD(self):
                self._record("HEAD", b"")
                key = self.path.split("?", 1)[0]
                if key not in parent.store:
                    self.send_response(404)
                    self.send_header("Content-Length", "0")
                    self.send_header("x-amz-request-id", "probe")
                    self.end_headers()
                    return
                body, content_type = parent.store[key]
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Content-Type", content_type)
                self.send_header("ETag", '"probe"')
                self.send_header("x-amz-request-id", "probe")
                self.end_headers()

            def do_PUT(self):
                body = self._read()
                self._record("PUT", body)
                key = self.path.split("?", 1)[0]
                if self.headers.get("If-None-Match") == "*" and key in parent.store:
                    self._xml(
                        412,
                        "<Error><Code>PreconditionFailed</Code><Message>exists</Message></Error>",
                    )
                    return
                parent.store[key] = (
                    body,
                    self.headers.get("Content-Type", "application/octet-stream"),
                )
                self.send_response(200)
                self.send_header("ETag", '"probe"')
                self.send_header("Content-Length", "0")
                self.send_header("x-amz-request-id", "probe")
                self.end_headers()

            def do_DELETE(self):
                self._record("DELETE", b"")
                parent.store.pop(self.path.split("?", 1)[0], None)
                self.send_response(204)
                self.send_header("x-amz-request-id", "probe")
                self.end_headers()

            def do_POST(self):
                body = self._read()
                self._record("POST", body)
                self._xml(400, "<Error><Code>NotImplemented</Code></Error>")

        return Handler

    def close(self):
        self.server.shutdown()
        self.thread.join(timeout=2)


def terraform_env(directory, extra=None):
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": directory,
        "TF_IN_AUTOMATION": "1",
        "TF_INPUT": "0",
        "CHECKPOINT_DISABLE": "1",
        "AWS_EC2_METADATA_DISABLED": "true",
        "AWS_ACCESS_KEY_ID": "probe-access-key",
        "AWS_SECRET_ACCESS_KEY": "probe-secret-key",
    }
    if extra:
        env.update(extra)
    return env


def run_terraform(directory, args, env):
    result = subprocess.run(
        [TERRAFORM, *args],
        cwd=directory,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result


def write_config(directory, backend_block, port):
    main = (
        "terraform {\n"
        '  required_version = ">= 1.11.0, < 2.0.0"\n'
        f"  {backend_block}\n"
        "}\n"
    )
    (directory / "main.tf").write_text(main)
    endpoint = f"http://127.0.0.1:{port}"
    require(endpoint.startswith("http://127.0.0.1:"), "probe endpoint left localhost")
    (directory / "backend.hcl").write_text(
        "\n".join(
            [
                f'bucket = "{PROBE_BUCKET}"',
                f'key    = "{STATE_KEY}"',
                "endpoints = {",
                f'  s3 = "{endpoint}"',
                "}",
                "",
            ]
        )
    )


def assert_lock_put(events, *, sse, crc32):
    lock_key = f"/{PROBE_BUCKET}/{STATE_KEY}.tflock"
    found = puts(events, lock_key)
    require(found, f"lock PutObject was not sent for {lock_key}")
    event = found[0]
    require(header(event, "If-None-Match") == "*", "lock PutObject omitted If-None-Match: *")
    sse_header = header(event, "x-amz-server-side-encryption")
    if sse:
        require(sse_header == "AES256", f"encrypt=true sent {sse_header}, want AES256")
    else:
        require(sse_header is None, f"encrypt=false still sent {sse_header}")
    crc = header(event, "x-amz-checksum-crc32")
    if crc32:
        require(crc is not None, "expected x-amz-checksum-crc32 on the lock PutObject")
    else:
        require(crc is None, f"checksum env still left x-amz-checksum-crc32: {crc}")
    require(
        header(event, "x-amz-server-side-encryption-customer-key") is None,
        "SSE-C customer key header was sent",
    )
    return event


def assert_state_put(events):
    state_key = f"/{PROBE_BUCKET}/{STATE_KEY}"
    found = puts(events, state_key)
    require(len(found) == 1, f"expected one state PutObject, saw {len(found)}")
    event = found[0]
    require(header(event, "If-None-Match") is None, "state PutObject sent If-None-Match")
    require(
        header(event, "x-amz-server-side-encryption") is None,
        "state PutObject sent an SSE header",
    )
    require(
        header(event, "x-amz-checksum-crc32") is None,
        "state PutObject sent x-amz-checksum-crc32",
    )
    require(header(event, "x-amz-content-sha256"), "state PutObject omitted the SigV4 payload hash")


def probe(backend_block, extra_env):
    standin = StandIn()
    directory = Path(tempfile.mkdtemp(prefix="tf-r2-backend-"))
    try:
        write_config(directory, backend_block, standin.port)
        env = terraform_env(str(directory), extra_env)
        init = run_terraform(
            directory,
            ["init", "-backend-config=backend.hcl", "-input=false", "-no-color"],
            env,
        )
        require(init.returncode == 0, "localhost init failed:\n" + init.stderr)
        return standin, directory, env
    except Exception:
        standin.close()
        shutil.rmtree(directory, ignore_errors=True)
        raise


def check_committed_behavior(backend_block):
    standin, directory, env = probe(
        backend_block,
        {"AWS_REQUEST_CHECKSUM_CALCULATION": "when_required"},
    )
    try:
        plan = run_terraform(directory, ["plan", "-input=false", "-no-color"], env)
        require(plan.returncode == 0, "localhost plan failed:\n" + plan.stderr)
        plan_events = list(standin.events)
        assert_lock_put(plan_events, sse=False, crc32=False)
        state_key = f"/{PROBE_BUCKET}/{STATE_KEY}"
        require(
            not puts(plan_events, state_key),
            "plan wrote the state object on an empty configuration",
        )
        require(
            any(
                event["method"] == "DELETE" and event["path"].endswith(".tflock")
                for event in plan_events
            ),
            "plan did not delete the lock object",
        )
        state = {
            "version": 4,
            "terraform_version": "1.17.1",
            "serial": 1,
            "lineage": "11111111-1111-1111-1111-111111111111",
            "outputs": {},
            "resources": [],
        }
        state_path = directory / "empty.tfstate"
        state_path.write_text(json.dumps(state))
        before = len(standin.events)
        pushed = run_terraform(
            directory,
            ["state", "push", "-force", "empty.tfstate"],
            env,
        )
        require(pushed.returncode == 0, "localhost state push failed:\n" + pushed.stderr)
        push_events = standin.events[before:]
        assert_lock_put(push_events, sse=False, crc32=False)
        assert_state_put(push_events)
        stored = standin.store.get(f"/{PROBE_BUCKET}/{STATE_KEY}")
        require(stored, "state object was not stored by the stand-in")
        body = stored[0].decode()
        require('"resources"' in body, "pushed state has no resources field")
        require("probe-secret-key" not in body, "probe secret was written into state")
        require("CLOUDFLARE_API_TOKEN" not in body, "provider token name was written into state")
    finally:
        standin.close()
        shutil.rmtree(directory, ignore_errors=True)


def check_encrypt_header():
    block = """
backend "s3" {
  region                      = "auto"
  use_lockfile                = true
  encrypt                     = true
  use_path_style              = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
  skip_s3_checksum            = true
}
""".strip()
    standin, directory, env = probe(
        block,
        {"AWS_REQUEST_CHECKSUM_CALCULATION": "when_required"},
    )
    try:
        plan = run_terraform(directory, ["plan", "-input=false", "-no-color"], env)
        require(plan.returncode == 0, "encrypt=true localhost plan failed:\n" + plan.stderr)
        assert_lock_put(standin.events, sse=True, crc32=False)
    finally:
        standin.close()
        shutil.rmtree(directory, ignore_errors=True)


def check_default_checksum_header():
    block = """
backend "s3" {
  region                      = "auto"
  use_lockfile                = true
  encrypt                     = false
  use_path_style              = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
  skip_s3_checksum            = true
}
""".strip()
    standin, directory, env = probe(block, {})
    try:
        plan = run_terraform(directory, ["plan", "-input=false", "-no-color"], env)
        require(plan.returncode == 0, "default checksum plan failed:\n" + plan.stderr)
        assert_lock_put(standin.events, sse=False, crc32=True)
    finally:
        standin.close()
        shutil.rmtree(directory, ignore_errors=True)


def check_region_rejected_offline():
    directory = Path(tempfile.mkdtemp(prefix="tf-r2-region-"))
    try:
        (directory / "main.tf").write_text(
            """
terraform {
  backend "s3" {
    bucket                      = "probe-bucket"
    key                         = "probe/terraform.tfstate"
    region                      = "auto"
    use_lockfile                = true
    encrypt                     = false
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}
"""
        )
        result = run_terraform(
            directory,
            ["init", "-input=false", "-no-color"],
            terraform_env(str(directory)),
        )
        combined = result.stdout + result.stderr
        require(result.returncode != 0, "region auto was accepted without skip_region_validation")
        require(
            "Invalid AWS Region: auto" in combined,
            "region rejection did not name auto:\n" + combined,
        )
    finally:
        shutil.rmtree(directory, ignore_errors=True)


def check_files(backend_block, body):
    found = assignments(body)
    require(
        set(found.items()) == set(REQUIRED.items()),
        f"backend arguments are {found}, want {REQUIRED}",
    )
    for name in FORBIDDEN_BACKEND_NAMES:
        require(name not in found, f"backend block sets {name}")
    versions = (ROOT / "versions.tf").read_text()
    require(backend_block in versions, "extracted backend block is not the committed block")

    example = (ROOT / "backend.hcl.example").read_text()
    cleaned = strip_comments(example)
    require('bucket = "REPLACE_WITH_PRIVATE_STATE_BUCKET"' in cleaned, "bucket placeholder missing")
    require(f'key    = "{STATE_KEY}"' in cleaned or f'key = "{STATE_KEY}"' in cleaned, "state key missing")
    require(
        "https://REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com" in cleaned,
        "endpoint placeholder missing",
    )
    for name in (
        "access_key",
        "secret_key",
        "token",
        "encrypt",
        "use_lockfile",
        "region",
        "skip_",
        "password",
        "AKIA",
    ):
        require(name not in cleaned, f"backend.hcl.example contains {name}")
    require(
        re.search(r"\b[0-9a-fA-F]{32}\b", cleaned) is None,
        "backend.hcl.example contains a 32-hex account id",
    )

    gitignore = (REPO / ".gitignore").read_text()
    for line in ("infra/cloudflare/backend.hcl", "*.tfstate", "*.tfvars"):
        require(line in gitignore, f".gitignore is missing {line}")
    ignored = subprocess.run(
        ["git", "check-ignore", "-q", "infra/cloudflare/backend.hcl"],
        cwd=REPO,
    )
    require(ignored.returncode == 0, "backend.hcl is not gitignored")
    example_ignored = subprocess.run(
        ["git", "check-ignore", "-q", "infra/cloudflare/backend.hcl.example"],
        cwd=REPO,
    )
    require(example_ignored.returncode != 0, "backend.hcl.example is gitignored")

    deploy = (REPO / "scripts" / "deploy.mjs").read_text()
    for name in (
        "backend.hcl",
        "terraform.tfstate",
        "r2.cloudflarestorage",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_REQUEST_CHECKSUM_CALCULATION",
    ):
        require(name not in deploy, f"deploy.mjs references {name}")

    workflow = (REPO / ".github" / "workflows" / "terraform.yml").read_text()
    require("secrets:" not in workflow, "terraform workflow has a secrets mapping")
    require("AWS_ACCESS_KEY_ID" not in workflow, "terraform workflow names the R2 access key")
    require("terraform apply" not in workflow, "terraform workflow runs apply")
    require(
        workflow.count("CLOUDFLARE_API_TOKEN") == 1
        and "not set CLOUDFLARE_API_TOKEN" in workflow,
        "terraform workflow must only mention the provider token to say it is unset",
    )
    require("backend/check.py" in workflow, "terraform workflow does not run the backend check")

    infra_readme = (ROOT / "README.md").read_text()
    for phrase in (
        "use_lockfile = true",
        "encrypt = false",
        "If-None-Match",
        "x-amz-server-side-encryption",
        "AWS_REQUEST_CHECKSUM_CALCULATION=when_required",
        "GetBucketVersioning",
        "AWS_ACCESS_KEY_ID",
        "CLOUDFLARE_API_TOKEN",
        "npm run deploy",
        "A live R2 bucket was not initialized, and Terraform was not applied.",
        "không có phiên bản đối tượng",
        "Chưa khởi tạo bucket R2 thật và chưa chạy terraform apply.",
    ):
        require(phrase in infra_readme, f"infra README is missing {phrase!r}")
    for phrase in (
        "restore the previous object version from the bucket",
        "Enable versioning and default encryption",
    ):
        require(phrase not in infra_readme, f"infra README still says {phrase!r}")

    root_readme = (REPO / "README.md").read_text()
    require("does not use an R2 bucket" in root_readme, "root README missed the English deploy boundary")
    require("không dùng bucket R2" in root_readme, "root README missed the Vietnamese deploy boundary")


def check_terraform_version():
    require(shutil.which(TERRAFORM), f"{TERRAFORM} is not on PATH")
    result = subprocess.run(
        [TERRAFORM, "version"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    require(result.returncode == 0, "terraform version failed")
    first = result.stdout.splitlines()[0]
    require(first == "Terraform v1.17.1", f"probe requires Terraform v1.17.1, found {first}")


def main():
    check_terraform_version()
    versions = (ROOT / "versions.tf").read_text()
    backend_block, body = extract_backend_block(strip_comments(versions))
    check_files(backend_block, body)
    # Re-extract from the raw file so the probe uses the formatted block,
    # including spacing, rather than the comment-stripped copy.
    raw_block, _ = extract_backend_block(versions)
    check_region_rejected_offline()
    check_default_checksum_header()
    check_encrypt_header()
    check_committed_behavior(raw_block)
    print("backend configuration checks passed")


if __name__ == "__main__":
    main()
