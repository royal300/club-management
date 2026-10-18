"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { loginAttempts, users } from "@/db/schema";
import { audit } from "@/server/audit";
import { createSession, destroySession, getSessionUser, sha256 } from "@/server/auth";
import { clientIp } from "@/server/request";

export type LoginState = { error?: string; email?: string } | undefined;

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = "$2b$12$K.aYLcAi5gIpS5Z6r6d93./cJWFsrGty.2I3qQrw9fC8Db9xKkFfS";
const WINDOW_MINUTES = 15;
const MAX_PER_ACCOUNT = 5;
const MAX_PER_IP = 25;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, email };

  const ip = await clientIp();
  const accountKey = sha256(`acct:${parsed.data.email}|${ip}`);
  const ipKey = sha256(`ip:${ip}`);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  const failures = async (keyHash: string) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.keyHash, keyHash), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
    return Number(row?.n ?? 0);
  };
  if ((await failures(accountKey)) >= MAX_PER_ACCOUNT || (await failures(ipKey)) >= MAX_PER_IP) {
    return { error: `Too many attempts. Please wait ${WINDOW_MINUTES} minutes and try again.`, email };
  }

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok || !user.isActive) {
    await db.insert(loginAttempts).values([
      { keyHash: accountKey, success: false },
      { keyHash: ipKey, success: false },
    ]);
    if (user) {
      await audit(db, null, {
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user.id,
        summary: `Failed sign-in for ${user.email}${user.isActive ? "" : " (disabled account)"}`,
      });
    }
    return { error: "That email and password don't match our records.", email };
  }

  await db.insert(loginAttempts).values({ keyHash: accountKey, success: true });
  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await audit(db, { id: user.id, name: user.name, email: user.email, role: user.role }, {
    action: "LOGIN",
    entityType: "user",
    entityId: user.id,
    summary: `${user.name} signed in`,
  });

  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  const user = await getSessionUser();
  if (user) {
    await audit(db, user, { action: "LOGOUT", entityType: "user", entityId: user.id, summary: `${user.name} signed out` });
  }
  await destroySession();
  redirect("/login");
}
