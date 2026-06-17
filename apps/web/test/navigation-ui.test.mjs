import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function transpile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function loadModule(path, customRequire = require) {
  const moduleRecord = { exports: {} };
  const evaluateModule = new Function("exports", "module", "require", transpile(path));
  evaluateModule(moduleRecord.exports, moduleRecord, customRequire);
  return moduleRecord.exports;
}

const navigation = loadModule("src/lib/navigation.ts", (specifier) => {
  if (specifier === "@tabler/icons-react") {
    return {
      IconClipboardList: () => null,
      IconHome: () => null,
      IconSearch: () => null,
      IconUser: () => null,
    };
  }

  return require(specifier);
});

test("mobile navigation route matcher activates exactly one item", () => {
  assert.equal(navigation.getActiveMobileNavigationHref("/"), "/");
  assert.equal(navigation.getActiveMobileNavigationHref("/reports"), "/reports");
  assert.equal(navigation.getActiveMobileNavigationHref("/reports/abc"), "/reports");
  assert.equal(navigation.getActiveMobileNavigationHref("/report/new"), "/report/new");
  assert.equal(navigation.getActiveMobileNavigationHref("/report/new/draft"), "/report/new");
  assert.equal(navigation.getActiveMobileNavigationHref("/me"), "/me/reports");
  assert.equal(navigation.getActiveMobileNavigationHref("/me/claims/123"), "/me/reports");
  assert.equal(navigation.getActiveMobileNavigationHref("/admin"), null);
});

test("desktop public navigation matcher activates route parents only", () => {
  assert.equal(navigation.getActivePublicNavigationHref("/"), "/");
  assert.equal(navigation.getActivePublicNavigationHref("/?q=1"), "/");
  assert.equal(navigation.getActivePublicNavigationHref("/reports"), "/reports");
  assert.equal(navigation.getActivePublicNavigationHref("/reports/abc"), "/reports");
  assert.equal(navigation.getActivePublicNavigationHref("/report/new"), null);
  assert.equal(navigation.getActivePublicNavigationHref("/admin"), null);
});

test("desktop action navigation matcher covers report, auth, and profile routes", () => {
  assert.equal(navigation.getActiveHeaderActionHref("/report/new"), "/report/new");
  assert.equal(navigation.getActiveHeaderActionHref("/report/new?type=lost"), "/report/new");
  assert.equal(navigation.getActiveHeaderActionHref("/me"), "/me/profile");
  assert.equal(navigation.getActiveHeaderActionHref("/me/claims/123"), "/me/profile");
  assert.equal(navigation.getActiveHeaderActionHref("/login"), "/login");
  assert.equal(navigation.getActiveHeaderActionHref("/reports/abc"), null);
});

test("mobile nav uses client pathname, aria-current, and no permanent primary item", () => {
  const source = readFileSync("src/components/mobile-nav.tsx", "utf8");

  assert.match(source, /usePathname/);
  assert.match(source, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(source, /opacity-100/);
  assert.match(source, /opacity-60/);
  assert.doesNotMatch(source, /item\.href === "\/report\/new"/);
});

test("desktop header nav uses client pathname, aria-current, and opacity active state", () => {
  const source = readFileSync("src/components/site-header-navigation.tsx", "utf8");

  assert.match(source, /usePathname/);
  assert.match(source, /getActivePublicNavigationHref/);
  assert.match(source, /getActiveHeaderActionHref/);
  assert.match(source, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(source, /opacity-100/);
  assert.match(source, /opacity-60/);
});

test("mobile header no longer exposes duplicate search button", () => {
  const source = readFileSync("src/components/site-header.tsx", "utf8");

  assert.doesNotMatch(source, /IconSearch/);
  assert.doesNotMatch(source, /aria-label="Cari laporan"/);
  assert.doesNotMatch(source, /md:hidden/);
});
