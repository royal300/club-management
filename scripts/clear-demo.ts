// Empties the ledger so the club can start on real records: removes every member, event,
// transaction and attachment (rows and stored files), resets the receipt/member/event
// numbering, drops their audit entries and the demo Treasurer/Viewer logins.
// Keeps admins and other users, settings, membership types and expense categories.
//
// Dry run by default; pass --yes to delete. Demo and hand-entered records can't be told
// apart, so anything already entered through the app goes too — the dry run counts it.
import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and, inArray, notInArray, or, eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const { users, members, events, transactions, attachments, counters, auditLogs } = schema;

const DEMO_USER_EMAILS = ["treasurer@club.local", "viewer@club.local"];
const LEDGER_ENTITIES = ["member", "event", "transaction"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const confirmed = process.argv.includes("--yes");
  const pool = mysql.createPool({ uri: url, timezone: "Z", connectionLimit: 2 });
  const db = drizzle(pool, { schema, mode: "default" });

  const count = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const n = sql<number>`count(*)`.as("n");
  const ledgerAudit = or(
    inArray(auditLogs.entityType, LEDGER_ENTITIES),
    and(eq(auditLogs.entityType, "system"), eq(auditLogs.action, "SEED")),
  );
  const stats = {
    members: await count(db.select({ n }).from(members)),
    events: await count(db.select({ n }).from(events)),
    transactions: await count(db.select({ n }).from(transactions)),
    attachments: await count(db.select({ n }).from(attachments)),
    "audit entries": await count(db.select({ n }).from(auditLogs).where(ledgerAudit)),
    "demo users": await count(db.select({ n }).from(users).where(inArray(users.email, DEMO_USER_EMAILS))),
  };
  // Changes someone made through the app (the seed itself writes no per-record audit rows).
  const handEntered = await count(
    db
      .select({ n })
      .from(auditLogs)
      .where(and(inArray(auditLogs.entityType, LEDGER_ENTITIES), notInArray(auditLogs.action, ["EXPORT"]))),
  );

  console.log(confirmed ? "Clearing:" : "Would clear (dry run):");
  for (const [label, value] of Object.entries(stats)) console.log(`  ${label.padEnd(14)} ${value}`);
  if (handEntered > 0) {
    console.log(`  ! ${handEntered} change(s) were made through the app after seeding; they will be lost too.`);
  }
  if (!confirmed) {
    console.log("Run again with --yes to delete.");
    await pool.end();
    return;
  }

  const files = await db.select({ storedName: attachments.storedName }).from(attachments);
  await db.transaction(async (tx) => {
    await tx.delete(attachments);
    await tx.delete(transactions);
    await tx.delete(members);
    await tx.delete(events);
    await tx.delete(counters);
    await tx.delete(auditLogs).where(ledgerAudit);
    await tx.delete(users).where(inArray(users.email, DEMO_USER_EMAILS));
    await tx.insert(auditLogs).values({
      userName: "System",
      action: "RESET",
      entityType: "system",
      summary: `Ledger cleared: ${stats.members} members, ${stats.events} events, ${stats.transactions} transactions`,
    });
  });

  const dir = path.resolve(process.env.UPLOAD_DIR ?? "./.data/uploads");
  for (const f of files) await rm(path.join(dir, f.storedName), { force: true });

  console.log(`✓ ledger cleared (${files.length} stored file(s) removed from ${dir})`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
