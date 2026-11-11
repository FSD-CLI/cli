import { Button } from "../../shared/ui/button";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Button label="Sign in" />
      {children}
    </div>
  );
}
