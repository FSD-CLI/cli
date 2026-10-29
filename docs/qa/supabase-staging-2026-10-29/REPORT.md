# Supabase auth adapter — staging acceptance (2026-10-29)

Live run of the generated browser adapter (`bin/generators/supabase-auth-adapter.mjs`,
the exact module the CLI writes into the auth slice) against an isolated Supabase
project. ClickUp task 18.

| | |
| --- | --- |
| Project | `fsd-cli-auth-staging` (free tier, eu-central-1), created for this run; no production data |
| SDK | `@supabase/supabase-js` 2.118.0 |
| Runtime | Node v24.21.0 (browser singleton bypassed by calling `createSupabaseAuthAdapter` directly) |
| Keys | Public URL and publishable key only; no secret/service-role key |
| Harness | `scripts/staging/supabase-auth-e2e.mjs` (phases `session`, `recovery`, `expired`) |
| RLS fixture | `public.e2e_notes`, RLS on; `authenticated` may select/insert only rows where `owner = auth.uid()`; `anon` has no grants |

## Results — 15/15 checks pass

**Session** ([log](session.log)) — 8/8
- RLS rejects anonymous read and write (`42501`)
- invalid credentials reject with the adapter's generic error
- login returns the normalized session (id, email, `user_metadata.name`, access token)
- RLS allows the owner to insert and read only their own rows
- SDK `refreshSession` rotates the access token
- adapter `logout` revokes the provider session: the old refresh token is rejected (`refresh_token_not_found`)
- RLS rejects after logout (`42501`)
- registering an existing email returns no session (confirmation contract)

**Recovery** ([log](recovery.log)) — 6/6
- a wrong recovery code is rejected
- mismatched password confirmation is rejected before any request
- `verifyCode` then `resetPassword` updates the password
- the consumed recovery code cannot be reused
- the old password no longer logs in; the new password does

**Expiry** ([log](expired.log)) — 1/1
- a recovery code older than the OTP lifetime is rejected; the provider error is `otp_expired` (403)

## How users and codes were provisioned

The project's default SMTP only delivers to team members and rejects addresses
whose domain has no mail exchanger (`email_address_invalid`), so no mailbox was
used. The test user was inserted as a confirmed user via SQL with a bcrypt hash
computed locally (the password never left the machine). Recovery codes were
placed the way delivery would: `auth.users.recovery_token` and an
`auth.one_time_tokens` row hold `sha224(email + code)`, with `recovery_sent_at`
now (valid) or two hours ago (expired). Everything after that — verification,
consumption, expiry, password update, sessions, refresh, revocation and RLS —
ran through the real Auth and PostgREST APIs.

## Not covered

- **Email delivery and the signup confirmation link.** Needs project SMTP (or a
  team mailbox). The adapter's confirmation-required path (`register` → `null`)
  is exercised; the click-through confirmation is not.
- **`forgotPassword` sending mail.** Same SMTP limit; the request/response
  mapping is unit-tested.
- **Request-scoped SSR authorization.** Out of the browser adapter's scope by
  contract.
- Supabase advisor on this project: leaked-password protection is disabled
  (project setting). Applications should enable it.
