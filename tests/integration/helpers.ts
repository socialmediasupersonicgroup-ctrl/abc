import { prisma } from "@/lib/db";

let n = 0;
export async function newWorkspace(name = "Test") {
  return prisma.workspace.create({ data: { name: `${name} ${++n}` } });
}

export const taskInput = (over: Record<string, unknown> = {}) => ({
  title: "Task",
  description: null,
  status: "TODO" as const,
  priority: "MEDIUM" as const,
  dueDate: null,
  assignee: null,
  projectId: null,
  customerId: null,
  tags: null,
  ...over,
});

export const customerInput = (over: Record<string, unknown> = {}) => ({
  name: "Customer",
  company: null,
  email: null,
  phone: null,
  status: "ACTIVE" as const,
  source: null,
  dealValue: 0,
  notes: null,
  lastContactAt: null,
  nextFollowUpAt: null,
  ...over,
});

export const projectInput = (over: Record<string, unknown> = {}) => ({
  name: "Project",
  description: null,
  status: "ACTIVE" as const,
  priority: "MEDIUM" as const,
  startDate: null,
  dueDate: null,
  progressMode: "AUTO" as const,
  manualProgress: 0,
  budget: 0,
  customerId: null,
  notes: null,
  ...over,
});

export const txnInput = (over: Record<string, unknown> = {}) => ({
  description: "Txn",
  amount: 10000,
  type: "EXPENSE" as const,
  category: "Software",
  date: "2026-10-05",
  paymentMethod: null,
  reference: null,
  customerId: null,
  projectId: null,
  notes: null,
  ...over,
});
