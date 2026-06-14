import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const authSource = readFileSync("src/lib/auth/validation.ts", "utf8");
const authModule = ts.transpileModule(authSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function loadAuthExports() {
  const moduleRecord = { exports: {} };
  const evaluateModule = new Function("exports", "module", "require", authModule);

  evaluateModule(moduleRecord.exports, moduleRecord, require);

  return moduleRecord.exports;
}

const {
  buildInstitutionalEmail,
  normalizeFirstName,
  parseNim,
  sanitizeNextPath,
  validateInstitutionalEmail,
  validateInstitutionalIdentity,
} = loadAuthExports();

test("parses Teknik Informatika NIM", () => {
  assert.deepEqual(parseNim("535240143"), {
    nim: "535240143",
    prefix: "535",
    programStudyCode: "TI",
    programStudyName: "Teknik Informatika",
    cohortCode: "24",
    cohortYear: 2024,
    sequence: "0143",
  });
});

test("parses Sistem Informasi NIM", () => {
  assert.deepEqual(parseNim("825250118"), {
    nim: "825250118",
    prefix: "825",
    programStudyCode: "SI",
    programStudyName: "Sistem Informasi",
    cohortCode: "25",
    cohortYear: 2025,
    sequence: "0118",
  });
});

test("normalizes first name and builds expected institutional email", () => {
  assert.equal(normalizeFirstName("Axel Chrisdy"), "axel");
  assert.equal(buildInstitutionalEmail("Axel Chrisdy", "535240143"), "axel.535240143@stu.untar.ac.id");
  assert.equal(buildInstitutionalEmail("Sinta Tan", "825250118"), "sinta.825250118@stu.untar.ac.id");
});

test("validates institutional identity and matching passwords", () => {
  assert.equal(
    validateInstitutionalIdentity({
      fullName: "Axel Chrisdy",
      nim: "535240143",
      email: "axel.535240143@stu.untar.ac.id",
      password: "password123",
      passwordConfirmation: "password123",
    }).programStudyCode,
    "TI",
  );
});

test("rejects invalid NIM values", () => {
  assert.throws(() => parseNim("53524014"), /9 digit/);
  assert.throws(() => parseNim("5352401439"), /9 digit/);
  assert.throws(() => parseNim("123240143"), /Prefix/);
  assert.throws(() => parseNim("535230143"), /Angkatan/);
  assert.throws(() => parseNim("53524A143"), /angka/);
});

test("rejects institutional email mismatches", () => {
  assert.throws(
    () =>
      validateInstitutionalIdentity({
        fullName: "Axel Chrisdy",
        nim: "535240143",
        email: "axel.535240143@example.com",
      }),
    /domain/,
  );
  assert.throws(
    () =>
      validateInstitutionalIdentity({
        fullName: "Axel Chrisdy",
        nim: "535240143",
        email: "budi.535240143@stu.untar.ac.id",
      }),
    /Nama depan/,
  );
  assert.throws(
    () =>
      validateInstitutionalIdentity({
        fullName: "Axel Chrisdy",
        nim: "535240143",
        email: "axel.535240144@stu.untar.ac.id",
      }),
    /NIM/,
  );
  assert.throws(
    () =>
      validateInstitutionalIdentity({
        fullName: "Axel Chrisdy",
        nim: "535240143",
        email: "axel.extra.535240143@stu.untar.ac.id",
      }),
    /nama\.NIM/,
  );
});

test("validates login institutional email format without full name", () => {
  assert.equal(validateInstitutionalEmail("AXEL.535240143@STU.UNTAR.AC.ID"), "axel.535240143@stu.untar.ac.id");
  assert.throws(() => validateInstitutionalEmail("axel.535240143@example.com"), /domain/);
  assert.throws(() => validateInstitutionalEmail("axel.extra.535240143@stu.untar.ac.id"), /nama\.NIM/);
  assert.throws(() => validateInstitutionalEmail("axel.123240143@stu.untar.ac.id"), /Prefix/);
});

test("rejects empty normalized first name and password mismatch", () => {
  assert.throws(() => normalizeFirstName("123 456"), /a-z/);
  assert.throws(
    () =>
      validateInstitutionalIdentity({
        fullName: "Axel Chrisdy",
        nim: "535240143",
        email: "axel.535240143@stu.untar.ac.id",
        password: "password123",
        passwordConfirmation: "password124",
      }),
    /Konfirmasi/,
  );
});

test("sanitizes next paths", () => {
  assert.equal(sanitizeNextPath("/me/profile"), "/me/profile");
  assert.equal(sanitizeNextPath("/me/reports"), "/me/reports");
  assert.equal(sanitizeNextPath("/report/new"), "/report/new");
  assert.equal(sanitizeNextPath("/reports/123"), "/reports/123");
  assert.equal(sanitizeNextPath("https://evil.example"), "/me/profile");
  assert.equal(sanitizeNextPath("//evil.example"), "/me/profile");
  assert.equal(sanitizeNextPath("\\evil.example"), "/me/profile");
  assert.equal(sanitizeNextPath("javascript:alert(1)"), "/me/profile");
});
