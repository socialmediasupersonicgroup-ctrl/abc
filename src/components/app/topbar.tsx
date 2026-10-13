"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut, Menu, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Alert } from "@/lib/services/notifications";
import { initials } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import { useApp } from "./app-context";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Notifications } from "./notifications";
import { QuickCreate } from "./quick-create";

export function Topbar({ alerts, authEnabled }: { alerts: Alert[]; authEnabled: boolean }) {
  const { setPaletteOpen, workspace } = useApp();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const [isMac, setIsMac] = React.useState(true);
  React.useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  React.useEffect(() => setMobileOpen(false), [pathname]);

  const owner = workspace.ownerName || workspace.name;

  return (
    <header className="sticky top-0 z-30 border-b print:hidden bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)} data-testid="mobile-nav">
            <Menu />
          </Button>
          <SheetContent title="Navigation">
            <div className="flex h-14 items-center px-4">
              <Logo />
            </div>
            <div className="px-3 pb-4">
              <WorkspaceSwitcher />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Dialog>

        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border bg-surface px-2.5 text-[13px] text-muted-foreground shadow-card transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="search-trigger"
        >
          <Search className="size-3.5" />
          <span className="flex-1 truncate text-left">Search or jump to…</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <QuickCreate />
          <Notifications alerts={alerts} />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                {initials(owner)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel className="normal-case tracking-normal">
                <span className="block text-[13px] font-medium text-foreground">{workspace.ownerName || "Workspace owner"}</span>
                <span className="block text-xs font-normal">{workspace.name}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPaletteOpen(true)}>
                <Search /> Command palette
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {authEnabled ? (
                <DropdownMenuItem onSelect={() => void logoutAction()}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              ) : (
                <p className="px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Local mode: no password is set, so anyone who can reach this server has access.
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {workspace.isDemo && (
        <div className="flex items-center justify-center gap-2 border-t bg-warning-soft px-4 py-1.5 text-center text-xs text-warning">
          <FlaskConical className="size-3.5 shrink-0" />
          <span>
            Demo workspace — all records here are fictional sample data, not real business results.{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              Manage workspaces
            </Link>
          </span>
        </div>
      )}
    </header>
  );
}
