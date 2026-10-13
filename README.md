# NEXUS — Business Operating System

NEXUS is a command center for founders, freelancers and small teams. It brings tasks, projects, customers, finance and invoicing, a calendar, a content planner, notes and analytics into one fast, keyboard-friendly web app.

Every number on the dashboard comes from records you store. When there is no data, NEXUS shows an empty state; it never fills the gap with estimates or invented growth figures.

## Features

| Module | What it does |
| --- | --- |
| **Overview** | Revenue, expenses, net profit, outstanding and overdue invoices, active projects, open and overdue tasks, deadlines for the next 7 days, and customer count. Includes a cash-flow chart, priority tasks, recent transactions, upcoming events, task and project breakdowns, and recently updated records. Period selector (month, last 30 days, quarter, year, all time). A comparison with the previous period appears only when that period has data. |
| **Tasks** | Create, edit and delete tasks. Each task has a status, priority, due date, assignee, project and customer links, and tags. List and board views (drag-and-drop or a status menu), search, filters (status, priority, project, due, tag), sorting and overdue indicators. Filters are kept in the URL. |
| **Projects** | Card and table views. Each project page lists its tasks (you can add tasks inline), invoices, transactions, events and notes. Progress is either calculated from completed tasks or entered manually, and the page says which. Budget usage comes from linked expenses. Overdue and due-soon deadlines are flagged. You can create a project together with its first tasks in one step. |
| **Customers (CRM)** | Status, lead source, deal value, last contact and next follow-up. Search, filters and sorting. The detail page shows projects, invoices, open tasks, events, linked notes and a running notes log. "Log contact" stamps today's date and schedules the next follow-up. Due follow-ups appear in notifications. |
| **Finance** | An income and expense ledger with categories, payment methods, references, and optional customer or project links. Search, filters, date ranges with presets, filtered summaries and pagination. |
| **Invoicing** | Multiple line items, decimal quantities, percent or fixed discounts, and a configurable tax (GST 18% by default). Totals update live as you edit. Statuses are Draft, Sent, Paid, Overdue and Cancelled. Paid and Overdue are derived from payments and the due date. You can record partial payments, preview the invoice, print it, and download it as a PDF (generated with jsPDF). |
| **Calendar** | Month, week and agenda views. Create, edit and delete events, including all-day and multi-day events, and link them to tasks, projects or customers. Task deadlines, project deadlines and scheduled content appear on the calendar alongside events. Times use the workspace time zone. |
| **Content Planner** | Board, list and calendar views. Each item has a platform, format, campaign, schedule, caption, hashtags and notes. You can copy the caption and hashtags with one click. You change the status yourself; NEXUS does not publish anything. |
| **Notes** | A Markdown editor with a safe preview renderer. Supports pinning, archiving, tags, search, and links to tasks, projects and customers. Autosave shows its state (unsaved, saving, saved or error with a retry button), saves pending edits before you switch notes, and warns before you close the tab with unsaved changes. |
| **Analytics** | For any date range: revenue, expenses and net income over time, cumulative net income, expenses by category, task throughput, customer growth, invoice collection (invoiced, collected, outstanding, collection rate), project progress and the content pipeline. |
| **Search and commands** | <kbd>Ctrl/⌘ K</kbd> opens a command palette. It searches tasks, projects, customers, invoices, transactions, events, notes and content (results grouped by type) and offers create, navigation and theme shortcuts. |
| **Settings** | Workspace name, currency (INR by default), time zone, first day of the week, invoice prefix, default tax rate and owner profile. Theme (light, dark or system). Load or reset the demo workspace, delete all data in a workspace (you type the name to confirm), and delete a workspace. |
| **Shell** | Collapsible sidebar, workspace switcher, quick-create menu, live notifications (overdue tasks and invoices, due follow-ups, events in the next 24 hours), light and dark themes, a mobile navigation drawer, and a print stylesheet. |

## Tech stack

