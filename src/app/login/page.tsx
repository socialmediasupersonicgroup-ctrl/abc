import { redirect } from "next/navigation";
import { authEnabled, safeNextPath } from "@/lib/auth/session";
import { isSignedIn } from "@/server/auth";
import { LogoMark } from "@/components/app/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next);
  if (!authEnabled() || (await isSignedIn())) redirect(target);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-10" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Sign in to NEXUS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the workspace owner password.</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <LoginForm next={target} />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">The password is set by whoever hosts this NEXUS instance (NEXUS_PASSWORD).</p>
      </div>
    </main>
  );
}
