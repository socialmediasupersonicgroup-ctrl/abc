import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext } from "@/server/workspace";
import { listInvoices } from "@/lib/services/invoices";
import { str, type SearchParams } from "@/server/load";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { InvoicesView } from "@/components/finance/invoices-view";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId, today, currency } = await getContext();
  const [invoices, all] = await Promise.all([
    listInvoices(workspaceId, { q: str(sp.q), status: str(sp.status), customerId: str(sp.customerId), sort: str(sp.sort) }, today),
    listInvoices(workspaceId, {}, today),
  ]);
  // Summary is computed over all invoices so it doesn't change with list filters.
  const billable = all.filter((i) => i.effectiveStatus !== "DRAFT" && i.effectiveStatus !== "CANCELLED");
  const invoiced = billable.reduce((s, i) => s + i.total, 0);
  const collected = billable.reduce((s, i) => s + i.amountPaid, 0);
  const outstanding = billable.reduce((s, i) => s + i.balance, 0);
  const overdue = billable.filter((i) => i.effectiveStatus === "OVERDUE").reduce((s, i) => s + i.balance, 0);
  const drafts = all.filter((i) => i.effectiveStatus === "DRAFT").length;
  const m = (v: number) => formatMoney(v, currency);

  return (
    <>
      <PageHeader
        title="Finance"
        description="Bill customers and track what has been collected."
        actions={
          <Button asChild>
            <Link href="/finance/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
        }
      />
      <FinanceTabs />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Invoiced", value: m(invoiced), hint: `${billable.length} issued · ${drafts} draft${drafts === 1 ? "" : "s"} excluded`, id: "inv-invoiced" },
          { label: "Collected", value: m(collected), hint: "Payments recorded against invoices", id: "inv-collected" },
          { label: "Outstanding", value: m(outstanding), hint: "Issued and not yet paid", id: "inv-outstanding" },
          { label: "Overdue", value: m(overdue), hint: "Past due date with a balance", id: "inv-overdue", danger: overdue > 0 },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-[13px] font-medium text-muted-foreground">{c.label}</p>
            <p className={`mt-1.5 text-xl font-semibold tabular ${c.danger ? "text-destructive" : ""}`} data-testid={c.id}>
              {c.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
          </Card>
        ))}
      </div>
      <InvoicesView invoices={invoices} />
    </>
  );
}
