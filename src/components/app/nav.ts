import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  NotebookPen,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; group: "main" | "ops" | "system" };

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, group: "main" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, group: "main" },
  { href: "/projects", label: "Projects", icon: FolderKanban, group: "main" },
  { href: "/customers", label: "Customers", icon: Users, group: "main" },
  { href: "/finance", label: "Finance", icon: Wallet, group: "ops" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, group: "ops" },
  { href: "/content", label: "Content Planner", icon: Megaphone, group: "ops" },
  { href: "/notes", label: "Notes", icon: NotebookPen, group: "ops" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "system" },
  { href: "/settings", label: "Settings", icon: Settings, group: "system" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
