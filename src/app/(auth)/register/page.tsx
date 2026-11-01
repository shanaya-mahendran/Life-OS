import { AuthForm } from "../AuthForm";

export const metadata = { title: "Create account · LifeOS" };

export default function RegisterPage() {
  return <AuthForm mode="signup" />;
}
