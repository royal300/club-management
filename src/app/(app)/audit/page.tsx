import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { Pagination } from "@/components/app/pagination";
import { ExportMenu } from "@/components/app/export-menu";
import { EmptyState } from "@/components/app/empty-state";
import { ListPageSkeleton } from "@/components/app/skeletons";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { auditFacets, listAudit, parseAuditFilters } from "@/server/queries/finance";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditPage(props: PageProps<"/audit">) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <Audit searchParams={props.searchParams} />
    </Suspense>
  );
}

const ACTION_TONE: Record<string, string> = {
  CREATE: "bg-income/12 text-income",
  SETTLE: "bg-income/12 text-income",
  RENEW: "bg-income/12 text-income",
  UPDATE: "bg-chart-4/12 text-chart-4",
  ATTACH: "bg-chart-4/12 text-chart-4",
  VOID: "bg-destructive/12 text-destructive",
  DEACTIVATE: "bg-destructive/12 text-destructive",
  LOGIN_FAILED: "bg-destructive/12 text-destructive",
};

function entityHref(type: string, id: string | null) {
  if (!id) return null;
  if (type === "member") return `/members/${id}`;
  if (type === "transaction") return `/transactions/${id}`;
  if (type === "event") return `/events/${id}`;
  return null;
}

async function Audit({ searchParams }: { searchParams: PageProps<"/audit">["searchParams"] }) {
  await requirePermission("audit:read");
  const sp = await searchParams;
  const f = parseAuditFilters(sp);
  const [page, facets] = await Promise.all([listAudit(f), auditFacets()]);
  return (
    <>
      <PageHeader eyebrow="Accountability" title="Audit log" description="Who changed what, and when. Entries can't be edited or removed." actions={<ExportMenu entity="audit" />} />
      <div className="rounded-2xl border bg-card">
        <div className="border-b p-3 sm:p-4">
          <FilterBar
            placeholder="Summary, user, record ID…"
            filters={[
              { type: "select", name: "action", label: "Actions", options: facets.actions.map((a) => ({ value: a, label: a.replace("_", " ").toLowerCase() })) },
              { type: "select", name: "entity", label: "Records", options: facets.entities.map((e) => ({ value: e, label: e })) },
              { type: "date", name: "from", label: "From" },
              { type: "date", name: "to", label: "To" },
            ]}
          />
        </div>
        {page.rows.length ? (
          <>
            <ul className="divide-y">
              {page.rows.map((a) => {
                const href = entityHref(a.entityType, a.entityId);
                return (
                  <li key={a.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4 sm:px-5">
                    <div className="text-xs text-muted-foreground">
                      <p className="tabular">{formatDateTime(a.createdAt)}</p>
                      <p className="font-medium text-foreground">{a.userName ?? "System"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${ACTION_TONE[a.action] ?? "bg-muted text-muted-foreground"}`}>{a.action}</span>
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {a.summary}
                          </Link>
                        ) : (
                          <span>{a.summary}</span>
                        )}
                      </p>
                      {a.changes ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {Object.entries(a.changes).map(([k, c]) => (
                            <li key={k}>
                              <span className="font-medium text-foreground">{k}</span>: <span className="line-through">{String(c.from ?? "—")}</span> → {String(c.to ?? "—")}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {a.ip ? <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">IP {a.ip}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination base="/audit" sp={sp} page={page.page} pages={page.pages} total={page.total} pageSize={page.pageSize} />
          </>
        ) : (
          <EmptyState title="Nothing logged here">Try a different filter.</EmptyState>
        )}
      </div>
    </>
  );
}
