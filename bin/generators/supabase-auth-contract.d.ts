import type { AuthSession } from "../model/auth.types";
interface ProviderUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}
interface ProviderResult {
  data: {
    session?: { access_token: string; user: ProviderUser } | null;
    user?: ProviderUser | null;
  } | null;
  error: { message: string } | null;
}
export interface SupabaseAuthClient {
  auth: {
    signInWithPassword(input: {
      email: string;
      password: string;
    }): Promise<ProviderResult>;
    signUp(input: {
      email: string;
      password: string;
      options: { data: { name: string } };
    }): Promise<ProviderResult>;
    resetPasswordForEmail(email: string): Promise<ProviderResult>;
    verifyOtp(input: {
      email: string;
      token: string;
      type: "recovery";
    }): Promise<ProviderResult>;
    updateUser(input: { password: string }): Promise<ProviderResult>;
    signOut(): Promise<{ error: { message: string } | null }>;
  };
}
export interface SupabaseAuthAdapter {
  login(input: { email: string; password: string }): Promise<AuthSession>;
  register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthSession | null>;
  forgotPassword(input: { email: string }): Promise<{ message: string }>;
  verifyCode(input: {
    email: string;
    code: string;
  }): Promise<{ isValid: boolean }>;
  resetPassword(input: {
    email: string;
    code: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<{ message: string }>;
  logout(): Promise<void>;
}
export function createSupabaseAuthAdapter(
  client: SupabaseAuthClient,
): SupabaseAuthAdapter;
export function configureSupabaseAuth(
  client: SupabaseAuthClient,
): SupabaseAuthAdapter;
export function getSupabaseAuth(): SupabaseAuthAdapter;
