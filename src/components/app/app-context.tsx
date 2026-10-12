"use client";

import * as React from "react";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

export type WorkspaceInfo = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  isDemo: boolean;
  invoicePrefix: string;
  defaultTaxBps: number;
  weekStartsOn: number;
  ownerName: string;
};

export type Options = {
  projects: { id: string; name: string; status: string; customerId: string | null }[];
  customers: { id: string; name: string; company: string | null }[];
  tasks: { id: string; title: string }[];
};

export type CreateKind = "task" | "project" | "customer" | "transaction" | "event" | "content" | "note";
export type CreateDefaults = Record<string, string | boolean | null | undefined>;

type Ctx = {
  workspace: WorkspaceInfo;
  workspaces: { id: string; name: string; isDemo: boolean }[];
  today: string;
  options: Options;
  create: { kind: CreateKind; defaults?: CreateDefaults } | null;
  openCreate: (kind: CreateKind, defaults?: CreateDefaults) => void;
  closeCreate: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
};

const AppContext = React.createContext<Ctx | null>(null);

export function AppProvider({
  children,
  workspace,
  workspaces,
  today,
  options,
}: {
  children: React.ReactNode;
  workspace: WorkspaceInfo;
  workspaces: Ctx["workspaces"];
  today: string;
  options: Options;
}) {
  const [create, setCreate] = React.useState<Ctx["create"]>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const value = React.useMemo<Ctx>(
    () => ({
      workspace,
      workspaces,
      today,
      options,
      create,
      openCreate: (kind, defaults) => setCreate({ kind, defaults }),
      closeCreate: () => setCreate(null),
      paletteOpen,
      setPaletteOpen,
    }),
    [workspace, workspaces, today, options, create, paletteOpen],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function useMoney() {
  const { workspace } = useApp();
  return React.useMemo(
    () => ({
      currency: workspace.currency,
      format: (minor: number) => formatMoney(minor, workspace.currency),
      compact: (minor: number) => formatMoneyCompact(minor, workspace.currency),
    }),
    [workspace.currency],
  );
}
