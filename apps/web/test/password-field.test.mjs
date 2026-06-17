import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const passwordField = readFileSync("src/components/auth/password-field.tsx", "utf8");
const loginForm = readFileSync("src/components/auth/login-form.tsx", "utf8");
const registerForm = readFileSync("src/components/auth/register-form.tsx", "utf8");
const authIntegration = readFileSync("test/auth-integration.test.mjs", "utf8");

test("password field exposes the accessible icon-button contract", () => {
  assert.match(passwordField, /IconEye, IconEyeOff/);
  assert.match(passwordField, /useState\(false\)/);
  assert.match(passwordField, /type=\{isVisible \? "text" : "password"\}/);
  assert.match(passwordField, /type="button"/);
  assert.match(passwordField, /aria-label=\{label\}/);
  assert.match(passwordField, /aria-pressed=\{isVisible\}/);
  assert.match(passwordField, /visibilityLabel = "password"/);
  assert.match(passwordField, /min-h-11 min-w-11/);
  assert.match(passwordField, /focus-visible:outline-2/);
  assert.match(passwordField, /\[&::-ms-reveal\]:hidden/);
});

test("login and registration use distinct password field instances", () => {
  assert.match(loginForm, /<PasswordField/);
  assert.equal((registerForm.match(/<PasswordField/g) ?? []).length, 2);
  assert.match(registerForm, /visibilityLabel="password"/);
  assert.match(registerForm, /visibilityLabel="konfirmasi password"/);
});

test("auth integration includes real browser interaction coverage", () => {
  assert.match(authIntegration, /browser password toggles render icons and preserve independent form state/);
  assert.match(authIntegration, /\.locator\("svg"\)/);
  assert.match(authIntegration, /\.getAttribute\("type"\)/);
  assert.match(authIntegration, /\.inputValue\(\)/);
  assert.match(authIntegration, /\.press\("Enter"\)/);
  assert.match(authIntegration, /__passwordToggleSubmitCount/);
});
