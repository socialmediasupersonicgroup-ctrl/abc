"use client";

import * as React from "react";
import { useTheme } from "next-themes";

const VARS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "border", "muted-foreground", "foreground", "popover", "success", "destructive", "warning", "info"] as const;
type Key = (typeof VARS)[number];

/** Resolves design tokens to concrete colors, because SVG presentation attributes cannot read CSS variables. */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = React.useState<Record<Key, string> | null>(null);
  React.useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next = {} as Record<Key, string>;
    for (const v of VARS) next[v] = `hsl(${style.getPropertyValue(`--${v}`).trim()})`;
    setColors(next);
  }, [resolvedTheme]);
  return colors;
}
