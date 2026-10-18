import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/app/page-header";
import { CategoryBars, IncomeExpenseChart } from "@/components/app/charts";
import { FySelect } from "@/components/app/fy-select";
import { DashboardSkeleton } from "@/components/app/skeletons";
import { cn } from "@/lib/utils";
import { formatINR, fyLabel, fyRange, fyStartYear, INCOME_CATEGORY_LABEL, monthEnd, monthLabel, todayIST } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { intParam, param } from "@/server/queries/common";
import { getExpenseByCategory, getFinancialYears, getIncomeByCategory, getMonthlySeries, getPeriodTotals, getYearlySummary, listEvents } from "@/server/queries/finance";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage(props: PageProps<"/reports">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Reports searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const [, sp] = await Promise.all([requireUser(), searchParams]);
  const years = await getFinancialYears();
  const current = fyStartYear(todayIST());
  const requested = intParam(param(sp, "fy"));
  const fy = requested && years.includes(requested) ? requested : current;
  const { from, to } = fyRange(fy);
  const end = to < todayIST() ? to : todayIST();
  const [totals, months, incomeCats, expenseCats, yearly, events] = await Promise.all([
    getPeriodTotals(from, to),
    getMonthlySeries(from, end),
    getIncomeByCategory(from, to),
    getExpenseByCategory(from, to),
    getYearlySummary(),
    listEvents({ from, to, page: 1, pageSize: 100 }),
  ]);
  const runningNet = months.reduce<number[]>((acc, m) => [...acc, (acc.at(-1) ?? 0) + m.net], []);
  const labels = Object.fromEntries(years.map((y) => [y, fyLabel(y)]));

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Reports"
        description="Indian financial year (April–March). Only completed money is counted; pledges and void entries are left out."
        actions={
          <>
            <FySelect years={years} value={fy} labels={labels} />
            <Button asChild variant="outline">
              <a href={`/api/export/transactions?format=xlsx&from=${from}&to=${to}`} download>
                <Download /> {fyLabel(fy)} ledger
              </a>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary label={`Income · ${fyLabel(fy)}`} value={totals.income} />
        <Summary label={`Expenses · ${fyLabel(fy)}`} value={totals.expense} />
        <Summary label={totals.net >= 0 ? "Surplus" : "Deficit"} value={totals.net} negative={totals.net < 0} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-[1.4fr_1fr] lg:gap-5">
        <Panel title="Month by month" description={`${monthLabel(from.slice(0, 7), true)} – ${monthLabel(end.slice(0, 7), true)}`}>
          <IncomeExpenseChart data={months} />
        </Panel>
        <Panel title="Monthly summary" bodyClassName="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2.5 font-medium">Month</th>
                  <th className="px-2 py-2.5 text-right font-medium">In</th>
                  <th className="px-2 py-2.5 text-right font-medium">Out</th>
                  <th className="px-4 py-2.5 text-right font-medium">Running net</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono text-xs tabular">
                {months.map((m, i) => {
                  const running = runningNet[i]!;
                  return (
                    <tr key={m.month}>
                      <td className="px-4 py-2 font-sans">
                        <Link className="hover:underline" href={`/transactions?from=${m.month}-01&to=${monthEnd(m.month)}`}>
                          {monthLabel(m.month, true)}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right">{formatINR(m.income, { whole: true })}</td>
                      <td className="px-2 py-2 text-right">{formatINR(m.expense, { whole: true })}</td>
                      <td className={cn("px-4 py-2 text-right font-semibold", running < 0 && "text-destructive")}>{formatINR(running, { whole: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
        <Panel title="Income by type">
          <CategoryBars color="income" rows={incomeCats.map((c) => ({ label: INCOME_CATEGORY_LABEL[c.category], total: c.total, count: c.count }))} />
        </Panel>
        <Panel title="Expenses by category">
          <CategoryBars color="expense" rows={expenseCats.map((c) => ({ label: c.category, total: c.total, count: c.count }))} />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
        <Panel title="Event-wise summary" description={fyLabel(fy)} bodyClassName="p-0 sm:p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="px-2 py-2.5 text-right font-medium">Raised</th>
                <th className="px-2 py-2.5 text-right font-medium">Spent</th>
                <th className="px-4 py-2.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/events/${e.id}`} className="hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular">{formatINR(e.income, { whole: true })}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular">{formatINR(e.expense, { whole: true })}</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono text-xs font-semibold tabular", e.net < 0 && "text-destructive")}>{formatINR(e.net, { whole: true })}</td>
                </tr>
              ))}
              {!events.rows.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No events in this financial year.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
        <Panel title="Yearly summary" description="Every financial year on the books" bodyClassName="p-0 sm:p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2.5 font-medium">Year</th>
                <th className="px-2 py-2.5 text-right font-medium">Income</th>
                <th className="px-2 py-2.5 text-right font-medium">Expenses</th>
                <th className="px-4 py-2.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {yearly.map((y) => (
                <tr key={y.year} className={y.year === fy ? "bg-accent/40" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`/reports?fy=${y.year}`} className="hover:underline">
                      {fyLabel(y.year)}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular">{formatINR(y.income, { whole: true })}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs tabular">{formatINR(y.expense, { whole: true })}</td>
                  <td className={cn("px-4 py-2.5 text-right font-mono text-xs font-semibold tabular", y.net < 0 && "text-destructive")}>{formatINR(y.net, { whole: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

function Summary({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", negative && "text-destructive")}>{formatINR(value, { whole: true })}</p>
    </div>
  );
}
