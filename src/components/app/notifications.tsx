"use client";

import Link from "next/link";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, FileText, UserRound } from "lucide-react";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { Alert } from "@/lib/services/notifications";
import { cn } from "@/lib/utils";

const ICONS = { task: AlertTriangle, invoice: FileText, followup: UserRound, event: CalendarClock };
const TONES = { danger: "text-destructive bg-destructive-soft", warning: "text-warning bg-warning-soft", info: "text-info bg-info-soft" };

export function Notifications({ alerts }: { alerts: Alert[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Notifications${alerts.length ? ` (${alerts.length})` : ""}`} className="relative">
          <Bell />
          {alerts.length > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-destructive-foreground">
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Needs attention</p>
          <span className="text-xs text-muted-foreground">Live from your data</span>
        </div>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <CheckCircle2 className="mb-2 size-6 text-success" />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">No overdue tasks, invoices or follow-ups.</p>
          </div>
        ) : (
          <ul className="max-h-[360px] divide-y overflow-y-auto">
            {alerts.map((a) => {
              const Icon = ICONS[a.kind];
              return (
                <li key={a.id}>
                  <PopoverClose asChild>
                    <Link href={a.href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", TONES[a.tone])}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{a.title}</span>
                        <span className="block text-xs text-muted-foreground">{a.detail}</span>
                      </span>
                    </Link>
                  </PopoverClose>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
