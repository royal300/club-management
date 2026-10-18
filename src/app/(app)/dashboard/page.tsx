import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, CircleAlert, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/app/page-header";
import { AnimatedNumber } from "@/components/app/animated-number";
import { IncomeExpenseChart } from "@/components/app/charts";
import { Amount, CategoryLabel, ModeBadge, RenewalBadge, StatusBadge } from "@/components/app/badges";
import { DashboardSkeleton } from "@/components/app/skeletons";
import { EmptyState } from "@/components/app/empty-state";
import { CoinStack } from "@/components/illustrations";
import { addDays, formatDate, formatINR, fyLabel, fyRange, fyStartYear, monthLabel, todayIST } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { getBalances, getEventSummaries, getMonthlySeries, getPendingTotals, getPeriodTotals } from "@/server/queries/finance";
import { getRenewalCounts, listRenewals } from "@/server/queries/members";
import { listPending, listRecent } from "@/server/queries/transactions";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const today = todayIST();
  const fy = fyStartYear(today);
  const fyDates = fyRange(fy);
  const monthStart = `${today.slice(0, 7)}-01`;
  const seriesFrom = `${addDays(monthStart, -330).slice(0, 7)}-01`;

  const [balances, month, fyTotals, series, pending, pendingList, renewals, overdue, dueSoon, recent, eventsSummary] = await Promise.all([
    getBalances(),
    getPeriodTotals(monthStart, today),
    getPeriodTotals(fyDates.from, fyDates.to),
    getMonthlySeries(seriesFrom, today),
    getPendingTotals(),
    listPending(5),
    getRenewalCounts(),
    listRenewals("overdue", 4),
    listRenewals("due", 4),
    listRecent(8),
    getEventSummaries(5),
  ]);
  const canWrite = can(user.role, "transactions:write");
  const dateLine = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow={`${dateLine} · ${fyLabel(fy)}`}
        title={
          <>
            {greeting()}, <span className="font-display-wonk italic">{user.name.split(" ")[0]}</span>.
          </>
        }
        description="Here is where the club's money and members stand today."
        actions={
          canWrite ? (
            <>
              <Button asChild variant="outline">
                <Link href="/transactions/new?kind=EXPENSE">
                  <ArrowUpRight className="text-expense" /> Record expense
                </Link>
              </Button>
              <Button asChild>
                <Link href="/transactions/new?kind=INCOME">
                  <ArrowDownLeft /> Record income
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      {sp.denied ? (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="size-4" /> Your role doesn&rsquo;t have access to that page.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Balance hero */}
        <section className="paper-grain relative overflow-hidden rounded-2xl bg-felt p-5 text-paper sm:p-6 lg:col-span-5 dark:bg-felt-deep dark:ring-1 dark:ring-white/10">
          <CoinStack className="pointer-events-none absolute -right-4 -top-3 w-24 opacity-90 sm:w-28" />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60">Available balance</p>
          <AnimatedNumber testId="balance-total" value={balances.balance} format="inr-whole" className="relative mt-2 block pr-16 text-[clamp(2.4rem,5vw,3.4rem)] font-semibold leading-none tracking-tight sm:pr-20" />
          <p className="mt-2 text-sm text-paper/60">Across cash in hand, bank and UPI</p>
          <ul className="mt-6 space-y-2.5">
            {(
              [
                ["CASH", "Cash", Banknote],
                ["BANK", "Bank", Landmark],
                ["UPI", "UPI", Smartphone],
              ] as const
            ).map(([mode, label, Icon]) => {
              const m = balances.modes[mode];
              const share = balances.balance > 0 ? Math.max(0, m.balance) / balances.balance : 0;
              return (
                <li key={mode}>
                  <Link
                    href={`/transactions?mode=${mode}`}
                    className="group flex items-center gap-3 rounded-xl bg-paper/[0.06] px-3 py-2.5 transition-colors hover:bg-paper/[0.12]"
                  >
                    <Icon className="size-4 text-brass-soft" />
                    <span className="text-sm">{label}</span>
                    <span className="ml-auto whitespace-nowrap font-mono text-sm tabular" data-testid={`balance-${mode}`}>{formatINR(m.balance)}</span>
                    <span className="hidden h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-paper/15 xl:block">
                      <span className="block h-full rounded-full bg-brass" style={{ width: `${Math.round(share * 100)}%` }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7 lg:gap-5">
          <StatTile label="Total income" value={balances.income} sub={`${formatINR(month.income)} this month`} tone="income" href="/transactions?kind=INCOME" />
          <StatTile label="Total expenses" value={balances.expense} sub={`${formatINR(month.expense)} this month`} tone="expense" href="/transactions?kind=EXPENSE" />
          <div className="rounded-2xl border bg-card p-5 sm:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{fyLabel(fy)} so far</p>
              <Link href="/reports" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Monthly &amp; yearly reports <ArrowRight className="size-3" />
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <MiniStat label="Income" value={fyTotals.income} />
              <MiniStat label="Expenses" value={fyTotals.expense} />
              <MiniStat label="Surplus" value={fyTotals.net} emphasise />
            </dl>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="h-full bg-chart-1" style={{ width: `${(fyTotals.income / Math.max(1, fyTotals.income + fyTotals.expense)) * 100}%` }} />
              <span className="h-full w-0.5 bg-card" />
              <span className="h-full flex-1 bg-chart-2" />
            </div>
          </div>
        </div>

        <Panel
          className="lg:col-span-8"
          title="Income vs expenses"
          description={`${monthLabel(series[0]!.month, true)} – ${monthLabel(series.at(-1)!.month, true)}`}
        >
          <IncomeExpenseChart data={series} />
        </Panel>

        <Panel className="lg:col-span-4" title={`This month · ${monthLabel(today.slice(0, 7), true)}`} bodyClassName="space-y-4">
          <div className="space-y-3">
            <Row label="Money in" value={formatINR(month.income)} dot="bg-chart-1" />
            <Row label="Money out" value={formatINR(month.expense)} dot="bg-chart-2" />
            <div className="border-t pt-3">
              <Row label="Net for the month" value={formatINR(month.net)} strong />
            </div>
          </div>
          <div className="rounded-xl bg-muted/60 p-3.5 text-sm">
            <p className="text-muted-foreground">{month.count} entries recorded since {formatDate(monthStart)}.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/transactions?status=PENDING&kind=INCOME" className="rounded-xl border p-3 transition-colors hover:bg-muted/50">
              <p className="text-xs text-muted-foreground">To collect</p>
              <p className="mt-1 font-mono text-sm font-semibold tabular">{formatINR(pending.receivable, { whole: true })}</p>
              <p className="text-[11px] text-muted-foreground">{pending.receivableCount} pledges</p>
            </Link>
            <Link href="/transactions?status=PENDING&kind=EXPENSE" className="rounded-xl border p-3 transition-colors hover:bg-muted/50">
              <p className="text-xs text-muted-foreground">To pay</p>
              <p className="mt-1 font-mono text-sm font-semibold tabular">{formatINR(pending.payable, { whole: true })}</p>
              <p className="text-[11px] text-muted-foreground">{pending.payableCount} bills</p>
            </Link>
          </div>
        </Panel>

        <Panel
          className="lg:col-span-6"
          title="Pending payments"
          description="Pledges to collect and bills to settle"
          action={<ViewAll href="/transactions?status=PENDING" />}
          bodyClassName="p-0 sm:p-0"
        >
          {pendingList.length ? (
            <ul className="divide-y">
              {pendingList.map((t) => (
                <li key={t.id}>
                  <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${t.kind === "INCOME" ? "bg-income/12 text-income" : "bg-expense/12 text-expense"}`}>
                      {t.kind === "INCOME" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.partyName ?? t.description}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.kind === "INCOME" ? "Receive" : "Pay"} by {formatDate(t.dueDate ?? t.txnDate)}
                        {t.eventName ? ` · ${t.eventName}` : ""}
                      </span>
                    </span>
                    <Amount kind={t.kind} value={t.amount} className="text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing outstanding">Every pledge has been collected and every bill paid.</EmptyState>
          )}
        </Panel>

        <Panel
          className="lg:col-span-6"
          title="Outstanding dues"
          description="Annual fees overdue or due within 30 days"
          action={<ViewAll href="/renewals" />}
          bodyClassName="p-0 sm:p-0"
        >
          <div className="grid grid-cols-2 border-b">
            <Link href="/renewals#overdue" className="border-r px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="font-mono text-lg font-semibold tabular text-destructive">{formatINR(renewals.overdueAmount, { whole: true })}</p>
              <p className="text-[11px] text-muted-foreground">{renewals.overdue} members</p>
            </Link>
            <Link href="/renewals#due" className="px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
              <p className="text-xs text-muted-foreground">Due in 30 days</p>
              <p className="font-mono text-lg font-semibold tabular text-pending">{formatINR(renewals.dueSoonAmount, { whole: true })}</p>
              <p className="text-[11px] text-muted-foreground">{renewals.dueSoon} members</p>
            </Link>
          </div>
          {overdue.length + dueSoon.length ? (
            <ul className="divide-y">
              {[...overdue, ...dueSoon].slice(0, 6).map((m) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.fullName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m.memberCode} · renewal {formatDate(m.renewalDate)}
                      </span>
                    </span>
                    <RenewalBadge renewalDate={m.renewalDate} today={today} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState art="members" title="Everyone is paid up">No renewals are overdue or due this month.</EmptyState>
          )}
        </Panel>

        <Panel className="lg:col-span-7" title="Recent transactions" action={<ViewAll href="/transactions" />} bodyClassName="p-0 sm:p-0">
          {recent.length ? (
            <ul className="divide-y">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
                    <span className="hidden w-[4.5rem] shrink-0 font-mono text-xs text-muted-foreground sm:block">{formatDate(t.txnDate).slice(0, 6)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.partyName ?? t.memberName ?? "—"}</span>
                        <StatusBadge status={t.status} />
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CategoryLabel kind={t.kind} incomeCategory={t.incomeCategory} expenseCategory={t.expenseCategory} />
                        <span aria-hidden>·</span>
                        <span className="font-mono">{t.txnCode}</span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Amount kind={t.kind} value={t.amount} className="text-sm" />
                      <ModeBadge mode={t.mode} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="The ledger is blank" action={canWrite ? <Button asChild><Link href="/transactions/new?kind=INCOME">Record the first entry</Link></Button> : null}>
              The first rupee you record will appear here.
            </EmptyState>
          )}
        </Panel>

        <Panel className="lg:col-span-5" title="Event-wise finances" action={<ViewAll href="/events" />} bodyClassName="p-0 sm:p-0">
          {eventsSummary.length ? (
            <ul className="divide-y">
              {eventsSummary.map((e) => {
                const used = e.budget ? Math.min(1, e.expense / e.budget) : 0;
                return (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{e.name}</span>
                        <span className={`font-mono text-sm font-semibold tabular ${e.net < 0 ? "text-destructive" : ""}`}>{formatINR(e.net, { whole: true })}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          {formatDate(e.eventDate)} · in {formatINR(e.income, { whole: true })} · out {formatINR(e.expense, { whole: true })}
                        </span>
                      </div>
                      {e.budget ? (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <span className={`block h-full rounded-full ${used > 0.95 ? "bg-chart-2" : "bg-brass"}`} style={{ width: `${used * 100}%` }} />
                          </span>
                          <span className="font-mono text-[11px] tabular text-muted-foreground">{Math.round(used * 100)}% of budget</span>
                        </div>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState art="events" title="No events yet">Plan an event to track its sponsorships and bills together.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, tone, href }: { label: string; value: number; sub: string; tone: "income" | "expense"; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={`grid size-8 place-items-center rounded-full ${tone === "income" ? "bg-income/12 text-income" : "bg-expense/12 text-expense"}`}>
          {tone === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
        </span>
      </div>
      <AnimatedNumber testId={`total-${tone}`} value={value} format="inr-whole" className="mt-3 block text-[1.9rem] font-semibold leading-none tracking-tight" />
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}

function MiniStat({ label, value, emphasise }: { label: string; value: number; emphasise?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm font-semibold tabular sm:text-base ${emphasise && value < 0 ? "text-destructive" : ""}`}>
        <AnimatedNumber value={value} format="inr-whole" />
      </dd>
    </div>
  );
}

function Row({ label, value, dot, strong }: { label: string; value: string; dot?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        {dot ? <span className={`size-2 rounded-full ${dot}`} /> : null}
        {label}
      </span>
      <span className={`whitespace-nowrap font-mono tabular ${strong ? "text-base font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      View all <ArrowRight className="size-3" />
    </Link>
  );
}
