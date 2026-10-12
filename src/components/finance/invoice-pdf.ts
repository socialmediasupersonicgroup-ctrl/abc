"use client";

import type { jsPDF as JsPDF } from "jspdf";
import { localeForCurrency, formatBps } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export type PdfInvoice = {
  number: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  discountAmount: number;
  discountType: string;
  discountValue: number;
  taxAmount: number;
  taxRateBps: number;
  taxLabel: string;
  total: number;
  amountPaid: number;
  notes: string | null;
  terms: string | null;
  from: { name: string; owner: string; email: string };
  to: { name: string; company: string | null; email: string | null; phone: string | null };
  items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
};

/**
 * Builds the invoice PDF in the browser with jsPDF. Built-in PDF fonts lack the ₹ glyph,
 * so amounts use the ISO currency code (e.g. "INR 1,23,456.00").
 */
export async function downloadInvoicePdf(inv: PdfInvoice) {
  const { jsPDF } = await import("jspdf");
  const doc: JsPDF = new jsPDF({ unit: "pt", format: "a4" });
  const fmt = new Intl.NumberFormat(localeForCurrency(inv.currency), { style: "currency", currency: inv.currency, currencyDisplay: "code" });
  const money = (m: number) => fmt.format(m / 100).replace(/ /g, " ");
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  doc.setFillColor(79, 70, 229);
  doc.roundedRect(M, y, 26, 26, 5, 5, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  doc.lines([[0, -12], [12, 12], [0, -12]], M + 7, y + 19);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text("INVOICE", W - M, y + 18, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(inv.number, W - M, y + 34, { align: "right" });
  y += 70;

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("FROM", M, y);
  doc.text("BILL TO", W / 2, y);
  y += 14;
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.text(inv.from.name, M, y);
  doc.text(inv.to.company || inv.to.name, W / 2, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 99);
  const fromLines = [inv.from.owner, inv.from.email].filter(Boolean);
  const toLines = [inv.to.company ? inv.to.name : "", inv.to.email ?? "", inv.to.phone ?? ""].filter(Boolean);
  fromLines.forEach((l, i) => doc.text(l, M, y + 14 * (i + 1)));
  toLines.forEach((l, i) => doc.text(l, W / 2, y + 14 * (i + 1)));
  y += 14 * Math.max(fromLines.length, toLines.length) + 26;

  const meta: [string, string][] = [
    ["Issue date", formatDate(inv.issueDate)],
    ["Due date", formatDate(inv.dueDate)],
    ["Status", inv.status.charAt(0) + inv.status.slice(1).toLowerCase()],
  ];
  meta.forEach(([k, v], i) => {
    const x = M + i * 140;
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(k.toUpperCase(), x, y);
    doc.setFontSize(10.5);
    doc.setTextColor(17, 24, 39);
    doc.text(v, x, y + 14);
  });
  y += 40;

  const cols = { desc: M + 10, qty: W - M - 230, price: W - M - 120, amount: W - M - 10 };
  doc.setFillColor(243, 244, 246);
  doc.rect(M, y, W - 2 * M, 24, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", cols.desc, y + 15);
  doc.text("QTY", cols.qty, y + 15, { align: "right" });
  doc.text("UNIT PRICE", cols.price, y + 15, { align: "right" });
  doc.text("AMOUNT", cols.amount, y + 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 24;

  doc.setFontSize(10);
  for (const item of inv.items) {
    const lines = doc.splitTextToSize(item.description, cols.qty - cols.desc - 50) as string[];
    const h = Math.max(24, lines.length * 13 + 11);
    if (y + h > H - 160) {
      doc.addPage();
      y = M;
    }
    doc.setTextColor(17, 24, 39);
    doc.text(lines, cols.desc, y + 16);
    doc.setTextColor(75, 85, 99);
    doc.text(String(item.quantity), cols.qty, y + 16, { align: "right" });
    doc.text(money(item.unitPrice), cols.price, y + 16, { align: "right" });
    doc.setTextColor(17, 24, 39);
    doc.text(money(item.lineTotal), cols.amount, y + 16, { align: "right" });
    y += h;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
  }

  y += 18;
  const rows: [string, string, boolean?][] = [["Subtotal", money(inv.subtotal)]];
  if (inv.discountAmount > 0)
    rows.push([`Discount${inv.discountType === "PERCENT" ? ` (${formatBps(inv.discountValue)})` : ""}`, `- ${money(inv.discountAmount)}`]);
  rows.push([`${inv.taxLabel || "Tax"} (${formatBps(inv.taxRateBps)})`, money(inv.taxAmount)]);
  rows.push(["Total", money(inv.total), true]);
  if (inv.amountPaid > 0) {
    rows.push(["Paid", `- ${money(inv.amountPaid)}`]);
    rows.push(["Balance due", money(Math.max(0, inv.total - inv.amountPaid)), true]);
  }
  for (const [label, value, bold] of rows) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11.5 : 10);
    doc.setTextColor(bold ? 17 : 75, bold ? 24 : 85, bold ? 39 : 99);
    doc.text(label, W - M - 200, y);
    doc.text(value, cols.amount, y, { align: "right" });
    y += bold ? 20 : 16;
  }

  y += 16;
  doc.setFont("helvetica", "normal");
  for (const [title, body] of [
    ["Notes", inv.notes],
    ["Terms", inv.terms],
  ] as const) {
    if (!body) continue;
    if (y > H - 100) {
      doc.addPage();
      y = M;
    }
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(title.toUpperCase(), M, y);
    doc.setFontSize(9.5);
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(body, W - 2 * M) as string[];
    doc.text(lines, M, y + 14);
    y += 14 + lines.length * 12 + 14;
  }

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated with NEXUS · ${inv.number}`, M, H - 30);
  doc.save(`${inv.number}.pdf`);
}
