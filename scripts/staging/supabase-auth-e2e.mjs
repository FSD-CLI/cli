// Live acceptance for the generated Supabase browser auth adapter against an
// isolated staging project. Public URL and publishable key only; test users and
// recovery codes are provisioned out of band (see docs/AUTH-SUPABASE-CONTRACT.md).
//
//   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... E2E_EMAIL=... E2E_PASSWORD=... \
//   node scripts/staging/supabase-auth-e2e.mjs session
//   ... E2E_NEW_PASSWORD=... E2E_RECOVERY_CODE=... node scripts/staging/supabase-auth-e2e.mjs recovery
//
// Requires @supabase/supabase-js resolvable from the working directory.
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createSupabaseAuthAdapter } from "../../bin/generators/supabase-auth-adapter.mjs";

const require = createRequire(path.join(process.cwd(), "noop.js"));
const { createClient } = await import(pathToFileURL(require.resolve("@supabase/supabase-js")).href);
const sdkVersion = require("@supabase/supabase-js/package.json").version;

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const url = env("SUPABASE_URL");
const key = env("SUPABASE_PUBLISHABLE_KEY");
if (/service_role|sb_secret_/.test(key)) throw new Error("Use a publishable/anon key, never a secret key.");
const email = env("E2E_EMAIL");
const phase = process.argv[2];

const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.log(`FAIL  ${name} — ${error.message}`);
  }
}
const rejects = async (promise, label) => {
  try {
    await promise;
  } catch {
    return;
  }
  throw new Error(`${label} resolved`);
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

console.log(`Supabase auth staging E2E — phase ${phase}, @supabase/supabase-js ${sdkVersion}, Node ${process.version}`);

if (phase === "session") {
  const password = env("E2E_PASSWORD");
  const client = newClient();
  const auth = createSupabaseAuthAdapter(client);

  await check("RLS rejects reads and writes without a session", async () => {
    const anon = newClient();
    const read = await anon.from("e2e_notes").select("id");
    const write = await anon.from("e2e_notes").insert({ body: "anon" });
    assert(read.error || read.data.length === 0, "anonymous read returned rows");
    assert(write.error, "anonymous insert succeeded");
    return `read: ${read.error ? read.error.code : "0 rows"}, write: ${write.error.code}`;
  });
  await check("invalid credentials reject with the generic error", async () => {
    try {
      await auth.login({ email, password: `${password}-wrong` });
    } catch (error) {
      assert(error.message === "Authentication request failed.", `unexpected message: ${error.message}`);
      return;
    }
    throw new Error("login with a wrong password resolved");
  });
  let first;
  await check("login returns a normalized session", async () => {
    first = await auth.login({ email, password });
    assert(first.user.email === email && first.user.id && first.accessToken, "session is not normalized");
    return `user ${first.user.id.slice(0, 8)}…, name "${first.user.name}"`;
  });
  await check("RLS allows the owner with a valid session", async () => {
    const insert = await client.from("e2e_notes").insert({ body: "owner note" }).select("owner");
    assert(!insert.error, insert.error?.message);
    const read = await client.from("e2e_notes").select("owner");
    assert(!read.error && read.data.length >= 1 && read.data.every((row) => row.owner === first.user.id), "owner cannot read own rows");
    return `${read.data.length} own row(s)`;
  });
  await check("SDK refresh issues a new access token", async () => {
    const { data, error } = await client.auth.refreshSession();
    assert(!error && data.session?.access_token, error?.message ?? "no session");
    assert(data.session.access_token !== first.accessToken, "access token unchanged");
    return "token rotated";
  });
  let refreshToken;
  await check("logout revokes the provider session", async () => {
    refreshToken = (await client.auth.getSession()).data.session?.refresh_token;
    await auth.logout();
    const { data } = await client.auth.getSession();
    assert(!data.session, "local session still present");
    const reuse = await newClient().auth.refreshSession({ refresh_token: refreshToken });
    assert(reuse.error, "revoked refresh token still issues sessions");
    return `refresh after logout: ${reuse.error.code ?? reuse.error.status}`;
  });
  await check("RLS rejects after logout", async () => {
    const read = await client.from("e2e_notes").select("id");
    assert(read.error || read.data.length === 0, "logged-out client still reads rows");
    return read.error ? read.error.code : "0 rows";
  });
  await check("registration of an existing email does not create a session", async () => {
    const result = await auth.register({ name: "Dup", email, password: `${password}-dup` }).catch((error) => error);
    assert(result === null || result instanceof Error, "duplicate signup returned a session");
    return result === null ? "null session (confirmation contract)" : "rejected";
  });
} else if (phase === "recovery") {
  const password = env("E2E_PASSWORD");
  const newPassword = env("E2E_NEW_PASSWORD");
  const code = env("E2E_RECOVERY_CODE");
  const client = newClient();
  const auth = createSupabaseAuthAdapter(client);

  await check("a wrong recovery code is rejected", () =>
    rejects(auth.verifyCode({ email, code: code === "000000" ? "111111" : "000000" }), "wrong code"));
  await check("mismatched password confirmation is rejected before any request", () =>
    rejects(auth.resetPassword({ email, code, password: newPassword, passwordConfirmation: `${newPassword}x` }), "mismatch"));
  await check("verify code then reset password", async () => {
    const verified = await auth.verifyCode({ email, code });
    assert(verified.isValid, "code not valid");
    const reset = await auth.resetPassword({ email, code, password: newPassword, passwordConfirmation: newPassword });
    return reset.message;
  });
  await check("a consumed recovery code cannot be reused", () =>
    rejects(createSupabaseAuthAdapter(newClient()).verifyCode({ email, code }), "reused code"));
  await check("the old password no longer logs in", () =>
    rejects(createSupabaseAuthAdapter(newClient()).login({ email, password }), "old password"));
  await check("the new password logs in", async () => {
    const session = await createSupabaseAuthAdapter(newClient()).login({ email, password: newPassword });
    assert(session.user.email === email, "wrong user");
    return "session issued";
  });
} else if (phase === "expired") {
  const code = env("E2E_RECOVERY_CODE");
  await check("an expired recovery code is rejected", () =>
    rejects(createSupabaseAuthAdapter(newClient()).verifyCode({ email, code }), "expired code"));
} else {
  throw new Error("Phase must be session, recovery or expired.");
}

const failed = results.filter((item) => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exitCode = failed ? 1 : 0;
