import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/app/page-header";
import { Amount, CategoryLabel, StatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { ListPageSkeleton } from "@/components/app/skeletons";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { param } from "@/server/queries/common";
import { listEvents } from "@/server/queries/finance";
import { searchMembersLite } from "@/server/queries/members";
import { listTransactions } from "@/server/queries/transactions";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <Search searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Search({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const [, sp] = await Promise.all([requireUser(), searchParams]);
  const q = param(sp, "q")?.slice(0, 100) ?? "";
  if (!q) {
    return (
      <>
        <PageHeader title="Search" />
        <EmptyState title="Search the whole ledger">Type a member&rsquo;s name, phone, member ID, receipt number or UPI reference in the search bar.</EmptyState>
      </>
    );
  }
  const [members, txns, events] = await Promise.all([
    searchMembersLite(q, 10),
    listTransactions({ q, status: "ALL", page: 1, pageSize: 12, sort: "date" }),
    listEvents({ q, page: 1, pageSize: 6 }),
  ]);
  const nothing = !members.length && !txns.rows.length && !events.rows.length;
  return (
    <>
      <PageHeader eyebrow="Search" title={<>Results for &ldquo;{q}&rdquo;</>} />
      {nothing ? (
        <EmptyState title="No matches">Nothing in members, transactions or events matches &ldquo;{q}&rdquo;.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          <Panel title={`Members (${members.length})`} bodyClassName="p-0 sm:p-0" action={<Link className="text-xs text-muted-foreground hover:text-foreground" href={`/members?q=${encodeURIComponent(q)}&status=all`}>Open in members</Link>}>
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 sm:px-5">
                    <span>
                      <span className="block text-sm font-medium">{m.fullName}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {m.memberCode} · {m.phone}
                      </span>
                    </span>
                    {m.status === "INACTIVE" ? <span className="text-xs text-muted-foreground">Inactive</span> : null}
                  </Link>
                </li>
              ))}
              {!members.length ? <li className="px-5 py-4 text-sm text-muted-foreground">No members match.</li> : null}
            </ul>
          </Panel>
          <Panel title={`Events (${events.total})`} bodyClassName="p-0 sm:p-0">
            <ul className="divide-y">
              {events.rows.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="block px-4 py-2.5 hover:bg-muted/40 sm:px-5">
                    <span className="block text-sm font-medium">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(e.eventDate)}</span>
                  </Link>
                </li>
              ))}
              {!events.rows.length ? <li className="px-5 py-4 text-sm text-muted-foreground">No events match.</li> : null}
            </ul>
          </Panel>
          <Panel className="lg:col-span-2" title={`Transactions (${txns.total})`} bodyClassName="p-0 sm:p-0" action={<Link className="text-xs text-muted-foreground hover:text-foreground" href={`/transactions?q=${encodeURIComponent(q)}&status=ALL`}>Open in ledger</Link>}>
            <ul className="divide-y">
              {txns.rows.map((t) => (
                <li key={t.id}>
                  <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {t.partyName ?? t.memberName} <StatusBadge status={t.status} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(t.txnDate)} · <CategoryLabel kind={t.kind} incomeCategory={t.incomeCategory} expenseCategory={t.expenseCategory} /> · <span className="font-mono">{t.receiptNo ?? t.txnCode}</span>
                      </span>
                    </span>
                    <Amount kind={t.kind} value={t.amount} className="text-sm" />
                  </Link>
                </li>
              ))}
              {!txns.rows.length ? <li className="px-5 py-4 text-sm text-muted-foreground">No transactions match.</li> : null}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
