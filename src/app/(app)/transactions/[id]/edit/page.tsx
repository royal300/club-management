import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { todayIST } from "@/lib/format";
import { updateTransaction } from "@/server/actions/transactions";
import { requirePermission } from "@/server/auth";
import { memberOptions } from "@/server/queries/members";
import { eventOptions, getTransaction, listExpenseCategories } from "@/server/queries/transactions";

export const metadata: Metadata = { title: "Edit transaction" };

export default function EditTransactionPage(props: PageProps<"/transactions/[id]/edit">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <EditTransaction params={props.params} />
    </Suspense>
  );
}

async function EditTransaction({ params }: { params: PageProps<"/transactions/[id]/edit">["params"] }) {
  await requirePermission("transactions:write");
  const { id } = await params;
  const t = /^\d+$/.test(id) ? await getTransaction(Number(id)) : null;
  if (!t) notFound();
  if (t.status === "VOID") redirect(`/transactions/${t.id}`);
  const [members, events, cats] = await Promise.all([memberOptions(), eventOptions(), listExpenseCategories()]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={`Ledger · ${t.txnCode}`} title="Correct this entry" description="The original values and your changes are kept in the audit log. Receipt numbers never change." />
      <TransactionForm
        action={updateTransaction.bind(null, t.id)}
        mode="edit"
        today={todayIST()}
        maxMb={Number(process.env.UPLOAD_MAX_MB ?? 5)}
        cancelHref={`/transactions/${t.id}`}
        members={members}
        events={events}
        expenseCategories={cats}
        defaults={{
          kind: t.kind,
          incomeCategory: t.incomeCategory,
          expenseCategoryId: t.expenseCategoryId,
          amount: t.amount,
          txnDate: t.txnDate,
          mode: t.mode,
          status: t.status === "PENDING" ? "PENDING" : "COMPLETED",
          dueDate: t.dueDate,
          referenceNo: t.referenceNo,
          partyName: t.partyName,
          description: t.description,
          memberId: t.memberId,
          eventId: t.eventId,
        }}
      />
    </div>
  );
}
