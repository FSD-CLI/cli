// Framework-independent Supabase Auth adapter. No key, URL or server secret is read here.
export function createSupabaseAuthAdapter(client) {
  let recovery = null;
  const fail = () => {
    throw new Error("Authentication request failed.");
  };
  const checked = async (request) => {
    const result = await request;
    if (!result || result.error) fail();
    return result.data;
  };
  const session = (value) => {
    if (!value?.access_token || !value.user?.id || !value.user.email) fail();
    return {
      user: {
        id: value.user.id,
        email: value.user.email,
        name:
          typeof value.user.user_metadata?.name === "string"
            ? value.user.user_metadata.name
            : "",
      },
      accessToken: value.access_token,
    };
  };
  return {
    async login(payload) {
      recovery = null;
      return session(
        (await checked(client.auth.signInWithPassword(payload))).session,
      );
    },
    async register({ name, email, password }) {
      recovery = null;
      const data = await checked(
        client.auth.signUp({ email, password, options: { data: { name } } }),
      );
      // Email confirmation may legitimately return no session.
      return data.session ? session(data.session) : null;
    },
    async forgotPassword({ email }) {
      recovery = null;
      await checked(client.auth.resetPasswordForEmail(email));
      return {
        message:
          "If this account is eligible, recovery instructions have been sent.",
      };
    },
    async verifyCode({ email, code }) {
      recovery = null;
      const data = await checked(
        client.auth.verifyOtp({ email, token: code, type: "recovery" }),
      );
      if (!data.session || data.user?.email !== email) fail();
      recovery = { email, code };
      return { isValid: true };
    },
    async resetPassword({ email, code, password, passwordConfirmation }) {
      if (!password || password !== passwordConfirmation)
        throw new Error("Passwords must match.");
      if (!recovery || recovery.email !== email || recovery.code !== code) {
        await this.verifyCode({ email, code });
      }
      // Consume the verified recovery state even if update fails. Never retry without fresh proof.
      recovery = null;
      const data = await checked(client.auth.updateUser({ password }));
      if (data.user?.email !== email) fail();
      return { message: "Password updated." };
    },
    async logout() {
      recovery = null;
      const result = await client.auth.signOut();
      if (result.error) fail();
    },
  };
}

let browserAdapter;
export function configureSupabaseAuth(client) {
  if (typeof window === "undefined") {
    throw new Error(
      "Configure Supabase Auth in the browser. SSR requires a request-scoped server integration.",
    );
  }
  browserAdapter = createSupabaseAuthAdapter(client);
  return browserAdapter;
}

export function getSupabaseAuth() {
  if (!browserAdapter || typeof window === "undefined") {
    throw new Error(
      "Configure the browser Supabase Auth client before submitting a form.",
    );
  }
  return browserAdapter;
}
