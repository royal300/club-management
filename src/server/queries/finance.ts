import "server-only";
import { and, asc, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, EVENT_STATUSES, events, expenseCategories, transactions, type PaymentMode } from "@/db/schema";
import { fyRange, fyStartYear, todayIST } from "@/lib/format";
import { isoDate, likeTerm, oneOf, PAGE_SIZE, pageParam, param, toPage, type SearchParams } from "./common";

const completed = eq(transactions.status, "COMPLETED");
const sumIncome = sql<string>`coalesce(sum(case when ${transactions.kind} = 'INCOME' then ${transactions.amount} else 0 end), 0)`;
const sumExpense = sql<string>`coalesce(sum(case when ${transactions.kind} = 'EXPENSE' then ${transactions.amount} else 0 end), 0)`;

/** All-time totals and per-mode balances (completed money only). */
export async function getBalances() {
  const rows = await db
    .select({ mode: transactions.mode, income: sumIncome, expense: sumExpense })
    .from(transactions)
    .where(completed)
    .groupBy(transactions.mode);
  const modes: Record<PaymentMode, { income: number; expense: number; balance: number }> = {
    CASH: { income: 0, expense: 0, balance: 0 },
    BANK: { income: 0, expense: 0, balance: 0 },
    UPI: { income: 0, expense: 0, balance: 0 },
  };
  for (const r of rows) {
    const income = Number(r.income);
    const expense = Number(r.expense);
    modes[r.mode] = { income, expense, balance: income - expense };
  }
  const income = Object.values(modes).reduce((a, m) => a + m.income, 0);
  const expense = Object.values(modes).reduce((a, m) => a + m.expense, 0);
  return { income, expense, balance: income - expense, modes };
}

export async function getPeriodTotals(from: string, to: string) {
  const [row] = await db
    .select({ income: sumIncome, expense: sumExpense, n: sql<number>`count(*)` })
    .from(transactions)
    .where(and(completed, gte(transactions.txnDate, from), lte(transactions.txnDate, to)));
  const income = Number(row?.income ?? 0);
  const expense = Number(row?.expense ?? 0);
  return { income, expense, net: income - expense, count: Number(row?.n ?? 0) };
}

export async function getPendingTotals() {
  const [row] = await db
    .select({
      receivable: sumIncome,
      payable: sumExpense,
      receivableCount: sql<number>`sum(case when ${transactions.kind} = 'INCOME' then 1 else 0 end)`,
      payableCount: sql<number>`sum(case when ${transactions.kind} = 'EXPENSE' then 1 else 0 end)`,
    })
    .from(transactions)
    .where(eq(transactions.status, "PENDING"));
  return {
    receivable: Number(row?.receivable ?? 0),
    payable: Number(row?.payable ?? 0),
    receivableCount: Number(row?.receivableCount ?? 0),
    payableCount: Number(row?.payableCount ?? 0),
  };
}

