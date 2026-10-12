"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { FlaskConical, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { workspaceSchema, type WorkspaceFormValues, type WorkspaceInput } from "@/lib/validation";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { TIMEZONES } from "@/lib/dates";
import { clearWorkspaceDataAction, deleteWorkspaceAction, loadDemoWorkspaceAction, updateWorkspaceAction } from "@/server/actions/workspace";
import { runClientAction } from "@/lib/client/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export function WorkspaceForm({ initial }: { initial: WorkspaceFormValues }) {
  const form = useForm<WorkspaceFormValues, unknown, WorkspaceInput>({ resolver: zodResolver(workspaceSchema), defaultValues: initial });
  const { register, handleSubmit, formState, setError, getValues, reset } = form;
  const e = formState.errors;
  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const res = await runClientAction(updateWorkspaceAction(values), { setError });
    if (res) reset(values);
  });
  const tzs = TIMEZONES.includes(initial.timezone) ? TIMEZONES : [initial.timezone, ...TIMEZONES];
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Applies to everyone using this workspace on this server.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workspace / business name" htmlFor="ws-name" error={e.name?.message} required hint="Shown on invoices.">
              <Input id="ws-name" {...register("name")} aria-invalid={!!e.name} />
            </Field>
            <Field label="Default currency" htmlFor="ws-currency" hint="Used for new records and all summaries.">
              <Select id="ws-currency" {...register("currency")}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time zone" htmlFor="ws-tz" error={e.timezone?.message} hint="Calendar times and “today” use this zone.">
              <Select id="ws-tz" {...register("timezone")}>
                {tzs.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Week starts on" htmlFor="ws-week">
              <Select id="ws-week" {...register("weekStartsOn")}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            </Field>
            <Field label="Invoice number prefix" htmlFor="ws-prefix" error={e.invoicePrefix?.message} hint="e.g. INV- → INV-0001">
              <Input id="ws-prefix" {...register("invoicePrefix")} />
            </Field>
            <Field label="Default tax rate (%)" htmlFor="ws-tax" error={e.defaultTaxRate?.message} hint="Pre-filled on new invoices.">
              <Input id="ws-tax" inputMode="decimal" {...register("defaultTaxRate")} />
            </Field>
          </div>
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Owner profile</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" htmlFor="ws-owner" error={e.ownerName?.message} hint="Used in greetings and on invoices.">
                <Input id="ws-owner" {...register("ownerName")} />
              </Field>
              <Field label="Contact email" htmlFor="ws-email" error={e.ownerEmail?.message} hint="Printed on invoices. Never used to send email.">
                <Input id="ws-email" type="email" {...register("ownerEmail")} aria-invalid={!!e.ownerEmail} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export function ThemeCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Saved in this browser only.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {options.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={mounted && theme === o.value}
              onClick={() => setTheme(o.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 text-[13px] font-medium transition-colors hover:bg-accent",
                mounted && theme === o.value && "border-primary bg-primary-soft text-primary",
              )}
            >
              <o.icon className="size-4" />
              {o.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DataCard({ workspaceName, isDemo, stats, workspaceCount }: { workspaceName: string; isDemo: boolean; stats: Record<string, number>; workspaceCount: number }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"demo" | "clear" | "delete" | null>(null);
  const [confirmText, setConfirmText] = React.useState("");
  React.useEffect(() => setConfirmText(""), [dialog]);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Data management</CardTitle>
          <CardDescription>
            {total.toLocaleString("en-IN")} records in this workspace · {Object.entries(stats).map(([k, v]) => `${v} ${k}`).join(" · ")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium">{isDemo ? "Reset demo data" : "Open demo workspace"}</p>
            <p className="text-xs text-muted-foreground">
              {isDemo
                ? "Replaces everything in this demo workspace with fresh sample data."
                : "Creates (or refreshes) a separate workspace with fictional sample data. Your current workspace is not touched."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDialog("demo")}>
            <FlaskConical /> {isDemo ? "Reset demo data" : "Open demo workspace"}
          </Button>
        </div>
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium">Delete all data in this workspace</p>
            <p className="text-xs text-muted-foreground">Removes every task, project, customer, invoice, transaction, event, content item and note. Settings are kept.</p>
          </div>
          <Button variant="destructive-ghost" size="sm" onClick={() => setDialog("clear")} disabled={total === 0}>
            <Trash2 /> Delete all data
          </Button>
        </div>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium">Delete workspace</p>
            <p className="text-xs text-muted-foreground">{workspaceCount > 1 ? "Deletes the workspace and all of its data." : "You can't delete your only workspace."}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDialog("delete")} disabled={workspaceCount <= 1}>
            <Trash2 /> Delete workspace
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={dialog === "demo"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={isDemo ? "Reset demo data?" : "Open the demo workspace?"}
        description={
          isDemo
            ? "All records in this demo workspace will be replaced with fresh sample data."
            : "NEXUS will switch you to a separate “Demo Studio (sample data)” workspace. If it already exists, its data is refreshed."
        }
        confirmLabel={isDemo ? "Reset demo" : "Open demo"}
        destructive={isDemo}
        onConfirm={async () => {
          const res = await runClientAction(loadDemoWorkspaceAction());
          if (res) router.push("/");
          return !!res;
        }}
      />
      <ConfirmDialog
        open={dialog === "clear" || dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === "delete" ? "Delete this workspace?" : "Delete all workspace data?"}
        description={`This cannot be undone. Type “${workspaceName}” to confirm.`}
        confirmLabel={dialog === "delete" ? "Delete workspace" : "Delete all data"}
        onConfirm={async () => {
          if (confirmText.trim() !== workspaceName) return false;
          const res = await runClientAction(dialog === "delete" ? deleteWorkspaceAction(confirmText) : clearWorkspaceDataAction(confirmText));
          if (res) router.push("/");
          return !!res;
        }}
      >
        <Field label="Workspace name" htmlFor="confirm-name">
          <Input id="confirm-name" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={workspaceName} autoComplete="off" />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}
