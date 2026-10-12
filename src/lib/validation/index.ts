import { z } from "zod";
import {
  CONTENT_STATUS,
  CUSTOMER_STATUS,
  DISCOUNT_TYPES,
  INVOICE_STATUS,
  PRIORITY,
  PROJECT_STATUS,
  TASK_STATUS,
  TRANSACTION_TYPE,
} from "@/lib/constants";
import { CURRENCY_CODES, MAX_MINOR, parseMoney, parsePercentToBps } from "@/lib/money";
import { isDateKey } from "@/lib/dates";

/**
 * Schemas operate on the plain values produced by forms (strings), and output normalised
 * values ready for persistence. The same schemas run on the client (react-hook-form) and the server.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`);
const requiredText = (label: string, max = 200) => trimmed(max).min(1, `${label} is required`);
const optionalText = (max = 5000) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optionalId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const dateKey = (label: string) =>
  z.string().trim().refine(isDateKey, { message: `${label} must be a valid date` });

const optionalDateKey = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((v) => !v || isDateKey(v), { message: "Enter a valid date" })
  .transform((v) => (v ? v : null));

const money = (label: string, { allowZero = true } = {}) =>
  z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const s = String(v).trim();
      const parsed = s === "" ? 0 : parseMoney(s);
      if (parsed == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a number with up to 2 decimals` });
        return z.NEVER;
      }
      if (parsed < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} cannot be negative` });
        return z.NEVER;
      }
      if (!allowZero && parsed === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be greater than zero` });
        return z.NEVER;
      }
      if (parsed > MAX_MINOR) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is too large` });
        return z.NEVER;
      }
      return parsed;
    });

const percentBps = (label: string) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const s = String(v).trim();
    const bps = s === "" ? 0 : parsePercentToBps(s);
    if (bps == null || bps > 10000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be between 0 and 100 with up to 2 decimals` });
      return z.NEVER;
    }
    return bps;
  });

// ---------------------------------------------------------------- Tasks
export const taskSchema = z.object({
  title: requiredText("Title"),
  description: optionalText(10000),
  status: z.enum(TASK_STATUS.values),
  priority: z.enum(PRIORITY.values),
  dueDate: optionalDateKey,
  assignee: optionalText(80),
  projectId: optionalId,
  customerId: optionalId,
  tags: optionalText(400),
});
export type TaskFormValues = z.input<typeof taskSchema>;
export type TaskInput = z.output<typeof taskSchema>;

// ---------------------------------------------------------------- Projects
export const projectSchema = z
  .object({
    name: requiredText("Project name", 120),
    description: optionalText(5000),
    status: z.enum(PROJECT_STATUS.values),
    priority: z.enum(PRIORITY.values),
    startDate: optionalDateKey,
    dueDate: optionalDateKey,
    progressMode: z.enum(["AUTO", "MANUAL"]),
    manualProgress: z.coerce.number().int("Progress must be a whole number").min(0).max(100),
    budget: money("Budget"),
    customerId: optionalId,
    notes: optionalText(10000),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    message: "Deadline cannot be before the start date",
    path: ["dueDate"],
  });
export type ProjectFormValues = z.input<typeof projectSchema>;
export type ProjectInput = z.output<typeof projectSchema>;

// ---------------------------------------------------------------- Customers
export const customerSchema = z.object({
  name: requiredText("Name", 120),
  company: optionalText(120),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .refine((v) => !v || z.string().email().safeParse(v).success, { message: "Enter a valid email address" })
    .transform((v) => (v ? v.toLowerCase() : null)),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .nullable()
    .refine((v) => !v || /^[+()\d\s.-]{6,32}$/.test(v), { message: "Enter a valid phone number" })
    .transform((v) => (v ? v : null)),
  status: z.enum(CUSTOMER_STATUS.values),
  source: optionalText(60),
  dealValue: money("Deal value"),
  notes: optionalText(10000),
  lastContactAt: optionalDateKey,
  nextFollowUpAt: optionalDateKey,
});
export type CustomerFormValues = z.input<typeof customerSchema>;
export type CustomerInput = z.output<typeof customerSchema>;

// ---------------------------------------------------------------- Transactions
export const transactionSchema = z.object({
  description: requiredText("Description"),
  amount: money("Amount", { allowZero: false }),
  type: z.enum(TRANSACTION_TYPE.values),
  category: requiredText("Category", 60),
  date: dateKey("Date"),
  paymentMethod: optionalText(40),
  reference: optionalText(80),
  customerId: optionalId,
  projectId: optionalId,
  notes: optionalText(2000),
});
export type TransactionFormValues = z.input<typeof transactionSchema>;
export type TransactionInput = z.output<typeof transactionSchema>;

// ---------------------------------------------------------------- Invoices
export const invoiceItemSchema = z.object({
  description: requiredText("Item description", 300),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const s = String(v).trim();
      if (!/^\d{1,7}(\.\d{1,2})?$/.test(s) || Number(s) <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quantity must be greater than 0 (max 2 decimals)" });
        return z.NEVER;
      }
      return Number(s);
    }),
  unitPrice: money("Unit price"),
});

export const invoiceSchema = z
  .object({
    number: requiredText("Invoice number", 40),
    customerId: z.string().min(1, "Select a customer"),
    projectId: optionalId,
    status: z.enum(["DRAFT", "SENT", "CANCELLED"]),
    issueDate: dateKey("Issue date"),
    dueDate: dateKey("Due date"),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.union([z.string(), z.number()]),
    taxRate: percentBps("Tax rate"),
    taxLabel: trimmed(20).default("GST"),
    notes: optionalText(2000),
    terms: optionalText(2000),
    items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(100),
  })
  .transform((v, ctx) => {
    let discountValue = 0;
    const raw = String(v.discountValue ?? "").trim();
    if (v.discountType === "PERCENT") {
      const bps = raw === "" ? 0 : parsePercentToBps(raw);
      if (bps == null || bps > 10000) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Discount must be 0–100%" });
        return z.NEVER;
      }
      discountValue = bps;
    } else if (v.discountType === "FIXED") {
      const minor = raw === "" ? 0 : parseMoney(raw);
      if (minor == null || minor < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Enter a valid discount amount" });
        return z.NEVER;
      }
      discountValue = minor;
    }
    if (v.dueDate < v.issueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dueDate"], message: "Due date cannot be before the issue date" });
      return z.NEVER;
    }
    return { ...v, discountValue, taxRateBps: v.taxRate };
  });
export type InvoiceFormValues = z.input<typeof invoiceSchema>;
export type InvoiceInput = z.output<typeof invoiceSchema>;

export const paymentSchema = z.object({
  amount: money("Payment amount", { allowZero: false }),
  date: dateKey("Payment date"),
  method: optionalText(40),
  reference: optionalText(80),
  notes: optionalText(1000),
});
export type PaymentFormValues = z.input<typeof paymentSchema>;
export type PaymentInput = z.output<typeof paymentSchema>;

export const invoiceStatusSchema = z.enum(INVOICE_STATUS.values);

// ---------------------------------------------------------------- Events
const dateTimeLocal = (label: string) =>
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `${label} must be a valid date and time`);

export const eventSchema = z
  .object({
    title: requiredText("Title"),
    description: optionalText(5000),
    location: optionalText(200),
    allDay: z.boolean(),
    start: dateTimeLocal("Start"),
    end: dateTimeLocal("End"),
    taskId: optionalId,
    projectId: optionalId,
    customerId: optionalId,
  })
  .refine((v) => (v.allDay ? v.end.slice(0, 10) >= v.start.slice(0, 10) : v.end > v.start), {
    message: "End must be after the start",
    path: ["end"],
  });
export type EventFormValues = z.input<typeof eventSchema>;
export type EventInput = z.output<typeof eventSchema>;

// ---------------------------------------------------------------- Content
export const contentSchema = z.object({
  title: requiredText("Title"),
  platform: requiredText("Platform", 40),
  format: requiredText("Format", 40),
  campaign: optionalText(80),
  scheduledAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), { message: "Enter a valid date and time" })
    .transform((v) => (v ? v : null)),
  status: z.enum(CONTENT_STATUS.values),
  caption: optionalText(5000),
  hashtags: optionalText(1000),
  notes: optionalText(5000),
});
export type ContentFormValues = z.input<typeof contentSchema>;
export type ContentInput = z.output<typeof contentSchema>;

// ---------------------------------------------------------------- Notes
export const noteSchema = z.object({
  title: trimmed(200).transform((v) => v || "Untitled"),
  content: z.string().max(100_000, "Note is too long"),
  pinned: z.boolean().default(false),
  tags: optionalText(400),
  taskId: optionalId,
  projectId: optionalId,
  customerId: optionalId,
});
export type NoteFormValues = z.input<typeof noteSchema>;
export type NoteInput = z.output<typeof noteSchema>;

// ---------------------------------------------------------------- Workspace
export const workspaceSchema = z.object({
  name: requiredText("Workspace name", 80),
  currency: z.enum(CURRENCY_CODES),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone"),
  weekStartsOn: z.coerce.number().int().min(0).max(1),
  invoicePrefix: trimmed(12),
  defaultTaxRate: percentBps("Default tax rate"),
  ownerName: trimmed(80),
  ownerEmail: z
    .string()
    .trim()
    .max(160)
    .refine((v) => !v || z.string().email().safeParse(v).success, { message: "Enter a valid email address" }),
});
export type WorkspaceFormValues = z.input<typeof workspaceSchema>;
export type WorkspaceInput = z.output<typeof workspaceSchema>;
