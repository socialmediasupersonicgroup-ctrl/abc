"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "./logo";
import { NAV, isActive } from "./nav";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const GROUP_LABELS = { main: "Workspace", ops: "Operations", system: "Insights" } as const;

export function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5" aria-label="Main navigation">
      {(["main", "ops", "system"] as const).map((group) => (
        <div key={group}>
          {!collapsed && <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">{GROUP_LABELS[group]}</p>}
          <ul className="grid gap-0.5">
            {NAV.filter((n) => n.group === group).map((item) => {
              const active = isActive(pathname, item.href);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const STORAGE_KEY = "nexus.sidebar.collapsed";

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-surface transition-[width] duration-200 lg:flex print:!hidden",
        collapsed ? "w-[64px]" : "w-[244px]",
      )}
    >
      <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="NEXUS home">
          <Logo collapsed={collapsed} />
        </Link>
        {!collapsed && (
          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      <div className={cn("pb-4", collapsed ? "px-3" : "px-3")}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className={cn("border-t p-3", collapsed && "flex justify-center")}>
        {collapsed ? (
          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        ) : (
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Single-user workspace · data stored on this server
          </p>
        )}
      </div>
    </aside>
  );
}
