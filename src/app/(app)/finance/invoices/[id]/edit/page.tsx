import { getContext } from "@/server/workspace";
import { getInvoice } from "@/lib/services/invoices";
import { orNotFound } from "@/server/load";
import { dateToKey } from "@/lib/dates";
import { minorToInput } from "@/lib/money";
import { PageHeader } from "@/components/ui/misc";
import { InvoiceEditor } from "@/components/finance/invoice-editor";
import type { InvoiceFormValues } from "@/lib/validation";

export const metadata = { title: "Edit invoice" };

const trimZeros = (s: string) => s.replace(/\.00$/, "");

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId, today } = await getContext();
  const inv = await orNotFound(getInvoice(workspaceId, id, today));
  const initial: InvoiceFormValues = {
    number: inv.number,
    customerId: inv.customerId,
    projectId: inv.projectId ?? "",
    status: inv.status === "PAID" || inv.status === "OVERDUE" ? "SENT" : (inv.status as "DRAFT" | "SENT" | "CANCELLED"),
    issueDate: dateToKey(inv.issueDate),
    dueDate: dateToKey(inv.dueDate),
    discountType: inv.discountType as InvoiceFormValues["discountType"],
    discountValue: inv.discountType === "NONE" ? "" : trimZeros(minorToInput(inv.discountValue)),
    taxRate: trimZeros(minorToInput(inv.taxRateBps)),
    taxLabel: inv.taxLabel,
    notes: inv.notes ?? "",
    terms: inv.terms ?? "",
    items: inv.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: minorToInput(i.unitPrice) })),
  };
  return (
    <>
      <PageHeader title={`Edit ${inv.number}`} description={inv.amountPaid > 0 ? "This invoice has payments; the total cannot drop below the amount already paid." : undefined} />
      <InvoiceEditor invoiceId={inv.id} initial={initial} amountPaid={inv.amountPaid} />
    </>
  );
}
