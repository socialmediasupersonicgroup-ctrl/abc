"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanban, LayoutGrid, Plus, Table2 } from "lucide-react";
import { PRIORITY, PROJECT_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import type { ProgressSource } from "@/lib/calc/progress";
import { useApp, useMoney } from "@/components/app/app-context";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClearFilters, SearchFilter, Segmented, SelectFilter, useUrlParams } from "@/components/shared/url-filters";
import { PriorityIcon } from "@/components/shared/bits";
import { DeadlineChip, ProgressBlock } from "./project-bits";

export type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  budget: number;
  customer: { id: string; name: string } | null;
  progress: { value: number; source: ProgressSource; done: number; total: number };
};

const KEYS = ["q", "status", "priority", "customerId"];

export function ProjectsView({ projects, view: initialView }: { projects: ProjectItem[]; view: "cards" | "table" }) {
  // Local state makes the switch instant; the URL keeps it shareable and reload-safe.
  const [view, setView] = React.useState(initialView);
  const { options, today, openCreate } = useApp();
  const money = useMoney();
  const { params, set } = useUrlParams();
  // Follow the browser URL (not the server prop), so a late server refresh can't revert the chosen view.
  const urlView = params.get("view");
  React.useEffect(() => {
    setView(urlView && (["cards", "table"] as string[]).includes(urlView) ? (urlView as typeof initialView) : "cards");
  }, [urlView]);
  const filtered = KEYS.some((k) => params.get(k));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Search projects…" />
          <SelectFilter
            param="status"
            label="Status"
            allLabel="All statuses"
            options={[{ value: "OPEN", label: "Open (not closed)" }, ...PROJECT_STATUS.list.map((s) => ({ value: s.value, label: s.label }))]}
          />
          <SelectFilter param="priority" label="Priority" allLabel="Any priority" options={PRIORITY.list.map((s) => ({ value: s.value, label: s.label }))} />
          <SelectFilter param="customerId" label="Customer" allLabel="All customers" options={options.customers.map((c) => ({ value: c.id, label: c.name }))} />
          <ClearFilters keys={KEYS} />
        </div>
        <div className="flex items-center gap-2">
          <SelectFilter
            param="sort"
            label="Sort"
            allLabel="Sort: deadline"
            options={[
              { value: "updated", label: "Sort: recently updated" },
              { value: "name", label: "Sort: name" },
              { value: "budget", label: "Sort: budget" },
            ]}
          />
          <Segmented
            label="View"
            value={view}
            onChange={(v) => {
              setView(v);
              set({ view: v === "cards" ? null : v }, { replace: true });
            }}
            options={[
              { value: "cards", label: "Cards", icon: LayoutGrid },
              { value: "table", label: "Table", icon: Table2 },
            ]}
          />
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={filtered ? "No projects match these filters" : "No projects yet"}
            description={filtered ? "Try a different search or clear the filters." : "Projects group tasks, invoices and notes around a piece of work."}
            action={
              !filtered && (
                <Button onClick={() => openCreate("project")}>
                  <Plus /> New project
                </Button>
              )
            }
          />
        </Card>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group flex flex-col rounded-lg border bg-card p-4 shadow-card transition-colors hover:border-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="project-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium group-hover:text-primary">{p.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.customer?.name ?? "Internal"}</p>
                </div>
                <StatusBadge options={PROJECT_STATUS} value={p.status} />
              </div>
              {p.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>}
              <div className="mt-auto pt-4">
                <ProgressBlock progress={p.progress} />
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="flex items-center gap-3">
                    <PriorityIcon priority={p.priority} withLabel />
                    <DeadlineChip status={p.status} dueDate={p.dueDate} today={today} />
                  </span>
                  <span className="text-xs font-medium tabular text-muted-foreground">{p.budget ? money.compact(p.budget) : ""}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Project</TH>
                  <TH>Status</TH>
                  <TH className="hidden md:table-cell">Priority</TH>
                  <TH className="w-[180px]">Progress</TH>
                  <TH>Deadline</TH>
                  <TH className="hidden text-right lg:table-cell">Budget</TH>
                </tr>
              </THead>
              <TBody>
                {projects.map((p) => (
                  <TR key={p.id}>
                    <TD className="max-w-[300px]">
                      <Link href={`/projects/${p.id}`} className="block truncate font-medium hover:text-primary">
                        {p.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{p.customer?.name ?? "Internal"}</span>
                    </TD>
                    <TD>
                      <StatusBadge options={PROJECT_STATUS} value={p.status} />
                    </TD>
                    <TD className="hidden md:table-cell">
                      <PriorityIcon priority={p.priority} withLabel />
                    </TD>
                    <TD>
                      <ProgressBlock progress={p.progress} compact />
                    </TD>
                    <TD>
                      <span className="flex flex-col">
                        <DeadlineChip status={p.status} dueDate={p.dueDate} today={today} />
                        {p.dueDate && <span className="text-[11px] text-muted-foreground">{formatDate(p.dueDate)}</span>}
                      </span>
                    </TD>
                    <TD className="hidden text-right tabular lg:table-cell">{money.format(p.budget)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
