/** Status / enum vocabularies. Stored as strings in SQLite, validated through zod. */

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "violet";

type Option<T extends string> = { value: T; label: string; tone: Tone };

function options<T extends string>(list: Option<T>[]) {
  const values = list.map((o) => o.value) as [T, ...T[]];
  const byValue = Object.fromEntries(list.map((o) => [o.value, o])) as Record<T, Option<T>>;
  return { list, values, byValue, label: (v: string) => (byValue as Record<string, Option<T>>)[v]?.label ?? v };
}

export const TASK_STATUS = options([
  { value: "TODO", label: "Todo", tone: "neutral" },
  { value: "IN_PROGRESS", label: "In Progress", tone: "info" },
  { value: "IN_REVIEW", label: "In Review", tone: "violet" },
  { value: "DONE", label: "Completed", tone: "success" },
] as const satisfies Option<string>[]);
export type TaskStatus = (typeof TASK_STATUS.values)[number];

export const PRIORITY = options([
  { value: "LOW", label: "Low", tone: "neutral" },
  { value: "MEDIUM", label: "Medium", tone: "info" },
  { value: "HIGH", label: "High", tone: "warning" },
  { value: "URGENT", label: "Urgent", tone: "danger" },
] as const satisfies Option<string>[]);
export type Priority = (typeof PRIORITY.values)[number];
export const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const PROJECT_STATUS = options([
  { value: "PLANNING", label: "Planning", tone: "neutral" },
  { value: "ACTIVE", label: "Active", tone: "info" },
  { value: "ON_HOLD", label: "On Hold", tone: "warning" },
  { value: "COMPLETED", label: "Completed", tone: "success" },
  { value: "CANCELLED", label: "Cancelled", tone: "danger" },
] as const satisfies Option<string>[]);
export type ProjectStatus = (typeof PROJECT_STATUS.values)[number];
export const OPEN_PROJECT_STATUSES: ProjectStatus[] = ["PLANNING", "ACTIVE", "ON_HOLD"];

export const CUSTOMER_STATUS = options([
  { value: "LEAD", label: "Lead", tone: "neutral" },
  { value: "PROSPECT", label: "Prospect", tone: "info" },
  { value: "ACTIVE", label: "Active", tone: "success" },
  { value: "INACTIVE", label: "Inactive", tone: "warning" },
  { value: "CHURNED", label: "Churned", tone: "danger" },
] as const satisfies Option<string>[]);
export type CustomerStatus = (typeof CUSTOMER_STATUS.values)[number];

export const LEAD_SOURCES = ["Referral", "Website", "LinkedIn", "Instagram", "Cold outreach", "Event", "Partner", "Other"] as const;

export const TRANSACTION_TYPE = options([
  { value: "INCOME", label: "Income", tone: "success" },
  { value: "EXPENSE", label: "Expense", tone: "danger" },
] as const satisfies Option<string>[]);
export type TransactionType = (typeof TRANSACTION_TYPE.values)[number];

export const INCOME_CATEGORIES = ["Sales", "Services", "Consulting", "Retainer", "Invoice payment", "Interest", "Other income"];
export const EXPENSE_CATEGORIES = [
  "Software",
  "Marketing",
  "Salaries",
  "Contractors",
  "Rent",
  "Utilities",
  "Travel",
  "Equipment",
  "Taxes",
  "Bank fees",
  "Office",
  "Other expense",
];
export const INVOICE_PAYMENT_CATEGORY = "Invoice payment";

export const PAYMENT_METHODS = ["Bank transfer", "UPI", "Card", "Cash", "Cheque", "Other"] as const;

export const INVOICE_STATUS = options([
  { value: "DRAFT", label: "Draft", tone: "neutral" },
  { value: "SENT", label: "Sent", tone: "info" },
  { value: "PAID", label: "Paid", tone: "success" },
  { value: "OVERDUE", label: "Overdue", tone: "danger" },
  { value: "CANCELLED", label: "Cancelled", tone: "warning" },
] as const satisfies Option<string>[]);
export type InvoiceStatus = (typeof INVOICE_STATUS.values)[number];

export const DISCOUNT_TYPES = ["NONE", "PERCENT", "FIXED"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const CONTENT_STATUS = options([
  { value: "IDEA", label: "Idea", tone: "neutral" },
  { value: "PLANNED", label: "Planned", tone: "info" },
  { value: "IN_PRODUCTION", label: "In Production", tone: "violet" },
  { value: "READY", label: "Ready", tone: "warning" },
  { value: "PUBLISHED", label: "Published", tone: "success" },
] as const satisfies Option<string>[]);
export type ContentStatus = (typeof CONTENT_STATUS.values)[number];

export const CONTENT_PLATFORMS = ["Instagram", "LinkedIn", "YouTube", "X", "Facebook", "Blog", "Newsletter", "Podcast", "Other"] as const;
export const CONTENT_FORMATS = ["Post", "Carousel", "Reel / Short", "Video", "Story", "Article", "Thread", "Email", "Episode", "Other"] as const;
