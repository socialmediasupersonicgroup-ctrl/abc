/**
 * SAMPLE DATA — used only for the explicitly labelled demo workspace.
 * Every figure here is fictional. Dates are generated relative to "today" so the demo always looks current.
 * Records are created through the same services the app uses, so invoices, payments and
 * transactions obey the normal financial rules.
 */
import type { PrismaClient } from "@prisma/client";
import { addDaysToKey, dateToKey, todayKey } from "@/lib/dates";
import { createCustomer } from "@/lib/services/customers";
import { createProject } from "@/lib/services/projects";
import { createTask } from "@/lib/services/tasks";
import { createTransaction } from "@/lib/services/transactions";
import { createInvoice, recordPayment, setInvoiceStatus } from "@/lib/services/invoices";
import { createEvent } from "@/lib/services/events";
import { createContent } from "@/lib/services/content";
import { createNote } from "@/lib/services/notes";
import type { CustomerStatus, Priority, ProjectStatus, TaskStatus } from "@/lib/constants";

const rupees = (n: number) => Math.round(n * 100);

export async function seedDemoData(db: PrismaClient, workspaceId: string, tz = "Asia/Kolkata") {
  const today = todayKey(tz);
  const d = (offset: number) => addDaysToKey(today, offset);

  await db.workspace.update({
    where: { id: workspaceId },
    data: { isDemo: true, ownerName: "Demo Owner", ownerEmail: "owner@example.com", invoicePrefix: "INV-", defaultTaxBps: 1800 },
  });

  // ---------------------------------------------------------------- Customers
  const customerSeed: [string, string, string, CustomerStatus, string, number, number | null, number | null][] = [
    ["Aarav Mehta", "Lumen Retail Pvt Ltd", "aarav@lumenretail.example", "ACTIVE", "Referral", 450000, -6, 4],
    ["Priya Nair", "Coastline Hospitality", "priya@coastline.example", "ACTIVE", "LinkedIn", 280000, -12, 0],
    ["Rohan Kapoor", "Kapoor & Sons Logistics", "rohan@kapoorlogistics.example", "PROSPECT", "Website", 600000, -3, 2],
    ["Sneha Iyer", "Brightpath Learning", "sneha@brightpath.example", "ACTIVE", "Event", 190000, -20, -2],
    ["Vikram Shah", "Northwind Fintech", "vikram@northwind.example", "LEAD", "Cold outreach", 900000, null, 6],
    ["Ananya Rao", "Studio Verde", "ananya@studioverde.example", "ACTIVE", "Instagram", 120000, -9, 14],
    ["Karan Malhotra", "Peak Fitness Clubs", "karan@peakfitness.example", "INACTIVE", "Partner", 75000, -75, null],
    ["Meera Joshi", "Joshi Ayurveda", "meera@joshiayurveda.example", "PROSPECT", "Referral", 210000, -1, 5],
  ];
  const customers = [];
  for (const [name, company, email, status, source, value, last, next] of customerSeed) {
    customers.push(
      await createCustomer(
        workspaceId,
        {
          name,
          company,
          email,
          phone: `+91 98${String(10000000 + customers.length * 1234567).slice(0, 8)}`,
          status,
          source,
          dealValue: rupees(value),
          notes: `Sample customer record created for the demo workspace.`,
          lastContactAt: last == null ? null : d(last),
          nextFollowUpAt: next == null ? null : d(next),
        },
        db,
      ),
    );
  }
  const [lumen, coastline, kapoor, brightpath, northwind, verde] = customers;

  // ---------------------------------------------------------------- Projects
  const projectSeed: [string, string, ProjectStatus, Priority, number, number, number, string | null][] = [
    ["Lumen e-commerce relaunch", "Redesign and rebuild the online store with a faster checkout.", "ACTIVE", "HIGH", -40, 21, 380000, lumen.id],
    ["Coastline booking engine", "Direct booking flow and channel manager integration.", "ACTIVE", "URGENT", -25, 5, 260000, coastline.id],
    ["Brightpath LMS onboarding", "Course migration, branding and admin training.", "ACTIVE", "MEDIUM", -60, -3, 180000, brightpath.id],
    ["Kapoor fleet dashboard", "Discovery and proposal for a live fleet tracking dashboard.", "PLANNING", "MEDIUM", 7, 60, 550000, kapoor.id],
    ["Studio Verde brand refresh", "Logo refinement, social templates and brand guidelines.", "COMPLETED", "LOW", -90, -30, 95000, verde.id],
    ["Internal: website & case studies", "Refresh our own website and publish three case studies.", "ON_HOLD", "LOW", -15, 45, 0, null],
  ];
  const projects = [];
  for (const [name, description, status, priority, start, due, budget, customerId] of projectSeed) {
    projects.push(
      await createProject(
        workspaceId,
        {
          name,
          description,
          status,
          priority,
          startDate: d(start),
          dueDate: d(due),
          progressMode: "AUTO",
          manualProgress: 0,
          budget: rupees(budget),
          customerId,
          notes: null,
        },
        db,
      ),
    );
  }
  const [pLumen, pCoast, pBright, pKapoor, pVerde, pInternal] = projects;
  await db.project.update({ where: { id: pInternal.id }, data: { progressMode: "MANUAL", manualProgress: 35 } });

  // ---------------------------------------------------------------- Tasks
  const taskSeed: [string, TaskStatus, Priority, number | null, string | null, string | null, string, string | null][] = [
    ["Finalise checkout wireframes", "DONE", "HIGH", -12, pLumen.id, lumen.id, "design,ux", "Neha"],
    ["Product catalogue import script", "IN_PROGRESS", "HIGH", 3, pLumen.id, lumen.id, "dev", "Arjun"],
    ["Payment gateway integration", "TODO", "URGENT", 6, pLumen.id, lumen.id, "dev,payments", "Arjun"],
    ["Mobile QA pass", "TODO", "MEDIUM", 15, pLumen.id, lumen.id, "qa", null],
    ["Homepage hero copy", "IN_REVIEW", "MEDIUM", 1, pLumen.id, lumen.id, "content", "Neha"],
    ["Room availability API", "IN_PROGRESS", "URGENT", -1, pCoast.id, coastline.id, "dev", "Arjun"],
    ["Booking confirmation emails", "TODO", "HIGH", 2, pCoast.id, coastline.id, "dev,email", null],
    ["Rate plan configuration", "DONE", "MEDIUM", -8, pCoast.id, coastline.id, "setup", "Neha"],
    ["UAT with front desk team", "TODO", "HIGH", 4, pCoast.id, coastline.id, "qa", null],
    ["Migrate 40 courses", "DONE", "HIGH", -20, pBright.id, brightpath.id, "migration", "Arjun"],
    ["Admin training session", "DONE", "MEDIUM", -6, pBright.id, brightpath.id, "training", "Neha"],
    ["Fix certificate template", "IN_REVIEW", "HIGH", -2, pBright.id, brightpath.id, "bug", "Arjun"],
    ["Discovery workshop agenda", "TODO", "MEDIUM", 8, pKapoor.id, kapoor.id, "discovery", null],
    ["Draft proposal & estimate", "TODO", "HIGH", 12, pKapoor.id, kapoor.id, "sales", null],
    ["Deliver brand guidelines PDF", "DONE", "MEDIUM", -32, pVerde.id, verde.id, "design", "Neha"],
    ["Social template pack", "DONE", "LOW", -35, pVerde.id, verde.id, "design", "Neha"],
    ["Write case study: Studio Verde", "IN_PROGRESS", "LOW", 20, pInternal.id, null, "content", null],
    ["Send GST filing documents to CA", "TODO", "URGENT", 0, null, null, "admin,finance", null],
    ["Renew domain & hosting", "TODO", "MEDIUM", 9, null, null, "admin", null],
    ["Follow up on Northwind intro call", "TODO", "HIGH", 1, null, northwind.id, "sales", null],
    ["Update portfolio deck", "DONE", "LOW", -4, null, null, "sales", null],
    ["Quarterly expense review", "TODO", "MEDIUM", -3, null, null, "finance", null],
  ];
  const tasks = [];
  for (const [title, status, priority, due, projectId, customerId, tags, assignee] of taskSeed) {
    tasks.push(
      await createTask(
        workspaceId,
        { title, description: null, status, priority, dueDate: due == null ? null : d(due), assignee, projectId, customerId, tags },
        db,
      ),
    );
  }
  // Spread completion dates so analytics has a realistic history.
  let i = 0;
  for (const t of tasks.filter((t) => t.status === "DONE")) {
    const completed = new Date(`${d(-3 - i * 9)}T10:00:00Z`);
    await db.task.update({ where: { id: t.id }, data: { completedAt: completed, createdAt: new Date(completed.getTime() - 10 * 86400000) } });
    i++;
  }

  // ---------------------------------------------------------------- Customers history (createdAt spread)
  for (const [idx, c] of customers.entries()) {
    await db.customer.update({ where: { id: c.id }, data: { createdAt: new Date(`${d(-210 + idx * 26)}T09:00:00Z`) } });
  }

  // ---------------------------------------------------------------- Transactions (expenses + retainers)
  const monthly: [string, string, number, string][] = [
    ["Design & dev tool subscriptions", "Software", 8500, "Card"],
    ["Co-working desk rent", "Rent", 18000, "Bank transfer"],
    ["Freelance developer", "Contractors", 42000, "Bank transfer"],
    ["Internet & phone", "Utilities", 2400, "UPI"],
  ];
  for (let m = 6; m >= 0; m--) {
    const day = d(-m * 30 - 2);
    for (const [description, category, amount, method] of monthly) {
      const variance = 1 + ((m * 7 + description.length) % 9) / 100;
      await createTransaction(
        workspaceId,
        {
          description,
          amount: rupees(Math.round(amount * variance)),
          type: "EXPENSE",
          category,
          date: day,
          paymentMethod: method,
          reference: null,
          customerId: null,
          projectId: null,
          notes: null,
        },
        db,
      );
    }
    await createTransaction(
      workspaceId,
      {
        description: "Monthly retainer — Brightpath Learning",
        amount: rupees(45000),
        type: "INCOME",
        category: "Retainer",
        date: d(-m * 30 - 5),
        paymentMethod: "Bank transfer",
        reference: `RET-${7 - m}`,
        customerId: brightpath.id,
        projectId: pBright.id,
        notes: null,
      },
      db,
    );
  }
  const oneOffs: [string, "INCOME" | "EXPENSE", string, number, number, string | null][] = [
    ["Facebook & Instagram ads", "EXPENSE", "Marketing", 15000, -18, null],
    ["Laptop purchase", "EXPENSE", "Equipment", 98000, -120, null],
    ["Client workshop travel", "EXPENSE", "Travel", 12600, -44, pKapoor.id],
    ["Strategy consultation", "INCOME", "Consulting", 25000, -50, null],
    ["Bank charges", "EXPENSE", "Bank fees", 590, -10, null],
  ];
  for (const [description, type, category, amount, offset, projectId] of oneOffs) {
    await createTransaction(
      workspaceId,
      { description, amount: rupees(amount), type, category, date: d(offset), paymentMethod: "Card", reference: null, customerId: null, projectId, notes: null },
      db,
    );
  }

  // ---------------------------------------------------------------- Invoices & payments
  const invoiceSeed: {
    customer: string;
    project: string | null;
    issue: number;
    due: number;
    items: [string, number, number][];
    discount?: number;
    pay?: [number, number][];
    status: "DRAFT" | "SENT" | "CANCELLED";
  }[] = [
    { customer: verde.id, project: pVerde.id, issue: -95, due: -80, items: [["Brand refresh — design", 1, 80000], ["Social template pack", 1, 15000]], pay: [[-82, 112100]], status: "SENT" },
    { customer: lumen.id, project: pLumen.id, issue: -40, due: -25, items: [["Discovery & UX (milestone 1)", 1, 120000]], pay: [[-28, 141600]], status: "SENT" },
    { customer: lumen.id, project: pLumen.id, issue: -8, due: 7, items: [["Design system & UI (milestone 2)", 1, 110000], ["Content migration", 12, 1500]], status: "SENT" },
    { customer: coastline.id, project: pCoast.id, issue: -30, due: -5, items: [["Booking engine — phase 1", 1, 130000]], pay: [[-12, 60000]], status: "SENT" },
    { customer: brightpath.id, project: pBright.id, issue: -55, due: -40, items: [["LMS setup & migration", 1, 90000], ["Admin training (hours)", 6, 2500]], discount: 1000, pay: [[-45, 111510]], status: "SENT" },
    { customer: kapoor.id, project: pKapoor.id, issue: -1, due: 14, items: [["Discovery workshop (deposit)", 1, 50000]], status: "DRAFT" },
    { customer: brightpath.id, project: null, issue: -70, due: -55, items: [["Additional course design", 3, 8000]], status: "CANCELLED" },
  ];
  let number = 1;
  for (const inv of invoiceSeed) {
    const created = await createInvoice(
      workspaceId,
      "INR",
      {
        number: `INV-${String(number++).padStart(4, "0")}`,
        customerId: inv.customer,
        projectId: inv.project,
        status: inv.status,
        issueDate: d(inv.issue),
        dueDate: d(inv.due),
        discountType: inv.discount ? "PERCENT" : "NONE",
        discountValue: inv.discount ?? 0,
        taxRate: 1800,
        taxRateBps: 1800,
        taxLabel: "GST",
        notes: "Thank you for your business.",
        terms: "Payment due within 15 days of the invoice date.",
        items: inv.items.map(([description, quantity, price]) => ({ description, quantity, unitPrice: rupees(price) })),
      },
      db,
    );
    for (const [offset, amount] of inv.pay ?? []) {
      const remaining = created.total - (await db.invoice.findUniqueOrThrow({ where: { id: created.id } })).amountPaid;
      await recordPayment(
        workspaceId,
        created.id,
        { amount: Math.min(rupees(amount), remaining), date: d(offset), method: "Bank transfer", reference: `UTR${100200 + number}`, notes: null },
        db,
      );
    }
    if (inv.status === "CANCELLED") await setInvoiceStatus(workspaceId, created.id, "CANCELLED", db);
  }

  // ---------------------------------------------------------------- Events
  const at = (offset: number, hhmm: string) => `${d(offset)}T${hhmm}`;
  const eventSeed: [string, string, string, boolean, string | null, string | null, string | null][] = [
    ["Weekly planning", at(0, "10:00"), at(0, "10:45"), false, null, null, "Team sync on priorities for the week."],
    ["Lumen sprint review", at(1, "15:00"), at(1, "16:00"), false, pLumen.id, lumen.id, "Demo milestone 2 progress."],
    ["Coastline UAT", at(4, "11:00"), at(4, "13:00"), false, pCoast.id, coastline.id, "Front desk team walkthrough."],
    ["Northwind intro call", at(2, "12:30"), at(2, "13:00"), false, null, northwind.id, "First conversation — understand their roadmap."],
    ["Kapoor discovery workshop", at(8, "10:00"), at(8, "16:00"), false, pKapoor.id, kapoor.id, "On-site workshop."],
    ["GST filing deadline", at(6, "00:00"), at(6, "00:00"), true, null, null, "Monthly return."],
    ["Content shoot", at(10, "09:00"), at(10, "12:00"), false, null, null, "Reels for the case study series."],
    ["Brightpath check-in", at(-3, "16:00"), at(-3, "16:30"), false, pBright.id, brightpath.id, null],
  ];
  for (const [title, start, end, allDay, projectId, customerId, description] of eventSeed) {
    await createEvent(workspaceId, tz, { title, start, end, allDay, projectId, customerId, taskId: null, description, location: null }, db);
  }

  // ---------------------------------------------------------------- Content
  const contentSeed: [string, string, string, string, number | null, "IDEA" | "PLANNED" | "IN_PRODUCTION" | "READY" | "PUBLISHED", string][] = [
    ["Case study: Studio Verde brand refresh", "LinkedIn", "Carousel", "Case studies", 3, "IN_PRODUCTION", "How we refreshed a boutique studio's brand in 6 weeks — and what changed for their bookings."],
    ["Behind the scenes: checkout redesign", "Instagram", "Reel / Short", "Build in public", 5, "PLANNED", "Small UX changes, big conversion wins. Here's what we tested."],
    ["5 signs your website is costing you leads", "Blog", "Article", "Lead generation", 9, "READY", "A practical checklist for small business owners."],
    ["Monthly newsletter — October", "Newsletter", "Email", "Newsletter", 12, "IDEA", "Highlights, lessons learned and one useful tool."],
    ["Founder story: why we started", "YouTube", "Video", "Brand", null, "IDEA", "Short documentary-style intro to the studio."],
    ["Launch post: Brightpath LMS", "LinkedIn", "Post", "Case studies", -10, "PUBLISHED", "Proud to see 40 courses live for Brightpath Learning."],
  ];
  for (const [title, platform, format, campaign, offset, status, caption] of contentSeed) {
    await createContent(
      workspaceId,
      tz,
      {
        title,
        platform,
        format,
        campaign,
        scheduledAt: offset == null ? null : at(offset, "11:00"),
        status,
        caption,
        hashtags: "#smallbusiness #design #growth",
        notes: null,
      },
      db,
    );
  }

  // ---------------------------------------------------------------- Notes
  const noteSeed: [string, string, boolean, string, string | null, string | null][] = [
    [
      "Pricing guidelines",
      "- Discovery workshops are billed upfront.\n- Projects over ₹2,00,000 are split into milestones.\n- Retainers renew monthly; review scope every quarter.\n\n**Remember:** quote GST separately.",
      true,
      "sales,finance",
      null,
      null,
    ],
    [
      "Lumen relaunch — meeting notes",
      "## Kick-off\n\n- Priority: faster checkout on mobile\n- Launch window: before the festive sale\n- Aarav wants weekly demos\n\n## Open questions\n\n- Which payment gateway?\n- Inventory sync frequency",
      false,
      "meeting",
      pLumen.id,
      lumen.id,
    ],
    [
      "Onboarding checklist for new clients",
      "1. Send welcome email and kickoff agenda\n2. Create shared folder\n3. Collect brand assets and access\n4. Set up project in NEXUS with milestones\n5. Schedule weekly check-in",
      true,
      "process",
      null,
      null,
    ],
    ["Ideas backlog", "- Template store for social media packs\n- Webinar on website conversion\n- Partner with a photographer", false, "ideas", null, null],
  ];
  for (const [title, content, pinned, tags, projectId, customerId] of noteSeed) {
    await createNote(workspaceId, { title, content, pinned, tags, projectId, customerId, taskId: null }, db);
  }

  return { today: dateToKey(new Date(`${today}T00:00:00Z`)) };
}
