"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Password" htmlFor="password" error={state.error}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus aria-invalid={!!state.error} maxLength={256} />
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        {!pending && <Lock />} Sign in
      </Button>
    </form>
  );
}
