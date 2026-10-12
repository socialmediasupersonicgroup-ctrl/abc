import { getContext } from "@/server/workspace";
import { nextInvoiceNumber } from "@/lib/services/invoices";
import { addDaysToKey } from "@/lib/dates";
import { minorToInput } from "@/lib/money";
import { str, type SearchParams } from "@/server/load";
import { PageHeader } from "@/components/ui/misc";
import { InvoiceEditor } from "@/components/finance/invoice-editor";
import type { InvoiceFormValues } from "@/lib/validation";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { ws, today } = await getContext();
  const initial: InvoiceFormValues = {
    number: await nextInvoiceNumber(ws.id, ws.invoicePrefix),
    customerId: str(sp.customerId),
    projectId: str(sp.projectId),
    status: "DRAFT",
    issueDate: today,
    dueDate: addDaysToKey(today, 15),
    discountType: "NONE",
    discountValue: "",
    taxRate: minorToInput(ws.defaultTaxBps).replace(/\.00$/, ""),
    taxLabel: "GST",
    notes: "",
    terms: "",
    items: [{ description: "", quantity: "1", unitPrice: "" }],
  };
  return (
    <>
      <PageHeader title="New invoice" description="Save as Draft while you work on it, or mark it Sent once it goes to the customer." />
      <InvoiceEditor initial={initial} />
    </>
  );
}
