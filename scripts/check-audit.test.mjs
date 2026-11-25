import assert from "node:assert/strict";
import test from "node:test";
import { parseAuditReport } from "./check-audit.mjs";

test("audit output that is not JSON fails", () => {
  assert.throws(() => parseAuditReport(""), /did not return JSON/);
  assert.throws(() => parseAuditReport("   "), /did not return JSON/);
  assert.throws(() => parseAuditReport("npm error not json"), /did not return JSON/);
  assert.throws(() => parseAuditReport("[]"), /did not return JSON/);
  assert.throws(() => parseAuditReport("null"), /did not return JSON/);
});

test("a JSON audit report is accepted", () => {
  const report = parseAuditReport('{"vulnerabilities":{}}');
  assert.deepEqual(report.vulnerabilities, {});
});
