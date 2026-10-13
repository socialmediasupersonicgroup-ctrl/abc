import { prisma } from "@/lib/db";
import { authEnabled } from "@/lib/auth/session";
import { getContext } from "@/server/workspace";
import { listWorkspaces } from "@/lib/services/workspaces";
import { getAlerts } from "@/lib/services/notifications";
import { AppProvider } from "@/components/app/app-context";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { CommandPalette } from "@/components/app/command-palette";
import { CreateDialogs } from "@/components/app/create-dialogs";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { ws, today } = await getContext();
  const [workspaces, projects, customers, tasks, alerts] = await Promise.all([
    listWorkspaces(),
    prisma.project.findMany({
      where: { workspaceId: ws.id },
      select: { id: true, name: true, status: true, customerId: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true, company: true }, orderBy: { name: "asc" } }),
    prisma.task.findMany({
      where: { workspaceId: ws.id, status: { not: "DONE" } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    getAlerts(ws.id, today, new Date(), ws.currency),
  ]);

  return (
    <AppProvider
      workspace={{
        id: ws.id,
        name: ws.name,
        currency: ws.currency,
        timezone: ws.timezone,
        isDemo: ws.isDemo,
        invoicePrefix: ws.invoicePrefix,
        defaultTaxBps: ws.defaultTaxBps,
        weekStartsOn: ws.weekStartsOn,
        ownerName: ws.ownerName,
      }}
      workspaces={workspaces}
      today={today}
      options={{ projects, customers, tasks }}
    >
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar alerts={alerts} authEnabled={authEnabled()} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
      <CommandPalette />
      <CreateDialogs />
    </AppProvider>
  );
}
