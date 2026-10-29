# Supabase Auth generator contract

Approved October 6, 2026. Candidate implementation; not in npm 2.6.1.

```sh
node bin/index.mjs -g feature auth --auth-provider supabase --dry-run
node bin/index.mjs -g feature auth --auth-provider supabase
```

The default generator keeps its existing example `/auth/*` contract. The opt-in
adapter replaces these example requests with Supabase Auth SDK operations for
all five supported frontend frameworks. It writes only inside the auth slice;
it does not install dependencies, configure a remote project or edit environment
files. Install `@supabase/supabase-js` using the application's package manager.
The verified SDK2.117.2 requires Node>=22; check the installed SDK engine before
adding it to a project. This does not change the CLI runtime engine.
With server state disabled, wire form submit events to the exported API methods.

## Browser bootstrap

Create a browser SDK client using the application's **public URL and publishable
or anon key**, then call `configureSupabaseAuth(client)` from the slice's public
API before submitting forms. Read framework-specific public environment values
in application bootstrap; the generator reads no environment variables or keys.
Never use a secret or service-role key in frontend code.

```ts
import { createClient } from '@supabase/supabase-js';
import { configureSupabaseAuth } from '@/features/auth';

// publicUrl and publishableKey come from this application's public configuration.
const client = createClient(publicUrl, publishableKey);
configureSupabaseAuth(client);
```

Use the framework's client/bootstrap boundary. The module is safe to import
during SSR, but configuring its browser singleton on the server is rejected.
SSR sessions, cookies, callback routes and authorization require a separate
request-scoped server integration following
[Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side).
The browser adapter never grants server authorization.

## Operations

| Operation | Provider method | Result and failure contract |
| --- | --- | --- |
| Login | `signInWithPassword` | Session normalized to user/id/email/name + accessToken; absent session and provider errors reject |
| Registration | `signUp` | Session or `null` when email confirmation is required; UI must display confirmation instructions |
| Forgot password | `resetPasswordForEmail` | Generic eligibility message; provider failures reject |
| Verify code | `verifyOtp` with recovery type | Recovery OTP, not signup OTP; verified identity must match the submitted email |
| Reset password | Verify recovery OTP then `updateUser` | Matching password confirmation and recovery proof required; already verified OTP is consumed once |
| Logout | `signOut` | Revokes provider session; clearing local UI state alone is not logout |

Configure the Supabase recovery email template to expose `{{ .Token }}` for this
OTP workflow. The generated reset form uses email/code/password/confirmation
across frameworks. A normal confirmation-link flow must use the application's
SDK callback integration; an arbitrary link token is not a recovery OTP.

The SDK owns persistence and refresh. Subscribe to `onAuthStateChange` in browser
bootstrap to update the application's state store and clear it on logout. The
generated state stores do not automatically become session authorities. Do not
log credentials, OTPs or tokens. Provider error responses are mapped to a generic
failure; transport exceptions must be handled by the application error boundary.

## Verification and release acceptance

Unit tests verify normalization, confirmation-required signup, failure paths,
recovery identity/OTP consumption, password mismatch, logout, server singleton
rejection and read-only output plans across five frameworks. These use an SDK
contract double and do not prove backend integration. The generated declaration
was also typechecked against the actual @supabase/supabase-js2.117.2 SDK.

Before claiming live acceptance, use an isolated Supabase test project to check
signup/confirmation/login, invalid credentials, recovery mail and expired code,
reset/login with new password, refresh, logout, RLS rejection without a valid
session and request-scoped SSR where required. No production account or private
project is used automatically. Retain redacted logs and exact versions.

Source references: [password login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[signup](https://supabase.com/docs/reference/javascript/auth-signup),
[password update](https://supabase.com/docs/reference/javascript/auth-updateuser).
