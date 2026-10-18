"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { attachments, events, expenseCategories, members, PAYMENT_MODES, transactions } from "@/db/schema";
import { formatINR, todayIST } from "@/lib/format";
import { flattenErrors, formValues, TransactionSchema, type ActionResult } from "@/lib/validation";
import { audit, diff } from "@/server/audit";
import { assertPermission, AuthError, type SessionUser } from "@/server/auth";
import { extendRenewal, issueDocumentNumber, recordTransaction } from "@/server/ledger";
import type { Tx } from "@/server/sequence";
import { removeStoredFile, storeFile, validateFiles, type ValidatedFile } from "@/server/uploads";

function failure(err: unknown, values?: Record<string, string>): ActionResult {
  if (err instanceof AuthError) return { ok: false, message: err.message, values };
  console.error(err);
  return { ok: false, message: "Something went wrong while saving. Nothing was recorded — please try again.", values };
}

async function checkReferences(data: { memberId: number | null; eventId: number | null; expenseCategoryId: number | null }) {
  const errors: Record<string, string> = {};
  if (data.memberId) {
    const [m] = await db.select({ id: members.id }).from(members).where(eq(members.id, data.memberId));
    if (!m) errors.memberId = "That member doesn't exist";
  }
  if (data.eventId) {
    const [e] = await db.select({ id: events.id }).from(events).where(eq(events.id, data.eventId));
    if (!e) errors.eventId = "That event doesn't exist";
  }
  if (data.expenseCategoryId) {
    const [c] = await db.select({ id: expenseCategories.id }).from(expenseCategories).where(eq(expenseCategories.id, data.expenseCategoryId));
    if (!c) errors.expenseCategoryId = "That category doesn't exist";
  }
  return errors;
}

async function attachFiles(tx: Tx, user: SessionUser, transactionId: number, stored: { file: ValidatedFile; storedName: string }[]) {
  if (!stored.length) return;
  await tx.insert(attachments).values(
    stored.map(({ file, storedName }) => ({
      transactionId,
      originalName: file.originalName,
      storedName,
      mimeType: file.mime,
      sizeBytes: file.size,
      uploadedById: user.id,
    })),
  );
  await audit(tx, user, {
    action: "ATTACH",
    entityType: "transaction",
    entityId: transactionId,
    summary: `${stored.length} file${stored.length > 1 ? "s" : ""} attached: ${stored.map((s) => s.file.originalName).join(", ")}`.slice(0, 255),
  });
}

export async function createTransaction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = formValues(formData);
  let id: number;
  const stored: { file: ValidatedFile; storedName: string }[] = [];
  try {
    const user = await assertPermission("transactions:write");
    const parsed = TransactionSchema.safeParse(values);
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
    const t = parsed.data;
    const refErrors = await checkReferences(t);
    if (Object.keys(refErrors).length) return { ok: false, errors: refErrors, values };
    if (t.txnDate > todayIST()) return { ok: false, errors: { txnDate: "The date can't be in the future" }, values };

    const files = await validateFiles(formData.getAll("files") as File[]);
    if (files.error) return { ok: false, errors: { files: files.error }, values };
    for (const file of files.files) stored.push({ file, storedName: await storeFile(file) });

    const result = await db.transaction(async (tx) => {
      const rec = await recordTransaction(
        tx,
        user,
        {
          kind: t.kind,
          incomeCategory: t.kind === "INCOME" ? t.incomeCategory : null,
          expenseCategoryId: t.kind === "EXPENSE" ? t.expenseCategoryId : null,
          amount: t.amount,
          txnDate: t.txnDate,
          mode: t.mode,
          status: t.status,
          dueDate: t.status === "PENDING" ? t.dueDate : null,
          referenceNo: t.referenceNo ?? null,
          partyName: t.partyName ?? null,
          description: t.description ?? null,
          memberId: t.memberId,
          eventId: t.eventId,
        },
        { extendMembership: t.kind === "INCOME" && t.incomeCategory === "SUBSCRIPTION" && t.extendMembership },
      );
      await attachFiles(tx, user, rec.id, stored);
      return rec;
    });
    id = result.id;
  } catch (err) {
    for (const s of stored) await removeStoredFile(s.storedName);
    return failure(err, values);
  }
  redirect(`/transactions/${id}?new=1`);
}

const EDITABLE = ["incomeCategory", "expenseCategoryId", "amount", "txnDate", "mode", "dueDate", "referenceNo", "partyName", "description", "memberId", "eventId"] as const;

