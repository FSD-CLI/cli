import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSupabaseAuthAdapter, configureSupabaseAuth } from '../bin/generators/supabase-auth-adapter.mjs';
import { createGeneratorPlan } from '../bin/generator.mjs';
import { normalizeProjectConfig } from '../bin/project-config.mjs';
import { parseCliArgs } from '../bin/cli/args.mjs';
const user = { id: 'user-1', email: 'test@example.com', user_metadata: { name: 'Test' } };
const session = { user, access_token: 'test-token' };
function fixture(overrides = {}) {
  const calls = [];
  const auth = Object.fromEntries(['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'verifyOtp', 'updateUser', 'signOut'].map(method => [method, async input => {
    calls.push({ method, input });
    return overrides[method] ?? { data: { user, session }, error: null };
  }]));
  return { adapter: createSupabaseAuthAdapter({ auth }), calls };
}
test('Supabase password login maps its real session shape and confirmation signup returns null', async () => {
  const { adapter } = fixture({ signUp: { data: { user, session: null }, error: null } });
  assert.deepEqual(await adapter.login({ email: user.email, password: 'password' }), { user: { id: user.id, email: user.email, name: 'Test' }, accessToken: session.access_token });
  assert.equal(await adapter.register({ email: user.email, name: 'Test', password: 'password' }), null);
});
test('Supabase provider failures and absent login session cannot become authenticated success', async () => {
  for (const result of [{ data: { session: null }, error: null }, { data: null, error: { message: 'internal sensitive diagnostic' } }]) {
    await assert.rejects(fixture({ signInWithPassword: result }).adapter.login({ email: user.email, password: 'wrong' }), /^Error: Authentication request failed\.$/);
  }
});
test('recovery OTP is verified once, identity is checked and consumed before changing password', async () => {
  const { adapter, calls } = fixture();
  await adapter.forgotPassword({ email: user.email });
  await adapter.verifyCode({ email: user.email, code: '123456' });
  await adapter.resetPassword({ email: user.email, code: '123456', password: 'new-password', passwordConfirmation: 'new-password' });
  assert.equal(calls.filter(c => c.method === 'verifyOtp').length, 1);
  assert.deepEqual(calls.find(c => c.method === 'verifyOtp').input, { email: user.email, token: '123456', type: 'recovery' });
  await adapter.resetPassword({ email: user.email, code: '123456', password: 'another-password', passwordConfirmation: 'another-password' });
  assert.equal(calls.filter(c => c.method === 'verifyOtp').length, 2);
});
test('failed/foreign recovery and password mismatch cannot invoke updateUser', async () => {
  for (const result of [{ data: null, error: { message: 'expired' } }, { data: { session, user: { ...user, email: 'other@example.com' } }, error: null }]) {
    const { adapter, calls } = fixture({ verifyOtp: result });
    await assert.rejects(adapter.resetPassword({ email: user.email, code: '123456', password: 'new-password', passwordConfirmation: 'new-password' }));
    assert.equal(calls.some(c => c.method === 'updateUser'), false);
  }
  const { adapter, calls } = fixture();
  await assert.rejects(adapter.resetPassword({ email: user.email, code: '123456', password: 'one', passwordConfirmation: 'two' }), /Passwords must match/);
  assert.equal(calls.length, 0);
});
test('logout revokes the provider session and server singleton configuration is rejected', async () => {
  const { adapter, calls } = fixture();
  await adapter.logout();
  assert.equal(calls[0].method, 'signOut');
  assert.throws(() => configureSupabaseAuth({}), /request-scoped server integration/);
});
test('Supabase flag validation rejects typos and unrelated slices', () => {
  assert.equal(parseCliArgs(['-g', 'feature', 'auth', '--auth-provider', 'supabase']).authProvider, 'supabase');
  assert.equal(parseCliArgs(['-g', 'feature', 'auth', '--auth-provider=supabase']).authProvider, 'supabase');
  assert.throws(() => parseCliArgs(['-g', 'feature', 'auth', '--auth-provider']), /supports only supabase/);
  assert.throws(() => createGeneratorPlan({ cwd: os.tmpdir(), type: 'entity', name: 'product', config: normalizeProjectConfig('react-vite'), authProvider: 'supabase' }), /only valid for feature auth/);
});
for (const framework of ['react-vite', 'nextjs', 'vue-vite', 'nuxt', 'sveltekit']) {
  test(`${framework}: Supabase preview emits provider calls and consistent recovery fields without writing`, () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fsd-supabase-'));
    try {
      const plan = createGeneratorPlan({ cwd, type: 'feature', name: 'auth', config: normalizeProjectConfig(framework), authProvider: 'supabase' });
      const adapter = plan.files.find(f => f.path === 'api/supabase.adapter.js').content;
      assert.match(adapter, /signInWithPassword/);
      assert.doesNotMatch(adapter, /process\.env|import\.meta\.env|service_role|sb_secret_/);
      const reset = plan.files.find(f => f.path === 'api/reset-password.api.ts').content;
      assert.match(reset, /getSupabaseAuth\(\)\.resetPassword/);
      assert(plan.files.some(f => f.path === 'api/supabase.adapter.d.ts'));
      assert(plan.files.some(f => f.path === 'SUPABASE.md'));
      assert.equal(fs.readdirSync(cwd).length, 0);
      if (['vue-vite', 'nuxt', 'sveltekit'].includes(framework)) assert.match(plan.files.find(f => f.path === 'model/auth.types.ts').content, /ResetPasswordPayload = \{ email: string; code: string;/);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  });
}
