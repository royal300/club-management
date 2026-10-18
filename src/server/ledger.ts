import "server-only";
import { eq } from "drizzle-orm";
import { members, transactions } from "@/db/schema";
import { addYears, formatINR } from "@/lib/format";
import { audit } from "./audit";
import type { SessionUser } from "./auth";
import { nextCode, type Tx } from "./sequence";

type NewTxn = Omit<typeof transactions.$inferInsert, "txnCode" | "receiptNo" | "createdById" | "updatedById">;

export function documentPrefix(kind: "INCOME" | "EXPENSE") {
  return kind === "INCOME" ? "RCPT" : "VCH";
}

/**
 * The one place money enters the ledger: numbers the entry, issues the receipt/voucher once
 * the money has actually moved, optionally advances the member's renewal, and audits it all.
 */
export async function recordTransaction(tx: Tx, user: SessionUser, data: NewTxn, opts: { extendMembership?: boolean } = {}) {
  const year = data.txnDate.slice(0, 4);
  const txnCode = await nextCode(tx, "TXN", year);
  const receiptNo = data.status === "COMPLETED" ? await nextCode(tx, documentPrefix(data.kind), year) : null;
  const [res] = await tx.insert(transactions).values({ ...data, txnCode, receiptNo, createdById: user.id, updatedById: user.id });
  const id = res.insertId;

  await audit(tx, user, {
    action: "CREATE",
    entityType: "transaction",
    entityId: id,
    summary: `${data.kind === "INCOME" ? "Income" : "Expense"} ${txnCode} of ${formatINR(data.amount)}${data.status === "PENDING" ? " (pending)" : ""}`,
  });

  if (opts.extendMembership && data.memberId && data.kind === "INCOME" && data.status === "COMPLETED") {
    await extendRenewal(tx, user, data.memberId, txnCode);
  }
  return { id, txnCode, receiptNo };
}

/** Pushes a member's next renewal date one year forward after their subscription is paid. */
export async function extendRenewal(tx: Tx, user: SessionUser, memberId: number, txnCode: string) {
  const [m] = await tx.select({ renewalDate: members.renewalDate, fullName: members.fullName, status: members.status }).from(members).where(eq(members.id, memberId));
  if (!m) return;
  const next = addYears(m.renewalDate, 1);
  await tx.update(members).set({ renewalDate: next }).where(eq(members.id, memberId));
  await audit(tx, user, {
    action: "RENEW",
    entityType: "member",
    entityId: memberId,
    summary: `${m.fullName}'s membership renewed to ${next} via ${txnCode}`,
    changes: { renewalDate: { from: m.renewalDate, to: next } },
  });
}

/** Issues the receipt/voucher number when a pending entry is settled. */
export async function issueDocumentNumber(tx: Tx, kind: "INCOME" | "EXPENSE", txnDate: string) {
  return nextCode(tx, documentPrefix(kind), txnDate.slice(0, 4));
}
