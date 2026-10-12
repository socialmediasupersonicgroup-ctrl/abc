"use client";

import { Check } from "lucide-react";
import { TASK_STATUS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function TaskStatusMenu({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Change status">
        <StatusBadge options={TASK_STATUS} value={status} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {TASK_STATUS.list.map((s) => (
          <DropdownMenuItem key={s.value} onSelect={() => s.value !== status && onChange(s.value)}>
            <StatusBadge options={TASK_STATUS} value={s.value} />
            {s.value === status && <Check className="ml-auto !text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
