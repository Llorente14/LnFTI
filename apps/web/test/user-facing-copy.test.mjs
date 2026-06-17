import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(tsx|ts)$/.test(path) ? [path] : [];
  });
}

test("user-facing source does not mention Supabase by brand", () => {
  const files = [
    ...sourceFiles("src/app"),
    ...sourceFiles("src/components"),
  ];

  const offenders = files.filter((file) => readFileSync(file, "utf8").includes("Supabase"));

  assert.deepEqual(offenders, []);
});

