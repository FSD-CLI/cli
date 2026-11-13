import { isAuthenticated, type Session } from "../model/auth";
import type { User } from "../../../entities/user/model/user.types";
import { Button } from "../../../shared/ui/button";

export function LoginForm({ session }: { session: Session | null }) {
  const user: User | null = session?.user ?? null;
  return (
    <form>
      {user ? <p>Signed in as {user.name}</p> : <p>Please sign in</p>}
      <Button label={isAuthenticated(session) ? "Continue" : "Sign in"} />
    </form>
  );
}
