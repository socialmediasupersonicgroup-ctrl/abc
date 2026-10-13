import { redirect } from "next/navigation";
import { getContext } from "@/server/workspace";
import { listTransactions, transactionCategories, type TransactionFilters } from "@/lib/services/transactions";
import { str, type SearchParams } from "@/server/load";
import { isDateKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { NewButton } from "@/components/shared/new-button";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import { TransactionsView } from "@/components/finance/transactions-view";

export const metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId } = await getContext();
  const date = (v: string) => (isDateKey(v) ? v : "");
  const filters: TransactionFilters = {
    q: str(sp.q),
    type: str(sp.type),
    category: str(sp.category),
    from: date(str(sp.from)),
    to: date(str(sp.to)),
    customerId: str(sp.customerId),
    projectId: str(sp.projectId),
    sort: str(sp.sort) as TransactionFilters["sort"],
  };
  const page = Math.max(1, Number.parseInt(str(sp.page) || "1", 10) || 1);
  const [data, categories] = await Promise.all([listTransactions(workspaceId, filters, page, 50), transactionCategories(workspaceId)]);
  // Past the last page (e.g. after deleting its only row): go to the last page that has rows.
  if (data.rows.length === 0 && data.total > 0 && page > 1) {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : [])));
    qs.set("page", String(Math.ceil(data.total / data.pageSize)));
    redirect(`/finance?${qs.toString()}`);
  }
  return (
    <>
      <PageHeader
        title="Finance"
        description="Track money in and out. Invoice payments are added here automatically."
        actions={
          <>
            <NewButton kind="transaction" label="Income" defaults={{ type: "INCOME" }} variant="outline" />
            <NewButton kind="transaction" label="Expense" defaults={{ type: "EXPENSE" }} />
          </>
        }
      />
      <FinanceTabs />
      <TransactionsView {...data} categories={categories} />
    </>
  );
}
