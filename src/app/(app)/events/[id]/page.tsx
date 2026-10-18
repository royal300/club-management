import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { Amount, CategoryLabel, ModeBadge, StatusBadge } from "@/components/app/badges";
import { CategoryBars } from "@/components/app/charts";
import { EmptyState } from "@/components/app/empty-state";
import { HistoryList } from "@/components/app/history-list";
import { AnimatedNumber } from "@/components/app/animated-number";
import { cn } from "@/lib/utils";
import { formatDate, formatINR, INCOME_CATEGORY_LABEL } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { getEntityHistory, getEvent, getEventCategoryBreakdown } from "@/server/queries/finance";
import { listTransactions } from "@/server/queries/transactions";

export const metadata: Metadata = { title: "Event" };

export default function EventPage(props: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <EventDetail params={props.params} />
    </Suspense>
  );
}

async function EventDetail({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const event = /^\d+$/.test(id) ? await getEvent(Number(id)) : null;
  if (!event) notFound();
  const [breakdown, txns, history] = await Promise.all([
    getEventCategoryBreakdown(event.id),
    listTransactions({ eventId: event.id, status: "ALL", page: 1, pageSize: 200, sort: "date" }),
    getEntityHistory("event", event.id),
  ]);
  const canWrite = can(user.role, "transactions:write");
  const used = event.budget ? event.expense / event.budget : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/events" className="hover:text-foreground">
            ← Events
          </Link>
        }
        title={event.name}
        description={`${formatDate(event.eventDate)} · ${event.venue ?? "Venue TBD"} · ${event.eventCode}`}
        actions={
          <>
            {can(user.role, "events:write") ? (
              <Button asChild variant="outline">
                <Link href={`/events/${event.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            ) : null}
            {canWrite ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/transactions/new?kind=EXPENSE&event=${event.id}`}>
                    <ArrowUpRight className="text-expense" /> Add bill
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`/transactions/new?kind=INCOME&category=SPONSORSHIP&event=${event.id}`}>
                    <ArrowDownLeft /> Add income
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Raised" value={event.income} />
        <Tile label="Spent" value={event.expense} />
        <Tile label="Net" value={event.net} negative={event.net < 0} />
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Budget</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular">{event.budget ? formatINR(event.budget, { whole: true }) : "—"}</p>
          {used !== null ? (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", used > 1 ? "bg-chart-2" : "bg-brass")} style={{ width: `${Math.min(100, used * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{Math.round(used * 100)}% used{event.pending ? ` · ${formatINR(event.pending, { whole: true })} pledged` : ""}</p>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
        <Panel title="Where the money came from">
          <CategoryBars color="income" rows={breakdown.filter((b) => b.kind === "INCOME").map((b) => ({ label: INCOME_CATEGORY_LABEL[b.label as keyof typeof INCOME_CATEGORY_LABEL] ?? b.label, total: b.total }))} emptyText="No income recorded for this event yet." />
        </Panel>
        <Panel title="Where it went">
          <CategoryBars color="expense" rows={breakdown.filter((b) => b.kind === "EXPENSE").map((b) => ({ label: b.label, total: b.total }))} emptyText="No bills recorded for this event yet." />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-[1fr_340px] lg:gap-5">
        <Panel title="Every entry" description={`${txns.total} transactions linked to this event`} bodyClassName="p-0 sm:p-0">
          {txns.rows.length ? (
            <ul className="divide-y">
              {txns.rows.map((t) => (
                <li key={t.id} className={t.status === "VOID" ? "opacity-55" : ""}>
                  <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
                    <span className="hidden w-20 shrink-0 text-xs text-muted-foreground sm:block">{formatDate(t.txnDate)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.partyName ?? t.memberName}</span>
                        <StatusBadge status={t.status} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <CategoryLabel kind={t.kind} incomeCategory={t.incomeCategory} expenseCategory={t.expenseCategory} /> · <span className="font-mono">{t.txnCode}</span>
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <ModeBadge mode={t.mode} />
                    </span>
                    <Amount kind={t.kind} value={t.amount} className="text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No money moved yet">Record a sponsorship or a bill and link it to this event.</EmptyState>
          )}
        </Panel>
        <div className="space-y-4">
          {event.description ? (
            <Panel title="About">
              <p className="whitespace-pre-line text-sm text-muted-foreground">{event.description}</p>
            </Panel>
          ) : null}
          <Panel title="History">
            <HistoryList entries={history} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <AnimatedNumber value={value} format="inr-whole" className={cn("mt-2 block font-mono text-2xl font-semibold tabular", negative && "text-destructive")} />
    </div>
  );
}
