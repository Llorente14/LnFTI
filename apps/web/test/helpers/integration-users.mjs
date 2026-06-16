import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function createSupabaseClient(env) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createInstitutionalIdentity(label, prefix = "535") {
  const sequence = String(randomInt(100_000, 999_999));
  const nim = `${prefix}25${sequence.slice(0, 4)}`;
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "");

  return {
    fullName: `MVP ${label} ${sequence}`,
    nim,
    email: `${slug}.${nim}@stu.untar.ac.id`,
    passphrase: `LnftiMvp${sequence}!`,
  };
}

export async function signUpTestUser(env, identity) {
  const supabase = createSupabaseClient(env);
  const { data, error } = await supabase.auth.signUp({
    email: identity.email,
    password: identity.passphrase,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/confirm?next=%2Fme%2Fprofile`,
      data: {
        full_name: identity.fullName,
        nim: identity.nim,
      },
    },
  });

  assert.equal(error, null);
  assert.ok(data.user);
  return data.user.id;
}

export async function confirmAndVerifyTestUser(client, userId) {
  await client.query(
    `
      update auth.users
      set email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = $1
    `,
    [userId],
  );
  await client.query(
    `
      update public.profiles
      set verification_status = 'VERIFIED'
      where id = $1
    `,
    [userId],
  );
}

export async function setTestUserRole(client, userId, role) {
  assert.ok(["student", "verifier", "admin"].includes(role));
  await client.query(
    `
      update public.profiles
      set role = $2::public.application_role
      where id = $1
    `,
    [userId, role],
  );
}

export async function loginThroughUi(page, env, identity, next = "/me/profile") {
  await page.goto(`${env.appUrl}/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email institusional").fill(identity.email);
  await page.getByLabel("Password").fill(identity.passphrase);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(`**${next}`);
}
