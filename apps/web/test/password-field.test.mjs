import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const passwordField = readFileSync("src/components/auth/password-field.tsx", "utf8");
const loginForm = readFileSync("src/components/auth/login-form.tsx", "utf8");
const registerForm = readFileSync("src/components/auth/register-form.tsx", "utf8");

test("password field is hidden by default and toggles without submitting", () => {
  assert.match(passwordField, /useState\(false\)/);
  assert.match(passwordField, /type=\{isVisible \? "text" : "password"\}/);
  assert.match(passwordField, /type="button"/);
  assert.match(passwordField, /setIsVisible\(\(current\) => !current\)/);
});

test("password toggle exposes accessible state and keyboard focus styling", () => {
  assert.match(passwordField, /Sembunyikan password/);
  assert.match(passwordField, /Tampilkan password/);
  assert.match(passwordField, /aria-label=\{label\}/);
  assert.match(passwordField, /aria-pressed=\{isVisible\}/);
  assert.match(passwordField, /min-h-11 min-w-11/);
  assert.match(passwordField, /focus-visible:outline-2/);
});

test("login and registration use independent password field instances", () => {
  assert.match(loginForm, /<PasswordField/);
  assert.equal((registerForm.match(/<PasswordField/g) ?? []).length, 2);
  assert.match(registerForm, /name="password"/);
  assert.match(registerForm, /name="password_confirmation"/);
});
