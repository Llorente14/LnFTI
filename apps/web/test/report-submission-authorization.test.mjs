import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionsSource = readFileSync("src/app/report/new/actions.ts", "utf8");
const migrationSource = readFileSync(
  "../../supabase/migrations/20260617040000_normalize_verified_student_rls.sql",
  "utf8",
);

test("draft report action performs profile verification preflight before insert", () => {
  assert.match(actionsSource, /getCurrentProfileResult\(\)/);
  assert.match(actionsSource, /isVerifiedStudentProfile\(profileResult\.profile\)/);
  assert.match(actionsSource, /Akun mahasiswa Anda belum terverifikasi/);
  assert.match(actionsSource, /Laporan belum dapat dikirim\. Periksa data lalu coba lagi\./);

  const preflightPosition = actionsSource.indexOf("getCurrentProfileResult()");
  const insertPosition = actionsSource.indexOf('.from("reports")');
  assert.ok(preflightPosition >= 0 && insertPosition > preflightPosition);
});

test("database helper normalizes profile verification status without bypassing RLS", () => {
  assert.match(migrationSource, /lower\(btrim\(coalesce\(status_value, ''\)\)\) = 'verified'/);
  assert.match(migrationSource, /profiles\.role = 'student'::public\.application_role/);
  assert.match(migrationSource, /profiles\.id = auth\.uid\(\)/);
  assert.match(migrationSource, /profiles\.verification_status::text/);
  assert.match(migrationSource, /grant execute on function public\.is_verified_student\(\) to authenticated/);
  assert.doesNotMatch(
    migrationSource,
    /verification_status\s*=\s*'VERIFIED'::public\.profile_verification_status/,
  );
});
