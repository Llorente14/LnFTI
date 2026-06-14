import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync("src/lib/auth/role.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const moduleRecord = { exports: {} };
new Function("exports", "module", compiled)(moduleRecord.exports, moduleRecord);
const { isAllowedRole } = moduleRecord.exports;

test("allows verifier and admin into the verifier workspace", () => {
  const allowedRoles = ["verifier", "admin"];

  assert.equal(isAllowedRole("verifier", allowedRoles), true);
  assert.equal(isAllowedRole("admin", allowedRoles), true);
});

test("rejects students and missing roles from the verifier workspace", () => {
  const allowedRoles = ["verifier", "admin"];

  assert.equal(isAllowedRole("student", allowedRoles), false);
  assert.equal(isAllowedRole(null, allowedRoles), false);
  assert.equal(isAllowedRole(undefined, allowedRoles), false);
});
