import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Construction OS" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  if (session?.userId) redirect(callbackUrl);

  const errorMessage =
    params.error === "CredentialsSignin"
      ? "Email or password is incorrect."
      : params.error
        ? "Sign-in failed. Please try again."
        : null;

  return (
    <main className="login-shell">
      <div className="login-card">
        <header>
          <h1>Construction OS</h1>
          <p>Sign in to your tenant workspace.</p>
        </header>
        <LoginForm callbackUrl={callbackUrl} initialError={errorMessage} />
        <footer>
          <p>Demo accounts (password: <code>demo1234</code>)</p>
          <ul>
            <li>admin@construction.local</li>
            <li>exec@construction.local</li>
            <li>pm@construction.local</li>
            <li>super@construction.local</li>
          </ul>
        </footer>
      </div>
    </main>
  );
}