- **Next.js 15** (App Router, React Server Components, Server Actions) with **React 19** and **TypeScript** in strict mode
- **Prisma 6** with **SQLite**, managed through migrations
- **Tailwind CSS 3** with a custom token-based design system (light and dark), **Radix UI** primitives, **cmdk** and **lucide-react** icons
- **Recharts** for charts. The categorical palette was validated for colour-vision deficiency and contrast in both themes.
- **Zod** validation shared by the client (React Hook Form) and the server
- **date-fns** and **date-fns-tz** for dates and time zones, **jsPDF** for invoice PDFs, **sonner** for toasts
- **Vitest** for unit and integration tests and **Playwright** for end-to-end tests

## Getting started

Requirements: Node.js 20 or newer, and npm.

```bash
# 1. Install dependencies (this also generates the Prisma client)
npm install

# 2. Configure the database location
cp .env.example .env            # DATABASE_URL="file:./dev.db" (relative to prisma/)

# 3. Create the database and load the demo workspace
npm run setup                   # = prisma migrate deploy && prisma db seed

# 4. Start the app
npm run dev                     # http://localhost:3000
```

To run a production build instead:

```bash
npm run build
npm start                       # http://localhost:3000
```

### Demo data versus your own data

`npm run setup` creates a workspace called **"Demo Studio (sample data)"**. Every record in it is fictional and is labelled as such throughout the UI. To start fresh, open the workspace switcher in the top-left corner and choose **New workspace**. You can reset or reload the demo at any time from **Settings → Data management**. The seed script and the demo reset only ever modify the workspace flagged as the demo.

## Deploying to Railway

The repository includes a `Dockerfile` and `railway.json`, so Railway builds and runs it with no extra setup. The container applies database migrations on start and serves a public health check at `/api/health`.

