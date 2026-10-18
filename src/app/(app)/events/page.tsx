import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { Pagination } from "@/components/app/pagination";
import { ExportMenu } from "@/components/app/export-menu";
import { EmptyState } from "@/components/app/empty-state";
import { ListPageSkeleton } from "@/components/app/skeletons";
import { cn } from "@/lib/utils";
import { formatDate, formatINR, todayIST } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { listEvents, parseEventFilters } from "@/server/queries/finance";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage(props: PageProps<"/events">) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <Events searchParams={props.searchParams} />
    </Suspense>
  );
}

const STATUS_STYLE = {
  PLANNED: "bg-chart-4/12 text-chart-4",
  COMPLETED: "bg-income/12 text-income",
  CANCELLED: "bg-muted text-muted-foreground",
} as const;

async function Events({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const f = parseEventFilters(sp);
  const page = await listEvents(f);
  const canWrite = can(user.role, "events:write");
  const today = todayIST();

  return (
    <>
      <PageHeader
        eyebrow="The calendar"
        title="Events"
        description="Every puja, meet and camp with the money that flowed through it."
        actions={
          <>
            <ExportMenu entity="events" />
            {canWrite ? (
              <Button asChild>
                <Link href="/events/new">
                  <CalendarPlus /> New event
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 rounded-2xl border bg-card p-3 sm:p-4">
        <FilterBar
          placeholder="Event name, venue, ID…"
          filters={[
            { type: "select", name: "status", label: "Statuses", options: [{ value: "PLANNED", label: "Planned" }, { value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" }] },
            { type: "date", name: "from", label: "From" },
            { type: "date", name: "to", label: "To" },
          ]}
        />
      </div>
      {page.rows.length ? (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {page.rows.map((e) => {
              const used = e.budget ? e.expense / e.budget : 0;
              const upcoming = e.eventDate >= today && e.status === "PLANNED";
              return (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="group flex h-full flex-col rounded-2xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid size-14 shrink-0 place-items-center rounded-xl border-2 border-ink/80 bg-paper text-ink">
                        <span className="text-center leading-none">
                          <span className="block font-mono text-[9px] uppercase tracking-widest">{formatDate(e.eventDate).slice(3, 6)}</span>
                          <span className="block font-display text-2xl">{formatDate(e.eventDate).slice(0, 2)}</span>
                        </span>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[e.status])}>{upcoming ? "Upcoming" : e.status[0] + e.status.slice(1).toLowerCase()}</span>
                    </div>
                    <h3 className="mt-4 font-display text-xl leading-tight tracking-tight">{e.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {e.venue ?? "Venue TBD"} · {e.eventCode}
                    </p>
                    <dl className="mt-auto grid grid-cols-3 gap-2 pt-5 text-xs">
                      <div>
                        <dt className="text-muted-foreground">In</dt>
                        <dd className="font-mono font-medium tabular">{formatINR(e.income, { whole: true })}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Out</dt>
                        <dd className="font-mono font-medium tabular">{formatINR(e.expense, { whole: true })}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Net</dt>
                        <dd className={cn("font-mono font-semibold tabular", e.net < 0 && "text-destructive")}>{formatINR(e.net, { whole: true })}</dd>
                      </div>
                    </dl>
                    {e.budget ? (
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", used > 1 ? "bg-chart-2" : "bg-brass")} style={{ width: `${Math.min(100, used * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {Math.round(used * 100)}% of {formatINR(e.budget, { whole: true })} budget spent
                        </p>
                      </div>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-2xl border bg-card">
            <Pagination base="/events" sp={sp} page={page.page} pages={page.pages} total={page.total} pageSize={page.pageSize} />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            art="events"
            title={f.q || f.status ? "No events match" : "Nothing on the calendar"}
            action={
              canWrite ? (
                <Button asChild>
                  <Link href="/events/new">Plan an event</Link>
                </Button>
              ) : null
            }
          >
            Events gather their sponsorships, donations and bills so you can see what each one cost and raised.
          </EmptyState>
        </div>
      )}
    </>
  );
}
