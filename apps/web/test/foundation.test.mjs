import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const expectedRoutes = [
  "src/app/page.tsx",
  "src/app/reports/page.tsx",
  "src/app/reports/[id]/page.tsx",
  "src/app/report/new/page.tsx",
  "src/app/login/page.tsx",
  "src/app/me/reports/page.tsx",
  "src/app/me/claims/page.tsx",
  "src/app/admin/page.tsx",
];

test("Next.js foundation uses strict TypeScript and required scripts", () => {
  const pkg = readJson("package.json");
  const tsconfig = readJson("tsconfig.json");

  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.equal(pkg.scripts.build, "next build");
  assert.ok(!pkg.dependencies["next-auth"], "Supabase Auth is the only planned auth layer");
});

test("shadcn and Tailwind design foundations are configured", () => {
  const components = readJson("components.json");
  const css = readFileSync("src/app/globals.css", "utf8");

  assert.equal(components.rsc, true);
  assert.equal(components.iconLibrary, "tabler");
  assert.match(css, /@import "tailwindcss";/);
  assert.match(css, /--crimson-deep:/);
  assert.match(css, /--gold-accent:/);
  assert.match(css, /--font-plus-jakarta/);
  assert.match(css, /--font-dm-sans/);
});

test("all initial App Router placeholders exist", () => {
  for (const route of expectedRoutes) {
    assert.ok(existsSync(route), `Missing route file: ${route}`);
  }
});

test("responsive application shell exists", () => {
  assert.ok(existsSync("src/components/site-header.tsx"));
  assert.ok(existsSync("src/components/mobile-nav.tsx"));
  assert.ok(existsSync("src/components/app-shell.tsx"));
});
