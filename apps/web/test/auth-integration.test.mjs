import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import test from "node:test";
import { chromium } from "@playwright/test";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_SUPABASE_AUTH_INTEGRATION === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const appUrl = process.env.NEXT_APP_URL;
const mailpitUrl = process.env.MAILPIT_URL;
const { Client } = pg;

const maybeTest = enabled ? test : test.skip;

function requireIntegrationEnv() {
  assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
  assert.ok(supabaseKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
}

function requireAppEnv() {
  assert.ok(appUrl, "NEXT_APP_URL is required");
  assert.ok(mailpitUrl, "MAILPIT_URL is required");
}

function createSupabaseClient() {
  requireIntegrationEnv();

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function uniqueIdentity(firstName = "Browser", prefix = "825") {
  const sequence = String(randomInt(1000, 9999));
  const nim = `${prefix}25${sequence}`;

  return {
    fullName: `${firstName} Student`,
    nim,
    email: `${firstName.toLowerCase()}.${nim}@stu.untar.ac.id`,
    passphrase: `LnftiTest${sequence}!`,
  };
}

maybeTest("auth integration signs up institutional user and derives profile", async () => {
  const sequence = String(randomInt(1000, 9999));
  const nim = `53525${sequence}`;
  const email = `integration.${nim}@stu.untar.ac.id`;
  const passphrase = `LnftiTest${sequence}!`;
  const supabase = createSupabaseClient();

  const { data: signup, error: signupError } = await supabase.auth.signUp({
    email,
    password: passphrase,
    options: {
      emailRedirectTo: `${appUrl ?? "http://127.0.0.1:3000"}/auth/confirm?next=%2Fme%2Fprofile`,
      data: {
        full_name: "Integration Student",
        nim,
      },
    },
  });

  assert.equal(signupError, null);
  assert.ok(signup.user);
  assert.equal(signup.session, null);

  const profiles = await selectProfilesByEmail(email);
  assert.equal(profiles.length, 1);
  assert.deepEqual(
    {
      role: profiles[0].role,
      displayName: profiles[0].display_name,
      nim: profiles[0].nim,
      nimPrefix: profiles[0].nim_prefix,
      programStudyCode: profiles[0].program_study_code,
      cohortYear: profiles[0].cohort_year,
    },
    {
      role: "student",
      displayName: "Integration Student",
      nim,
      nimPrefix: "535",
      programStudyCode: "TI",
      cohortYear: 2025,
    },
  );
  assert.equal(profiles[0].verification_status, "UNVERIFIED");
});

maybeTest("auth integration protects private routes without session", async () => {
  assert.ok(appUrl, "NEXT_APP_URL is required");

  const response = await fetch(`${appUrl}/me/profile`, {
    redirect: "manual",
  });

  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/login\?next=%2Fme%2Fprofile/);

  const spoofedConfirmResponse = await fetch(
    `${appUrl}/auth/confirm?token_hash=bad-token&type=recovery&next=/me/profile`,
    {
      redirect: "manual",
      headers: {
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    },
  );

  assert.equal(spoofedConfirmResponse.status, 307);
  assert.equal(
    spoofedConfirmResponse.headers.get("location"),
    `${appUrl}/login?message=confirmation_failed`,
  );
});

maybeTest("browser password toggles render icons and preserve independent form state", async () => {
  assert.ok(appUrl, "NEXT_APP_URL is required");

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const passwordValue = "VisiblePassword123!";
  const confirmationValue = "IndependentPassword456!";

  try {
    await page.goto(`${appUrl}/register`);

    const passwordInput = page.getByLabel("Password", { exact: true });
    const confirmationInput = page.getByLabel("Konfirmasi password", { exact: true });
    const passwordToggle = page.getByRole("button", {
      name: "Tampilkan password",
      exact: true,
    });
    const confirmationToggle = page.getByRole("button", {
      name: "Tampilkan konfirmasi password",
      exact: true,
    });

    await passwordInput.fill(passwordValue);
    await confirmationInput.fill(confirmationValue);
    await page.evaluate(() => {
      window.__passwordToggleSubmitCount = 0;
      document.querySelector("form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        window.__passwordToggleSubmitCount += 1;
      });
    });

    assert.equal(await passwordInput.getAttribute("type"), "password");
    assert.equal(await confirmationInput.getAttribute("type"), "password");
    assert.equal(await passwordToggle.locator("svg").count(), 1);
    assert.equal(await confirmationToggle.locator("svg").count(), 1);

    const toggleBox = await passwordToggle.boundingBox();
    assert.ok(toggleBox);
    assert.ok(toggleBox.width >= 44);
    assert.ok(toggleBox.height >= 44);

    const inputPaddingRight = await passwordInput.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).paddingRight),
    );
    assert.ok(inputPaddingRight >= 48);

    await passwordToggle.click();
    assert.equal(await passwordInput.getAttribute("type"), "text");
    assert.equal(await confirmationInput.getAttribute("type"), "password");
    assert.equal(await passwordInput.inputValue(), passwordValue);
    assert.equal(await confirmationInput.inputValue(), confirmationValue);
    assert.equal(new URL(page.url()).pathname, "/register");
    assert.equal(await page.evaluate(() => window.__passwordToggleSubmitCount), 0);
    assert.equal(
      await page.getByRole("button", { name: "Sembunyikan password", exact: true }).locator("svg").count(),
      1,
    );

    await page.getByRole("button", { name: "Sembunyikan password", exact: true }).click();
    assert.equal(await passwordInput.getAttribute("type"), "password");

    await confirmationToggle.focus();
    await confirmationToggle.press("Enter");
    assert.equal(await passwordInput.getAttribute("type"), "password");
    assert.equal(await confirmationInput.getAttribute("type"), "text");
    assert.equal(await passwordInput.inputValue(), passwordValue);
    assert.equal(await confirmationInput.inputValue(), confirmationValue);
    assert.equal(await page.evaluate(() => window.__passwordToggleSubmitCount), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Sembunyikan konfirmasi password", exact: true })
        .locator("svg")
        .count(),
      1,
    );
  } finally {
    await browser.close();
  }
});

