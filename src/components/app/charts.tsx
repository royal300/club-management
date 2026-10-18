"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { Table2, ChartColumn } from "lucide-react";
import { formatINR, formatINRCompact, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type MonthPoint = { month: string; income: number; expense: number; net: number };

const SERIES = [
  { key: "income", label: "Income", color: "var(--chart-1)" },
  { key: "expense", label: "Expenses", color: "var(--chart-2)" },
] as const;

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function MonthTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload as MonthPoint;
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 text-muted-foreground">{monthLabel(String(label), true)}</p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="font-mono font-semibold text-foreground tabular">{formatINR(point[s.key])}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-4 border-t pt-1">
        <span className="text-muted-foreground">Net</span>
        <span className="font-mono font-semibold text-foreground tabular">{formatINR(point.net)}</span>
      </div>
    </div>
  );
}

/** Income vs expenses per month — grouped columns, with a table view for every value. */
export function IncomeExpenseChart({ data, height = 280 }: { data: MonthPoint[]; height?: number }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Legend />
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Chart view">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors",
                view === v && "bg-muted text-foreground",
              )}
              aria-label={v === "chart" ? "Show chart" : "Show table"}
            >
              {v === "chart" ? <ChartColumn className="size-3.5" /> : <Table2 className="size-3.5" />}
            </button>
          ))}
        </div>
      </div>
      {view === "chart" ? (
        <div style={{ height }} className="-ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => monthLabel(m)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                tickFormatter={(v) => formatINRCompact(v)}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip content={MonthTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={700} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[280px] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Income</th>
                <th className="px-3 py-2 text-right font-medium">Expenses</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {data.map((d) => (
                <tr key={d.month} className="border-t">
                  <td className="px-3 py-1.5 font-sans">{monthLabel(d.month, true)}</td>
                  <td className="px-3 py-1.5 text-right">{formatINR(d.income)}</td>
                  <td className="px-3 py-1.5 text-right">{formatINR(d.expense)}</td>
                  <td className={cn("px-3 py-1.5 text-right", d.net < 0 && "text-destructive")}>{formatINR(d.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Ranked category totals as horizontal bars. One hue per chart; value at the tip. */
export function CategoryBars({
  rows,
  color,
  emptyText = "Nothing recorded in this period.",
}: {
  rows: { label: string; total: number; count?: number }[];
  color: "income" | "expense";
  emptyText?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const sum = rows.reduce((a, r) => a + r.total, 0);
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">
              <span className="font-semibold text-foreground">{formatINR(r.total, { whole: true })}</span> · {Math.round((r.total / sum) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted" title={`${r.label}: ${formatINR(r.total)}${r.count ? ` across ${r.count} entries` : ""}`}>
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out group-hover:brightness-110"
              style={{ width: `${(r.total / max) * 100}%`, background: color === "income" ? "var(--chart-1)" : "var(--chart-2)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
