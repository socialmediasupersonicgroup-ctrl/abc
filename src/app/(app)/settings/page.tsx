import { getContext } from "@/server/workspace";
import { authEnabled } from "@/lib/auth/session";
import { hasMoneyRecords, listWorkspaces, workspaceStats } from "@/lib/services/workspaces";
import { minorToInput } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { DataCard, ThemeCard, WorkspaceForm } from "@/components/settings/settings-forms";
import pkg from "../../../../package.json";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { ws } = await getContext();
  const [stats, workspaces, currencyLocked] = await Promise.all([workspaceStats(ws.id), listWorkspaces(), hasMoneyRecords(ws.id)]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Settings" description={`Preferences for ${ws.name}`} />
      <WorkspaceForm
        currencyLocked={currencyLocked}
        initial={{
          name: ws.name,
          currency: ws.currency as never,
          timezone: ws.timezone,
          weekStartsOn: ws.weekStartsOn,
          invoicePrefix: ws.invoicePrefix,
          defaultTaxRate: minorToInput(ws.defaultTaxBps).replace(/\.00$/, ""),
          ownerName: ws.ownerName,
          ownerEmail: ws.ownerEmail,
        }}
      />
      <ThemeCard />
      <DataCard workspaceName={ws.name} isDemo={ws.isDemo} stats={stats} workspaceCount={workspaces.length} />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>About NEXUS</CardTitle>
            <CardDescription>Version {pkg.version}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px] text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Access.</strong>{" "}
            {authEnabled()
              ? "Protected by the owner password (NEXUS_PASSWORD). Anyone who knows it has full access to every workspace."
              : "No password is set (NEXUS_PASSWORD), so anyone who can reach this server can use every workspace. Set one before exposing NEXUS on a network."}
          </p>
          <p>
            <strong className="font-medium text-foreground">Storage.</strong> Data is stored in a local SQLite database file (see <code className="font-mono text-xs">DATABASE_URL</code>). Back it up by copying the
            file while the app is stopped.
          </p>
          <p>
            <strong className="font-medium text-foreground">Integrations.</strong> NEXUS does not send email, sync calendars or post to social platforms. Links open your own apps.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
