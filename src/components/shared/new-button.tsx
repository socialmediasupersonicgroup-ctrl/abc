"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp, type CreateDefaults, type CreateKind } from "@/components/app/app-context";

export function NewButton({ kind, label, defaults, variant = "default", size = "md" }: { kind: CreateKind; label: string; defaults?: CreateDefaults; variant?: "default" | "outline"; size?: "sm" | "md" }) {
  const { openCreate } = useApp();
  return (
    <Button variant={variant} size={size} onClick={() => openCreate(kind, defaults)}>
      <Plus /> {label}
    </Button>
  );
}
