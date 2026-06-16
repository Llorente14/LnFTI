import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

function findRepoRoot() {
  let current = process.cwd();
  for (;;) {
    if (existsSync(path.join(current, "services", "ai", "Dockerfile"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Repository root not found.");
    }
    current = parent;
  }
}

const repoRoot = findRepoRoot();

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("AI Dockerfile is production-oriented for Hugging Face Docker Space", async () => {
  const dockerfile = await readRepoFile("services/ai/Dockerfile");

  assert.match(dockerfile, /FROM python:3\.12\.8-slim-bookworm/);
  assert.match(dockerfile, /EXPOSE 7860/);
  assert.match(dockerfile, /USER user/);
  assert.doesNotMatch(dockerfile, /--reload/);
  assert.doesNotMatch(dockerfile, /COPY .*\.env/);
  assert.match(dockerfile, /--workers", "1"/);
  assert.match(dockerfile, /\/api\/v1\/health/);
});

test("Hugging Face Space manifest uses Docker SDK and port 7860", async () => {
  const readme = await readRepoFile("deploy/huggingface/README.md");

  assert.match(readme, /sdk: docker/);
  assert.match(readme, /app_port: 7860/);
  assert.match(readme, /AI_INTERNAL_API_TOKEN/);
});

test("Space package excludes env files, tests, and model weights", async () => {
  const tempParent = await mkdtemp(path.join(tmpdir(), "lnfti-hf-package-"));
  const output = path.join("dist", path.basename(tempParent));

  try {
    await execFileAsync(process.execPath, ["scripts/package-hf-space.mjs", output], { cwd: repoRoot });
    const outputRoot = path.join(repoRoot, output);

    await stat(path.join(outputRoot, "Dockerfile"));
    await stat(path.join(outputRoot, "README.md"));
    await stat(path.join(outputRoot, "requirements.txt"));
    await stat(path.join(outputRoot, "app", "main.py"));
    assert.equal(existsSync(path.join(outputRoot, ".env")), false);
    assert.equal(existsSync(path.join(outputRoot, "tests")), false);
    assert.equal(existsSync(path.join(outputRoot, "app", "__pycache__")), false);
    assert.equal(existsSync(path.join(outputRoot, "yolo26n.pt")), false);
  } finally {
    await rm(path.join(repoRoot, output), { recursive: true, force: true });
    await rm(tempParent, { recursive: true, force: true });
  }
});

test("production verification rejects non-production targets", async () => {
  const verifier = await import(pathToFileURL(path.join(repoRoot, "scripts", "verify-production.mjs")));

  assert.throws(
    () => verifier.validateProductionUrl("PRODUCTION_WEB_URL", "http://example.com"),
    /must use HTTPS/,
  );
  assert.throws(
    () => verifier.validateProductionUrl("PRODUCTION_WEB_URL", "https://localhost"),
    /must not target localhost/,
  );
  assert.equal(
    verifier.validateProductionUrl("PRODUCTION_WEB_URL", "https://lnfti.example.com/path"),
    "https://lnfti.example.com",
  );
});

test("deployment documentation entrypoints exist", async () => {
  for (const relativePath of [
    "docs/deployment/SUPABASE_PRODUCTION.md",
    "docs/deployment/VERCEL_PRODUCTION.md",
    "docs/deployment/PRODUCTION_RUNBOOK.md",
    "docs/deployment/DEPLOYMENT_RECORD_TEMPLATE.md",
    "docs/deployment/bootstrap-admin.sql.example",
  ]) {
    await stat(path.join(repoRoot, relativePath));
  }
});