1. Sign in at [railway.com](https://railway.com) with GitHub. Choose **New Project → Deploy from GitHub repo**, then select this repository.
2. In the new service, open **Variables** and add `NEXUS_PASSWORD` with a long, unique password. Optionally add `SESSION_SECRET` with a random string.
3. Right-click the service (or use **⌘K → Add Volume**), add a **Volume**, and set its mount path to `/data`. The SQLite database lives there, so your data survives redeploys.
4. Open **Settings → Networking → Generate Domain**. Railway gives you a public `https://….up.railway.app` link.
5. Open the link and sign in with your password.

The same image runs on any Docker host:

```bash
docker build -t nexus .
docker run -p 3000:3000 -e NEXUS_PASSWORD='your-password' -v nexus-data:/data nexus
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXUS_PASSWORD` | Yes, for any public deployment | Owner password. When it is set, every page, server action and search request requires a signed session. |
| `SESSION_SECRET` | No | Key for signing session cookies. Defaults to `NEXUS_PASSWORD`. Changing either value signs everyone out. |
| `DATABASE_URL` | No | Defaults to `file:<volume>/nexus.db` (Railway's `RAILWAY_VOLUME_MOUNT_PATH`, otherwise `/data`). |
| `PORT` | No | Set automatically by Railway. Defaults to 3000. |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (Next.js core-web-vitals and TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit and integration tests (Vitest, against a fresh SQLite database at `prisma/test.db`) |
| `npm run test:e2e` | Playwright end-to-end tests. Run `npm run build` first. The tests start two servers with fresh databases: port 3100 runs open, and port 3101 has a password set, to test the sign-in gate. To use an already-installed Chromium, set `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome`; otherwise run `npx playwright install chromium` once. |
| `npm run db:migrate` | Create or apply migrations during development |
| `npm run db:seed` | Reseed the demo workspace |
| `npm run setup` | Apply migrations and seed (first run) |
| `npm run start:prod` | Production entrypoint used by Docker and Railway: migrate, then start on `$PORT` |

## Project structure

```
prisma/
  schema.prisma        Data model (workspaces, customers, projects, tasks, transactions,
                       invoices, invoice items, payments, events, content, notes, tags)
  migrations/          SQL migrations
  seed.ts              Seeds the labelled demo workspace
src/
  app/(app)/           Routes: overview, tasks, projects, customers, finance, calendar,
                       content, notes, analytics, settings
  components/          UI kit (ui/), app shell (app/), forms, charts and module components
  lib/
    calc/              Pure business logic: invoice totals, progress, financial metrics
    services/          Workspace-scoped data access and mutations (used by pages, actions and tests)
    validation/        Zod schemas shared by client and server
    money.ts, dates.ts Money (integer minor units) and date / time-zone helpers
  server/
    actions/           Server Actions: validate input → call service → revalidate
    workspace.ts       Active-workspace resolution
tests/
  unit/                Money, invoice maths and rounding, metrics, progress, validation, time zones
  integration/         Database workflows against a real SQLite file
  e2e/                 Browser workflows (Playwright)
```

## Design decisions

**Money.** Amounts are stored as integer minor units (paise for INR). User input is parsed from strings, so no floating-point arithmetic is involved. Each line amount is `round(qty × unit price)`, with quantities limited to two decimal places. The discount is applied to the subtotal, then tax is applied to the discounted amount. Every rounding step is half away from zero. Currency is formatted per workspace; INR uses Indian digit grouping (₹1,23,456.78).

**No double counting.** Recording a payment on an invoice, in a single database transaction:

1. creates the payment,
2. creates exactly one linked income transaction,
3. updates the invoice's paid amount and status.

Revenue is therefore the sum of income transactions, and invoice totals are never added to it a second time. A linked transaction can only be changed or removed through its payment.

**Status rules.** NEXUS rejects payments that exceed the outstanding balance and payments on draft or cancelled invoices. You cannot cancel an invoice that has payments, or reduce its total below the amount already paid. Customers with invoices cannot be deleted. When you delete a project, its tasks, invoices and other records are kept but unlinked.

**Dates.** Date-only fields (due dates, invoice dates, transaction dates and follow-ups) are stored as UTC-midnight values and read back as calendar dates, so they never shift between time zones. Event and content times are real instants, entered and displayed in the workspace time zone. "Today" is calculated in that time zone.

**Validation.** The same Zod schemas validate on the client, for instant feedback, and again on the server inside every Server Action. Each service also checks that every referenced record belongs to the active workspace.

## Limitations and deployment notes

- **Single owner password, not user accounts.** When `NEXUS_PASSWORD` is set, the middleware and a server-side check on every page and action require a signed, httpOnly session cookie. Sessions last 30 days. Failed sign-ins are rate-limited (5 attempts per 15 minutes per client, held in memory). There are no separate user accounts or roles, and anyone who knows the password has full access. Workspaces separate data; they do not isolate users from each other. Without `NEXUS_PASSWORD`, the app runs open, which is only appropriate on your own machine.
- **SQLite** keeps setup simple. Locally it persists to `prisma/dev.db`; on Railway it persists to the attached volume. Run a single instance only (no horizontal scaling). To back up, copy the database file, or use Railway's volume backups. Serverless platforms with ephemeral file systems (for example Vercel) will lose SQLite data. On those, switch the Prisma `provider` to PostgreSQL and regenerate the migrations.
- **No external integrations.** NEXUS does not send email, sync with Google or other calendars, or post to social platforms. Email and phone links open your own apps, and invoices are sent by downloading the PDF. No API keys are required.
- **Invoice PDFs** use jsPDF's built-in fonts, which have no ₹ glyph, so amounts in the PDF show the currency code (for example "INR 54,692.99"). The on-screen preview and the browser's print output (Print → Save as PDF) use the ₹ symbol.
- **Assignees** are free text, because NEXUS has no user accounts.
- **Lists** show up to 500 tasks or customers and 300 projects or invoices per view. Use filters to narrow larger datasets. The transaction ledger is paginated (50 per page).