/** Month-by-month income and expense between two dates, gaps filled with zero. */
export async function getMonthlySeries(from: string, to: string) {
  const ym = sql<string>`date_format(${transactions.txnDate}, '%Y-%m')`;
  const rows = await db
    .select({ month: ym, income: sumIncome, expense: sumExpense })
    .from(transactions)
    .where(and(completed, gte(transactions.txnDate, from), lte(transactions.txnDate, to)))
    .groupBy(ym)
    .orderBy(ym);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const out: { month: string; income: number; expense: number; net: number }[] = [];
  const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const end = to.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= end) {
    const key = cursor.toISOString().slice(0, 7);
    const r = byMonth.get(key);
    const income = Number(r?.income ?? 0);
    const expense = Number(r?.expense ?? 0);
    out.push({ month: key, income, expense, net: income - expense });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

export async function getIncomeByCategory(from: string, to: string) {
  const rows = await db
    .select({ category: transactions.incomeCategory, total: sql<string>`sum(${transactions.amount})`, n: sql<number>`count(*)` })
    .from(transactions)
    .where(and(completed, eq(transactions.kind, "INCOME"), gte(transactions.txnDate, from), lte(transactions.txnDate, to)))
    .groupBy(transactions.incomeCategory)
    .orderBy(desc(sql`sum(${transactions.amount})`));
  return rows.map((r) => ({ category: r.category ?? "OTHER", total: Number(r.total), count: Number(r.n) }));
}

export async function getExpenseByCategory(from: string, to: string) {
  const rows = await db
    .select({ category: expenseCategories.name, total: sql<string>`sum(${transactions.amount})`, n: sql<number>`count(*)` })
    .from(transactions)
    .leftJoin(expenseCategories, eq(expenseCategories.id, transactions.expenseCategoryId))
    .where(and(completed, eq(transactions.kind, "EXPENSE"), gte(transactions.txnDate, from), lte(transactions.txnDate, to)))
    .groupBy(expenseCategories.name)
    .orderBy(desc(sql`sum(${transactions.amount})`));
  return rows.map((r) => ({ category: r.category ?? "Uncategorised", total: Number(r.total), count: Number(r.n) }));
}

/** Financial years that have any activity, newest first (always includes the current one). */
export async function getFinancialYears() {
  const [row] = await db
    .select({ min: sql<string | null>`min(${transactions.txnDate})` })
    .from(transactions);
  const current = fyStartYear(todayIST());
  const first = row?.min ? fyStartYear(row.min) : current;
  const years: number[] = [];
  for (let y = current; y >= first; y--) years.push(y);
  return years;
}

export async function getYearlySummary() {
  const years = await getFinancialYears();
  return Promise.all(
    years.map(async (y) => {
      const { from, to } = fyRange(y);
      return { year: y, ...(await getPeriodTotals(from, to)) };
    }),
  );
}

/* ---------------------------------------------------------------- Events */

export type EventFilters = {
  q?: string;
  status?: (typeof EVENT_STATUSES)[number];
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export function parseEventFilters(sp: SearchParams): EventFilters {
  return {
    q: param(sp, "q"),
    status: oneOf(param(sp, "status"), EVENT_STATUSES),
    from: isoDate(param(sp, "from")),
    to: isoDate(param(sp, "to")),
    page: pageParam(sp),
    pageSize: PAGE_SIZE,
  };
}

const eventMoney = {
  income: sql<string>`coalesce(sum(case when ${transactions.kind} = 'INCOME' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} else 0 end), 0)`,
  expense: sql<string>`coalesce(sum(case when ${transactions.kind} = 'EXPENSE' and ${transactions.status} = 'COMPLETED' then ${transactions.amount} else 0 end), 0)`,
  pending: sql<string>`coalesce(sum(case when ${transactions.status} = 'PENDING' and ${transactions.kind} = 'INCOME' then ${transactions.amount} else 0 end), 0)`,
  txnCount: sql<number>`count(${transactions.id})`,
};

export async function listEvents(f: EventFilters) {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(events.status, f.status));
  if (f.from) conds.push(gte(events.eventDate, f.from));
  if (f.to) conds.push(lte(events.eventDate, f.to));
  if (f.q) {
    const t = likeTerm(f.q);
    conds.push(or(like(events.name, t), like(events.venue, t), like(events.eventCode, t))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: events.id,
        eventCode: events.eventCode,
        name: events.name,
        eventDate: events.eventDate,
        venue: events.venue,
        budget: events.budget,
        status: events.status,
        ...eventMoney,
      })
      .from(events)
      .leftJoin(transactions, eq(transactions.eventId, events.id))
      .where(where)
      .groupBy(events.id)
      .orderBy(desc(events.eventDate))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)` }).from(events).where(where),
  ]);
  return toPage(
    rows.map((r) => ({
      ...r,
      income: Number(r.income),
      expense: Number(r.expense),
      pending: Number(r.pending),
      net: Number(r.income) - Number(r.expense),
      budget: r.budget == null ? null : Number(r.budget),
    })),
    Number(count!.n),
    f.page,
    f.pageSize,
  );
}

export type EventRow = Awaited<ReturnType<typeof listEvents>>["rows"][number];

export async function getEvent(id: number) {
  const [row] = await db
    .select({
      id: events.id,
      eventCode: events.eventCode,
      name: events.name,
      eventDate: events.eventDate,
      venue: events.venue,
      description: events.description,
      budget: events.budget,
      status: events.status,
      createdAt: events.createdAt,
      ...eventMoney,
    })
    .from(events)
    .leftJoin(transactions, eq(transactions.eventId, events.id))
    .where(eq(events.id, id))
    .groupBy(events.id)
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    income: Number(row.income),
    expense: Number(row.expense),
    pending: Number(row.pending),
    net: Number(row.income) - Number(row.expense),
    budget: row.budget == null ? null : Number(row.budget),
  };
}

export async function getEventCategoryBreakdown(eventId: number) {
  const rows = await db
    .select({
      kind: transactions.kind,
      income: transactions.incomeCategory,
      expense: expenseCategories.name,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(expenseCategories, eq(expenseCategories.id, transactions.expenseCategoryId))
    .where(and(eq(transactions.eventId, eventId), completed))
    .groupBy(transactions.kind, transactions.incomeCategory, expenseCategories.name)
    .orderBy(desc(sql`sum(${transactions.amount})`));
  return rows.map((r) => ({ kind: r.kind, label: (r.kind === "INCOME" ? r.income : r.expense) ?? "Other", total: Number(r.total) }));
}

/** Event-wise money for dashboard cards: recent and upcoming first. */
export async function getEventSummaries(limit = 5) {
  const page = await listEvents({ page: 1, pageSize: limit });
  return page.rows;
}

/* ---------------------------------------------------------------- Audit */

export type AuditFilters = { q?: string; entity?: string; action?: string; from?: string; to?: string; page: number; pageSize: number };

export function parseAuditFilters(sp: SearchParams): AuditFilters {
  return {
    q: param(sp, "q"),
    entity: param(sp, "entity"),
    action: param(sp, "action"),
    from: isoDate(param(sp, "from")),
    to: isoDate(param(sp, "to")),
    page: pageParam(sp),
    pageSize: 40,
  };
}

export async function listAudit(f: AuditFilters) {
  const conds: SQL[] = [];
  if (f.entity) conds.push(eq(auditLogs.entityType, f.entity));
  if (f.action) conds.push(eq(auditLogs.action, f.action));
  if (f.from) conds.push(gte(auditLogs.createdAt, new Date(`${f.from}T00:00:00+05:30`)));
  if (f.to) conds.push(lte(auditLogs.createdAt, new Date(`${f.to}T23:59:59+05:30`)));
  if (f.q) {
    const t = likeTerm(f.q);
    conds.push(or(like(auditLogs.summary, t), like(auditLogs.userName, t), like(auditLogs.entityId, t))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [count]] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(f.pageSize).offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)` }).from(auditLogs).where(where),
  ]);
  return toPage(rows, Number(count!.n), f.page, f.pageSize);
}

export async function auditFacets() {
  const [entities, actions] = await Promise.all([
    db.selectDistinct({ v: auditLogs.entityType }).from(auditLogs).orderBy(asc(auditLogs.entityType)),
    db.selectDistinct({ v: auditLogs.action }).from(auditLogs).orderBy(asc(auditLogs.action)),
  ]);
  return { entities: entities.map((e) => e.v), actions: actions.map((a) => a.v) };
}

export async function getEntityHistory(entityType: string, entityId: string | number, limit = 20) {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, String(entityId))))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit);
}
