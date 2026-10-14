import Link from "next/link";
import { Plus } from "lucide-react";
import { getContext } from "@/server/workspace";
import { INVOICE_LIST_LIMIT, invoiceSummary, listInvoicesPage } from "@/lib/services/invoices";
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
  const [{ items: invoices, truncated }, summary] = await Promise.all([
    listInvoicesPage(workspaceId, { q: str(sp.q), status: str(sp.status), customerId: str(sp.customerId), sort: str(sp.sort) }, today),
    // Computed over every invoice in the workspace, independent of list filters and the list's row limit.
    invoiceSummary(workspaceId, today),
  ]);
  const { invoiced, collected, outstanding, overdue, drafts, issued } = summary;
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
          { label: "Invoiced", value: m(invoiced), hint: `${issued} issued · ${drafts} draft${drafts === 1 ? "" : "s"} excluded`, id: "inv-invoiced" },
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
      {truncated && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Showing the first {INVOICE_LIST_LIMIT} matching invoices. Use search or filters to narrow the list; the totals above include every invoice.
        </p>
      )}
    </>
  );
}