maybeTest("browser auth session reaches profile, survives reload, and logs out", async () => {
  requireAppEnv();
  requireIntegrationEnv();

  const identity = uniqueIdentity("Browser", "825");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${appUrl}/register?next=%2Fme%2Fprofile`);
    await page.getByLabel("Nama lengkap").fill(identity.fullName);
    await page.getByLabel("NIM").fill(identity.nim);
    await page.getByLabel("Email institusional").fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill(identity.passphrase);
    await page.getByLabel("Konfirmasi password", { exact: true }).fill(identity.passphrase);
    await page.getByRole("button", { name: "Daftar" }).click();

    await page.waitForURL((url) => url.pathname === "/auth/check-email", { waitUntil: "commit" });
    await page.goto(`${appUrl}/me/profile`);
    await page.waitForURL("**/login?next=%2Fme%2Fprofile");

    await assertProfileStatus(identity.email, "UNVERIFIED");

    await page.goto(`${appUrl}/login?next=%2Fme%2Fprofile`);
    await page.getByLabel("Email institusional").fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill(identity.passphrase);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.getByText("Email belum dikonfirmasi.").waitFor();

    const confirmationUrl = await findConfirmationUrl(identity.email);
    assert.match(confirmationUrl, /\/auth\/confirm\?/);
    assert.match(confirmationUrl, /token_hash=/);
    assert.match(confirmationUrl, /type=email/);

    await page.goto(confirmationUrl);
    await page.waitForURL("**/me/profile");
    await assertProfileVisible(page, identity.email, identity.nim);
    await assertProfileStatus(identity.email, "UNVERIFIED");

    await page.reload();
    await assertProfileVisible(page, identity.email, identity.nim);

    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL("**/login");

    await page.goto(`${appUrl}/me/profile`);
    await page.waitForURL("**/login?next=%2Fme%2Fprofile");

    await page.goto(`${appUrl}/login?next=%2Fme%2Fprofile`);
    await page.getByLabel("Email institusional").fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.getByText("Email atau password tidak valid.").waitFor();

    await page.getByLabel("Email institusional").fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill(identity.passphrase);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL("**/me/profile");
    await assertProfileVisible(page, identity.email, identity.nim);

    await page.reload();
    await assertProfileVisible(page, identity.email, identity.nim);

    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL("**/login");
    await page.goto(`${appUrl}/me/profile`);
    await page.waitForURL("**/login?next=%2Fme%2Fprofile");
  } finally {
    await browser.close();
  }
});

maybeTest("browser registration duplicates use same safe generic message", async () => {
  assert.ok(appUrl, "NEXT_APP_URL is required");
  requireIntegrationEnv();

  const identity = uniqueIdentity("Duplicate", "535");
  const supabase = createSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email: identity.email,
    password: identity.passphrase,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm?next=%2Fme%2Fprofile`,
      data: {
        full_name: identity.fullName,
        nim: identity.nim,
      },
    },
  });
  assert.equal(error, null);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const safeMessage = "Registrasi tidak dapat diproses. Email atau NIM mungkin sudah digunakan.";

  try {
    await submitRegistration(page, identity);
    await assertRegistrationError(page, safeMessage);

    await submitRegistration(page, {
      ...uniqueIdentity("DuplicateNim", "825"),
      nim: identity.nim,
      email: `duplicatenim.${identity.nim}@stu.untar.ac.id`,
    });
    await assertRegistrationError(page, safeMessage);
  } finally {
    await browser.close();
  }
});

