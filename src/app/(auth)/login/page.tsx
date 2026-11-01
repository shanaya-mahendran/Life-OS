import { AuthForm } from "../AuthForm";

export const metadata = { title: "Sign in · LifeOS" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="signin" next={params.next} notice={params.notice} />;
}
