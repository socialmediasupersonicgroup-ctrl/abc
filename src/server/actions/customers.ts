"use server";

import { z } from "zod";
import { customerSchema, dateKey, type CustomerFormValues } from "@/lib/validation";
import * as customers from "@/lib/services/customers";
import { getContext } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";
import { formatDate } from "@/lib/dates";

export async function createCustomerAction(values: CustomerFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const c = await customers.createCustomer(workspaceId, parseInput(customerSchema, values));
    return { id: c.id };
  }, "Customer added");
}

export async function updateCustomerAction(id: string, values: CustomerFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await customers.updateCustomer(workspaceId, assertId(id), parseInput(customerSchema, values));
    return { id };
  }, "Customer updated");
}

export async function deleteCustomerAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await customers.deleteCustomer(workspaceId, assertId(id));
  }, "Customer deleted");
}

export async function logContactAction(id: string, nextFollowUp: string | null) {
  return runAction(async () => {
    const { workspaceId, today } = await getContext();
    const next = nextFollowUp ? parseInput(dateKey("Next follow-up"), nextFollowUp) : null;
    await customers.logContact(workspaceId, assertId(id), today, next);
  }, "Contact logged");
}

export async function addCustomerNoteAction(id: string, text: string) {
  return runAction(async () => {
    const { workspaceId, today } = await getContext();
    const body = parseInput(z.string().trim().min(1, "Write a note first").max(2000), text);
    await customers.appendCustomerNote(workspaceId, assertId(id), body, formatDate(today));
  }, "Note added");
}
