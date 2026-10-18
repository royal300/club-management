import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { SearchParams } from "@/server/queries/common";

function hrefFor(base: string, sp: SearchParams, page: number) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v && k !== "page") next.set(k, v);
  }
  if (page > 1) next.set("page", String(page));
  return `${base}${next.size ? `?${next}` : ""}`;
}

export function Pagination({ base, sp, page, pages, total, pageSize }: { base: string; sp: SearchParams; page: number; pages: number; total: number; pageSize: number }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">
      <span className="tabular">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <PageLink disabled={page <= 1} href={hrefFor(base, sp, page - 1)} label="Previous page">
          <ChevronLeft className="size-4" />
        </PageLink>
        <span className="px-2 tabular">
          {page} / {pages}
        </span>
        <PageLink disabled={page >= pages} href={hrefFor(base, sp, page + 1)} label="Next page">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "grid size-9 place-items-center rounded-lg border bg-card";
  if (disabled)
    return (
      <span aria-disabled className={cn(cls, "opacity-40")}>
        {children}
      </span>
    );
  return (
    <Link href={href} aria-label={label} className={cn(cls, "hover:bg-muted")} scroll={false}>
      {children}
    </Link>
  );
}
