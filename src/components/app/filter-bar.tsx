"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };
export type FilterDef =
  | { type: "select"; name: string; label: string; options: FilterOption[]; allLabel?: string }
  | { type: "date"; name: string; label: string };

/** URL-driven filters: every change is a shareable link and works with exports. */
export function FilterBar({ placeholder = "Search…", filters = [], className }: { placeholder?: string; filters?: FilterDef[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  const push = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = filters.some((f) => params.get(f.name)) || !!params.get("q");

  const isCompact = filters.length <= 3;

  return (
    <div className={cn("flex flex-col gap-2.5", isCompact && "lg:flex-row lg:items-center lg:gap-3", className)}>
      <div className={cn("relative w-full shrink-0", isCompact ? "lg:w-72 xl:w-80" : "sm:max-w-sm md:max-w-md")}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search this list"
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        {pending ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      </div>
      {filters.length > 0 ? (
        <div className="scrollbar-none -mx-4 flex flex-wrap items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          {filters.map((f) =>
            f.type === "select" ? (
              <label key={f.name} className="relative shrink-0">
                <span className="sr-only">{f.label}</span>
                <select
                  value={params.get(f.name) ?? ""}
                  onChange={(e) => push({ [f.name]: e.target.value || null })}
                  className={cn(
                    "h-10 appearance-none rounded-lg border border-input bg-card pl-3 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                    params.get(f.name) && "border-primary/50 bg-accent/60",
                  )}
                >
                  <option value="">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </label>
            ) : (
              <label key={f.name} className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-card pl-3 pr-2 text-xs text-muted-foreground transition-colors dark:bg-input/30">
                <span>{f.label}</span>
                <input
                  type="date"
                  value={params.get(f.name) ?? ""}
                  onChange={(e) => push({ [f.name]: e.target.value || null })}
                  className="h-8 bg-transparent text-sm text-foreground outline-none cursor-pointer"
                />
              </label>
            ),
          )}
          {active ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                startTransition(() => router.replace(pathname, { scroll: false }));
              }}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" /> Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
