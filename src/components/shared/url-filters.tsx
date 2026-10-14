"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isDateKey } from "@/lib/dates";

/** Updates URL search params (filters live in the URL so they survive reloads and can be shared). */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = React.useCallback(
    (updates: Record<string, string | null | undefined>, opts: { replace?: boolean } = {}) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in updates)) next.delete("page");
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, pathname, router],
  );
  return { params, set };
}

export function SearchFilter({ placeholder = "Search…", className, param = "q" }: { placeholder?: string; className?: string; param?: string }) {
  const { params, set } = useUrlParams();
  const urlValue = params.get(param) ?? "";
  const [value, setValue] = React.useState(urlValue);
  // The last value this input wrote to the URL. When the URL catches up with it, keep what the user has
  // typed since (including trailing spaces); only outside changes (back/forward, "Clear") overwrite the box.
  const pushed = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (pushed.current !== null && urlValue === pushed.current) return;
    pushed.current = null;
    setValue(urlValue);
  }, [urlValue]);

  React.useEffect(() => {
    const next = value.trim();
    if (next === urlValue) return;
    const t = setTimeout(() => {
      pushed.current = next;
      set({ [param]: next || null }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
    // Re-evaluated when a navigation lands too, so an edit made while a push was in flight is pushed afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, urlValue]);

  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 text-[13px]"
        aria-label={placeholder}
      />
    </div>
  );
}

/**
 * Date input bound to a URL param. Complete, valid dates (typed or picked) apply immediately; partial keyboard
 * entry stays local so it isn't reverted mid-typing. Invalid or rejected input reverts to the value in effect.
 * Pass `value` when the page resolves a different effective value than the raw URL (defaults, clamping).
 */
export function UrlDateInput({
  param,
  label,
  className,
  min,
  max,
  required,
  value: effective,
}: {
  param: string;
  label: string;
  className?: string;
  min?: string;
  max?: string;
  required?: boolean;
  value?: string;
}) {
  const { params, set } = useUrlParams();
  const current = effective ?? params.get(param) ?? "";
  const [value, setValue] = React.useState(current);
  // Resync whenever the effective value or the URL changes (including navigations that land on the same value).
  React.useEffect(() => setValue(current), [current, params]);

  const commit = (v: string) => {
    if (v === current) return;
    if (v === "") {
      if (required) setValue(current);
      else set({ [param]: null }, { replace: true });
      return;
    }
    if (isDateKey(v)) set({ [param]: v }, { replace: true });
    else setValue(current);
  };

  return (
    <Input
      type="date"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      required={required}
      onChange={(e) => {
        const v = e.target.value;
        setValue(v);
        // isDateKey rejects years below 1000, so partial keyboard years (0002, 0020…) are never pushed.
        if (isDateKey(v)) commit(v);
      }}
      onBlur={() => commit(value)}
      onKeyDown={(e) => e.key === "Enter" && commit(value)}
      className={cn("h-8 w-[150px] text-[13px]", className)}
    />
  );
}

export function SelectFilter({
  param,
  label,
  options,
  allLabel,
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel: string;
  className?: string;
}) {
  const { params, set } = useUrlParams();
  return (
    <Select
      aria-label={label}
      value={params.get(param) ?? ""}
      onChange={(e) => set({ [param]: e.target.value || null })}
      className={cn("h-8 w-auto min-w-[130px] text-[13px]", params.get(param) && "border-primary/40 bg-primary-soft/40", className)}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const { params, set } = useUrlParams();
  const active = keys.some((k) => params.get(k));
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(keys.map((k) => [k, null])))}>
      <X /> Clear
    </Button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  label: string;
}) {
  return (
    <div className="inline-flex h-8 items-center rounded-md bg-muted p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon && <o.icon className="size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
