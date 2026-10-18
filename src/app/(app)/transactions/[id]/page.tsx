import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CircleCheck, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { Amount, ModeBadge, StatusBadge } from "@/components/app/badges";
import { HistoryList } from "@/components/app/history-list";
import { ReceiptPrinter } from "@/components/transactions/receipt-printer";
import { AddAttachments, SettleButton, VoidButton } from "@/components/transactions/transaction-actions";
import { formatBytes, formatDate, formatDateTime, INCOME_CATEGORY_LABEL, MODE_LABEL, todayIST } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { getEntityHistory } from "@/server/queries/finance";
import { getTransaction } from "@/server/queries/transactions";
import { getClubSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Transaction" };

export default function TransactionPage(props: PageProps<"/transactions/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Transaction params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Transaction({ params, searchParams }: { params: PageProps<"/transactions/[id]">["params"]; searchParams: PageProps<"/transactions/[id]">["searchParams"] }) {
  const [user, { id }, sp] = await Promise.all([requireUser(), params, searchParams]);
  const t = /^\d+$/.test(id) ? await getTransaction(Number(id)) : null;
  if (!t) notFound();
  const [history, club] = await Promise.all([getEntityHistory("transaction", t.id), getClubSettings()]);
  const canWrite = can(user.role, "transactions:write");
  const label = t.kind === "INCOME" ? INCOME_CATEGORY_LABEL[t.incomeCategory ?? "OTHER"] : (t.expenseCategory ?? "Expense");
  const party = t.partyName ?? t.memberName ?? "—";
  const isNew = !!sp.new;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/transactions" className="hover:text-foreground">
            ← Transactions
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-[0.7em] tracking-tight">{t.txnCode}</span>
            <StatusBadge status={t.status} />
          </span>
        }
        description={`${t.kind === "INCOME" ? "Money in" : "Money out"} · ${label} · ${party}`}
        actions={
          <>
            {canWrite && t.status !== "VOID" ? <VoidButton id={t.id} code={t.txnCode} /> : null}
            {canWrite && t.status !== "VOID" ? (
              <Button asChild variant="outline">
                <Link href={`/transactions/${t.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            ) : null}
            {t.receiptNo && t.status === "COMPLETED" ? (
              <Button asChild variant="outline">
                <a href={`/api/receipts/${t.id}`} target="_blank" rel="noopener">
                  <FileText /> {t.kind === "INCOME" ? "Receipt" : "Voucher"} PDF
                </a>
              </Button>
            ) : null}
            {canWrite && t.status === "PENDING" ? (
              <SettleButton id={t.id} kind={t.kind} amount={t.amount} mode={t.mode} today={todayIST()} isSubscription={t.incomeCategory === "SUBSCRIPTION" && !!t.memberId} />
            ) : null}
          </>
        }
      />

      {sp.saved ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-income/30 bg-income/10 px-4 py-3 text-sm text-income">
          <CircleCheck className="size-4" /> Changes saved and logged.
        </p>
      ) : null}
      {t.status === "VOID" ? (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          This entry was voided{t.voidReason ? `: ${t.voidReason}` : ""}. It is kept for the record and excluded from all balances.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px] lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">{t.kind === "INCOME" ? "Amount received" : "Amount paid"}</p>
            <Amount kind={t.kind} value={t.amount} className={`mt-1 block text-4xl font-semibold tracking-tight sm:text-5xl ${t.status === "VOID" ? "line-through" : ""}`} />
            <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Item label="Date">{formatDate(t.txnDate)}</Item>
              <Item label="Paid via">
                <ModeBadge mode={t.mode} />
              </Item>
              <Item label={t.kind === "INCOME" ? "Received from" : "Paid to"}>{party}</Item>
              <Item label="Category">{label}</Item>
              <Item label={t.kind === "INCOME" ? "Receipt no." : "Voucher no."}>
                <span className="font-mono">{t.receiptNo ?? (t.status === "PENDING" ? "Issued when settled" : "—")}</span>
              </Item>
              <Item label="Reference">{t.referenceNo ? <span className="font-mono break-all">{t.referenceNo}</span> : "—"}</Item>
              {t.status === "PENDING" ? <Item label="Due by">{formatDate(t.dueDate)}</Item> : null}
              <Item label="Member">
                {t.memberId ? (
                  <Link href={`/members/${t.memberId}`} className="underline-offset-4 hover:underline">
                    {t.memberName} <span className="font-mono text-xs text-muted-foreground">{t.memberCode}</span>
                  </Link>
                ) : (
                  "—"
                )}
              </Item>
              <Item label="Event">
                {t.eventId ? (
                  <Link href={`/events/${t.eventId}`} className="underline-offset-4 hover:underline">
                    {t.eventName}
                  </Link>
                ) : (
                  "—"
                )}
              </Item>
              {t.description ? (
                <Item label="Description" wide>
                  <span className="whitespace-pre-line">{t.description}</span>
                </Item>
              ) : null}
            </dl>
            <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
              Recorded by {t.createdByName ?? "—"} on {formatDateTime(t.createdAt)}
              {t.updatedAt.getTime() - t.createdAt.getTime() > 1000 ? ` · last changed by ${t.updatedByName ?? "—"} on ${formatDateTime(t.updatedAt)}` : ""}
            </p>
          </section>

          <Panel title="Bills, invoices & proofs" description={`${t.attachments.length} file${t.attachments.length === 1 ? "" : "s"} on record`}>
            {t.attachments.length ? (
              <ul className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {t.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="group block overflow-hidden rounded-xl border bg-background/60 transition-colors hover:border-foreground/30">
                      {a.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/attachments/${a.id}`} alt={a.originalName} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      ) : (
                        <span className="grid aspect-[4/3] place-items-center bg-muted/60">
                          <FileText className="size-10 text-muted-foreground" />
                        </span>
                      )}
                      <span className="block truncate px-3 pt-2 text-xs font-medium">{a.originalName}</span>
                      <span className="block px-3 pb-2 text-[11px] text-muted-foreground">
                        {formatBytes(a.sizeBytes)} · {formatDate(a.createdAt.toISOString().slice(0, 10))}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">No files attached yet.</p>
            )}
            {canWrite && t.status !== "VOID" ? <AddAttachments id={t.id} maxMb={Number(process.env.UPLOAD_MAX_MB ?? 5)} /> : null}
          </Panel>
        </div>

        <div className="space-y-4 lg:space-y-5">
          {t.status !== "VOID" ? (
            <div className={isNew ? "" : "hidden lg:block"}>
              <ReceiptPrinter
                key={isNew ? "new" : "static"}
                play={isNew}
                id={t.id}
                clubName={club.club_name}
                documentNo={t.status === "COMPLETED" ? t.receiptNo : null}
                kind={t.kind}
                amount={t.amount}
                party={party}
                label={label}
                date={t.txnDate}
                mode={MODE_LABEL[t.mode]}
              />
            </div>
          ) : null}
          <Panel title="History">
            <HistoryList entries={history} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
