import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DetailSkeleton } from "@/components/app/skeletons";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { INCOME_CATEGORIES, type IncomeCategory } from "@/db/schema";
import { todayIST } from "@/lib/format";
import { createTransaction } from "@/server/actions/transactions";
import { requirePermission } from "@/server/auth";
import { intParam, oneOf, param } from "@/server/queries/common";
import { memberOptions } from "@/server/queries/members";
import { eventOptions, listExpenseCategories } from "@/server/queries/transactions";

export const metadata: Metadata = { title: "Record transaction" };

export default function NewTransactionPage(props: PageProps<"/transactions/new">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <NewTransaction searchParams={props.searchParams} />
    </Suspense>
  );
}

async function NewTransaction({ searchParams }: { searchParams: PageProps<"/transactions/new">["searchParams"] }) {
  await requirePermission("transactions:write");
  const sp = await searchParams;
  const kind = param(sp, "kind") === "EXPENSE" ? "EXPENSE" : "INCOME";
  const [members, events, cats] = await Promise.all([memberOptions(), eventOptions(), listExpenseCategories(true)]);
  const memberId = intParam(param(sp, "member"));
  const member = members.find((m) => m.id === memberId);
  const category = (oneOf(param(sp, "category"), INCOME_CATEGORIES) ?? (member ? "SUBSCRIPTION" : "DONATION")) as IncomeCategory;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Ledger · New entry"
        title={kind === "INCOME" ? "Record money in" : "Record money out"}
        description="Transaction and receipt numbers are issued automatically. Every entry is audited."
      />
      <TransactionForm
        action={createTransaction}
        mode="create"
        today={todayIST()}
        maxMb={Number(process.env.UPLOAD_MAX_MB ?? 5)}
        cancelHref={member ? `/members/${member.id}` : "/transactions"}
        members={members}
        events={events.filter((e) => e.status !== "CANCELLED")}
        expenseCategories={cats}
        defaults={{
          kind,
          incomeCategory: category,
          txnDate: todayIST(),
          memberId: member?.id ?? null,
          partyName: member?.fullName ?? null,
          amount: member && category === "SUBSCRIPTION" ? Number(member.annualFee).toFixed(0) : undefined,
          eventId: intParam(param(sp, "event")) ?? null,
        }}
      />
    </div>
  );
}