async function submitRegistration(page, identity) {
  await page.goto(`${appUrl}/register?next=%2Fme%2Fprofile`);
  await page.getByLabel("Nama lengkap").fill(identity.fullName);
  await page.getByLabel("NIM").fill(identity.nim);
  await page.getByLabel("Email institusional").fill(identity.email);
  await page.getByLabel("Password", { exact: true }).fill(identity.passphrase);
  await page.getByLabel("Konfirmasi password", { exact: true }).fill(identity.passphrase);
  await page.getByRole("button", { name: "Daftar" }).click();
}

async function assertProfileVisible(page, email, nim) {
  await page.getByRole("heading", { name: "Akun saya" }).waitFor();
  await page.getByText(email).waitFor();
  await page.getByText(nim, { exact: true }).waitFor();
}

async function assertRegistrationError(page, message) {
  await page.getByText(message).waitFor();
}

async function withDatabase(callback) {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.SUPABASE_DB_PORT ?? "54322"),
    user: process.env.SUPABASE_DB_USER ?? "postgres",
    password: process.env.SUPABASE_DB_PASSWORD ?? "postgres",
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
  });

  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function selectProfilesByEmail(email) {
  return withDatabase(async (client) => {
    const result = await client.query(
      `
        select
          profiles.role::text as role,
          profiles.display_name,
          profiles.nim,
          profiles.nim_prefix,
          profiles.program_study_code,
          profiles.cohort_year,
          profiles.verification_status::text as verification_status
        from auth.users
        join public.profiles
          on profiles.id = users.id
        where users.email = $1
      `,
      [email],
    );

    return result.rows;
  });
}

async function assertProfileStatus(email, expectedStatus) {
  const rows = await selectProfilesByEmail(email);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].verification_status, expectedStatus);
}

async function findConfirmationUrl(email) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const messagesResponse = await fetch(`${mailpitUrl}/api/v1/messages?limit=50`);
    assert.equal(messagesResponse.ok, true);

    const mailbox = await messagesResponse.json();
    const messages = mailbox.messages ?? mailbox.Messages ?? [];
    const matchingMessage = messages.find((message) =>
      JSON.stringify(message).toLowerCase().includes(email.toLowerCase()),
    );

    if (matchingMessage) {
      const id = matchingMessage.ID ?? matchingMessage.Id ?? matchingMessage.id;
      const messageResponse = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
      assert.equal(messageResponse.ok, true);

      const message = await messageResponse.json();
      const body = [
        message.HTML,
        message.Text,
        message.HTMLBody,
        message.TextBody,
        message.Body,
        JSON.stringify(message),
      ].filter(Boolean).join("\n");
      const match = body.match(/https?:\/\/[^"'<>\s]+\/auth\/confirm[^"'<>\s]+/);

      if (match) {
        return match[0].replaceAll("&amp;", "&");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Confirmation email not found for ${email}.`);
}
