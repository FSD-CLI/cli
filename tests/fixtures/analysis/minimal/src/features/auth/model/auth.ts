import type { User } from "../../../entities/user/model/user.types";

export type Session = {
  user: User;
  token: string;
};

export function isAuthenticated(session: Session | null): boolean {
  return session !== null && session.token.length > 0;
}
