// VIOLATION (INT-04 fixture): a feature must never import from a page.
// features/auth -> pages/home is an upward import.
import { HomePage } from "../../../pages/home/ui/home-page";
import type { User } from "../../../entities/user/model/user.types";

export type Session = {
  user: User;
  token: string;
};

export function isAuthenticated(session: Session | null): boolean {
  void HomePage;
  return session !== null && session.token.length > 0;
}
