import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { Pagination } from "@/components/app/pagination";
import { ExportMenu } from "@/components/app/export-menu";
import { EmptyState } from "@/components/app/empty-state";
import { Amount, CategoryLabel, ModeBadge, StatusBadge } from "@/components/app/badges";
import { ListPageSkeleton } from "@/components/app/skeletons";
import { formatDate, formatINR, formatNumber, INCOME_CATEGORY_LABEL } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { eventOptions, listExpenseCategories, listTransactions, parseTxnFilters } from "@/server/queries/transactions";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage(props: PageProps<"/transactions">) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <Transactions searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Transactions({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const f = parseTxnFilters(sp);
  const [page, cats, events] = await Promise.all([listTransactions(f), listExpenseCategories(), eventOptions()]);
  const canWrite = can(user.role, "transactions:write");

  return (
    <>
      <PageHeader
        eyebrow="The ledger"
        title="Transactions"
        description={`${formatNumber(page.total)} entries · ${formatINR(page.totals.income, { whole: true })} in · ${formatINR(page.totals.expense, { whole: true })} out`}
        actions={
          <>
            <ExportMenu entity="transactions" />
            {canWrite ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/transactions/new?kind=EXPENSE">
                    <ArrowUpRight className="text-expense" /> Expense
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/transactions/new?kind=INCOME">
                    <ArrowDownLeft /> Income
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <div className="rounded-2xl border bg-card">
        <div className="border-b p-3 sm:p-4">
          <FilterBar
            placeholder="TXN/receipt no., name, reference…"
            filters={[
              { type: "select", name: "kind", label: "Type", allLabel: "In & out", options: [{ value: "INCOME", label: "Income" }, { value: "EXPENSE", label: "Expenses" }] },
              { type: "select", name: "mode", label: "Modes", options: [{ value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank" }, { value: "UPI", label: "UPI" }] },
              {
                type: "select",
                name: "status",
                label: "Status",
                allLabel: "Completed & pending",
                options: [
                  { value: "COMPLETED", label: "Completed" },
                  { value: "PENDING", label: "Pending" },
                  { value: "VOID", label: "Void" },
                  { value: "ALL", label: "Everything" },
                ],
              },
              { type: "select", name: "category", label: "Income types", options: Object.entries(INCOME_CATEGORY_LABEL).map(([value, label]) => ({ value, label })) },
              { type: "select", name: "expenseCategory", label: "Expense types", options: cats.map((c) => ({ value: String(c.id), label: c.name })) },
              { type: "select", name: "event", label: "Events", options: events.map((e) => ({ value: String(e.id), label: e.name })) },
              { type: "select", name: "sort", label: "Sort", allLabel: "Newest first", options: [{ value: "amount", label: "Largest first" }] },
              { type: "date", name: "from", label: "From" },
              { type: "date", name: "to", label: "To" },
            ]}
          />
        </div>
        {page.rows.length ? (
          <>
            <table className="hidden w-full text-sm lg:table">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Entry</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Mode</th>
                  <th className="px-3 py-3 font-medium">Receipt</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.rows.map((t) => (
                  <tr key={t.id} className={`relative transition-colors hover:bg-muted/40 ${t.status === "VOID" ? "opacity-55" : ""}`}>
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{formatDate(t.txnDate)}</td>
                    <td className="max-w-[22rem] px-3 py-3">
                      <Link href={`/transactions/${t.id}`} className="after:absolute after:inset-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{t.partyName ?? t.memberName ?? "—"}</span>
                          <StatusBadge status={t.status} />
                          {t.attachmentCount > 0 ? <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label={`${t.attachmentCount} attachments`} /> : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          <span className="font-mono">{t.txnCode}</span>
                          {t.eventName ? ` · ${t.eventName}` : ""}
                          {t.memberCode ? ` · ${t.memberCode}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <CategoryLabel kind={t.kind} incomeCategory={t.incomeCategory} expenseCategory={t.expenseCategory} />
                    </td>
                    <td className="px-3 py-3">
                      <ModeBadge mode={t.mode} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{t.receiptNo ?? (t.status === "PENDING" ? `due ${formatDate(t.dueDate ?? t.txnDate)}` : "—")}</td>
                    <td className="px-5 py-3 text-right">
                      <Amount kind={t.kind} value={t.amount} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y lg:hidden">
              {page.rows.map((t) => (
                <li key={t.id} className={t.status === "VOID" ? "opacity-55" : ""}>
                  <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted/50">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${t.kind === "INCOME" ? "bg-income/12 text-income" : "bg-expense/12 text-expense"}`}>
                      {t.kind === "INCOME" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.partyName ?? t.memberName ?? "—"}</span>
                        <StatusBadge status={t.status} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(t.txnDate)} · {t.kind === "INCOME" ? INCOME_CATEGORY_LABEL[t.incomeCategory ?? "OTHER"] : t.expenseCategory} · {t.mode}
                      </span>
                    </span>
                    <Amount kind={t.kind} value={t.amount} className="text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination base="/transactions" sp={sp} page={page.page} pages={page.pages} total={page.total} pageSize={page.pageSize} />
          </>
        ) : (
          <EmptyState
            title={f.q || f.kind || f.mode || f.from ? "No entries match" : "The ledger is blank"}
            action={
              canWrite ? (
                <Button asChild>
                  <Link href="/transactions/new?kind=INCOME">Record an entry</Link>
                </Button>
              ) : null
            }
          >
            {f.q ? `Nothing matches "${f.q}". Try a receipt number, a name or a UPI reference.` : "Try widening the dates or clearing a filter."}
          </EmptyState>
        )}
      </div>
    </>
  );
}
