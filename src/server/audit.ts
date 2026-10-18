import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { SessionUser } from "./auth";
import { clientIp } from "./request";
import type { Tx } from "./sequence";

export type Changes = Record<string, { from: unknown; to: unknown }>;

/** Field-by-field diff of two records, limited to the given keys. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  keys: (keyof T)[],
): Changes {
  const out: Changes = {};
  for (const key of keys) {
    if (!(key in after)) continue;
    const a = normalise(before[key]);
    const b = normalise(after[key]);
    if (a !== b) out[key as string] = { from: a, to: b };
  }
  return out;
}

function normalise(v: unknown) {
  if (v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && /^-?\d+\.\d+$/.test(v)) return String(Number(v));
  return v as string | null;
}

export async function audit(
  executor: Tx | typeof db,
  user: SessionUser | null,
  entry: {
    action: string;
    entityType: string;
    entityId?: string | number | null;
    summary: string;
    changes?: Changes | null;
  },
) {
  await executor.insert(auditLogs).values({
    userId: user?.id ?? null,
    userName: user?.name ?? "System",
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId != null ? String(entry.entityId) : null,
    summary: entry.summary.slice(0, 255),
    changes: entry.changes && Object.keys(entry.changes).length ? entry.changes : null,
    ip: await clientIp().catch(() => null),
  });
}
