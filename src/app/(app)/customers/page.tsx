import { getContext } from "@/server/workspace";
import { listCustomers, type CustomerFilters } from "@/lib/services/customers";
import { str, type SearchParams } from "@/server/load";
import { PageHeader } from "@/components/ui/misc";
import { NewButton } from "@/components/shared/new-button";
import { CustomersView } from "@/components/customers/customers-view";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId, today } = await getContext();
  const customers = await listCustomers(
    workspaceId,
    {
      q: str(sp.q),
      status: str(sp.status),
      source: str(sp.source),
      followUp: str(sp.followUp) as CustomerFilters["followUp"],
      sort: str(sp.sort) as CustomerFilters["sort"],
    },
    today,
  );
  const active = customers.filter((c) => c.status === "ACTIVE").length;
  return (
    <>
      <PageHeader
        title="Customers"
        description={`${customers.length} customer${customers.length === 1 ? "" : "s"} · ${active} active`}
        actions={<NewButton kind="customer" label="Add customer" />}
      />
      <CustomersView customers={customers} />
    </>
  );
}
