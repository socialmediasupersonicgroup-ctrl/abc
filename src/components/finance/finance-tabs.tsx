"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function FinanceTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/finance", label: "Transactions", active: pathname === "/finance" },
    { href: "/finance/invoices", label: "Invoices", active: pathname.startsWith("/finance/invoices") },
  ];
  return (
    <nav className="mb-6 flex gap-1 border-b" aria-label="Finance sections">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 pb-2.5 text-[13px] font-medium transition-colors",
            t.active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
