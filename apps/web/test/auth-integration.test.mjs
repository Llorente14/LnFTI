import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.RUN_SUPABASE_AUTH_INTEGRATION === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const appUrl = process.env.NEXT_APP_URL;

const maybeTest = enabled ? test : test.skip;

function requireIntegrationEnv() {
  assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
  assert.ok(supabaseKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
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
      data: {
        full_name: "Integration Student",
        nim,
      },
    },
  });

  assert.equal(signupError, null);
  assert.ok(signup.user);

  if (!signup.session) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password: passphrase,
    });

    assert.equal(loginError, null);
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  assert.equal(userError, null);
  assert.equal(userResult.user?.email, email);

  const { count, data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, display_name, nim, nim_prefix, program_study_code, cohort_year, verification_status", {
      count: "exact",
    })
    .eq("id", userResult.user.id);

  assert.equal(profileError, null);
  assert.equal(count, 1);
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
  assert.match(profiles[0].verification_status, /^(PENDING_EMAIL|VERIFIED)$/);

  const secondClient = createSupabaseClient();
  const { error: loginError } = await secondClient.auth.signInWithPassword({
    email,
    password: passphrase,
  });
  assert.equal(loginError, null);

  const { data: firstSessionUser } = await secondClient.auth.getUser();
  const { data: secondSessionUser } = await secondClient.auth.getUser();
  assert.equal(firstSessionUser.user?.id, userResult.user.id);
  assert.equal(secondSessionUser.user?.id, userResult.user.id);

  await secondClient.auth.signOut();
  const { data: signedOutUser } = await secondClient.auth.getUser();
  assert.equal(signedOutUser.user, null);
});

maybeTest("auth integration protects private routes without session", async (t) => {
  if (!appUrl) {
    t.skip("NEXT_APP_URL not set; Next.js route integration skipped.");
    return;
  }

  const response = await fetch(`${appUrl}/me/profile`, {
    redirect: "manual",
  });

  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/login\?next=%2Fme%2Fprofile/);
});
