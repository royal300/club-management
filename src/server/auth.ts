import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type Role } from "@/db/schema";
import { can, type Permission } from "@/lib/permissions";
import { clientIp, userAgent } from "./request";

export const SESSION_COOKIE = "club_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function secureCookies() {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    ip: await clientIp(),
    userAgent: await userAgent(),
  });
  // Opportunistic cleanup of long-dead sessions.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Current user for this request, or null. Deduplicated per render. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Session reads compare against the clock, so they always belong to a real request.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || !row.isActive) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: send users without the permission back to the dashboard. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard?denied=1");
  return user;
}

export class AuthError extends Error {}

/** For server actions and route handlers: throw instead of redirecting. */
export async function assertPermission(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Your session has expired. Please sign in again.");
  if (permission && !can(user.role, permission)) {
    throw new AuthError("You don't have permission to do that.");
  }
  return user;
}
