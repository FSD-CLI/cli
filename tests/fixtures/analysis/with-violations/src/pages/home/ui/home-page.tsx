import { Header } from "../../../widgets/header/ui/header";
import { LoginForm } from "../../../features/auth/ui/login-form";

export function HomePage() {
  return (
    <main>
      <Header />
      <LoginForm />
    </main>
  );
}
