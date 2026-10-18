"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { members, membershipTypes } from "@/db/schema";
import { todayIST } from "@/lib/format";
import { CollectFeeSchema, flattenErrors, formValues, MemberSchema, type ActionResult } from "@/lib/validation";
import { audit, diff } from "@/server/audit";
import { assertPermission, AuthError } from "@/server/auth";
import { recordTransaction } from "@/server/ledger";
import { nextCode } from "@/server/sequence";

function failure(err: unknown, values?: Record<string, string>): ActionResult {
  if (err instanceof AuthError) return { ok: false, message: err.message, values };
  console.error(err);
  return { ok: false, message: "Something went wrong while saving. Please try again.", values };
}

export async function createMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = formValues(formData);
  let newId: number;
  try {
    const user = await assertPermission("members:write");
    const parsed = MemberSchema.safeParse(values);
    const fee = CollectFeeSchema.safeParse(values);
    if (!parsed.success || !fee.success) {
      return { ok: false, errors: { ...(parsed.error ? flattenErrors(parsed.error) : {}), ...(fee.error ? flattenErrors(fee.error) : {}) }, values };
    }
    const m = parsed.data;
    const [type] = await db.select().from(membershipTypes).where(eq(membershipTypes.id, m.membershipTypeId));
    if (!type) return { ok: false, errors: { membershipTypeId: "Choose a membership type" }, values };
    if (fee.data.collectFee && !fee.data.feeMode) return { ok: false, errors: { feeMode: "How was the fee paid?" }, values };

    newId = await db.transaction(async (tx) => {
      const memberCode = await nextCode(tx, "MEM", m.joiningDate.slice(0, 4), 4);
      const [res] = await tx.insert(members).values({ ...m, memberCode, createdById: user.id });
      const id = res.insertId;
      await audit(tx, user, { action: "CREATE", entityType: "member", entityId: id, summary: `Member ${memberCode} ${m.fullName} added` });
      if (fee.data.collectFee && fee.data.feeMode) {
        await recordTransaction(
          tx,
          user,
          {
            kind: "INCOME",
            incomeCategory: "SUBSCRIPTION",
            amount: m.annualFee,
            txnDate: todayIST(),
            mode: fee.data.feeMode,
            referenceNo: fee.data.feeReference ?? null,
            partyName: m.fullName,
            memberId: id,
            description: `Annual subscription (${type.name}) collected at joining`,
            status: "COMPLETED",
          },
          { extendMembership: true },
        );
      }
      return id;
    });
  } catch (err) {
    return failure(err, values);
  }
  redirect(`/members/${newId}?welcome=1`);
}

export async function updateMember(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const values = formValues(formData);
  try {
    const user = await assertPermission("members:write");
    const parsed = MemberSchema.safeParse(values);
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
    const [before] = await db.select().from(members).where(eq(members.id, id));
    if (!before) return { ok: false, message: "That member no longer exists." };
    const changes = diff(before, parsed.data, ["fullName", "phone", "email", "address", "joiningDate", "membershipTypeId", "annualFee", "renewalDate", "notes"]);
    if (Object.keys(changes).length) {
      await db.transaction(async (tx) => {
        await tx.update(members).set(parsed.data).where(eq(members.id, id));
        await audit(tx, user, {
          action: "UPDATE",
          entityType: "member",
          entityId: id,
          summary: `Member ${before.memberCode} updated (${Object.keys(changes).join(", ")})`,
          changes,
        });
      });
    }
  } catch (err) {
    return failure(err, values);
  }
  redirect(`/members/${id}?saved=1`);
}

const ReasonSchema = z.object({ reason: z.string().trim().min(3, "Add a short reason").max(255) });

export async function deactivateMember(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("members:write");
    const parsed = ReasonSchema.safeParse(formValues(formData));
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
    const [before] = await db.select().from(members).where(eq(members.id, id));
    if (!before) return { ok: false, message: "That member no longer exists." };
    if (before.status === "INACTIVE") return { ok: true };
    await db.transaction(async (tx) => {
      await tx
        .update(members)
        .set({ status: "INACTIVE", deactivatedAt: new Date(), deactivationReason: parsed.data.reason })
        .where(eq(members.id, id));
      await audit(tx, user, {
        action: "DEACTIVATE",
        entityType: "member",
        entityId: id,
        summary: `Member ${before.memberCode} ${before.fullName} deactivated: ${parsed.data.reason}`,
        changes: { status: { from: "ACTIVE", to: "INACTIVE" } },
      });
    });
    refresh();
    return { ok: true, message: `${before.fullName} has been deactivated. Their history is kept.` };
  } catch (err) {
    return failure(err);
  }
}

export async function reactivateMember(id: number): Promise<ActionResult> {
  try {
    const user = await assertPermission("members:write");
    const [before] = await db.select().from(members).where(eq(members.id, id));
    if (!before) return { ok: false, message: "That member no longer exists." };
    await db.transaction(async (tx) => {
      await tx.update(members).set({ status: "ACTIVE", deactivatedAt: null, deactivationReason: null }).where(eq(members.id, id));
      await audit(tx, user, {
        action: "REACTIVATE",
        entityType: "member",
        entityId: id,
        summary: `Member ${before.memberCode} ${before.fullName} reactivated`,
        changes: { status: { from: "INACTIVE", to: "ACTIVE" } },
      });
    });
    refresh();
    return { ok: true, message: `${before.fullName} is active again.` };
  } catch (err) {
    return failure(err);
  }
}
