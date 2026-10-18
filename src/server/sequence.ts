import { sql } from "drizzle-orm";
import type { DB } from "@/db";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Atomically take the next number of a named yearly sequence (e.g. TXN-2026).
 * Must run inside a transaction so a rollback also returns the number — keeps
 * receipt numbers gap-free for auditors.
 */
export async function nextSequence(tx: Tx, name: string): Promise<number> {
  await tx.execute(
    sql`INSERT INTO counters (name, value) VALUES (${name}, LAST_INSERT_ID(1))
        ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value + 1)`,
  );
  const [rows] = (await tx.execute(sql`SELECT LAST_INSERT_ID() AS v`)) as unknown as [
    Array<{ v: number | string }>,
  ];
  return Number(rows[0]!.v);
}

export function formatCode(prefix: string, year: number | string, n: number, width = 6) {
  return `${prefix}-${year}-${String(n).padStart(width, "0")}`;
}

export async function nextCode(tx: Tx, prefix: string, year: number | string, width = 6) {
  const n = await nextSequence(tx, `${prefix}-${year}`);
  return formatCode(prefix, year, n, width);
}

export type { Tx };
