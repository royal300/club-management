"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { expenseCategories, membershipTypes, ROLES, sessions, settings, users } from "@/db/schema";
import { flattenErrors, formValues, passwordSchema, UserSchema, type ActionResult } from "@/lib/validation";
import { audit, diff } from "@/server/audit";
import { assertPermission, AuthError, getSessionUser, sha256, SESSION_COOKIE } from "@/server/auth";
import { SETTING_KEYS } from "@/server/settings";
import { cookies } from "next/headers";

function failure(err: unknown): ActionResult {
  if (err instanceof AuthError) return { ok: false, message: err.message };
  if ((err as { code?: string }).code === "ER_DUP_ENTRY") return { ok: false, message: "That name or email is already in use." };
  console.error(err);
  return { ok: false, message: "Something went wrong while saving. Please try again." };
}

/* ---------------------------------------------------------------- Club profile */

const SettingsSchema = z.object({
  club_name: z.string().trim().min(2, "Enter the club's name").max(80),
  club_tagline: z.string().trim().max(120),
  club_address: z.string().trim().max(300),
  club_phone: z.string().trim().max(40),
  club_email: z.string().trim().max(120),
  club_registration: z.string().trim().max(200),
  club_pan: z.string().trim().toUpperCase().max(20),
  receipt_footer: z.string().trim().max(300),
});

export async function saveClubSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("settings:write");
    const values = formValues(formData);
    const parsed = SettingsSchema.safeParse(values);
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values };
    const before = Object.fromEntries((await db.select().from(settings)).map((r) => [r.key, r.value]));
    const changes = diff(before, parsed.data, [...SETTING_KEYS]);
    if (Object.keys(changes).length) {
      await db.transaction(async (tx) => {
        for (const key of SETTING_KEYS) {
          await tx.insert(settings).values({ key, value: parsed.data[key] }).onDuplicateKeyUpdate({ set: { value: parsed.data[key] } });
        }
        await audit(tx, user, { action: "UPDATE", entityType: "settings", summary: `Club profile updated (${Object.keys(changes).join(", ")})`, changes });
      });
      updateTag("settings");
    }
    return { ok: true, message: "Club profile saved. Receipts will use the new details." };
  } catch (err) {
    return failure(err);
  }
}

/* ---------------------------------------------------------------- Membership types */

const TypeSchema = z.object({
  name: z.string().trim().min(2, "Name the membership type").max(80),
  annualFee: z
    .string()
    .trim()
    .transform((v) => v.replace(/[₹,\s]/g, ""))
    .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter a fee in rupees")
    .transform((v) => Number(v).toFixed(2)),
  description: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => v || null),
  isActive: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function saveMembershipType(id: number | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("settings:write");
    const parsed = TypeSchema.safeParse({ isActive: id ? undefined : "on", ...formValues(formData) });
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
    if (id) {
      const [before] = await db.select().from(membershipTypes).where(eq(membershipTypes.id, id));
      if (!before) return { ok: false, message: "That type no longer exists." };
      const changes = diff(before, parsed.data, ["name", "annualFee", "description", "isActive"]);
      await db.update(membershipTypes).set(parsed.data).where(eq(membershipTypes.id, id));
      if (Object.keys(changes).length)
        await audit(db, user, { action: "UPDATE", entityType: "membership_type", entityId: id, summary: `Membership type "${parsed.data.name}" updated`, changes });
    } else {
      const [res] = await db.insert(membershipTypes).values(parsed.data);
      await audit(db, user, { action: "CREATE", entityType: "membership_type", entityId: res.insertId, summary: `Membership type "${parsed.data.name}" added` });
    }
    refresh();
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure(err);
  }
}

/* ---------------------------------------------------------------- Expense categories */

export async function addExpenseCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertPermission("settings:write");
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 80) return { ok: false, errors: { name: "Use 2–80 characters" } };
    const [res] = await db.insert(expenseCategories).values({ name });
    await audit(db, user, { action: "CREATE", entityType: "expense_category", entityId: res.insertId, summary: `Expense category "${name}" added` });
    refresh();
    return { ok: true, message: `"${name}" added.` };
  } catch (err) {
    return failure(err);
  }
}