export async function updateTransaction(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = formValues(formData);
  try {
    const user = await assertPermission("transactions:write");
    const [before] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!before) return { ok: false, message: "That entry no longer exists." };
    if (before.status === "VOID") return { ok: false, message: "Void entries can't be edited." };
    const parsed = TransactionSchema.safeParse({ ...values, kind: before.kind, status: before.status });
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
    const t = parsed.data;
    const refErrors = await checkReferences(t);
    if (Object.keys(refErrors).length) return { ok: false, errors: refErrors, values };
    if (t.txnDate > todayIST()) return { ok: false, errors: { txnDate: "The date can't be in the future" }, values };

    const next = {
      incomeCategory: before.kind === "INCOME" ? t.incomeCategory : null,
      expenseCategoryId: before.kind === "EXPENSE" ? t.expenseCategoryId : null,
      amount: t.amount,
      txnDate: t.txnDate,
      mode: t.mode,
      dueDate: before.status === "PENDING" ? t.dueDate : null,
      referenceNo: t.referenceNo ?? null,
      partyName: t.partyName ?? null,
      description: t.description ?? null,
      memberId: t.memberId,
      eventId: t.eventId,
    };
    const changes = diff(before, next, [...EDITABLE]);
    if (Object.keys(changes).length) {
      await db.transaction(async (tx) => {
        await tx.update(transactions).set({ ...next, updatedById: user.id }).where(eq(transactions.id, id));
        await audit(tx, user, {
          action: "UPDATE",
          entityType: "transaction",
          entityId: id,
          summary: `${before.txnCode} edited (${Object.keys(changes).join(", ")})`,
          changes,
        });
      });
    }
  } catch (err) {
    return failure(err, values);
  }
  redirect(`/transactions/${id}?saved=1`);
}

const SettleSchema = z.object({
  mode: z.enum(PAYMENT_MODES),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  referenceNo: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  extendMembership: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

/** Pending → completed: the money has now actually moved, so the receipt/voucher is issued. */
export async function settleTransaction(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("transactions:write");
    const parsed = SettleSchema.safeParse(formValues(formData));
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
    if (parsed.data.txnDate > todayIST()) return { ok: false, errors: { txnDate: "The date can't be in the future" } };
    const [before] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!before) return { ok: false, message: "That entry no longer exists." };
    if (before.status !== "PENDING") return { ok: false, message: "Only pending entries can be settled." };
    await db.transaction(async (tx) => {
      const receiptNo = await issueDocumentNumber(tx, before.kind, parsed.data.txnDate);
      await tx
        .update(transactions)
        .set({ status: "COMPLETED", receiptNo, mode: parsed.data.mode, txnDate: parsed.data.txnDate, referenceNo: parsed.data.referenceNo ?? before.referenceNo, updatedById: user.id })
        .where(eq(transactions.id, id));
      await audit(tx, user, {
        action: "SETTLE",
        entityType: "transaction",
        entityId: id,
        summary: `${before.txnCode} ${before.kind === "INCOME" ? "received" : "paid"} (${formatINR(before.amount)}) — ${receiptNo} issued`,
        changes: { status: { from: "PENDING", to: "COMPLETED" }, receiptNo: { from: null, to: receiptNo } },
      });
      if (parsed.data.extendMembership && before.memberId && before.incomeCategory === "SUBSCRIPTION") {
        await extendRenewal(tx, user, before.memberId, before.txnCode);
      }
    });
  } catch (err) {
    return failure(err);
  }
  redirect(`/transactions/${id}?new=1`);
}

const VoidSchema = z.object({ reason: z.string().trim().min(3, "Add a short reason").max(255) });

/** Entries are never deleted: voiding keeps the record (and its number) but removes it from balances. */
export async function voidTransaction(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("transactions:write");
    const parsed = VoidSchema.safeParse(formValues(formData));
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
    const [before] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!before) return { ok: false, message: "That entry no longer exists." };
    if (before.status === "VOID") return { ok: true };
    await db.transaction(async (tx) => {
      await tx.update(transactions).set({ status: "VOID", voidReason: parsed.data.reason, updatedById: user.id }).where(eq(transactions.id, id));
      await audit(tx, user, {
        action: "VOID",
        entityType: "transaction",
        entityId: id,
        summary: `${before.txnCode} voided: ${parsed.data.reason}`,
        changes: { status: { from: before.status, to: "VOID" } },
      });
    });
    refresh();
    return { ok: true, message: `${before.txnCode} is now void and no longer counts towards balances.` };
  } catch (err) {
    return failure(err);
  }
}

export async function addAttachments(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const stored: { file: ValidatedFile; storedName: string }[] = [];
  try {
    const user = await assertPermission("transactions:write");
    const [txn] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, id));
    if (!txn) return { ok: false, message: "That entry no longer exists." };
    const files = await validateFiles(formData.getAll("files") as File[]);
    if (files.error) return { ok: false, message: files.error };
    if (!files.files.length) return { ok: false, message: "Choose at least one file to upload." };
    for (const file of files.files) stored.push({ file, storedName: await storeFile(file) });
    await db.transaction(async (tx) => attachFiles(tx, user, id, stored));
    refresh();
    return { ok: true, message: `${stored.length} file${stored.length > 1 ? "s" : ""} uploaded.` };
  } catch (err) {
    for (const s of stored) await removeStoredFile(s.storedName);
    return failure(err);
  }
}
