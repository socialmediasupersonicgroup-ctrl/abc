"use client";

import Link from "next/link";
import { CalendarPlus, CheckSquare, FileText, FolderPlus, Megaphone, NotebookPen, Plus, Receipt, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useApp } from "./app-context";

export function QuickCreate() {
  const { openCreate } = useApp();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5" data-testid="quick-create">
          <Plus /> <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openCreate("task")}>
          <CheckSquare /> Task
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openCreate("project")}>
          <FolderPlus /> Project
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openCreate("customer")}>
          <UserPlus /> Customer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/finance/invoices/new">
            <FileText /> Invoice
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openCreate("transaction")}>
          <Receipt /> Transaction
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openCreate("event")}>
          <CalendarPlus /> Event
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openCreate("content")}>
          <Megaphone /> Content idea
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openCreate("note")}>
          <NotebookPen /> Note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