export async function toggleExpenseCategory(id: number): Promise<ActionResult> {
  try {
    const user = await assertPermission("settings:write");
    const [c] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
    if (!c) return { ok: false, message: "Not found." };
    await db.update(expenseCategories).set({ isActive: !c.isActive }).where(eq(expenseCategories.id, id));
    await audit(db, user, {
      action: "UPDATE",
      entityType: "expense_category",
      entityId: id,
      summary: `Expense category "${c.name}" ${c.isActive ? "hidden" : "restored"}`,
      changes: { isActive: { from: c.isActive, to: !c.isActive } },
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/* ---------------------------------------------------------------- Users */

function tempPassword() {
  // Readable, strong enough for a one-time hand-over: e.g. "Club-7fK2-x9Qm-4Rta"
  const raw = randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
  return `Club-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export type UserActionResult = (NonNullable<ActionResult> & { password?: string; email?: string }) | undefined;

export async function createUser(_prev: UserActionResult, formData: FormData): Promise<UserActionResult> {
  try {
    const admin = await assertPermission("users:manage");
    const parsed = UserSchema.safeParse(formValues(formData));
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
    const password = tempPassword();
    const [res] = await db.insert(users).values({ ...parsed.data, passwordHash: await bcrypt.hash(password, 12) });
    await audit(db, admin, { action: "CREATE", entityType: "user", entityId: res.insertId, summary: `User ${parsed.data.email} added as ${parsed.data.role}` });
    refresh();
    return { ok: true, message: `${parsed.data.name} can now sign in.`, password, email: parsed.data.email };
  } catch (err) {
    return failure(err);
  }
}

const RoleSchema = z.object({ role: z.enum(ROLES) });

export async function updateUserRole(id: number, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertPermission("users:manage");
    if (id === admin.id) return { ok: false, message: "You can't change your own role." };
    const parsed = RoleSchema.safeParse(formValues(formData));
    if (!parsed.success) return { ok: false, message: "Choose a valid role." };
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u) return { ok: false, message: "User not found." };
    if (u.role === parsed.data.role) return { ok: true };
    await db.update(users).set({ role: parsed.data.role }).where(eq(users.id, id));
    await audit(db, admin, { action: "UPDATE", entityType: "user", entityId: id, summary: `${u.email} is now ${parsed.data.role}`, changes: { role: { from: u.role, to: parsed.data.role } } });
    refresh();
    return { ok: true, message: `${u.name} is now a ${parsed.data.role.toLowerCase()}.` };
  } catch (err) {
    return failure(err);
  }
}

export async function toggleUserActive(id: number): Promise<ActionResult> {
  try {
    const admin = await assertPermission("users:manage");
    if (id === admin.id) return { ok: false, message: "You can't disable your own account." };
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u) return { ok: false, message: "User not found." };
    await db.transaction(async (tx) => {
      await tx.update(users).set({ isActive: !u.isActive }).where(eq(users.id, id));
      if (u.isActive) await tx.delete(sessions).where(eq(sessions.userId, id));
      await audit(tx, admin, {
        action: u.isActive ? "DEACTIVATE" : "REACTIVATE",
        entityType: "user",
        entityId: id,
        summary: `${u.email} ${u.isActive ? "disabled" : "re-enabled"}`,
        changes: { isActive: { from: u.isActive, to: !u.isActive } },
      });
    });
    refresh();
    return { ok: true, message: `${u.name} ${u.isActive ? "can no longer sign in" : "can sign in again"}.` };
  } catch (err) {
    return failure(err);
  }
}

export async function resetUserPassword(id: number): Promise<UserActionResult> {
  try {
    const admin = await assertPermission("users:manage");
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u) return { ok: false, message: "User not found." };
    const password = tempPassword();
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eq(users.id, id));
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await audit(tx, admin, { action: "RESET_PASSWORD", entityType: "user", entityId: id, summary: `Password reset for ${u.email}` });
    });
    return { ok: true, message: `New temporary password for ${u.name}.`, password, email: u.email };
  } catch (err) {
    return failure(err);
  }
}

/* ---------------------------------------------------------------- My account */

const ChangePasswordSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), next: passwordSchema, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The new passwords don't match" });

export async function changeOwnPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const me = await getSessionUser();
    if (!me) return { ok: false, message: "Your session has expired. Please sign in again." };
    const parsed = ChangePasswordSchema.safeParse(formValues(formData));
    if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
    const [u] = await db.select().from(users).where(eq(users.id, me.id));
    if (!u || !(await bcrypt.compare(parsed.data.current, u.passwordHash))) return { ok: false, errors: { current: "That isn't your current password" } };
    const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: await bcrypt.hash(parsed.data.next, 12) }).where(eq(users.id, me.id));
      // Sign out every other device.
      await tx.delete(sessions).where(and(eq(sessions.userId, me.id), ne(sessions.id, sha256(token))));
      await audit(tx, me, { action: "CHANGE_PASSWORD", entityType: "user", entityId: me.id, summary: `${me.email} changed their password` });
    });
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  } catch (err) {
    return failure(err);
  }
}
