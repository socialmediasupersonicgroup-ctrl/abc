-- Normalise stored invoice statuses to the current rules:
--   * only DRAFT, SENT, PAID and CANCELLED are stored (OVERDUE is derived from the due date);
--   * an issued invoice whose payments cover its total (including zero-total invoices) is PAID.
UPDATE "Invoice" SET "status" = 'PAID' WHERE "status" IN ('SENT', 'OVERDUE') AND "amountPaid" >= "total";
UPDATE "Invoice" SET "status" = 'SENT' WHERE "status" = 'OVERDUE';
